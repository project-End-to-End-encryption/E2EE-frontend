// features/conversation/group/groupMembershipSync.js
import { rpc } from '../../../infrastructure/websocket/socketRpc.js';
import { SOCKET_EVENTS } from '../../../shared/constants/socketEvents.js';
import { conversationRepo } from '../../../infrastructure/storage/repos.js';
import { authStore } from '../../auth/storage/authStore.js';
import { conversationService } from '../service/conversationService.js';
import { GroupSessionManager } from './GroupSessionManager.js';
import { senderKeyStorage } from '../../../infrastructure/crypto/storage/senderKeyStorage.js';

let attachedSocket = null;

export function registerGroupMembershipListeners(socket) {
    if (attachedSocket === socket) return;   // idempotent across reconnects on the same socket
    attachedSocket = socket;

    socket.on(SOCKET_EVENTS.CONVERSATION_UPDATED, (evt) => {
        void handleConversationUpdated(evt).catch((err) =>
            console.warn('[groupMembershipSync]', err?.message));
    });
}

export function resetGroupMembershipSync() {
    attachedSocket = null;
}

async function handleConversationUpdated({ conversationId, change, userId: subjectUserId, keyEpoch }) {
    const conversation = await conversationRepo.get(conversationId);
    if (!conversation || conversation.type !== 'group') return;
    if (String(subjectUserId) === String(authStore.getUserId())) return;

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