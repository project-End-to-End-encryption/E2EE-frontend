import { SessionManager } from '../service/session/SessionManager.js'
import { GroupSessionManager } from '../group/GroupSessionManager.js'
import webSocketClient from '../../../infrastructure/websocket/WebSocketClient.js'

export const sendDirectMessage = async ({toUserId, toDeviceId, text}) => {
    const payloadString = JSON.stringify({ kind: 'text', text });
    const envelop = await SessionManager.encryptDirectMessage({toUserId, toDeviceId, plaintext: payloadString});
    const socket = await webSocketClient.connect();
    return new Promise((resolve,reject) => {
        socket.emit('message:direct', envelop, (ack) => ack?.ok ? resolve(ack) : reject(new Error(ack?.error || 'SEND_FAILED')));
    });
};

export const sendGroupMessage = ({groupId, text}) => GroupSessionManager.sendGroupMessage({groupId, plaintext: text});

export const registerMessageListeners = (socket, {onDirectText, onGroupText}) => {
    socket.on('message:direct', async (envelope) => {

        try{
            const plaintext = await SessionManager.decryptDirectMessage(envelope);

            const payload = JSON.parse(plaintext);

            if(payload.kind === 'senderKeyDistribution'){
                await GroupSessionManager.receiveSenderKeyDistribution({
                    fromUserId: envelope.from.userId,
                    fromDeviceId: envelope.from.deviceId,
                    ...payload
                });
            } else if(payload.kind === 'text'){
                onDirectText?.({from: envelope.from, text: payload.text});
            }
        } catch {  };
    });

    socket.on('message:group', async (payload) => {
        try {
            const text = await GroupSessionManager.receiveGroupMessage(payload);
            onGroupText?.({groupId: payload.groupId, fromUserId: payload.fromUserId, text});
        } catch (error) {
            console.warn(`Failed to decrypt group message for ${payload.groupId}:`, error);
        }
    });
}