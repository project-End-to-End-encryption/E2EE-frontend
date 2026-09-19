import {senderKeyStorage} from '../../../infrastructure/crypto/storage/senderKeyStorage.js'
import {SessionManager} from '../service/session/SessionManager.js'
import {createSenderKey, senderKeyDecrypt, senderKeyEncrypt} from './senderKeyCrypto.js'
import {bufferToString, stringToBuffer} from '../../../shared/utils/encoding.js'
import webSocketClient from "../../../infrastructure/websocket/WebSocketClient.js";
import {getDeviceId} from "../../../shared/utils/deviceId.js";

export const GroupSessionManager = {

    async createGroupAndDistributeKey({groupId}) {
        const socket = await webSocketClient.connect();

        const memberDevices = await new Promise((resolve, reject) => {
            socket.emit(
                'groups:getMemberDevices',
                {groupId},
                (ack) => {
                    if (ack?.ok) {
                        resolve(ack.devices);
                    } else {
                        reject(
                            new Error(
                                ack?.error ||
                                'FAILED_TO_GET_MEMBER_DEVICES'
                            )
                        );
                    }
                }
            );
        });
        return this.distributeSenderKey({
            groupId,
            memberDevices
        });
    },
    async distributeSenderKey({groupId, memberDevices }){
        const senderKey = createSenderKey();
        await senderKeyStorage.saveOwnSenderKey(groupId, senderKey);

        const distributionPayload = JSON.stringify({
            kind: 'senderKeyDistribution',
            groupId,
            chainKeyBase64: senderKey.chainKeyBase64,
            iteration: senderKey.iteration
        });
        const socket = await webSocketClient.connect();
        return await Promise.allSettled(memberDevices.map(async ({userId, deviceId}) => {
                const envelope = await SessionManager.encryptDirectMessage({
                    toUserId: userId, toDeviceId: deviceId, plaintext: distributionPayload
                });

                socket.emit('message:direct', envelope, () => {
                });
                return {userId, deviceId}
            })
        )
    },
    async receiveSenderKeyDistribution({fromUserId, fromDeviceId, groupId, chainKeyBase64, iteration}) {
        await senderKeyStorage.saveReceivedSenderKey(groupId, fromUserId, fromDeviceId, {
            chainKeyBase64, iteration, skipped: []
        });
    },
    async sendGroupMessage({groupId, plaintext}){
        const senderKeyState = await senderKeyStorage.getOwnSenderKey(groupId);
        if(!senderKeyState) throw new Error('NO_SENDER_KEY_FOR_GROUP')

        const aad = stringToBuffer(groupId);
        const {iteration, ivBase64, ciphertextBase64} =
            await senderKeyEncrypt(senderKeyState, stringToBuffer(plaintext), aad);
        await senderKeyStorage.saveOwnSenderKey(groupId, senderKeyState);

        const socket = await webSocketClient.connect();
        socket.emit('message:group', {
            groupId,
            from: {deviceId: getDeviceId()},
            iteration, ivBase64, ciphertextBase64
        }, () => {});
    },
    async receiveGroupMessage({groupId, from, fromUserId, iteration, ivBase64, ciphertextBase64}){
        const receivedState = await senderKeyStorage.getReceivedSenderKey(groupId, fromUserId, from.deviceId);

        if(!receivedState) throw new Error('NO_SENDER_KEY_FOR_SENDER')

        const aad = stringToBuffer(groupId);
        const plaintextBytes =
            await senderKeyDecrypt(receivedState, {iteration, ivBase64, ciphertextBase64}, aad);
        await senderKeyStorage.saveReceivedSenderKey(groupId, fromUserId, from.deviceId, receivedState);

        return bufferToString(plaintextBytes);
    }
}