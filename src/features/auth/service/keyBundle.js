import cryptoProvider from '../../../infrastructure/crypto/WebCryptoProvider.js'
import { keyStorage } from '../../../infrastructure/crypto/storage/keyStorage.js'
import {getDeviceId} from "../../../shared/utils/deviceId.js";
import { identityHandoff } from '../../recovery/identityHandoff.js';
import { claimDevice} from "../../recovery/deviceState.js";
import { authStore } from "../storage/authStore.js";

const DEFAULT_OTPK_COUNT = 50;

/**
 * @param {object}  [options]
 * @param {boolean} [options.retainForVault]  Sign-up only. Generate the identity
 *        key exportable, hand its PKCS8 bytes to identityHandoff (memory only)
 *        for the recovery-key page, and store a non-extractable copy.
 */
export const generateAndRegisterKeys = async (socket, { retainForVault = false } = {}) => {
    if(!cryptoProvider.isSupported()){
        throw new Error("WEB_CRYPTO_UNSUPPORTED");
    }

    if (await keyStorage.hasIdentityKey() && await keyStorage.getSignedPreKey()) {
        if (retainForVault) {
            console.warn('[keys] identity already exists; cannot recover exportable identity key');
        }
        return;
    }
    let identityKeyPair = null;

    if (retainForVault) {
        try {
            const exportable = await cryptoProvider.generateIdentityKeyPair({ extractable: true });
            const { pkcs8, keyPair } = await cryptoProvider.exportAndLockIdentityKeyPair(exportable);
            identityHandoff.hold(pkcs8);
            identityKeyPair = keyPair;
        } catch (error) {
            // Never let the recovery feature break sign-up: fall back to a
            // plain non-extractable key. The recovery page will say it cannot
            // create a key in this session.
            console.warn('[keys] identity export unavailable, continuing without it:', error?.message);
        }
    }

    if (!identityKeyPair) identityKeyPair = await cryptoProvider.generateIdentityKeyPair();
    const identityPublicKeyBase64 = await cryptoProvider.exportPublicKeyBase64(identityKeyPair.publicKey);

    const signedPreKey = await cryptoProvider.generateSignedPreKey(identityKeyPair.privateKey, 1);
    const oneTimePreKeys = await cryptoProvider.generateOneTimePreKeys(DEFAULT_OTPK_COUNT, 1);

    await keyStorage.saveIdentityKeyPair(identityKeyPair);
    await keyStorage.saveSignedPreKey({keyId: signedPreKey.keyId, keyPair: signedPreKey.keyPair});
    await keyStorage.saveOneTimePreKeys(oneTimePreKeys
        .map(({keyId, keyPair}) => ({keyId,keyPair})));

    await claimDevice(authStore.getUserId());

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