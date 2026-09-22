import { rpc } from '../../../infrastructure/websocket/socketRpc.js';
import { SOCKET_EVENTS } from '../../../shared/constants/socketEvents.js';
import { conversationRepo } from '../../../infrastructure/storage/repos.js';
import { bus, TOPICS } from '../../../infrastructure/websocket/eventBus.js';
import { authStore } from '../../auth/storage/authStore.js';
import { conversationService, normaliseRow } from '../service/conversationService.js';
import { GroupSessionManager } from './GroupSessionManager.js';
import { senderKeyStorage } from '../../../infrastructure/crypto/storage/senderKeyStorage.js';

let attachedSocket = null;

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

    // Land the fresh row + notify the sidebar FIRST, unconditionally — this
    // is what was missing. Runs for every member's device, not just the
    // one that clicked add/remove, and also covers a brand-new member
    // seeing the group appear without a reload.
    if (patch) {
        await conversationRepo.applySync({ conversations: [normaliseRow(patch)] });
    }
    bus.emit(TOPICS.SIDEBAR_CHANGED, { conversationId, mode: 'updated' });

    if (change === 'memberRemoved' && isSelf) return;  // I'm out, nothing to rotate
    if (change === 'memberAdded' && isSelf) return;     // I receive a key, I don't send one to myself

    const conversation = await conversationRepo.get(conversationId);
    if (!conversation || conversation.type !== 'group') return;

    if (change === 'memberAdded') {
        const devices = (await fetchMemberDevices(conversationId))
            .filter((d) => String(d.userId) === String(subjectUserId));
        if (!devices.length) return;

        const own = await senderKeyStorage.getOwnSenderKey(conversationId);
        if (own) await GroupSessionManager.distributeSenderKey({ conversationId, memberDevices: devices });

        await conversationService.pushArchiveKey(conversationId, conversation.keyEpoch ?? 1);
    }

    if (change === 'memberRemoved') {
        await conversationService.ensureArchiveKey({ ...conversation, keyEpoch });
        const devices = await fetchMemberDevices(conversationId);
        await GroupSessionManager.rotateSenderKey({ conversationId, memberDevices: devices });
    }
}

async function fetchMemberDevices(conversationId) {
    const { devices } = await rpc(SOCKET_EVENTS.CONVERSATION_MEMBER_DEVICES, {
        conversationId, includeOwnOtherDevices: true
    });
    return devices;
}

export default { registerGroupMembershipListeners, resetGroupMembershipSync };