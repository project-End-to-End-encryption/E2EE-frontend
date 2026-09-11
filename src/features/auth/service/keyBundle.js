import cryptoProvider from '../../../infrastructure/crypto/WebCryptoProvider.js'
import { keyStorage } from '../../../infrastructure/crypto/keyStorage.js'
import {getDeviceId} from "../../../shared/utils/deviceId.js";

const DEFAULT_OTPK_COUNT = 50;

export const generateAndRegisterKeys = async (socket) => {
    if(!cryptoProvider.isSupported()){
        throw new Error("WEB_CRYPTO_UNSUPPORTED");
    }

    if(await keyStorage.hasIdentityKey()) return;

    const identityKeyPair = await cryptoProvider.generateIdentityKeyPair();
    const identityPublicKeyBase64 = await cryptoProvider.exportPublicKeyBase64(identityKeyPair.publicKey);

    const signedPreKey = await cryptoProvider.generateSignedPreKey(identityKeyPair.privateKey, 1);
    const oneTimePreKeys = await cryptoProvider.generateOneTimePreKeys(DEFAULT_OTPK_COUNT, 1);

    await keyStorage.saveIdentityKeyPair(identityKeyPair);
    await keyStorage.saveSignedPreKey({keyId: signedPreKey.keyId, keyPair: signedPreKey.keyPair});
    await keyStorage.saveOneTimePreKeys(oneTimePreKeys
        .map(({keyId, keyPair}) => ({keyId,keyPair})));

    const payload = {
        deviceId: getDeviceId(),
        identityPublicKey: identityPublicKeyBase64,
        signedPreKey: { keyId: signedPreKey.keyId, publicKey: signedPreKey.publicKeyBase64 },
        signedPreKeySignature: signedPreKey.signatureBase64,
        oneTimePreKeys: oneTimePreKeys
            .map(({ keyId, publicKeyBase64 }) => ({ keyId, publicKey: publicKeyBase64 }))
    }

    return new Promise((resolve,reject) => {
        socket.emit('keys:register', payload, (ack) => {
            if(ack?.ok) resolve(ack);
            else reject(new Error(ack?.error || 'KEY_REGISTRATION_FAILED'));
        });
    });
};