import { rpc } from '../../../infrastructure/websocket/socketRpc.js';
import { SOCKET_EVENTS } from '../../../shared/constants/socketEvents.js';
import { archiveKeyRepo, metaRepo, META_KEYS } from '../../../infrastructure/storage/repos.js';
import { bufferToBase64, base64ToBuffer, stringToBuffer, bufferToString } from '../../../shared/utils/encoding.js';
import { mbkStore } from '../../recovery/mbkStore.js';


const AES_ALG = 'AES-GCM';
const IV_BYTES = 12;


const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));


async function seal(cryptoKey, plaintextBytes, aad = null) {
    const iv = randomBytes(IV_BYTES);

    const params = { name: AES_ALG, iv };
    if (aad) params.additionalData = aad;

    const ciphertext = await crypto.subtle.encrypt(params, cryptoKey, plaintextBytes);

    return { iv: bufferToBase64(iv), ciphertext: bufferToBase64(ciphertext) };
}

async function open(cryptoKey, ivBase64, ciphertextBase64, aad = null) {
    const params = { name: AES_ALG, iv: new Uint8Array(base64ToBuffer(ivBase64)) };
    if (aad) params.additionalData = aad;

    return crypto.subtle.decrypt(params, cryptoKey, base64ToBuffer(ciphertextBase64));
}

async function importCak(rawBytes) {
    return crypto.subtle.importKey('raw', rawBytes, { name: AES_ALG }, false, ['encrypt', 'decrypt']);
}

const archiveAad = (conversationId, epoch) =>
    stringToBuffer(`archive:v1:${conversationId}:${epoch}`);

const cakAad = (conversationId, epoch) =>
    stringToBuffer(`cak:${conversationId}:${epoch}`);


