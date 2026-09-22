import webSocketClient from '../infrastructure/websocket/WebSocketClient.js';
import { bus, TOPICS } from '../infrastructure/websocket/eventBus.js';
import { sidebarSync } from '../features/sync/sidebarSync.js';
import { messageSync } from '../features/sync/messageSync.js';
import { messageComposer } from '../features/conversation/service/messageComposer.js';
import { archiveCrypto } from '../features/conversation/service/archiveCrypto.js';
import { mbkStore } from '../features/recovery/mbkStore.js';
import { generateAndRegisterKeys } from '../features/auth/service/keyBundle.js';
import { metaRepo, META_KEYS } from '../infrastructure/storage/repos.js';
import { clearCache } from '../infrastructure/storage/db.js';
import { registerGroupMembershipListeners, resetGroupMembershipSync } from '../features/conversation/group/groupMembershipSync.js';
// import { callSignaling } from '../features/calls/callSignaling.js';   // v2



let started = false;

export async function bootstrapSession({ isNewDevice = false } = {}) {
    if (started) return;
    started = true;

    bus.emit(TOPICS.CONNECTION_STATE, 'connecting');

    const hasLocalMbk = await mbkStore.init();


    // --- 1. socket ----------------------------------------------------------
    const socket = await webSocketClient.connect();

    // --- 2. listeners FIRST -------------------------------------------------
    // Register before syncing. If you sync first, every message:envelope that
    // arrives during the sync has no listener and is silently discarded - and
    // because the server already delivered it, it will not be queued either.
    // That is a permanently lost message and it only shows up under load.
    sidebarSync.registerSidebarListeners(socket);
    messageSync.registerMessageListeners(socket);
    registerGroupMembershipListeners(socket);
    // callSignaling.register(socket);          // v2: one line, nothing else changes

    registerConnectionLifecycle(socket);

    // --- 3. make sure this device is addressable ----------------------------
    await generateAndRegisterKeys(socket);

    // --- 4. the UI is usable from here. Paint from IndexedDB. ---------------
    bus.emit(TOPICS.SIDEBAR_CHANGED, { mode: 'cache' });
    bus.emit(TOPICS.CONNECTION_STATE, 'online');
    bus.emit(TOPICS.MBK_STATE, hasLocalMbk ? 'ready' : 'missing');


    // --- 5-7. catch up, in the background -----------------------------------
    // Not awaited by the caller: a slow sync must never hold up first paint.
    void catchUp({ isNewDevice });
}

async function catchUp({ isNewDevice }) {
    try {
        // Offline transport queue first. These are real messages that were sent
        // while we were away, and they must land before the sidebar is
        // reconciled - otherwise the sidebar shows an unread count for messages
        // that are not in the local store yet, and the chat looks empty.
        await messageSync.drainEnvelopes();

        await sidebarSync.run();

        await messageComposer.flushOutbox();

        // New device: pull and unwrap every archive key so history is readable.
        // Needs the MBK, so it is guarded.
        if (isNewDevice && mbkStore.has()) {
            await archiveCrypto.restoreAllKeys({
                onProgress: ({ done }) => bus.emit(TOPICS.SYNC_PROGRESS, { phase: 'archiveKeys', done })
            });
        }

        await metaRepo.set(META_KEYS.BOOTSTRAPPED_AT, Date.now());
        bus.emit(TOPICS.SYNC_COMPLETE, { phase: 'bootstrap' });

    } catch (error) {
        bus.emit(TOPICS.SYNC_FAILED, { phase: 'bootstrap', error });
        console.error('[bootstrap] catch-up failed:', error);
    }
}


function registerConnectionLifecycle(socket) {
    socket.on('connect', async () => {
        bus.emit(TOPICS.CONNECTION_STATE, 'online');
        // Re-run the catch-up: we may have missed envelopes while disconnected.
        await messageSync.drainEnvelopes().catch(() => {});
        await sidebarSync.run().catch(() => {});
        await messageComposer.flushOutbox().catch(() => {});
    });

    socket.on('disconnect', (reason) => {
        bus.emit(TOPICS.CONNECTION_STATE, 'offline');
        console.debug('[socket] disconnected:', reason);
    });

    // Tab came back to the foreground. Mobile browsers suspend sockets
    // aggressively, so a "connected" socket after a background period is often
    // a zombie - syncing is how you find out.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            sidebarSync.run().catch(() => {});
        }
    });

    // The token refresh path in WebSocketClient dispatches this on hard auth
    // failure.
    window.addEventListener('auth:logout', () => { void teardownSession(); });
}


export async function teardownSession() {
    started = false;
    await mbkStore.clear({ persistent: true });
    bus.clear();
    await clearCache();
    resetGroupMembershipSync();
    webSocketClient.getSocket()?.disconnect();
}


export async function onRecoveryKeyLoaded() {
    await archiveCrypto.restoreAllKeys({
        onProgress: ({ done }) => bus.emit(TOPICS.SYNC_PROGRESS, { phase: 'archiveKeys', done })
    });
    bus.emit(TOPICS.SYNC_COMPLETE, { phase: 'archiveKeys' });
}