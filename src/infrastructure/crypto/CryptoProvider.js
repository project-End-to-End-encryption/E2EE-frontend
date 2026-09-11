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
    isSupported() {
        throw new Error("Not implemented");
    }
}