import webSocketClient from '../../../../infrastructure/websocket/WebSocketClient.js'
import { keyStorage } from '../../../../infrastructure/crypto/storage/keyStorage.js'
import { sessionStorage } from '../../../../infrastructure/crypto/storage/sessionStorage.js'
import { DoubleRatchetSession } from '../../crypto/DoubleRatchet.js'
import * as x3dh from '../../crypto/x3dh.js'
import { stringToBuffer, bufferToString } from '../../../../shared/utils/encoding.js'
import { getDeviceId } from '../../../../shared/utils/deviceId.js'
import { authStore } from '../../../auth/storage/authStore.js'

export const requestPreKeyBundle = (socket, {userId, deviceId}) => {
    return new Promise((resolve,reject) => {
        socket.emit('keys:fetchBundle', {userId, deviceId}, (ack) => {
            if(ack?.ok) resolve(ack.bundle);
            else reject(new Error(ack?.error || 'FETCH_BUNDLE_FAILED'));
        });
    });
};

const aad = (fromUserId, userId) => stringToBuffer(`${fromUserId}:${userId}`);

async function loadOrCreateOutgoingSession(peer){
    const existing = await sessionStorage.getSession(peer.userId, peer.deviceId);
    if(existing) return {
        session: new DoubleRatchetSession(existing.state),
        isNew: false
    };

    const socket = await webSocketClient.connect();
    const bundle = await requestPreKeyBundle(socket, peer);
    const x3dhResult = await x3dh.initiateSession(bundle);
    const session = await DoubleRatchetSession.createAsInitiator(x3dhResult);

    return {
        session,
        isNew: true,
        preKeyHeader: {
            ephemeralPublicKeyBase64: x3dhResult.ephemeralPublicKeyBase64,
            usedOneTimePreKeyId: x3dhResult.usedOneTimePreKeyId
        }
    }
}

export const SessionManager = {
    async encryptDirectMessage({toUserId, toDeviceId, plaintext}){
        const fromUserId = authStore.getUserId();
        const peer = {userId: toUserId, deviceId: toDeviceId };

        const {session, isNew, preKeyHeader}
            = await loadOrCreateOutgoingSession(peer);

        const {header, ivBase64, ciphertextBase64} = await session.encrypt(
            stringToBuffer(plaintext),
            aad(fromUserId, toUserId)
        );

        await sessionStorage.saveSession(peer.userId, peer.deviceId, {state: session.state});

        return {
            type: isNew ? 'preKey' : 'message',
            from: {userId: fromUserId, deviceId: getDeviceId()},
            to: {userId: toUserId, deviceId: toDeviceId},
            ...(isNew ? preKeyHeader : {}),
            header, ivBase64, ciphertextBase64
        };
    },
    async decryptDirectMessage(envelop){
        const {from, header, ivBase64, ciphertextBase64} = envelop;
        let existing = await sessionStorage.getSession(from.userId, from.deviceId);
        let session;

        if(!existing && envelop.type === 'preKey'){
            const signedPreKeyPair = await keyStorage.getSignedPreKey();
            const oneTimePreKeyPair =
                envelop.usedOneTimePreKeyId ? await keyStorage
                    .getOneTimePreKey(envelop.usedOneTimePreKeyId) : null;

            const {rootKey, ownRatchetKeyPair} = await x3dh.receiveSession(envelop, {
                signedPreKeyPair: signedPreKeyPair.keyPair,
                oneTimePreKeyPair: oneTimePreKeyPair?.keyPair
            });
            session = await DoubleRatchetSession.createAsResponder({rootKey, ownRatchetKeyPair});

            if(envelop.usedOneTimePreKeyId){
                await keyStorage.deleteOneTimePreKey(envelop.usedOneTimePreKeyId)
            }
        } else if (existing){
            session = new DoubleRatchetSession(existing.state)
        } else {
            throw new Error('NO_SESSION_AND_NOT_PREKEY_MESSAGE');
        }

        const plaintextBytes = await session.decrypt(
            {header, ivBase64, ciphertextBase64},
            aad(from.userId, authStore.getUserId())
        );
        await sessionStorage.saveSession(from.userId, from.deviceId, {state: session.state});

        return bufferToString(plaintextBytes);
    }
}

