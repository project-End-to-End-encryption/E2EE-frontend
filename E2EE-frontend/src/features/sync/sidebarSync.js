import {rpc, rpcWithRetry} from "../../infrastructure/websocket/socketRpc.js";
import {SOCKET_EVENTS} from "../../shared/constants/socketEvents.js";
import {conversationRepo, metaRepo, META_KEYS} from "../../infrastructure/storage/repos.js";
import {bus, TOPICS} from "../../infrastructure/websocket/eventBus.js";
import { authStore } from "../auth/storage/authStore.js";

export const SIDEBAR_SCHEMA_VERSION = 1;

const MAX_PAGES = 200;   // 200 * 100 rows = 20k conversations. Loop guard.

let inFlight = null;

export async function run({force = false} = {}){
    if (inFlight) return inFlight;

    inFlight = (async ()=>{
        bus.emit(TOPICS.SYNC_STARTED, {phase: 'sidebar'});

        try{
            let since = force ? null : await metaRepo.get(META_KEYS.SIDEBAR_CURSOR, null);
            const storedSchema = await metaRepo.get(META_KEYS.SIDEBAR_SCHEMA, null);

            if(storedSchema !== null && storedSchema !== SIDEBAR_SCHEMA_VERSION) since = null;

            let afterId = null;
            let pages = 0;
            let changed = 0;
            let finalCursor = since;
            let mode = null;

            while(pages < MAX_PAGES){
                pages += 1;

                const ack = await rpcWithRetry(SOCKET_EVENTS.SIDEBAR_SYNC, {
                    since,
                    afterId,
                    schemaVersion: SIDEBAR_SCHEMA_VERSION
                });
                mode = ack.mode;

                if (ack.upToDate) break;

                if (ack.mode === 'full' && pages === 1) {
                    await clearConversationsOnly();
                }

                await conversationRepo.applySync({
                    conversations: ack.conversations,
                    removed: ack.removed,
                    // cursor written on the LAST page only - see comment above
                    cursor: ack.hasMore ? null : ack.cursor,
                    schemaVersion: ack.hasMore ? null : ack.schemaVersion
                });

                changed += ack.conversations.length + ack.removed.length;
                finalCursor = ack.cursor;

                for (const id of ack.removed) {
                    bus.emit(TOPICS.CONVERSATION_REMOVED, { conversationId: id });
                }

                bus.emit(TOPICS.SYNC_PROGRESS, {
                    phase: 'sidebar',
                    mode: ack.mode,
                    done: changed
                });

                if (!ack.hasMore) break;

                if (ack.mode === 'full') {
                    afterId = ack.nextAfterId;
                } else {
                    since = ack.cursor;
                    afterId = null;
                }
            }
            if (changed > 0) bus.emit(TOPICS.SIDEBAR_CHANGED, { count: changed, mode });
            bus.emit(TOPICS.SYNC_COMPLETE, { phase: 'sidebar', changed, mode });

            return { changed, cursor: finalCursor, mode };
        } catch (error){
            bus.emit(TOPICS.SYNC_FAILED, { phase: 'sidebar', error });
            console.warn('[sidebarSync] failed, keeping cached sidebar:', error.code || error.message);
            return { changed: 0, error };
        } finally {
            inFlight = null;
        }
    })();
    return inFlight;
}

export function registerSidebarListeners(socket) {
    socket.on(SOCKET_EVENTS.SIDEBAR_PATCH, async ({ conversation }) => {
        if (!conversation?._id) return;
        await conversationRepo.applySync({ conversations: [conversation] });
        bus.emit(TOPICS.SIDEBAR_CHANGED, { count: 1, mode: 'patch' });
    });

    socket.on(SOCKET_EVENTS.CONVERSATION_CREATED, async ({ conversation }) => {
        if (!conversation?._id) return;
        await conversationRepo.applySync({ conversations: [normaliseServerRow(conversation)] });
        bus.emit(TOPICS.SIDEBAR_CHANGED, { count: 1, mode: 'created' });
    });

    // Membership / rekey notifications.
    socket.on(SOCKET_EVENTS.CONVERSATION_UPDATED, async (payload) => {
        const { conversationId, change, keyEpoch, rekeyRequired } = payload;

        if (change === 'memberRemoved' && rekeyRequired) {

            bus.emit(TOPICS.SIDEBAR_CHANGED, { conversationId, keyEpoch, rekeyRequired: true });
        }


        await run();
    });

    socket.on(SOCKET_EVENTS.MESSAGE_NEW, async ({ conversationId, seq, sentAt, senderId, contentType }) => {
        const countsAsUnread =
            String(senderId) !== String(safeSelfId()) && contentType !== 'system';

        await conversationRepo.applyIncoming(conversationId, { seq, sentAt, countsAsUnread });
        bus.emit(TOPICS.SIDEBAR_CHANGED, { conversationId, mode: 'messageNew' });
    });
}

function normaliseServerRow(conversation) {
    return {
        _id: String(conversation._id),
        type: conversation.type,
        name: conversation.name ?? null,
        avatarKey: conversation.avatarKey ?? null,
        createdBy: conversation.createdBy,
        memberIds: conversation.memberIds ?? [],
        lastSeq: conversation.lastSeq ?? 0,
        lastMessageAt: conversation.lastMessageAt ?? null,
        keyEpoch: conversation.keyEpoch ?? 1,
        lastReadSeq: 0,
        lastDeliveredSeq: 0,
        unreadCount: 0,
        clearedBeforeSeq: 0,
        isPinned: false,
        isArchived: false,
        mutedUntil: null,
        rev: Date.now()
    };
}

async function clearConversationsOnly() {
    const { STORES, tx } = await import('../../infrastructure/storage/db.js');
    await tx([STORES.CONVERSATIONS], 'readwrite', (stores) => {
        stores[STORES.CONVERSATIONS].clear();
    });
}

export async function markRead(conversationId, seq) {
    await conversationRepo.patch(conversationId, { lastReadSeq: seq, unreadCount: 0 });
    bus.emit(TOPICS.SIDEBAR_CHANGED, { conversationId, mode: 'read' });

    try {
        await rpc(SOCKET_EVENTS.MESSAGE_READ, { conversationId, seq });
    } catch (error) {
        // Offline: the next sidebar:sync returns the server's real value and
        // overwrites our optimistic one. Nothing to repair by hand.
        console.debug('[sidebarSync] read receipt deferred:', error.code);
    }
}

function safeSelfId() {
    try { return authStore.getUserId(); }   // throws when logged out
    catch { return null; }
}

export const sidebarSync = { run, registerSidebarListeners, markRead, SIDEBAR_SCHEMA_VERSION };