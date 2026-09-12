export class ICryptoProvider {
    async generateIdentityKeyPair() {
        throw new Error("Not implemented");
    }
    async generateSignedPreKey(identityPrivateKey, keyId) {
        throw new Error("Not implemented");
    }
    async generateOneTimePreKeys(count, startId) {
        throw new Error("Not implemented");
    }
    async exportPublicKeyBase64(publicKey) {
        throw new Error("Not implemented");
    }
    async importX25519PublicKey(base64){
        throw new Error("Not implemented");
    }
    async importEd25519PublicKey(base64){
        throw new Error("Not implemented");
    }
    async verify({identityPublicKeyBase64, message, signatureBase64}){
        throw new Error("Not implemented");
    }
    async deriveBits(privateKey, publicKey, length){
        throw new Error("Not implemented");
    }
    async hkdf(ikm, salt, infoStr, length){
        throw new Error("Not implemented");
    }
    async hmac(rawKeyBytes, dataBytes){
        throw new Error("Not implemented");
    }
    async aesEncrypt(rawKeyBytes, plaintextBytes, aad){
        throw new Error("Not implemented");
    }
    async aesDecrypt(rawKeyBytes, ivBase64, ciphertextBase64, aad){
        throw new Error("Not implemented");
    }
    isSupported() {
        throw new Error("Not implemented");
    }
}