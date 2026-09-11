import {ICryptoProvider} from "./CryptoProvider.js";
import {bufferToBase64} from '../../shared/utils/encoding.js'

class WebCryptoProvider extends ICryptoProvider{

    // Identity key
    async generateIdentityKeyPair() {
        return crypto.subtle.generateKey(
            {name: 'Ed25519'},
            false,
            ['sign']
        );
    }

    // one time pre key
    async _generateX25519KeyPair(){
        return crypto.subtle.generateKey(
            {name: 'X25519'},
            false,
            ['deriveBits']
        );
    }

    async generateSignedPreKey(identityPrivateKey, keyId){
        const keyPair = await this._generateX25519KeyPair();
        const publicKeyBytes = await crypto.subtle.exportKey('raw', keyPair.publicKey);

        const signature = await crypto.subtle.sign(
            {name: 'Ed25519'},
            identityPrivateKey,
            publicKeyBytes
        );

        return {
            keyId,
            keypair,
            publicKeyBase64: bufferToBase64(publicKeyBytes),
            signatureBase64: bufferToBase64(signature)
        };
    }

    async generateOneTimePreKeys(count, startId= 1){
        const keys = [];
        for(let i = 0; i < count; i++){
            const keyPair = await this._generateX25519KeyPair();
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

    isSupported() {
        return typeof crypto?.subtle?.generateKey === 'function';
    }
}

export default new WebCryptoProvider();