import {bufferToBase64, base64ToBuffer} from '../../../shared/utils/encoding.js'
import webCryptoProvider from "../../../infrastructure/crypto/WebCryptoProvider.js";

const MAX_SKIP = 2000;

async function advanceChain(chainKey){
    const [messageKey, nextChainKey] = await Promise.all([
        webCryptoProvider.hmac(chainKey, new Uint8Array([0x01])),
        webCryptoProvider.hmac(chainKey, new Uint8Array([0x02]))
    ]);
    return {messageKey, nextChainKey};
}

export const createSenderKey = () => ({
    chainKeyBase64: bufferToBase64(crypto.getRandomValues(new Uint8Array(32)).buffer),
    iteration: 0
})

export const senderKeyEncrypt = async (senderKeyState, plaintextBytes, aad) => {
    const chainKey = base64ToBuffer(senderKeyState.chainKeyBase64);
    const {messageKey, nextChainKey} = await advanceChain(chainKey);
    const {ivBase64, ciphertextBase64} = await webCryptoProvider.aesEncrypt(messageKey, plaintextBytes, aad);

    const iterationUsed = senderKeyState.iteration;
    senderKeyState.chainKeyBase64 = bufferToBase64(nextChainKey);
    senderKeyState.iteration += 1;

    return {iteration: iterationUsed, ivBase64, ciphertextBase64};
}

export const senderKeyDecrypt = async (receivedKeyState,
                                       {iteration, ivBase64, ciphertextBase64}, aad) => {
    receivedKeyState.skipped ??= [];

    const cachedIdx = receivedKeyState.skipped.findIndex(k => k.iteration === iteration);

    if(cachedIdx !== -1){
        const {messageKeyBase64} = receivedKeyState.skipped[cachedIdx];
        receivedKeyState.skipped.splice(cachedIdx, 1);
        return webCryptoProvider.aesDecrypt(base64ToBuffer(messageKeyBase64), ivBase64, ciphertextBase64, aad);
    }

    if(iteration < receivedKeyState.iteration) throw new Error('SENDER_KEY_MESSAGE_TOO_OLD')

    if (iteration - receivedKeyState.iteration > MAX_SKIP) {
        throw new Error('TOO_MANY_SKIPPED_KEYS');
    }

    let chainKey = base64ToBuffer(receivedKeyState.chainKeyBase64);
    let messageKey;
    while (receivedKeyState.iteration <= iteration){
        const advanced =
            await advanceChain(chainKey);
        messageKey = advanced.messageKey;
        if(receivedKeyState.iteration !== iteration){
            receivedKeyState.skipped.push({
                iteration: receivedKeyState.iteration,
                messageKeyBase64: bufferToBase64(messageKey)
            });
        }
        chainKey = advanced.nextChainKey;
        receivedKeyState.iteration += 1;
    }
    receivedKeyState.chainKeyBase64 = bufferToBase64(chainKey);

    return webCryptoProvider.aesDecrypt(messageKey, ivBase64, ciphertextBase64, aad);
}