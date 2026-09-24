import webCryptoProvider from '../../../infrastructure/crypto/WebCryptoProvider.js';
import {base64ToBuffer} from '../../../shared/utils/encoding.js'

const concatBuffer = (...buffers) => {
    const total = buffers.reduce((sum, b) => sum + b.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for(const b of buffers){
        out.set(new Uint8Array(b), offset);
        offset += b.byteLength;
    }
    return out.buffer;
}

export const verifyPreKeyBundle = async (bundle) => {
    const isValid = await webCryptoProvider.verify({
        identityPublicKeyBase64: bundle.identityPublicKey,
        message: base64ToBuffer(bundle.signedPreKey.publicKey),
        signatureBase64: bundle.signedPreKeySignature
    });
    if(!isValid) throw new Error('SPK_SIGNATURE_INVALID');
};

export const initiateSession = async (bundle) => {
    await verifyPreKeyBundle(bundle);

    const ephemeralKeyPair = await webCryptoProvider.generateX25519KeyPair();
    const spkPublicKey =await webCryptoProvider.importX25519PublicKey(bundle.signedPreKey.publicKey);
    const dh1 = await webCryptoProvider.deriveBits(ephemeralKeyPair.privateKey, spkPublicKey);

    let dh2 = null;
    let usedOneTimePreKeyId = null;

    if(bundle.oneTimePreKey){
        const opkPublicKey = await webCryptoProvider.importX25519PublicKey(bundle.oneTimePreKey.publicKey);
        dh2 = await webCryptoProvider.deriveBits(ephemeralKeyPair.privateKey, opkPublicKey);
        usedOneTimePreKeyId = bundle.oneTimePreKey.keyId;
    }

    const ikm = dh2 ? concatBuffer(dh1,dh2) : dh1;
    const rootKey = await webCryptoProvider.hkdf(ikm, new Uint8Array(32), 'e2ee-root-key-v1', 32);

    return {
        rootKey,
        ephemeralKeyPair,
        ephemeralPublicKeyBase64: await webCryptoProvider.exportPublicKeyBase64(ephemeralKeyPair.publicKey),
        usedOneTimePreKeyId,
        theirRatchetPublicKeyBase64: bundle.signedPreKey.publicKey
    }
}

export const receiveSession = async ({ ephemeralPublicKeyBase64, usedOneTimePreKeyId },
                                     {signedPreKeyPair, oneTimePreKeyPair}) => {
    const ephemeralPublicKey = await webCryptoProvider.importX25519PublicKey(ephemeralPublicKeyBase64);
    const dh1 = await webCryptoProvider.deriveBits(signedPreKeyPair.privateKey, ephemeralPublicKey);

    let dh2 = null;
    if(usedOneTimePreKeyId && oneTimePreKeyPair){
        dh2 = await webCryptoProvider.deriveBits(oneTimePreKeyPair.privateKey, ephemeralPublicKey)
    }

    const ikm = dh2 ? concatBuffer(dh1,dh2) : dh1;
    const rootKey = await webCryptoProvider.hkdf(ikm, new Uint8Array(32), 'e2ee-root-key-v1', 32);
    return {
        rootKey,
        ownRatchetKeyPair: signedPreKeyPair
    };
}