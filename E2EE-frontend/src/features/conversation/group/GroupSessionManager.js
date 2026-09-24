// features/conversation/group/GroupSessionManager.js
import { senderKeyStorage } from '../../../infrastructure/crypto/storage/senderKeyStorage.js';
import { SessionManager } from '../service/session/SessionManager.js';
import { createSenderKey, senderKeyDecrypt, senderKeyEncrypt } from './senderKeyCrypto.js';
import { bufferToString, stringToBuffer } from '../../../shared/utils/encoding.js';
import { rpc } from '../../../infrastructure/websocket/socketRpc.js';
import { SOCKET_EVENTS } from '../../../shared/constants/socketEvents.js';
import { getDeviceId } from '../../../shared/utils/deviceId.js';
import { archiveCrypto } from '../service/archiveCrypto.js';
import { conversationRepo } from '../../../infrastructure/storage/repos.js';

export const GroupSessionManager = {

    async createGroupAndDistributeKey({ conversationId }) {
        const { devices } = await rpc(SOCKET_EVENTS.CONVERSATION_MEMBER_DEVICES, {
            conversationId, includeOwnOtherDevices: true
        });
        return this.distributeSenderKey({ conversationId, memberDevices: devices });
    },

    /**
     * Mint (or re-mint) MY sender-key chain and hand it to `memberDevices`.
     * Same call does double duty: initial distribution at group creation,
     * and rotation after a member is removed (call again with the
     * post-removal device list — see rotateSenderKey).
     */
    async distributeSenderKey({ conversationId, memberDevices }) {
        const senderKey = createSenderKey();
        await senderKeyStorage.saveOwnSenderKey(conversationId, senderKey);

        const plaintext = JSON.stringify({
            kind: 'senderKeyDistribution',
            conversationId,
            chainKeyBase64: senderKey.chainKeyBase64,
            iteration: senderKey.iteration
        });

        const envelopes = [];
        for (const { userId, deviceId } of memberDevices) {
            try {
                const envelope = await SessionManager.encryptDirectMessage({
                    toUserId: userId, toDeviceId: deviceId, plaintext
                });
                envelopes.push({ ...envelope, toUserId: userId, toDeviceId: deviceId });
            } catch (error) {
                console.warn('[GroupSessionManager] skipped a device:', error.message);
            }
        }
        if (!envelopes.length) return { sent: 0 };

        const conversation = await conversationRepo.get(conversationId);
        const epoch = conversation?.keyEpoch ?? 1;
        const archive = await archiveCrypto.encryptArchive(conversationId, epoch, {
            kind: 'system', event: 'senderKeyRotated', sentAt: new Date().toISOString()
        });

        await rpc(SOCKET_EVENTS.MESSAGE_SEND, {
            conversationId,
            clientMessageId: crypto.randomUUID(),
            contentType: 'system',
            archive,
            envelopes,
            sentAt: new Date().toISOString()
        });

        return { sent: envelopes.length };
    },

    rotateSenderKey(args) {
        return this.distributeSenderKey(args);
    },

    async receiveSenderKeyDistribution({ fromUserId, fromDeviceId, conversationId, chainKeyBase64, iteration }) {
        await senderKeyStorage.saveReceivedSenderKey(conversationId, fromUserId, fromDeviceId, {
            chainKeyBase64, iteration, skipped: []
        });
    },

    /** Returns the ciphertext piece only — messageComposer.js folds this into payload.groupPayload on MESSAGE_SEND. */
    async sendGroupMessage({ conversationId, plaintext }) {
        const senderKeyState = await senderKeyStorage.getOwnSenderKey(conversationId);
        if (!senderKeyState) throw new Error('NO_SENDER_KEY_FOR_GROUP');

        const aad = stringToBuffer(conversationId);
        const { iteration, ivBase64, ciphertextBase64 } =
            await senderKeyEncrypt(senderKeyState, stringToBuffer(plaintext), aad);
        await senderKeyStorage.saveOwnSenderKey(conversationId, senderKeyState);

        return { iteration, ivBase64, ciphertextBase64, from: { deviceId: getDeviceId() } };
    },

    async receiveGroupMessage({ conversationId, fromUserId, fromDeviceId, iteration, ivBase64, ciphertextBase64 }) {
        const receivedState = await senderKeyStorage.getReceivedSenderKey(conversationId, fromUserId, fromDeviceId);
        if (!receivedState) throw new Error('NO_SENDER_KEY_FOR_SENDER');

        const aad = stringToBuffer(conversationId);
        const plaintextBytes = await senderKeyDecrypt(receivedState, { iteration, ivBase64, ciphertextBase64 }, aad);
        await senderKeyStorage.saveReceivedSenderKey(conversationId, fromUserId, fromDeviceId, receivedState);

        return bufferToString(plaintextBytes);
    }
};

export default GroupSessionManager;