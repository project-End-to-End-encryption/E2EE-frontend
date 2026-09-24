import {ICryptoProvider} from "./CryptoProvider.js";
import {bufferToBase64, base64ToBuffer} from '../../shared/utils/encoding.js'

class WebCryptoProvider extends ICryptoProvider{

    // Identity key
    // `extractable` is false everywhere except the one moment at sign-up when
    // the private key has to be exported once for the recovery vault - see
    // exportAndLockIdentityKeyPair and features/recovery/identityHandoff.js.
    async generateIdentityKeyPair({ extractable = false } = {}) {
        return crypto.subtle.generateKey(
            {name: 'Ed25519'},
            extractable,
            ['sign']
        );
    }

    /**
     * Export an extractable identity private key once (PKCS8), then re-import
     * it as non-extractable. The returned keyPair is what gets stored; the
     * bytes go to the recovery vault and are zeroed by their owner.
     */
    async exportAndLockIdentityKeyPair(keyPair) {
        const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey));
        const privateKey = await crypto.subtle.importKey(
            'pkcs8',
            pkcs8,
            {name: 'Ed25519'},
            false,
            ['sign']
        );
        return { pkcs8, keyPair: { publicKey: keyPair.publicKey, privateKey } };
    }

    async generateX25519KeyPair(){
        return crypto.subtle.generateKey(
            {name: 'X25519'},
            false,
            ['deriveBits']
        );
    }
    // one time pre key
    async _generateX25519KeyPair(){
        return this.generateX25519KeyPair();
    }

    async generateSignedPreKey(identityPrivateKey, keyId){
        const keyPair = await this.generateX25519KeyPair();
        const publicKeyBytes = await crypto.subtle.exportKey('raw', keyPair.publicKey);

        const signature = await crypto.subtle.sign(
            {name: 'Ed25519'},
            identityPrivateKey,
            publicKeyBytes
        );

        return {
            keyId,
            keyPair,
            publicKeyBase64: bufferToBase64(publicKeyBytes),
            signatureBase64: bufferToBase64(signature)
        };
    }

    async generateOneTimePreKeys(count, startId= 1){
        const keys = [];
        for(let i = 0; i < count; i++){
            const keyPair = await this.generateX25519KeyPair();
            const publicKeyBytes = await crypto.subtle.exportKey('raw', keyPair.publicKey);

            keys.push({
                keyId: startId + i,
                keyPair,
                publicKeyBase64: bufferToBase64(publicKeyBytes)
            });
        }
        return keys;
    }

    async exportPublicKeyBase64(publicKey){
        const raw = await crypto.subtle.exportKey('raw', publicKey);
        return bufferToBase64(raw);
    }

    async importX25519PublicKey(base64){
        return crypto.subtle.importKey(
            'raw',
            base64ToBuffer(base64),
            {name: 'X25519'},
            false,
            []
        );
    }

    async importEd25519PublicKey(base64){
        return crypto.subtle.importKey(
            'raw',
            base64ToBuffer(base64),
            {name: 'Ed25519'},
            false,
            ['verify']
        );
    }

    async verify({identityPublicKeyBase64, message, signatureBase64}){
        const key = await this.importEd25519PublicKey(identityPublicKeyBase64);
        const messageBytes = message instanceof ArrayBuffer ? message : base64ToBuffer(message);
        return crypto.subtle.verify(
            {name: 'Ed25519'},
            key,
            base64ToBuffer(signatureBase64),
            messageBytes
        );
    }

    async deriveBits(privateKey, publicKey, length = 256){
        return crypto.subtle.deriveBits(
            {name: 'X25519', public: publicKey},
            privateKey,
            length
        );
    }
    async hkdf(ikm, salt, infoStr, length = 32){
        const baseKey = await crypto.subtle.importKey(
            'raw',
            ikm,
            'HKDF',
            false,
            ['deriveBits']
        );

        const info = new TextEncoder().encode(infoStr);
        return crypto.subtle.deriveBits(
            {name: 'HKDF', hash: 'SHA-256', salt, info},
            baseKey,
            length * 8
        );
    }

    async hmac(rawKeyBytes, dataBytes){
        const key = await crypto.subtle.importKey(
            'raw',
            rawKeyBytes,
            {name: 'HMAC', hash: 'SHA-256'},
            false,
            ['sign']
        );
        return crypto.subtle.sign('HMAC', key, dataBytes);
    }

    async aesEncrypt(rawKeyBytes, plaintextBytes, aad){
        const key = await crypto.subtle.importKey(
            'raw',
            rawKeyBytes,
            'AES-GCM',
            false,
            ['encrypt']
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));

        const ciphertext = await crypto.subtle.encrypt(
            {name: 'AES-GCM', iv, additionalData: aad},
            key,
            plaintextBytes
        );
        return {ivBase64: bufferToBase64(iv), ciphertextBase64: bufferToBase64(ciphertext)};
    }

    async aesDecrypt(rawKeyBytes, ivBase64, ciphertextBase64, aad){
        const key = await crypto.subtle.importKey(
            'raw',
            rawKeyBytes,
            'AES-GCM',
            false,
            ['decrypt']
        );

        let formattedAad = aad;
        if (typeof aad === 'string') {
            formattedAad = base64ToBuffer(aad);
        }

        return crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: new Uint8Array(base64ToBuffer(ivBase64)),
                ...(formattedAad && { additionalData: formattedAad })
            },
            key,
            base64ToBuffer(ciphertextBase64)
        );
    }

    isSupported() {
        return typeof crypto?.subtle?.generateKey === 'function';
    }
}

export default new WebCryptoProvider();