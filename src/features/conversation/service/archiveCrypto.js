import { rpc } from '../../../infrastructure/websocket/socketRpc.js';
import { SOCKET_EVENTS } from '../../../shared/constants/socketEvents.js';
import {archiveKeyRepo, metaRepo, META_KEYS, conversationRepo} from '../../../infrastructure/storage/repos.js';
import {bufferToBase64, base64ToBuffer, stringToBuffer, bufferToString} from '../../../shared/utils/encoding.js';
import { mbkStore } from '../../recovery/mbkStore.js';


const AES_ALG = 'AES-GCM';
const IV_BYTES = 12;

const randomBytes = (n) => {
    const result = crypto.getRandomValues(new Uint8Array(n));
    return result;
};

async function seal(cryptoKey, plaintextBytes, aad = null) {
    if (!(cryptoKey instanceof CryptoKey)) {
        throw new Error('SEAL_KEY_IS_NOT_CRYPTOKEY');
    }

    if (!cryptoKey.usages?.includes('encrypt')) {
        throw new Error('SEAL_KEY_MISSING_ENCRYPT_USAGE');
    }

    if (!plaintextBytes) {
        throw new Error('SEAL_PLAINTEXT_MISSING');
    }

    const iv = randomBytes(IV_BYTES);

    const params = {name: AES_ALG, iv};

    if (aad) {
        params.additionalData = aad;
    }

    let ciphertext;

    try {
        ciphertext = await crypto.subtle.encrypt(params, cryptoKey, plaintextBytes);
    } catch (error) {
        throw error;
    }

    const encodedIv = bufferToBase64(iv);
    const encodedCiphertext = bufferToBase64(ciphertext);

    return {
        iv: encodedIv,
        ciphertext: encodedCiphertext
    };
}

async function open(cryptoKey, ivBase64, ciphertextBase64, aad = null) {
    if (!(cryptoKey instanceof CryptoKey)) {
        throw new Error(
            'OPEN_KEY_IS_NOT_CRYPTOKEY'
        );
    }

    if (!cryptoKey.usages?.includes('decrypt')) {
        throw new Error(
            'OPEN_KEY_MISSING_DECRYPT_USAGE'
        );
    }

    let iv;

    try {
        iv = new Uint8Array(base64ToBuffer(ivBase64));
    } catch (error) {
        throw error;
    }

    let ciphertext;

    try {ciphertext = base64ToBuffer(ciphertextBase64);
    } catch (error) {
        throw error;
    }

    const params = {
        name: AES_ALG,
        iv
    };

    if (aad) {
        params.additionalData = aad;
    }

    try {
        const plaintext =
            await crypto.subtle.decrypt(
                params,
                cryptoKey,
                ciphertext
            );

        return plaintext;

    } catch (error) {
        throw error;
    }
}

async function importCak(rawBytes) {
    try {
        const key = await crypto.subtle.importKey(
                'raw',
                rawBytes,
                {
                    name: AES_ALG
                },
                false,
                [
                    'encrypt',
                    'decrypt'
                ]
            );

        return key;

    } catch (error) {
        throw error;
    }
}

const archiveAad = (conversationId, epoch) => {
    const value = `archive:v1:${conversationId}:${epoch}`;

    const result = stringToBuffer(value);

    return result;
};


const cakAad = (conversationId, epoch) => {
    const value = `cak:${conversationId}:${epoch}`;

    const result = stringToBuffer(value);

    return result;
};

