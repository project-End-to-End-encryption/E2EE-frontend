import cryptoProvider from '../../../infrastructure/crypto/WebCryptoProvider.js'
import { keyStorage } from '../../../infrastructure/crypto/storage/keyStorage.js';
import {getDeviceId} from "../../../shared/utils/deviceId.js";
import { identityHandoff } from '../../recovery/identityHandoff.js';
import { claimDevice } from "../../recovery/deviceState.js";
import { authStore } from "../storage/authStore.js";
import { metaRepo, META_KEYS } from "../../../infrastructure/storage/repos.js";

const DEFAULT_OTPK_COUNT = 50;
const IDENTITY_PUBLIC_KEY_META = 'keys.identityPublicKeyBase64';

export const generateAndRegisterKeys = async (socket, { retainForVault = false } = {}) => {
    if(!cryptoProvider.isSupported()){
        throw new Error("WEB_CRYPTO_UNSUPPORTED");
    }

    const hasLocalKeys = await keyStorage.hasIdentityKey() && await keyStorage.getSignedPreKey();
    if (hasLocalKeys && !retainForVault) {
        try {
            await reregisterKeyBundle(socket);
            return;
        } catch (error) {
            console.warn('[keys] re-registration failed, generating fresh keys:', error?.message);
        }
    }

    if (hasLocalKeys && retainForVault) {
        console.warn('[keys] identity already exists; cannot recover exportable identity key');
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
            console.warn('[keys] identity export unavailable, continuing without it:', error?.message);
        }
    }

    if (!identityKeyPair) identityKeyPair = await cryptoProvider.generateIdentityKeyPair();
    const identityPublicKeyBase64 = await cryptoProvider.exportPublicKeyBase64(identityKeyPair.publicKey);

    await metaRepo.set(IDENTITY_PUBLIC_KEY_META, identityPublicKeyBase64);

    const signedPreKey = await cryptoProvider.generateSignedPreKey(identityKeyPair.privateKey, 1);
    const oneTimePreKeys = await cryptoProvider.generateOneTimePreKeys(DEFAULT_OTPK_COUNT, 1);

    await keyStorage.saveIdentityKeyPair(identityKeyPair);
    await keyStorage.saveSignedPreKey({
        keyId: signedPreKey.keyId,
        keyPair: signedPreKey.keyPair,
        publicKeyBase64: signedPreKey.publicKeyBase64,
        signatureBase64: signedPreKey.signatureBase64
    });
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

async function reregisterKeyBundle(socket) {
    const identityPublicKeyBase64 = await metaRepo.get(IDENTITY_PUBLIC_KEY_META);
    const signedPreKey = await keyStorage.getSignedPreKey();

    if (!identityPublicKeyBase64) {
        throw new Error('No persisted identity public key');
    }
    if (!signedPreKey?.keyId || !signedPreKey?.publicKeyBase64 || !signedPreKey?.signatureBase64) {
        throw new Error('Incomplete signed pre-key for re-registration');
    }

    const deviceId = getDeviceId();
    const userId = authStore.getUserId();

    const payload = {
        deviceId,
        identityPublicKey: identityPublicKeyBase64,
        signedPreKey: { keyId: signedPreKey.keyId, publicKey: signedPreKey.publicKeyBase64 },
        signedPreKeySignature: signedPreKey.signatureBase64,
        oneTimePreKeys: []
    };

    return new Promise((resolve, reject) => {
        socket.emit('keys:register', payload, (ack) => {
            if (ack?.ok) resolve(ack);
            else reject(new Error(ack?.error || 'KEY_REGISTRATION_FAILED'));
        });
    });
}