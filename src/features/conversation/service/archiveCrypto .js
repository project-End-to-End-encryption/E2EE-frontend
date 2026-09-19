import {rpc} from "../../../infrastructure/websocket/socketRpc.js";
import {SOCKET_EVENTS} from "../../../shared/constants/socketEvents.js";
import {archiveKeyRepo, metaRepo, META_KEYS} from "../../../infrastructure/storage/repos.js";
import {bufferToBase64, base64ToBuffer, bufferToString, stringToBuffer} from "../../../shared/utils/encoding.js";
import {mbkStore} from "../../recovery/mbkStore.js";

/**
 * ARCHIVE CRYPTO  -  the Conversation Archive Key (CAK) layer
 *
 *
 * Three keys
 *  *
 *  *    RATCHET KEY  - per device pair, per message. Transport only. Forward
 *  *                   secret. Deleted after use. Cannot read history.
 *  *
 *  *    CAK          - per conversation, per epoch. 32 random bytes. Encrypts the
 *  *                   ONE archive row that every member shares. A 50-member group
 *  *                   stores one ciphertext, not fifty.
 *  *
 *  *    MBK          - per user. Wraps each CAK so the user's own devices (and
 *  *                   only those) can unwrap it. Itself sealed in the recovery
 *  *                   vault under the key the user downloads as a file.
 */

const AES_ALG = 'AES-GCM';
const IV_BYTES = 12;

const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));


async function importAesKey(rawBytes) {
    return crypto.subtle.importKey('raw', rawBytes, AES_ALG, false, ['encrypt', 'decrypt']);
}

async function seal(rawKeyBytes, plaintextBytes, aad = null) {
    const key = await importAesKey(rawKeyBytes);
    const iv = randomBytes(IV_BYTES);

    const params = { name: AES_ALG, iv };
    if (aad) params.additionalData = aad;

    const ciphertext = await crypto.subtle.encrypt(params, key, plaintextBytes);

    return { iv: bufferToBase64(iv), ciphertext: bufferToBase64(ciphertext) };
}

async function open(rawKeyBytes, ivBase64, ciphertextBase64, aad = null) {
    const key = await importAesKey(rawKeyBytes);

    const params = { name: AES_ALG, iv: new Uint8Array(base64ToBuffer(ivBase64)) };
    if (aad) params.additionalData = aad;

    return crypto.subtle.decrypt(params, key, base64ToBuffer(ciphertextBase64));
}

const archiveAad = (conversationId, epoch) =>
    stringToBuffer(`archive:v1:${conversationId}:${epoch}`);

export const archiveCrypto = {

    async getKey(conversationId, epoch) {
        const cached = await archiveKeyRepo.get(conversationId, epoch);
        if (cached) return new Uint8Array(cached.keyBytes);

        const ack = await rpc(SOCKET_EVENTS.CONVERSATION_GET_KEY, {conversationId, epoch});
        if (!ack.key) throw new Error(`NO_ARCHIVE_KEY:${conversationId}:${epoch}`);

        const keyBytes = await this.unwrap(ack.key);
        await archiveKeyRepo.put({conversationId, epoch: ack.key.epoch, keyBytes: keyBytes.buffer});

        return keyBytes;
    },

    async createKey(conversationId, epoch = 1) {
        const keyBytes = randomBytes(32);
        await this.wrapAndUpload(conversationId, epoch, keyBytes);
        await archiveKeyRepo.put({ conversationId, epoch, keyBytes: keyBytes.buffer });
        return keyBytes;
    },

    async wrapAndUpload(conversationId, epoch, keyBytes) {
        const mbk = await mbkStore.require();
        const sealed = await seal(mbk, keyBytes, stringToBuffer(`cak:${conversationId}:${epoch}`));

        await rpc(SOCKET_EVENTS.CONVERSATION_PUT_KEY, {
            conversationId,
            epoch,
            iv: sealed.iv,
            ciphertext: sealed.ciphertext,
            blobGeneration: await metaRepo.get('vault.generation', 1)
        });

        return sealed;
    },

    async unwrap(keyRow) {
        const mbk = await mbkStore.require();
        const plain = await open(
            mbk,
            keyRow.iv,
            keyRow.ciphertext,
            stringToBuffer(`cak:${keyRow.conversationId}:${keyRow.epoch}`)
        );
        return new Uint8Array(plain);
    },

    async restoreAllKeys({onProgress} = {}) {
        let cursor = await metaRepo.get(META_KEYS.ARCHIVE_KEYS_CURSOR, null);
        let total = 0;

        for (; ;) {
            const ack = await rpc(SOCKET_EVENTS.CONVERSATION_LIST_KEYS, {
                sinceId: cursor,
                limit: 500
            });

            if (!ack.keys?.length) break;

            const unwrapped = [];
            for (const row of ack.keys) {
                try {
                    const keyBytes = await this.unwrap(row);
                    unwrapped.push({
                        conversationId: String(row.conversationId),
                        epoch: Number(row.epoch),
                        keyBytes: keyBytes.buffer
                    });
                } catch (error) {
                    // A CAK wrapped under a previous MBK generation (i.e. from
                    // before a vault reset). Expected, not an error - those
                    // conversations are genuinely unreadable now. Skip quietly.
                    console.debug('[archiveCrypto] skipping unwrappable CAK', row.conversationId);
                }
            }

            await archiveKeyRepo.putMany(unwrapped);
            total += unwrapped.length;

            cursor = ack.nextCursor;
            await metaRepo.set(META_KEYS.ARCHIVE_KEYS_CURSOR, cursor);

            onProgress?.({done: total});
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

        const keyBytes = await this.createKey(conversationId, newEpoch);
        // Distribute to the other members over the transport channel as a
        // { kind: 'archiveKey' } control message - see messageComposer.
        return keyBytes;
    },

    async acceptDistributedKey(envelope, body) {
        const { conversationId, epoch, keyBase64 } = body;
        const keyBytes = new Uint8Array(base64ToBuffer(keyBase64));

        await archiveKeyRepo.put({ conversationId, epoch, keyBytes: keyBytes.buffer });
        // Also upload our own MBK-wrapped copy so our other devices can get it
        // without another round of distribution.
        await this.wrapAndUpload(conversationId, epoch, keyBytes);
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