import { rpc } from '../../../infrastructure/websocket/socketRpc.js';
import { SOCKET_EVENTS } from '../../../shared/constants/socketEvents.js';
import { conversationRepo, archiveKeyRepo } from '../../../infrastructure/storage/repos.js';
import { bus, TOPICS } from '../../../infrastructure/websocket/eventBus.js';
import { authStore } from '../../auth/storage/authStore.js';
import { archiveCrypto } from './archiveCrypto.js';
import { SessionManager } from './session/SessionManager.js';
import { bufferToBase64 } from '../../../shared/utils/encoding.js';
import { ERROR_CODES } from '../../../shared/constants/errorCodes.js';
import { GroupSessionManager } from '../group/GroupSessionManager.js';
/**
 * CONVERSATION SERVICE
 *
 * The UI layer's entry point for "open a chat with this person". Two jobs:
 *
 *   1. get (or create) the conversation without ever creating a second one
 *   2. make sure a Conversation Archive Key exists before anyone can type
 *
 * ARCHIVE KEY MINTING FIX (2026-09-20):
 *
 * The original code used a strict lexicographical minter rule: only the member
 * with the *lowest* userId would mint the CAK. If user B (higher ID) opened the
 * chat first, they would return 'awaitingKey' and never mint — and user A might
 * not have opened the chat yet, so no key would ever be created.
 *
 * Fix: whichever device opens the chat and finds no CAK is allowed to mint and
 * distribute it. The server's unique directKey index prevents a second
 * conversation from being created; the MBK-wrapped copy on both sides ensures
 * both can always recover the key. The race condition where two devices
 * simultaneously mint is benign: the second DISTRIBUTE silently loses (the
 * server rejects a duplicate epoch) and the archive still has a valid key.
 */

export const normaliseRow = (conversation) => ({
    _id: String(conversation._id),
    type: conversation.type,
    name: conversation.name ?? null,
    avatarKey: conversation.avatarKey ?? null,
    createdBy: conversation.createdBy,
    memberIds: (conversation.memberIds ?? []).map(String),
    members: (conversation.members ?? []).map((m) => ({ userId: String(m.userId), role: m.role })),
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
        const selfId = safeSelfId();
        if (selfId && String(peerUserId) === String(selfId)) {
            throw new Error('Cannot open a chat with yourself');
        }

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
     * Ensure a Conversation Archive Key exists for this conversation.
     *
     * @returns {'ready'|'awaitingKey'}  Always 'ready' after this fix,
     * because whoever opens the chat and finds no key simply mints one.
     * 'awaitingKey' is now only returned when the MBK is not loaded yet
     * (key-vault locked) — a condition the caller surfaces as a hard error.
     */
    async ensureArchiveKey(conversation) {
        const conversationId = String(conversation._id);
        const epoch = conversation.keyEpoch ?? 1;

        // Fast path — already in IndexedDB
        const cached = await archiveKeyRepo.get(conversationId, epoch);
        if (cached?.key) return 'ready';

        // Try fetching from the server (someone else already minted + distributed)
        try {
            await archiveCrypto.getKey(conversationId, epoch);
            return 'ready';
        } catch (error) {
            if (error?.code === ERROR_CODES.MBK_NOT_LOADED) throw error;
            // NO_ARCHIVE_KEY — fall through and mint it ourselves
        }

        // Mint the CAK and distribute it. Whichever device gets here first
        // races safely: the server rejects a duplicate epoch silently and the
        // winner's distribution still lands correctly.
        const { bytes } = await archiveCrypto.createKey(conversationId, epoch);
        try {
            await this.distributeArchiveKey(conversationId, epoch, bytes);
        } catch (distributeError) {
            // Distribution failure (e.g., peer has no prekeys yet) must not
            // block the chat. The key is already in IndexedDB from createKey;
            // the peer will pull it from MBK-vault on next restoreAllKeys().
            console.warn('[conversationService] key distribution warning:', distributeError?.message);
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

    async createGroup(name, memberUserIds, avatarKey) {
        if (!name || !name.trim()) throw new Error('Group name required');
        if (!memberUserIds || !Array.isArray(memberUserIds) || memberUserIds.length === 0) {
            throw new Error('At least one member is required for a group');
        }

        const ack = await rpc(SOCKET_EVENTS.CONVERSATION_CREATE_GROUP, { name, memberUserIds, avatarKey });
        const row = normaliseRow(ack.conversation);

        await conversationRepo.applySync({ conversations: [row] });
        bus.emit(TOPICS.SIDEBAR_CHANGED, { conversationId: row._id, mode: 'opened' });

        const keyState = await this.ensureArchiveKey(row);
        const { devices } = await rpc(SOCKET_EVENTS.CONVERSATION_MEMBER_DEVICES, {
                   conversationId: row._id, includeOwnOtherDevices: true
           });
           await GroupSessionManager.distributeSenderKey({ conversationId: row._id, memberDevices: devices });

        return { conversationId: row._id, created: true, keyState };
    },
    async addMember(conversationId, newUserId) {
        const ack = await rpc(SOCKET_EVENTS.CONVERSATION_ADD_MEMBER, { conversationId, newUserId });
        const row = normaliseRow(ack.conversation);
        await conversationRepo.applySync({ conversations: [row] });
        bus.emit(TOPICS.SIDEBAR_CHANGED, { conversationId: row._id, mode: 'updated' });
        return row;
    },

    async removeMember(conversationId, targetUserId) {
        const ack = await rpc(SOCKET_EVENTS.CONVERSATION_REMOVE_MEMBER, { conversationId, targetUserId });
        const row = normaliseRow(ack.conversation);
        await conversationRepo.applySync({ conversations: [row] });
        bus.emit(TOPICS.SIDEBAR_CHANGED, { conversationId: row._id, mode: 'updated' });
        return row;
    },

    /** Re-hand the CAK I already hold for `epoch` to everyone — cheap no-op for existing members, necessary for a newcomer. */
    async pushArchiveKey(conversationId, epoch) {
        const cached = await archiveKeyRepo.get(conversationId, epoch);
        if (!cached?.key) return 0;
        return this.distributeArchiveKey(conversationId, epoch, cached.key);
    },

    list: (options) => conversationRepo.list(options),

    get: (conversationId) => conversationRepo.get(conversationId)
};

export default conversationService;