export const archiveCrypto = {

    async getKey(conversationId, epoch) {
        if (conversationId === undefined || conversationId === null) {
            throw new Error(
                'ARCHIVE_CONVERSATION_ID_MISSING'
            );
        }

        if (
            epoch === undefined ||
            epoch === null
        ) {
            throw new Error(
                'ARCHIVE_EPOCH_MISSING'
            );
        }

        const normalizedConversationId = String(conversationId);

        const normalizedEpoch = Number(epoch);

        let cached;

        try {
            cached = await archiveKeyRepo.get(normalizedConversationId, normalizedEpoch);

        } catch (error) {
            throw error;
        }

        if (cached?.key instanceof CryptoKey) {
            return cached.key;
        }


        if (cached?.keyBytes) {
            try {
                const key = await importCak(new Uint8Array(cached.keyBytes));
                await archiveKeyRepo.put({
                    conversationId:
                    normalizedConversationId,
                    epoch:
                    normalizedEpoch,
                    key
                });

                return key;

            } catch (error) {
                throw error;
            }
        }

        let ack;

        try {
            ack = await rpc(SOCKET_EVENTS.CONVERSATION_GET_KEY,
                {conversationId: normalizedConversationId, epoch: normalizedEpoch}
            );

        } catch (error) {
            throw error;
        }

        if (!ack?.key) {
            throw new Error(`NO_ARCHIVE_KEY:${normalizedConversationId}:${normalizedEpoch}`);
        }

        let keyBytes;

        try {
            keyBytes = await this.unwrapToKey(ack.key);
        } catch (error) {
            throw error;
        }

        let key;

        try {

            key = await importCak(keyBytes);

        } finally {
            keyBytes.fill(0);
        }
        if (
            !(key instanceof CryptoKey)
        ) {
            throw new Error('UNWRAPPED_CAK_IS_NOT_CRYPTOKEY');
        }

        try {

            await archiveKeyRepo.put({
                conversationId:
                normalizedConversationId,
                epoch:
                    Number(ack.key.epoch),
                key
            });

        } catch (error) {
            throw error;
        }

        return key;
    },

    async unwrapToKey(keyRow) {
        let mbk;
        try {
            mbk = await mbkStore.require();
        } catch (error) {
            throw error;
        }

        try {

            const aad =
                cakAad(keyRow.conversationId, keyRow.epoch);

            const plain = await open(mbk, keyRow.iv, keyRow.ciphertext, aad);

            const bytes = new Uint8Array(plain);

            return bytes;

        } catch (error) {
            throw error;
        }
    },

    async unwrapToBytes(keyRow) {
        const mbk = await mbkStore.require();

        const plain =
            await open(mbk, keyRow.iv, keyRow.ciphertext, cakAad(keyRow.conversationId, keyRow.epoch));

        const bytes = new Uint8Array(plain);

        return bytes;
    },

    async createKey(conversationId, epoch = 1) {
        const bytes = randomBytes(32);

        try {
            await this.wrapAndUpload(conversationId, epoch, bytes);

            const key = await importCak(bytes);

            await archiveKeyRepo.put({conversationId, epoch, key});

            return {key, bytes};

        } catch (error) {
            bytes.fill(0);
            throw error;
        }
    },

    async wrapAndUpload(conversationId, epoch, cakBytes, {mode = 'copy'}) {
        let mbk;

        try {
            mbk = await mbkStore.require();

        } catch (error) {
            throw error;
        }

        let sealed;

        try {
            sealed = await seal(mbk, cakBytes, cakAad(conversationId, epoch));
        } catch (error) {
            throw error;
        }

        const blobGeneration =
            await metaRepo.get('vault.generation', 1);

        const payload = { conversationId, epoch, iv: sealed.iv, ciphertext: sealed.ciphertext, blobGeneration, mode };

        try {
            const ack = await rpc(SOCKET_EVENTS.CONVERSATION_PUT_KEY, payload);
        } catch (error) {
            throw error;
        }

        return sealed;
    },

    async restoreAllKeys({ onProgress } = {}) {
        let cursor = await metaRepo.get(META_KEYS.ARCHIVE_KEYS_CURSOR, null);

        let total = 0;

        for (;;) {
            let ack;
            try {
                ack = await rpc(SOCKET_EVENTS.CONVERSATION_LIST_KEYS, {sinceId: cursor, limit: 500});

            } catch (error) {
                throw error;
            }

            if (!ack.keys?.length) {
                break;
            }
            const unwrapped = [];

            for (const row of ack.keys) {
                try {
                    const key = await this.unwrapToKey(row);

                    const cryptoKey = await importCak(key);

                    key.fill(0);

                    unwrapped.push({conversationId: String(row.conversationId), epoch: Number(row.epoch), key: cryptoKey});

                } catch (error) {
                    // Skipping unwrappable CAK
                }
            }

            await archiveKeyRepo.putMany(unwrapped);

            total += unwrapped.length;

            cursor = ack.nextCursor;

            await metaRepo.set(META_KEYS.ARCHIVE_KEYS_CURSOR, cursor);

            onProgress?.({done: total});

            if (!ack.hasMore) {
                break;
            }
        }

        return total;
    },

    async encryptArchive(conversationId, epoch, bodyObject) {
        if (conversationId === undefined || conversationId === null) {
            throw new Error('ENCRYPT_ARCHIVE_CONVERSATION_ID_MISSING');
        }

        if (epoch === undefined || epoch === null) {
            throw new Error('ENCRYPT_ARCHIVE_EPOCH_MISSING');
        }

        if (bodyObject === undefined || bodyObject === null) {
            throw new Error('ENCRYPT_ARCHIVE_BODY_MISSING');
        }

        let json;

        try {
            json = JSON.stringify(bodyObject);

        } catch (error) {
            throw error;
        }
        const plaintextBytes = stringToBuffer(json);

        let key;

        try {
            key = await this.getKey(conversationId, epoch);
        } catch (error) {
            throw error;
        }

        if (!(key instanceof CryptoKey)) {
            throw new Error('ARCHIVE_KEY_IS_NOT_CRYPTOKEY');
        }

        if (!key.usages?.includes('encrypt')) {
            throw new Error('ARCHIVE_KEY_MISSING_ENCRYPT_USAGE');
        }

        const aad = archiveAad(conversationId, epoch);

        let sealed;

        try {
            sealed = await seal(key, plaintextBytes, aad);
        } catch (error) {
            throw error;
        }

        const payload = {v: 1, epoch, iv: sealed.iv, ciphertext: sealed.ciphertext};

        return payload;
    },

    async decryptArchive(conversationId, row) {
        if (row.isRevoked || !row.payload?.ciphertext) {
            return {...toRow(row), isRevoked: true, body: null};
        }

        const epoch = row.payload.epoch ?? 1;

        let key;

        try {
            key = await this.getKey(conversationId, epoch);
        } catch (error) {
            throw error;
        }

        const aad = archiveAad(conversationId, epoch);

        let plain;

        try {

            plain = await open(key, row.payload.iv, row.payload.ciphertext, aad);

        } catch (error) {
            throw error;
        }

        let body;

        try {
            body = JSON.parse(bufferToString(plain));

        } catch (error) {
            throw error;
        }

        return {
            ...toRow(row),
            body
        };
    },

    async decryptMany(conversationId, rows) {
        const out = [];

        for (const row of rows) {

            try {
                out.push(await this.decryptArchive(conversationId, row));

            } catch (error) {
                out.push({...toRow(row), body: null, undecryptable: true});
            }
        }
        return out;
    },

    async handleRekey(conversationId, keyEpoch) {
        const row = await conversationRepo.get(String(conversationId));
        if (!row) return 'awaitingKey';           // sidebar not synced yet
        await conversationRepo.patch(row._id, { keyEpoch });   // sending must use the new epoch
        return this.ensureArchiveKey({ ...row, keyEpoch });
    },

    async acceptDistributedKey(envelope, body) {
        const {conversationId, epoch, keyBase64} = body;

        const existing = await archiveKeyRepo.get(conversationId, epoch);
        if (existing?.key) {
            // We already hold a key for this epoch: never replace it with a
            // distributed one, or our own history would become unreadable.
            return { accepted: false, reason: 'ALREADY_HAVE_KEY' };
        }

        if (!conversationId) {
            throw new Error('DISTRIBUTED_CAK_CONVERSATION_ID_MISSING');
        }

        if (epoch === undefined || epoch === null) {
            throw new Error('DISTRIBUTED_CAK_EPOCH_MISSING');
        }

        if (!keyBase64) {
            throw new Error('DISTRIBUTED_CAK_BYTES_MISSING');
        }

        const bytes = new Uint8Array(base64ToBuffer(keyBase64));

        try {
            let alreadyHave = false;
            try {
                await this.getKey(conversationId, epoch);
                alreadyHave = true;
            } catch (e) {
                // Anything other than "no key exists" is a real error. Rethrow it so
                // drainEnvelopes leaves the envelope queued for a later retry.
                if (e?.code !== ERROR_CODES.NO_ARCHIVE_KEY) throw e;
            }
            if (alreadyHave) return { accepted: false, reason: 'ALREADY_HAVE_KEY' };

            await this.wrapAndUpload(conversationId, epoch, bytes);

            const key = await importCak(bytes);

            await archiveKeyRepo.put({conversationId, epoch, key});

        } catch (error) {
            throw error;

        } finally {
            bytes.fill(0);
        }
    }
};

function toRow(row) {
    const result = {conversationId: String(row.conversationId),

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

    return result;
}