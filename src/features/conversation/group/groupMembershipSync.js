import { rpc } from '../../../infrastructure/websocket/socketRpc.js';
import { SOCKET_EVENTS } from '../../../shared/constants/socketEvents.js';
import { conversationRepo } from '../../../infrastructure/storage/repos.js';
import { bus, TOPICS } from '../../../infrastructure/websocket/eventBus.js';
import { authStore } from '../../auth/storage/authStore.js';
import { conversationService, normaliseRow } from '../service/conversationService.js';
import { GroupSessionManager } from './GroupSessionManager.js';
import { senderKeyStorage } from '../../../infrastructure/crypto/storage/senderKeyStorage.js';

let attachedSocket = null;

const PER_USER_FIELDS = [
    'lastReadSeq', 'lastDeliveredSeq', 'unreadCount',
    'clearedBeforeSeq', 'isPinned', 'isArchived', 'mutedUntil'
];

export function registerGroupMembershipListeners(socket) {
    if (attachedSocket === socket) return;
    attachedSocket = socket;
    socket.on(SOCKET_EVENTS.CONVERSATION_UPDATED, (evt) => {
        void handleConversationUpdated(evt).catch((err) =>
            console.warn('[groupMembershipSync]', err?.message));
    });
}

export function resetGroupMembershipSync() {
    attachedSocket = null;
}

async function handleConversationUpdated({ conversationId, change, userId: subjectUserId, keyEpoch, conversation: patch }) {
    const isSelf = String(subjectUserId) === String(authStore.getUserId());

    if (patch) {
        const row = normaliseRow(patch);

        // Keep this user's own state; only take shared fields from the server row
        const existing = await conversationRepo.get(conversationId);
        if (existing) {
            for (const field of PER_USER_FIELDS) row[field] = existing[field] ?? row[field];
        }

        // The event's keyEpoch is authoritative. The broadcast row may carry the old one.
        if (keyEpoch != null) row.keyEpoch = Number(keyEpoch);

        await conversationRepo.applySync({ conversations: [row] });
    }
    bus.emit(TOPICS.SIDEBAR_CHANGED, { conversationId, mode: 'updated' });

    if (isSelf) return;   // I was added (I receive keys) or removed (nothing to rotate)

    const conversation = await conversationRepo.get(conversationId);
    if (!conversation || conversation.type !== 'group') return;

    if (change === 'memberAdded') {
        // Every member device sends ITS OWN sender key to the newcomer, so this
        // must run everywhere. The archive key is NOT pushed here: the device
        // that clicked "add" already does that in conversationService.addMember.
        const devices = (await fetchMemberDevices(conversationId))
            .filter((d) => String(d.userId) === String(subjectUserId));
        if (!devices.length) return;

        const own = await senderKeyStorage.getOwnSenderKey(conversationId);
        if (own) await GroupSessionManager.distributeSenderKey({ conversationId, memberDevices: devices });
    }

    if (change === 'memberRemoved') {
        if (keyEpoch == null) return;   // without the new epoch we can't rekey safely

        // 1) Sender keys first: this is what protects live group traffic.
        //    Isolated so an archive-key problem can never skip it.
        try {
            const devices = await fetchMemberDevices(conversationId);
            await GroupSessionManager.rotateSenderKey({ conversationId, memberDevices: devices });
        } catch (err) {
            console.error('[groupMembershipSync] sender key rotation FAILED:', err?.message);
        }

        // 2) Archive key for the new epoch. Every remaining device calls this;
        //    the server's mint claim picks ONE minter and the rest return
        //    'awaitingKey' and receive the key by envelope.
        try {
            await conversationService.ensureArchiveKey({ ...conversation, keyEpoch: Number(keyEpoch) });
        } catch (err) {
            console.error('[groupMembershipSync] archive rekey FAILED:', err?.message);
        }
    }
}
async function fetchMemberDevices(conversationId) {
    const { devices } = await rpc(SOCKET_EVENTS.CONVERSATION_MEMBER_DEVICES, {
        conversationId, includeOwnOtherDevices: true
    });
    return devices;
}

export default { registerGroupMembershipListeners, resetGroupMembershipSync };