export const archiveCrypto = {


    async getKey(conversationId, epoch) {
        const cached = await archiveKeyRepo.get(conversationId, epoch);

        if (cached?.key instanceof CryptoKey) return cached.key;


        if (cached?.keyBytes) {
            const key = await importCak(new Uint8Array(cached.keyBytes));
            await archiveKeyRepo.put({ conversationId, epoch, key });
            return key;
        }

        const ack = await rpc(SOCKET_EVENTS.CONVERSATION_GET_KEY, { conversationId, epoch });
        if (!ack.key) throw new Error(`NO_ARCHIVE_KEY:${conversationId}:${epoch}`);

        const key = await this.unwrapToKey(ack.key);
        await archiveKeyRepo.put({ conversationId, epoch: ack.key.epoch, key });

        return key;
    },


    async unwrapToKey(keyRow) {
        const bytes = await this.unwrapToBytes(keyRow);
        try {
            return await importCak(bytes);
        } finally {
            bytes.fill(0);
        }
    },


    async unwrapToBytes(keyRow) {
        const mbk = await mbkStore.require();     // CryptoKey, usage: decrypt
        const plain = await open(
            mbk,
            keyRow.iv,
            keyRow.ciphertext,
            cakAad(keyRow.conversationId, keyRow.epoch)
        );
        return new Uint8Array(plain);
    },

    async createKey(conversationId, epoch = 1) {
        const bytes = randomBytes(32);
        try {
            await this.wrapAndUpload(conversationId, epoch, bytes);

            const key = await importCak(bytes);
            await archiveKeyRepo.put({ conversationId, epoch, key });


            return { key, bytes };
        } catch (error) {
            bytes.fill(0);
            throw error;
        }
    },


    async wrapAndUpload(conversationId, epoch, cakBytes) {
        const mbk = await mbkStore.require();     // CryptoKey, usage: encrypt
        const sealed = await seal(mbk, cakBytes, cakAad(conversationId, epoch));

        await rpc(SOCKET_EVENTS.CONVERSATION_PUT_KEY, {
            conversationId,
            epoch,
            iv: sealed.iv,
            ciphertext: sealed.ciphertext,
            blobGeneration: await metaRepo.get('vault.generation', 1)
        });

        return sealed;
    },


    async restoreAllKeys({ onProgress } = {}) {
        let cursor = await metaRepo.get(META_KEYS.ARCHIVE_KEYS_CURSOR, null);
        let total = 0;

        for (;;) {
            const ack = await rpc(SOCKET_EVENTS.CONVERSATION_LIST_KEYS, {
                sinceId: cursor,
                limit: 500
            });

            if (!ack.keys?.length) break;

            const unwrapped = [];
            for (const row of ack.keys) {
                try {
                    unwrapped.push({
                        conversationId: String(row.conversationId),
                        epoch: Number(row.epoch),
                        key: await this.unwrapToKey(row)
                    });
                } catch {
                    // Wrapped under a previous MBK generation (i.e. before a
                    // vault reset). Genuinely unreadable now. Skip quietly.
                    console.debug('[archiveCrypto] skipping unwrappable CAK', row.conversationId);
                }
            }

            await archiveKeyRepo.putMany(unwrapped);
            total += unwrapped.length;

            cursor = ack.nextCursor;
            await metaRepo.set(META_KEYS.ARCHIVE_KEYS_CURSOR, cursor);

            onProgress?.({ done: total });
            if (!ack.hasMore) break;
        }

        return total;
    },


    async encryptArchive(conversationId, epoch, bodyObject) {
        const key = await this.getKey(conversationId, epoch);
        const sealed = await seal(
            key,
            stringToBuffer(JSON.stringify(bodyObject)),
            archiveAad(conversationId, epoch)
        );
        return { v: 1, epoch, iv: sealed.iv, ciphertext: sealed.ciphertext };
    },

    async decryptArchive(conversationId, row) {
        if (row.isRevoked || !row.payload?.ciphertext) {
            return { ...toRow(row), isRevoked: true, body: null };
        }

        const epoch = row.payload.epoch ?? 1;
        const key = await this.getKey(conversationId, epoch);

        const plain = await open(
            key,
            row.payload.iv,
            row.payload.ciphertext,
            archiveAad(conversationId, epoch)
        );

        return { ...toRow(row), body: JSON.parse(bufferToString(plain)) };
    },

    async decryptMany(conversationId, rows) {
        const out = [];
        for (const row of rows) {
            try {
                out.push(await this.decryptArchive(conversationId, row));
            } catch (error) {
                console.warn('[archiveCrypto] undecryptable row', row.seq, error.message);
                out.push({ ...toRow(row), body: null, undecryptable: true });
            }
        }
        return out;
    },


    async rotateForConversation(conversationId, newEpoch, { members, selfUserId }) {
        const minter = [...members].sort()[0];
        if (String(minter) !== String(selfUserId)) return null;

        // Caller distributes `bytes` to the other members, then zeroes them.
        return this.createKey(conversationId, newEpoch);
    },

    /** Store a CAK someone handed us over the transport channel. */
    async acceptDistributedKey(envelope, body) {
        const { conversationId, epoch, keyBase64 } = body;
        const bytes = new Uint8Array(base64ToBuffer(keyBase64));

        try {
            // Our own MBK-wrapped copy, so our other devices get it without
            // another round of distribution.
            await this.wrapAndUpload(conversationId, epoch, bytes);

            await archiveKeyRepo.put({
                conversationId,
                epoch,
                key: await importCak(bytes)
            });
        } finally {
            bytes.fill(0);
        }
    }
};

function toRow(row) {
    return {
        conversationId: String(row.conversationId),
        seq: row.seq,
        messageId: String(row._id),
        clientMessageId: row.clientMessageId,
        senderId: row.senderId,
        senderDeviceId: row.senderDeviceId,
        contentType: row.contentType,
        sentAt: row.sentAt ?? row.sendAt ?? null,
        receivedAt: Date.now(),
        isRevoked: !!row.isRevoked,
        isOutgoing: false,
        state: 'archived'
    };
}