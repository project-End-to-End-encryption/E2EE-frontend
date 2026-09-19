import { rpc } from '../../../infrastructure/websocket/socketRpc.js';
import { SOCKET_EVENTS } from '../../../shared/constants/socketEvents.js';
import { conversationRepo, archiveKeyRepo } from '../../../infrastructure/storage/repos.js';
import { bus, TOPICS } from '../../../infrastructure/websocket/eventBus.js';
import { authStore } from '../../auth/storage/authStore.js';
import { archiveCrypto } from './archiveCrypto.js';
import { SessionManager } from './session/SessionManager.js';
import { bufferToBase64 } from '../../../shared/utils/encoding.js';
import { ERROR_CODES } from '../../../shared/constants/errorCodes.js';

/**
 * CONVERSATION SERVICE
 *
 * The UI layer's entry point for "open a chat with this person". Two jobs:
 *
 *   1. get (or create) the conversation without ever creating a second one
 *   2. make sure a Conversation Archive Key exists before anyone can type
 *
 * DUPLICATE PREVENTION, two independent guards:
 *
 *   server  ConversationRepository.findOrCreateDirect + the unique partial
 *           index on `directKey` in conversation.model.js. This is the one
 *           that actually holds: two devices racing both get the same row.
 *   client  a local cache check first, so the common case does not even make
 *           the round trip.
 *
 * ARCHIVE KEY, why it is here:
 *
 * archiveCrypto.encryptArchive throws NO_ARCHIVE_KEY when a conversation has
 * no CAK, so a brand-new chat cannot send its first message until one exists.
 * The minter is deterministic - the lowest member id, the same rule
 * archiveCrypto.rotateForConversation already uses - so both sides agree on
 * who mints without any negotiation, and the other side receives it over the
 * existing 'archiveKey' envelope kind that messageSync already routes.
 */

const normaliseRow = (conversation) => ({
    _id: String(conversation._id),
    type: conversation.type,
    name: conversation.name ?? null,
    avatarKey: conversation.avatarKey ?? null,
    createdBy: conversation.createdBy,
    memberIds: (conversation.memberIds ?? []).map(String),
    lastSeq: conversation.lastSeq ?? 0,
    lastMessageAt: conversation.lastMessageAt ?? null,
    keyEpoch: conversation.keyEpoch ?? 1,
    lastReadSeq: conversation.lastReadSeq ?? 0,
    lastDeliveredSeq: conversation.lastDeliveredSeq ?? 0,
    unreadCount: conversation.unreadCount ?? 0,
    clearedBeforeSeq: conversation.clearedBeforeSeq ?? 0,
    isPinned: conversation.isPinned ?? false,
    isArchived: conversation.isArchived ?? false,
    mutedUntil: conversation.mutedUntil ?? null,
    rev: Date.now()
});

/** The local sidebar already knows about this peer? Then reuse that row. */
async function findLocalDirect(peerUserId) {
    const selfId = safeSelfId();
    const rows = await conversationRepo.list({ includeArchived: true });

    return rows.find((row) =>
        row.type === 'direct' &&
        (row.memberIds ?? []).length === 2 &&
        (row.memberIds ?? []).map(String).includes(String(peerUserId)) &&
        (!selfId || (row.memberIds ?? []).map(String).includes(String(selfId)))
    ) ?? null;
}

function safeSelfId() {
    try {
        return authStore.getUserId();
    } catch {
        return null;
    }
}

export const conversationService = {

    /**
     * Open (or create) the 1:1 chat with `peerUserId`.
     * @returns {Promise<{conversationId: string, created: boolean, keyState: string}>}
     */
    async openDirect(peerUserId) {
        if (!peerUserId) throw new Error('peerUserId required');

        const existing = await findLocalDirect(peerUserId);
        if (existing) {
            const keyState = await this.ensureArchiveKey(existing);
            return { conversationId: existing._id, created: false, keyState };
        }

        const ack = await rpc(SOCKET_EVENTS.CONVERSATION_OPEN_DIRECT, { peerUserId });
        const row = normaliseRow(ack.conversation);

        await conversationRepo.applySync({ conversations: [row] });
        bus.emit(TOPICS.SIDEBAR_CHANGED, { conversationId: row._id, mode: 'opened' });

        const keyState = await this.ensureArchiveKey(row);
        return { conversationId: row._id, created: true, keyState };
    },

    /**
     * @returns {'ready'|'awaitingKey'} - 'awaitingKey' means the other side is
     * the minter and their distribution envelope has not landed yet.
     */
    async ensureArchiveKey(conversation) {
        const conversationId = String(conversation._id);
        const epoch = conversation.keyEpoch ?? 1;

        const cached = await archiveKeyRepo.get(conversationId, epoch);
        if (cached?.key) return 'ready';

        // Someone already minted it and the server holds our MBK-wrapped copy.
        try {
            await archiveCrypto.getKey(conversationId, epoch);
            return 'ready';
        } catch (error) {
            if (error?.code === ERROR_CODES.MBK_NOT_LOADED) throw error;
            // NO_ARCHIVE_KEY - fall through and decide whether we mint.
        }

        const members = (conversation.memberIds ?? []).map(String);
        const selfId = safeSelfId();
        const minter = [...members].sort()[0];

        if (!selfId || String(minter) !== String(selfId)) return 'awaitingKey';

        const { bytes } = await archiveCrypto.createKey(conversationId, epoch);
        try {
            await this.distributeArchiveKey(conversationId, epoch, bytes);
        } finally {
            bytes.fill(0);
        }
        return 'ready';
    },

    /**
     * Hand the freshly minted CAK to every other device in the conversation.
     *
     * It rides the ordinary transport: one ratchet-sealed envelope per device,
     * kind 'archiveKey', which messageSync.handleEnvelope already routes into
     * archiveCrypto.acceptDistributedKey. The accompanying archive row is a
     * system record sealed under the very key being distributed, so the server
     * sees ciphertext here exactly as it does for a normal message.
     */
    async distributeArchiveKey(conversationId, epoch, cakBytes) {
        const { devices } = await rpc(SOCKET_EVENTS.CONVERSATION_MEMBER_DEVICES, {
            conversationId,
            includeOwnOtherDevices: true
        });

        if (!devices?.length) return 0;

        const keyBase64 = bufferToBase64(cakBytes);
        const payload = JSON.stringify({
            kind: 'archiveKey',
            conversationId,
            epoch,
            keyBase64
        });

        const envelopes = [];
        for (const device of devices) {
            try {
                const envelope = await SessionManager.encryptDirectMessage({
                    toUserId: device.userId,
                    toDeviceId: device.deviceId,
                    plaintext: payload
                });
                envelopes.push({ ...envelope, toUserId: device.userId, toDeviceId: device.deviceId });
            } catch (error) {
                // One unreachable device must not block the conversation. It
                // will pick the key up from its own MBK-wrapped copy on the
                // next restoreAllKeys().
                console.warn('[conversation] key distribution skipped a device:', error.message);
            }
        }

        if (!envelopes.length) return 0;

        const archive = await archiveCrypto.encryptArchive(conversationId, epoch, {
            kind: 'system',
            event: 'archiveKeyEstablished',
            epoch,
            sentAt: new Date().toISOString()
        });

        await rpc(SOCKET_EVENTS.MESSAGE_SEND, {
            conversationId,
            clientMessageId: crypto.randomUUID(),
            contentType: 'system',
            archive,
            envelopes,
            sentAt: new Date().toISOString()
        });

        return envelopes.length;
    },

    list: (options) => conversationRepo.list(options),

    get: (conversationId) => conversationRepo.get(conversationId)
};

export default conversationService;
