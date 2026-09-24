import webCryptoProvider from '../../../infrastructure/crypto/WebCryptoProvider.js';
import {base64ToBuffer, bufferToBase64} from '../../../shared/utils/encoding.js'

async function kdRootKey(rootKey, dhOutput){
    const output = await webCryptoProvider.hkdf(dhOutput, rootKey, 'e2ee-dh-ratchet-v1', 64);
    return {newRootKey: output.slice(0, 32), chainKey: output.slice(32, 64)};
}

async function kdfChainKey(chainKey){
    const [messageKey, nextChainKey] = await Promise.all([
        webCryptoProvider.hmac(chainKey, new Uint8Array([0x01])),
        webCryptoProvider.hmac(chainKey, new Uint8Array([0x02]))
    ]);
    return {messageKey, nextChainKey};
}

export class DoubleRatchetSession {
    constructor(state) {
        this.state = state;
    }

    static async createAsInitiator ({rootKey, ephemeralKeyPair, theirRatchetPublicKeyBase64}){
        const thereRatchetPublicKey = await webCryptoProvider
            .importX25519PublicKey(theirRatchetPublicKeyBase64);

        const dhOut = await webCryptoProvider.deriveBits(ephemeralKeyPair.privateKey, thereRatchetPublicKey);

        const {newRootKey, chainKey} = await kdRootKey(rootKey, dhOut);

        return new DoubleRatchetSession({
            rootKey: newRootKey,
            dhSelfKeyPair: ephemeralKeyPair,
            dhRemotePublicKeyBase64: theirRatchetPublicKeyBase64,
            sendingChainKey: chainKey,
            receivingChainKey: null,
            sendN: 0,
            recvN: 0,
            prevChainLength: 0,
            skippedKeys: []
        });
    }

    static async createAsResponder({rootKey, ownRatchetKeyPair}){
        return new DoubleRatchetSession({
            rootKey,
            dhSelfKeyPair: ownRatchetKeyPair,
            dhRemotePublicKeyBase64: null,
            sendingChainKey: null,
            receivingChainKey: null,
            sendN: 0,
            recvN: 0,
            prevChainLength: 0,
            skippedKeys: []
        });
    }

    async _dhRatchetSetup(theirNewRatchetPublicKeyBase64){
        const s = this.state;
        const theirKey = await webCryptoProvider.importX25519PublicKey(theirNewRatchetPublicKeyBase64);

        // receiving side
        const dhRecv = await webCryptoProvider.deriveBits(s.dhSelfKeyPair.privateKey, theirKey);
        const recvDerived = await kdRootKey(s.rootKey, dhRecv);
        s.receivingChainKey = recvDerived.chainKey;
        s.rootKey = recvDerived.newRootKey;
        s.dhRemotePublicKeyBase64 = theirNewRatchetPublicKeyBase64;
        s.prevChainLength = s.sendN;
        s.sendN = 0;
        s.recvN = 0;

        // generate our own new ratchet key

        s.dhSelfKeyPair = await webCryptoProvider.generateX25519KeyPair();
        const dhSend = await webCryptoProvider.deriveBits(s.dhSelfKeyPair.privateKey, theirKey);
        const sendDerived = await kdRootKey(s.rootKey, dhSend);
        s.sendingChainKey = sendDerived.chainKey;
        s.rootKey = sendDerived.newRootKey;
    }

    async _skipReceivingKeys(untilN){
        const s = this.state;

        if(!s.receivingChainKey) return;

        while(s.recvN < untilN){
            const {messageKey, nextChainKey} = await kdfChainKey(s.receivingChainKey);
            s.skippedKeys.push({
                ratchetPublicKeyBase64: s.dhRemotePublicKeyBase64,
                n: s.recvN,
                messageKeyBase64: bufferToBase64(messageKey)
            });
            s.receivingChainKey = nextChainKey;
            s.recvN += 1;
        }
    }

    async encrypt(plaintextBytes, aad){
        const s = this.state;
        const {messageKey, nextChainKey} = await kdfChainKey(s.sendingChainKey);
        s.sendingChainKey = nextChainKey;

        const {ivBase64, ciphertextBase64} = await webCryptoProvider.aesEncrypt(messageKey, plaintextBytes, aad);

        const header = {
            ratchetPublicKeyBase64: await webCryptoProvider.exportPublicKeyBase64(s.dhSelfKeyPair.publicKey),
            n: s.sendN,
            pn: s.prevChainLength
        };
        s.sendN += 1;
        return{
            header,
            ivBase64,
            ciphertextBase64
        };
    }

    async decrypt({header, ivBase64, ciphertextBase64}, aad){
        const s = this.state;

        const cachedIdx = s.skippedKeys.findIndex(
            k => k.ratchetPublicKeyBase64 === header.ratchetPublicKeyBase64 && k.n === header.n
        );

        if(cachedIdx !== -1){
            const {messageKeyBase64} = s.skippedKeys[cachedIdx];
            s.skippedKeys.splice(cachedIdx, 1);
            return webCryptoProvider.aesDecrypt(base64ToBuffer(messageKeyBase64), ivBase64, ciphertextBase64, aad);
        }

        if(header.ratchetPublicKeyBase64 !== s.dhRemotePublicKeyBase64) {
            await this._skipReceivingKeys(header.pn);
            await this._dhRatchetSetup(header.ratchetPublicKeyBase64);
        }
        await this._skipReceivingKeys(header.n);
        const {messageKey, nextChainKey} = await kdfChainKey(s.receivingChainKey);
        s.receivingChainKey = nextChainKey;
        s.recvN += 1;

        return webCryptoProvider.aesDecrypt(messageKey, ivBase64, ciphertextBase64, aad);

    }
}