import { rpc } from '../../../infrastructure/websocket/socketRpc.js';
import { SOCKET_EVENTS } from '../../../shared/constants/socketEvents.js';
import {
    archiveKeyRepo,
    metaRepo,
    META_KEYS, conversationRepo
} from '../../../infrastructure/storage/repos.js';

import {
    bufferToBase64,
    base64ToBuffer,
    stringToBuffer,
    bufferToString
} from '../../../shared/utils/encoding.js';

import { mbkStore } from '../../recovery/mbkStore.js';


const AES_ALG = 'AES-GCM';
const IV_BYTES = 12;


/* =========================================================
 * DEBUG HELPERS
 * ========================================================= */

const now = () => new Date().toISOString();

const elapsed = (start) => `${Date.now() - start}ms`;

const describeError = (error) => ({
    name: error?.name,
    message: error?.message,
    code: error?.code,
    stack: error?.stack
});

const describeCryptoKey = (key) => ({
    exists: !!key,
    isCryptoKey: key instanceof CryptoKey,
    constructor: key?.constructor?.name,
    type: key?.type,
    algorithm: key?.algorithm,
    extractable: key?.extractable,
    usages: key?.usages
});

const describeBytes = (bytes) => ({
    exists: bytes != null,
    constructor: bytes?.constructor?.name,
    byteLength: bytes?.byteLength,
    length: bytes?.length
});

const describeRow = (row) => ({
    conversationId: row?.conversationId != null
        ? String(row.conversationId)
        : undefined,

    epoch: row?.epoch != null
        ? Number(row.epoch)
        : undefined,

    ivExists: !!row?.iv,
    ivLength: row?.iv?.length,

    ciphertextExists: !!row?.ciphertext,
    ciphertextLength: row?.ciphertext?.length,

    hasPayload: !!row?.payload,

    payloadEpoch: row?.payload?.epoch,

    seq: row?.seq,

    messageId: row?._id != null
        ? String(row._id)
        : undefined,

    clientMessageId: row?.clientMessageId
});


/* =========================================================
 * RANDOM BYTES
 * ========================================================= */

const randomBytes = (n) => {

    const result = crypto.getRandomValues(
        new Uint8Array(n)
    );

    return result;
};


/* =========================================================
 * AES-GCM SEAL
 * ========================================================= */

async function seal(
    cryptoKey,
    plaintextBytes,
    aad = null
) {
    const start = Date.now();

    if (!(cryptoKey instanceof CryptoKey)) {
        throw new Error(
            'SEAL_KEY_IS_NOT_CRYPTOKEY'
        );
    }

    if (!cryptoKey.usages?.includes('encrypt')) {
        console.error(
            '[SEAL] FATAL: key does not have encrypt usage',
            cryptoKey.usages
        );

        console.groupEnd();

        throw new Error(
            'SEAL_KEY_MISSING_ENCRYPT_USAGE'
        );
    }

    if (!plaintextBytes) {
        console.error(
            '[SEAL] FATAL: plaintextBytes is missing'
        );

        console.groupEnd();

        throw new Error(
            'SEAL_PLAINTEXT_MISSING'
        );
    }

    const iv = randomBytes(IV_BYTES);

    console.log('[SEAL] IV CREATED', {
        ivLength: iv.length,
        ivBytes: Array.from(iv)
    });

    const params = {
        name: AES_ALG,
        iv
    };

    if (aad) {
        params.additionalData = aad;
    }

    console.log(
        '[SEAL] crypto.subtle.encrypt PARAMETERS',
        {
            algorithm: params.name,
            ivLength: params.iv.length,
            aadExists: !!params.additionalData,
            aadLength: params.additionalData?.length,
            plaintextLength: plaintextBytes.byteLength
        }
    );

    console.log(
        '[SEAL] BEFORE crypto.subtle.encrypt'
    );

    let ciphertext;

    try {
        ciphertext = await crypto.subtle.encrypt(
            params,
            cryptoKey,
            plaintextBytes
        );
    } catch (error) {
        console.error(
            '[SEAL] crypto.subtle.encrypt FAILED',
            {
                elapsed: elapsed(start),
                error: describeError(error),
                key: describeCryptoKey(cryptoKey),
                params: {
                    name: params.name,
                    ivLength: params.iv?.length,
                    aadLength:
                    params.additionalData?.length
                },
                plaintext:
                    describeBytes(plaintextBytes)
            }
        );

        console.groupEnd();

        throw error;
    }

    console.log(
        '[SEAL] ENCRYPT SUCCESS',
        {
            elapsed: elapsed(start),
            ciphertextBytes:
            ciphertext.byteLength
        }
    );

    const encodedIv = bufferToBase64(iv);
    const encodedCiphertext =
        bufferToBase64(ciphertext);

    console.log(
        '[SEAL] BASE64 ENCODE SUCCESS',
        {
            ivLength: encodedIv?.length,
            ciphertextLength:
            encodedCiphertext?.length
        }
    );

    console.log(
        '[SEAL] COMPLETE',
        {
            elapsed: elapsed(start)
        }
    );

    console.groupEnd();

    return {
        iv: encodedIv,
        ciphertext: encodedCiphertext
    };
}


/* =========================================================
 * AES-GCM OPEN
 * ========================================================= */

async function open(
    cryptoKey,
    ivBase64,
    ciphertextBase64,
    aad = null
) {
    const start = Date.now();

    console.groupCollapsed(
        `%c[OPEN] START`,
        'color: #aa66ff; font-weight: bold;'
    );

    console.log('[OPEN] key:', describeCryptoKey(cryptoKey));

    console.log('[OPEN] inputs:', {
        ivBase64Length: ivBase64?.length,
        ciphertextBase64Length:
        ciphertextBase64?.length,
        aadLength: aad?.length
    });

    if (!(cryptoKey instanceof CryptoKey)) {
        console.error(
            '[OPEN] FATAL: key is not CryptoKey'
        );

        console.groupEnd();

        throw new Error(
            'OPEN_KEY_IS_NOT_CRYPTOKEY'
        );
    }

    if (!cryptoKey.usages?.includes('decrypt')) {
        console.error(
            '[OPEN] FATAL: key does not have decrypt usage',
            cryptoKey.usages
        );

        console.groupEnd();

        throw new Error(
            'OPEN_KEY_MISSING_DECRYPT_USAGE'
        );
    }

    let iv;

    try {
        iv = new Uint8Array(
            base64ToBuffer(ivBase64)
        );
    } catch (error) {
        console.error(
            '[OPEN] IV decode FAILED',
            describeError(error)
        );

        console.groupEnd();

        throw error;
    }

    let ciphertext;

    try {
        ciphertext =
            base64ToBuffer(ciphertextBase64);
    } catch (error) {
        console.error(
            '[OPEN] ciphertext decode FAILED',
            describeError(error)
        );

        console.groupEnd();

        throw error;
    }

    console.log('[OPEN] decoded inputs:', {
        ivLength: iv.length,
        ciphertextLength:
        ciphertext.byteLength,
        aadLength: aad?.length
    });

    const params = {
        name: AES_ALG,
        iv
    };

    if (aad) {
        params.additionalData = aad;
    }

    console.log(
        '[OPEN] BEFORE crypto.subtle.decrypt'
    );

    try {
        const plaintext =
            await crypto.subtle.decrypt(
                params,
                cryptoKey,
                ciphertext
            );

        console.log(
            '[OPEN] DECRYPT SUCCESS',
            {
                elapsed: elapsed(start),
                plaintextBytes:
                plaintext.byteLength
            }
        );

        console.groupEnd();

        return plaintext;

    } catch (error) {
        console.error(
            '[OPEN] crypto.subtle.decrypt FAILED',
            {
                elapsed: elapsed(start),
                error: describeError(error),
                key: describeCryptoKey(cryptoKey),
                ivLength: iv.length,
                ciphertextLength:
                ciphertext.byteLength,
                aadLength: aad?.length
            }
        );

        console.groupEnd();

        throw error;
    }
}


/* =========================================================
 * IMPORT CAK
 * ========================================================= */

async function importCak(rawBytes) {
    const start = Date.now();

    console.log(
        '[CAK] importCak START',
        {
            bytes: describeBytes(rawBytes)
        }
    );

    try {
        const key =
            await crypto.subtle.importKey(
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

        console.log(
            '[CAK] importCak SUCCESS',
            {
                elapsed: elapsed(start),
                key: describeCryptoKey(key)
            }
        );

        return key;

    } catch (error) {
        console.error(
            '[CAK] importCak FAILED',
            {
                elapsed: elapsed(start),
                error: describeError(error),
                bytes:
                    describeBytes(rawBytes)
            }
        );

        throw error;
    }
}


/* =========================================================
 * AAD
 * ========================================================= */

const archiveAad = (
    conversationId,
    epoch
) => {
    const value =
        `archive:v1:${conversationId}:${epoch}`;

    const result =
        stringToBuffer(value);

    console.log(
        '[AAD] archiveAad',
        {
            conversationId,
            epoch,
            value,
            byteLength: result.byteLength
        }
    );

    return result;
};


const cakAad = (
    conversationId,
    epoch
) => {
    const value =
        `cak:${conversationId}:${epoch}`;

    const result =
        stringToBuffer(value);

    console.log(
        '[AAD] cakAad',
        {
            conversationId,
            epoch,
            value,
            byteLength: result.byteLength
        }
    );

    return result;
};


/* =========================================================
 * ARCHIVE CRYPTO
 * ========================================================= */

export const archiveCrypto = {


    /* =====================================================
     * GET CAK
     * ===================================================== */

    async getKey(conversationId, epoch) {
        const start = Date.now();

        console.groupCollapsed(
            `%c[CAK] getKey START`,
            'color: orange; font-weight: bold;'
        );

        console.log(
            '[CAK] request',
            {
                conversationId:
                    String(conversationId),
                epoch:
                    Number(epoch),
                timestamp: now()
            }
        );

        if (conversationId === undefined || conversationId === null) {
            console.error(
                '[CAK] INVALID conversationId',
                conversationId
            );

            console.groupEnd();

            throw new Error(
                'ARCHIVE_CONVERSATION_ID_MISSING'
            );
        }

        if (
            epoch === undefined ||
            epoch === null
        ) {
            console.error(
                '[CAK] INVALID epoch',
                epoch
            );

            console.groupEnd();

            throw new Error(
                'ARCHIVE_EPOCH_MISSING'
            );
        }

        const normalizedConversationId =
            String(conversationId);

        const normalizedEpoch =
            Number(epoch);

        console.log(
            '[CAK] normalized request',
            {
                conversationId:
                normalizedConversationId,
                epoch:
                normalizedEpoch
            }
        );


        /* -----------------------------------------------
         * CACHE LOOKUP
         * ----------------------------------------------- */

        console.log(
            '[CAK] CACHE LOOKUP START'
        );

        let cached;

        try {
            cached =
                await archiveKeyRepo.get(
                    normalizedConversationId,
                    normalizedEpoch
                );

            console.log(
                '[CAK] CACHE LOOKUP COMPLETE',
                {
                    elapsed: elapsed(start),
                    found: !!cached,
                    cached
                }
            );

        } catch (error) {
            console.error(
                '[CAK] CACHE LOOKUP FAILED',
                {
                    elapsed: elapsed(start),
                    error:
                        describeError(error)
                }
            );

            console.groupEnd();

            throw error;
        }


        /* -----------------------------------------------
         * CACHE: CRYPTOKEY
         * ----------------------------------------------- */

        console.log(
            '[CAK] CACHE KEY INSPECTION',
            {
                cachedExists: !!cached,
                cachedKey:
                    describeCryptoKey(cached?.key),
                cachedKeyBytes:
                    describeBytes(cached?.keyBytes)
            }
        );

        if (cached?.key instanceof CryptoKey) {
            console.log(
                '[CAK] USING CACHED CRYPTOKEY',
                {
                    conversationId:
                    normalizedConversationId,
                    epoch:
                    normalizedEpoch,
                    key:
                        describeCryptoKey(
                            cached.key
                        ),
                    elapsed:
                        elapsed(start)
                }
            );

            console.groupEnd();

            return cached.key;
        }


        /* -----------------------------------------------
         * CACHE: RAW KEY BYTES
         * ----------------------------------------------- */

        if (cached?.keyBytes) {

            console.log(
                '[CAK] FOUND CACHED KEY BYTES',
                {
                    bytes:
                        describeBytes(
                            cached.keyBytes
                        )
                }
            );

            try {

                const key =
                    await importCak(
                        new Uint8Array(
                            cached.keyBytes
                        )
                    );

                console.log(
                    '[CAK] CACHED KEY BYTES IMPORTED',
                    {
                        key:
                            describeCryptoKey(
                                key
                            )
                    }
                );

                await archiveKeyRepo.put({
                    conversationId:
                    normalizedConversationId,
                    epoch:
                    normalizedEpoch,
                    key
                });

                console.log(
                    '[CAK] CACHED KEY RE-STORED'
                );

                console.groupEnd();

                return key;

            } catch (error) {

                console.error(
                    '[CAK] CACHED KEY BYTES PATH FAILED',
                    {
                        elapsed:
                            elapsed(start),
                        error:
                            describeError(error)
                    }
                );

                console.groupEnd();

                throw error;
            }
        }


        /* -----------------------------------------------
         * SERVER FETCH
         * ----------------------------------------------- */

        console.log(
            '[CAK] CACHE MISS'
        );

        console.log(
            '[CAK] FETCHING KEY FROM SERVER',
            {
                event:
                SOCKET_EVENTS.CONVERSATION_GET_KEY,
                conversationId:
                normalizedConversationId,
                epoch:
                normalizedEpoch
            }
        );

        let ack;

        try {

            const rpcStart =
                Date.now();

            ack = await rpc(
                SOCKET_EVENTS.CONVERSATION_GET_KEY,
                {
                    conversationId:
                    normalizedConversationId,
                    epoch:
                    normalizedEpoch
                }
            );

            console.log(
                '[CAK] SERVER RPC SUCCESS',
                {
                    elapsed:
                        elapsed(rpcStart),
                    ack
                }
            );

        } catch (error) {

            console.error(
                '[CAK] SERVER RPC FAILED',
                {
                    elapsed:
                        elapsed(start),
                    error:
                        describeError(error),
                    event:
                    SOCKET_EVENTS.CONVERSATION_GET_KEY
                }
            );

            console.groupEnd();

            throw error;
        }


        /* -----------------------------------------------
         * SERVER RESPONSE VALIDATION
         * ----------------------------------------------- */

        console.log(
            '[CAK] SERVER RESPONSE INSPECTION',
            {
                ackExists: !!ack,
                hasKey: !!ack?.key,
                key:
                    ack?.key
                        ? describeRow(ack.key)
                        : null
            }
        );

        if (!ack?.key) {

            console.error(
                '[CAK] SERVER RETURNED NO KEY',
                {
                    conversationId:
                    normalizedConversationId,
                    epoch:
                    normalizedEpoch,
                    ack
                }
            );

            console.groupEnd();

            throw new Error(
                `NO_ARCHIVE_KEY:${normalizedConversationId}:${normalizedEpoch}`
            );
        }


        /* -----------------------------------------------
         * UNWRAP
         * ----------------------------------------------- */

        console.log(
            '[CAK] STARTING SERVER CAK UNWRAP'
        );

        let keyBytes;

        try {

            keyBytes =
                await this.unwrapToKey(
                    ack.key
                );

        } catch (error) {

            console.error(
                '[CAK] SERVER CAK UNWRAP FAILED',
                {
                    elapsed:
                        elapsed(start),
                    error:
                        describeError(error),
                    row:
                        describeRow(ack.key)
                }
            );

            console.groupEnd();

            throw error;
        }


        /* -----------------------------------------------
         * IMPORT UNWRAPPED CAK
         * ----------------------------------------------- */

        console.log(
            '[CAK] UNWRAPPED BYTES',
            {
                ...describeBytes(keyBytes),
                firstBytes:
                    Array.from(
                        keyBytes.slice(0, 16)
                    )
            }
        );

        let key;

        try {

            key =
                await importCak(
                    keyBytes
                );

        } finally {

            console.log(
                '[CAK] ZEROING UNWRAPPED CAK BYTES'
            );

            keyBytes.fill(0);
        }


        console.log(
            '[CAK] SERVER KEY AFTER UNWRAP',
            {
                key:
                    describeCryptoKey(key),
            }
        );

        if (
            !(key instanceof CryptoKey)
        ) {

            console.error(
                '[CAK] FATAL: UNWRAPPED CAK IS NOT CRYPTOKEY'
            );

            console.groupEnd();

            throw new Error(
                'UNWRAPPED_CAK_IS_NOT_CRYPTOKEY'
            );
        }


        /* -----------------------------------------------
         * CACHE NEW KEY
         * ----------------------------------------------- */

        console.log(
            '[CAK] SAVING UNWRAPPED KEY TO CACHE',
            {
                conversationId:
                normalizedConversationId,
                requestedEpoch:
                normalizedEpoch,
                returnedEpoch:
                ack.key.epoch
            }
        );

        try {

            await archiveKeyRepo.put({
                conversationId:
                normalizedConversationId,
                epoch:
                    Number(ack.key.epoch),
                key
            });

            console.log(
                '[CAK] KEY SAVED TO CACHE'
            );

        } catch (error) {

            console.error(
                '[CAK] FAILED TO SAVE KEY TO CACHE',
                {
                    error:
                        describeError(error)
                }
            );

            console.groupEnd();

            throw error;
        }


        console.log(
            '[CAK] getKey COMPLETE',
            {
                elapsed:
                    elapsed(start),
                conversationId:
                normalizedConversationId,
                epoch:
                normalizedEpoch,
                key:
                    describeCryptoKey(key)
            }
        );

        console.groupEnd();

        return key;
    },


    /* =====================================================
     * UNWRAP TO KEY BYTES
     * ===================================================== */

    async unwrapToKey(
        keyRow
    ) {
        const start = Date.now();

        console.groupCollapsed(
            `%c[CAK] unwrapToKey START`,
            'color: #ff8800; font-weight: bold;'
        );

        console.log(
            '[CAK] attempting unwrap',
            {
                conversationId:
                    String(
                        keyRow?.conversationId
                    ),
                epoch:
                    Number(keyRow?.epoch),
                hasMBK:
                    mbkStore.has(),
                mbk:
                    describeCryptoKey(
                        mbkStore.get()
                    ),
                ivLength:
                keyRow?.iv?.length,
                ciphertextLength:
                keyRow?.ciphertext?.length
            }
        );

        console.log(
            '[CAK] key row',
            describeRow(keyRow)
        );

        let mbk;

        try {

            mbk =
                await mbkStore.require();

            console.log(
                '[CAK] MBK LOADED',
                {
                    elapsed:
                        elapsed(start),
                    mbk:
                        describeCryptoKey(mbk)
                }
            );

        } catch (error) {

            console.error(
                '[CAK] MBK REQUIRE FAILED',
                {
                    elapsed:
                        elapsed(start),
                    error:
                        describeError(error)
                }
            );

            console.groupEnd();

            throw error;
        }


        try {

            const aad =
                cakAad(
                    keyRow.conversationId,
                    keyRow.epoch
                );

            console.log(
                '[CAK] BEFORE UNWRAP decrypt',
                {
                    aad:
                        bufferToString(aad),
                    aadLength:
                    aad.length,
                    ivLength:
                    keyRow.iv?.length,
                    ciphertextLength:
                    keyRow.ciphertext?.length
                }
            );

            const plain =
                await open(
                    mbk,
                    keyRow.iv,
                    keyRow.ciphertext,
                    aad
                );

            console.log(
                '[CAK] unwrap SUCCESS',
                {
                    elapsed:
                        elapsed(start),
                    conversationId:
                        String(
                            keyRow.conversationId
                        ),
                    epoch:
                        Number(
                            keyRow.epoch
                        ),
                    plaintextLength:
                    plain.byteLength
                }
            );

            const bytes =
                new Uint8Array(plain);

            console.log(
                '[CAK] UNWRAPPED CAK BYTES',
                {
                    byteLength:
                    bytes.byteLength,
                    expected:
                        32
                }
            );

            if (bytes.byteLength !== 32) {

                console.error(
                    '[CAK] WARNING: CAK IS NOT 32 BYTES',
                    {
                        actual:
                        bytes.byteLength
                    }
                );
            }

            console.groupEnd();

            return bytes;

        } catch (error) {

            console.error(
                '[CAK] unwrap FAILED',
                {
                    elapsed:
                        elapsed(start),
                    conversationId:
                        String(
                            keyRow?.conversationId
                        ),
                    epoch:
                        Number(
                            keyRow?.epoch
                        ),
                    errorName:
                    error?.name,
                    errorMessage:
                    error?.message,
                    stack:
                    error?.stack
                }
            );

            console.groupEnd();

            throw error;
        }
    },


    /* =====================================================
     * UNWRAP TO BYTES
     * ===================================================== */

    async unwrapToBytes(
        keyRow
    ) {
        const start = Date.now();

        console.log(
            '[CAK] unwrapToBytes START',
            {
                conversationId:
                    String(
                        keyRow?.conversationId
                    ),
                epoch:
                    Number(keyRow?.epoch)
            }
        );

        const mbk =
            await mbkStore.require();

        console.log(
            '[CAK] unwrapToBytes MBK READY',
            describeCryptoKey(mbk)
        );

        const plain =
            await open(
                mbk,
                keyRow.iv,
                keyRow.ciphertext,
                cakAad(
                    keyRow.conversationId,
                    keyRow.epoch
                )
            );

        const bytes =
            new Uint8Array(plain);

        console.log(
            '[CAK] unwrapToBytes SUCCESS',
            {
                elapsed:
                    elapsed(start),
                bytes:
                    describeBytes(bytes)
            }
        );

        return bytes;
    },


    /* =====================================================
     * CREATE CAK
     * ===================================================== */

    async createKey(
        conversationId,
        epoch = 1
    ) {
        const start = Date.now();

        console.groupCollapsed(
            `%c[CAK] createKey START`,
            'color: #00cc66; font-weight: bold;'
        );

        console.log(
            '[CAK] createKey INPUT',
            {
                conversationId,
                epoch
            }
        );

        const bytes =
            randomBytes(32);

        console.log(
            '[CAK] GENERATED NEW CAK',
            {
                byteLength:
                bytes.byteLength
            }
        );

        try {

            await this.wrapAndUpload(
                conversationId,
                epoch,
                bytes
            );

            console.log(
                '[CAK] wrapAndUpload SUCCESS'
            );

            const key =
                await importCak(bytes);

            console.log(
                '[CAK] NEW CAK IMPORTED',
                describeCryptoKey(key)
            );

            await archiveKeyRepo.put({
                conversationId,
                epoch,
                key
            });

            console.log(
                '[CAK] NEW CAK CACHED'
            );

            console.log(
                '[CAK] createKey COMPLETE',
                {
                    elapsed:
                        elapsed(start)
                }
            );

            console.groupEnd();

            return {
                key,
                bytes
            };

        } catch (error) {

            console.error(
                '[CAK] createKey FAILED',
                {
                    elapsed:
                        elapsed(start),
                    error:
                        describeError(error)
                }
            );

            bytes.fill(0);

            console.log(
                '[CAK] GENERATED CAK BYTES ZEROED'
            );

            console.groupEnd();

            throw error;
        }
    },


    /* =====================================================
     * WRAP + UPLOAD CAK
     * ===================================================== */

    async wrapAndUpload(conversationId, epoch, cakBytes, {mode = 'copy'}) {
        const start = Date.now();

        console.groupCollapsed(
            `%c[CAK] wrapAndUpload START`,
            'color: #00cc66; font-weight: bold;'
        );

        console.log(
            '[CAK] wrapAndUpload INPUT',
            {
                conversationId,
                epoch,
                cakBytes:
                    describeBytes(cakBytes)
            }
        );

        let mbk;

        try {
            mbk =
                await mbkStore.require();

            console.log(
                '[CAK] MBK READY FOR WRAP',
                describeCryptoKey(mbk)
            );

        } catch (error) {

            console.error(
                '[CAK] MBK REQUIRE FAILED',
                {
                    error:
                        describeError(error)
                }
            );

            console.groupEnd();

            throw error;
        }

        let sealed;

        try {

            sealed =
                await seal(
                    mbk,
                    cakBytes,
                    cakAad(
                        conversationId,
                        epoch
                    )
                );

            console.log(
                '[CAK] CAK WRAPPED SUCCESSFULLY',
                {
                    ivLength:
                    sealed.iv?.length,
                    ciphertextLength:
                    sealed.ciphertext?.length
                }
            );

        } catch (error) {

            console.error(
                '[CAK] CAK WRAP FAILED',
                {
                    error:
                        describeError(error)
                }
            );

            console.groupEnd();

            throw error;
        }


        const blobGeneration =
            await metaRepo.get(
                'vault.generation',
                1
            );

        console.log(
            '[CAK] VAULT GENERATION',
            {
                blobGeneration
            }
        );


        const payload = { conversationId, epoch, iv: sealed.iv,
            ciphertext: sealed.ciphertext, blobGeneration, mode };

        console.log(
            '[CAK] PUT KEY RPC REQUEST',
            {
                event:
                SOCKET_EVENTS.CONVERSATION_PUT_KEY,
                payload
            }
        );


        try {

            const ack =
                await rpc(
                    SOCKET_EVENTS.CONVERSATION_PUT_KEY,
                    payload
                );

            console.log(
                '[CAK] PUT KEY RPC SUCCESS',
                {
                    elapsed:
                        elapsed(start),
                    ack
                }
            );

        } catch (error) {

            console.error(
                '[CAK] PUT KEY RPC FAILED',
                {
                    elapsed:
                        elapsed(start),
                    error:
                        describeError(error)
                }
            );

            console.groupEnd();

            throw error;
        }

        console.log(
            '[CAK] wrapAndUpload COMPLETE',
            {
                elapsed:
                    elapsed(start)
            }
        );

        console.groupEnd();

        return sealed;
    },


    /* =====================================================
     * RESTORE ALL KEYS
     * ===================================================== */

    async restoreAllKeys({ onProgress } = {}) {
        const start = Date.now();

        console.groupCollapsed(
            `%c[CAK] restoreAllKeys START`,
            'color: #0099ff; font-weight: bold;'
        );

        let cursor =
            await metaRepo.get(
                META_KEYS.ARCHIVE_KEYS_CURSOR,
                null
            );

        console.log(
            '[CAK] RESTORE CURSOR',
            {
                cursor
            }
        );

        let total = 0;

        for (;;) {

            console.log(
                '[CAK] LIST KEYS RPC',
                {
                    sinceId: cursor,
                    limit: 500
                }
            );

            let ack;

            try {

                ack =
                    await rpc(
                        SOCKET_EVENTS.CONVERSATION_LIST_KEYS,
                        {
                            sinceId: cursor,
                            limit: 500
                        }
                    );

                console.log(
                    '[CAK] LIST KEYS RESPONSE',
                    {
                        keyCount:
                        ack?.keys?.length,
                        nextCursor:
                        ack?.nextCursor,
                        hasMore:
                        ack?.hasMore
                    }
                );

            } catch (error) {

                console.error(
                    '[CAK] LIST KEYS RPC FAILED',
                    {
                        error:
                            describeError(error)
                    }
                );

                console.groupEnd();

                throw error;
            }


            if (!ack.keys?.length) {

                console.log(
                    '[CAK] NO MORE KEYS'
                );

                break;
            }


            const unwrapped = [];

            for (
                const row of ack.keys
                ) {

                console.groupCollapsed(
                    '[CAK] RESTORE KEY'
                );

                console.log(
                    '[CAK] ROW',
                    describeRow(row)
                );

                try {

                    const key =
                        await this.unwrapToKey(
                            row
                        );

                    console.log(
                        '[CAK] RESTORE KEY UNWRAPPED',
                        {
                            keyBytes:
                                describeBytes(key)
                        }
                    );

                    /*
                     * IMPORTANT:
                     * unwrapToKey() returns RAW BYTES.
                     * Convert them to CryptoKey before caching.
                     */

                    const cryptoKey =
                        await importCak(key);

                    key.fill(0);

                    unwrapped.push({
                        conversationId:
                            String(
                                row.conversationId
                            ),
                        epoch:
                            Number(row.epoch),
                        key: cryptoKey
                    });

                    console.log(
                        '[CAK] RESTORE KEY IMPORTED',
                        {
                            conversationId:
                                String(
                                    row.conversationId
                                ),
                            epoch:
                                Number(row.epoch),
                            key:
                                describeCryptoKey(
                                    cryptoKey
                                )
                        }
                    );

                } catch (error) {

                    console.debug(
                        '[archiveCrypto] skipping unwrappable CAK',
                        {
                            conversationId:
                            row?.conversationId,
                            epoch:
                            row?.epoch,
                            error:
                                describeError(error)
                        }
                    );

                } finally {

                    console.groupEnd();
                }
            }


            console.log(
                '[CAK] SAVING RESTORED KEYS',
                {
                    count:
                    unwrapped.length
                }
            );

            await archiveKeyRepo.putMany(
                unwrapped
            );

            total +=
                unwrapped.length;

            cursor =
                ack.nextCursor;

            await metaRepo.set(
                META_KEYS.ARCHIVE_KEYS_CURSOR,
                cursor
            );

            console.log(
                '[CAK] RESTORE PAGE COMPLETE',
                {
                    total,
                    cursor,
                    hasMore:
                    ack.hasMore
                }
            );

            onProgress?.({
                done: total
            });

            if (!ack.hasMore) {
                break;
            }
        }

        console.log(
            '[CAK] restoreAllKeys COMPLETE',
            {
                total,
                elapsed:
                    elapsed(start)
            }
        );

        console.groupEnd();

        return total;
    },


    /* =====================================================
     * ENCRYPT ARCHIVE
     * ===================================================== */

    async encryptArchive(
        conversationId,
        epoch,
        bodyObject
    ) {
        const start = Date.now();

        console.groupCollapsed(
            `%c[SEND] encryptArchive START`,
            'color: #00ccff; font-weight: bold;'
        );

        console.log(
            '[SEND] timestamp:',
            now()
        );

        console.log(
            '[SEND] INPUT',
            {
                conversationId:
                    String(conversationId),
                epoch:
                    Number(epoch),
                bodyObject,
                bodyType:
                    typeof bodyObject,
                bodyKeys:
                    bodyObject &&
                    typeof bodyObject === 'object'
                        ? Object.keys(bodyObject)
                        : undefined
            }
        );


        /* -----------------------------------------------
         * VALIDATE INPUT
         * ----------------------------------------------- */

        if (
            conversationId === undefined ||
            conversationId === null
        ) {

            console.error(
                '[SEND] conversationId MISSING'
            );

            console.groupEnd();

            throw new Error(
                'ENCRYPT_ARCHIVE_CONVERSATION_ID_MISSING'
            );
        }

        if (
            epoch === undefined ||
            epoch === null
        ) {

            console.error(
                '[SEND] epoch MISSING'
            );

            console.groupEnd();

            throw new Error(
                'ENCRYPT_ARCHIVE_EPOCH_MISSING'
            );
        }

        if (
            bodyObject === undefined ||
            bodyObject === null
        ) {

            console.error(
                '[SEND] bodyObject MISSING'
            );

            console.groupEnd();

            throw new Error(
                'ENCRYPT_ARCHIVE_BODY_MISSING'
            );
        }


        /* -----------------------------------------------
         * SERIALIZATION TEST
         * ----------------------------------------------- */

        let json;

        try {

            json =
                JSON.stringify(bodyObject);

            console.log(
                '[SEND] JSON.stringify SUCCESS',
                {
                    jsonLength:
                    json?.length,
                    jsonPreview:
                        json?.slice(0, 500)
                }
            );

        } catch (error) {

            console.error(
                '[SEND] JSON.stringify FAILED',
                {
                    error:
                        describeError(error)
                }
            );

            console.groupEnd();

            throw error;
        }


        const plaintextBytes =
            stringToBuffer(json);

        console.log(
            '[SEND] PLAINTEXT CREATED',
            {
                ...describeBytes(
                    plaintextBytes
                )
            }
        );


        /* -----------------------------------------------
         * GET CAK
         * ----------------------------------------------- */

        console.log(
            '[SEND] BEFORE getKey()'
        );

        let key;

        try {

            key =
                await this.getKey(
                    conversationId,
                    epoch
                );

        } catch (error) {

            console.error(
                '[SEND] getKey() FAILED',
                {
                    elapsed:
                        elapsed(start),
                    conversationId,
                    epoch,
                    error:
                        describeError(error)
                }
            );

            console.groupEnd();

            throw error;
        }


        console.log(
            '[SEND] KEY RETURNED',
            {
                key:
                    describeCryptoKey(key)
            }
        );


        if (
            !(key instanceof CryptoKey)
        ) {

            console.error(
                '[SEND] FATAL: key is NOT CryptoKey'
            );

            console.groupEnd();

            throw new Error(
                'ARCHIVE_KEY_IS_NOT_CRYPTOKEY'
            );
        }

        if (
            !key.usages?.includes('encrypt')
        ) {

            console.error(
                '[SEND] FATAL: CAK has no encrypt usage',
                key.usages
            );

            console.groupEnd();

            throw new Error(
                'ARCHIVE_KEY_MISSING_ENCRYPT_USAGE'
            );
        }


        /* -----------------------------------------------
         * AAD
         * ----------------------------------------------- */

        const aad =
            archiveAad(
                conversationId,
                epoch
            );

        console.log(
            '[SEND] ARCHIVE AAD CREATED',
            {
                value:
                    bufferToString(aad),
                length:
                aad.length
            }
        );


        /* -----------------------------------------------
         * ENCRYPT
         * ----------------------------------------------- */

        console.log(
            '[SEND] BEFORE seal()'
        );

        let sealed;

        try {

            sealed =
                await seal(
                    key,
                    plaintextBytes,
                    aad
                );

        } catch (error) {

            console.error(
                '[SEND] seal() FAILED',
                {
                    elapsed:
                        elapsed(start),
                    conversationId,
                    epoch,
                    key:
                        describeCryptoKey(key),
                    plaintext:
                        describeBytes(
                            plaintextBytes
                        ),
                    aadLength:
                    aad.length,
                    error:
                        describeError(error)
                }
            );

            console.groupEnd();

            throw error;
        }


        console.log(
            '[SEND] SEAL RETURNED',
            {
                ivLength:
                sealed?.iv?.length,
                ciphertextLength:
                sealed?.ciphertext?.length
            }
        );


        /* -----------------------------------------------
         * FINAL PAYLOAD
         * ----------------------------------------------- */

        const payload = {
            v: 1,
            epoch,
            iv:
            sealed.iv,
            ciphertext:
            sealed.ciphertext
        };

        console.log(
            '[SEND] encryptArchive PAYLOAD',
            {
                payload,
                payloadSize:
                JSON.stringify(
                    payload
                ).length
            }
        );

        console.log(
            '[SEND] encryptArchive SUCCESS',
            {
                conversationId,
                epoch,
                elapsed:
                    elapsed(start)
            }
        );

        console.groupEnd();

        return payload;
    },


    /* =====================================================
     * DECRYPT ARCHIVE
     * ===================================================== */

    async decryptArchive(
        conversationId,
        row
    ) {
        const start = Date.now();

        console.groupCollapsed(
            `%c[RECV] decryptArchive START`,
            'color: #aa66ff; font-weight: bold;'
        );

        console.log(
            '[RECV] INPUT',
            {
                conversationId,
                row:
                    describeRow(row),
                isRevoked:
                row?.isRevoked,
                hasCiphertext:
                    !!row?.payload?.ciphertext
            }
        );


        if (
            row.isRevoked ||
            !row.payload?.ciphertext
        ) {

            console.log(
                '[RECV] ROW REVOKED OR EMPTY'
            );

            console.groupEnd();

            return {
                ...toRow(row),
                isRevoked: true,
                body: null
            };
        }


        const epoch =
            row.payload.epoch ?? 1;

        console.log(
            '[RECV] USING EPOCH',
            {
                epoch
            }
        );


        let key;

        try {

            key =
                await this.getKey(
                    conversationId,
                    epoch
                );

        } catch (error) {

            console.error(
                '[RECV] getKey FAILED',
                {
                    error:
                        describeError(error)
                }
            );

            console.groupEnd();

            throw error;
        }


        console.log(
            '[RECV] DECRYPT KEY',
            describeCryptoKey(key)
        );


        const aad =
            archiveAad(
                conversationId,
                epoch
            );


        let plain;

        try {

            plain =
                await open(
                    key,
                    row.payload.iv,
                    row.payload.ciphertext,
                    aad
                );

        } catch (error) {

            console.error(
                '[RECV] archive decrypt FAILED',
                {
                    error:
                        describeError(error),
                    conversationId,
                    epoch
                }
            );

            console.groupEnd();

            throw error;
        }


        let body;

        try {

            body =
                JSON.parse(
                    bufferToString(plain)
                );

        } catch (error) {

            console.error(
                '[RECV] JSON.parse FAILED',
                {
                    error:
                        describeError(error),
                    plaintextLength:
                    plain?.byteLength
                }
            );

            console.groupEnd();

            throw error;
        }


        console.log(
            '[RECV] decryptArchive SUCCESS',
            {
                elapsed:
                    elapsed(start),
                body
            }
        );

        console.groupEnd();

        return {
            ...toRow(row),
            body
        };
    },


    /* =====================================================
     * DECRYPT MANY
     * ===================================================== */

    async decryptMany(
        conversationId,
        rows
    ) {
        const start = Date.now();

        console.groupCollapsed(
            `%c[RECV] decryptMany START`,
            'color: #aa66ff; font-weight: bold;'
        );

        console.log(
            '[RECV] INPUT',
            {
                conversationId,
                rowCount:
                rows?.length
            }
        );

        const out = [];

        for (
            const row of rows
            ) {

            try {

                out.push(
                    await this.decryptArchive(
                        conversationId,
                        row
                    )
                );

            } catch (error) {

                console.warn(
                    '[archiveCrypto] undecryptable row',
                    {
                        seq:
                        row?.seq,
                        error:
                            describeError(error)
                    }
                );

                out.push({
                    ...toRow(row),
                    body: null,
                    undecryptable: true
                });
            }
        }

        console.log(
            '[RECV] decryptMany COMPLETE',
            {
                elapsed:
                    elapsed(start),
                outputCount:
                out.length
            }
        );

        console.groupEnd();

        return out;
    },


    /* =====================================================
     * ROTATE CONVERSATION KEY
     * ===================================================== */

    async handleRekey(conversationId, keyEpoch) {
        const row = await conversationRepo.get(String(conversationId));
        if (!row) return 'awaitingKey';           // sidebar not synced yet
        await conversationRepo.patch(row._id, { keyEpoch });   // sending must use the new epoch
        return this.ensureArchiveKey({ ...row, keyEpoch });
    },

    /* =====================================================
     * ACCEPT DISTRIBUTED KEY
     * ===================================================== */

    async acceptDistributedKey(envelope, body) {
        const start = Date.now();

        const {conversationId, epoch, keyBase64} = body;

        const existing = await archiveKeyRepo.get(conversationId, epoch);
        if (existing?.key) {
            // We already hold a key for this epoch: never replace it with a
            // distributed one, or our own history would become unreadable.
            return { accepted: false, reason: 'ALREADY_HAVE_KEY' };
        }

        if (!conversationId) {
            throw new Error(
                'DISTRIBUTED_CAK_CONVERSATION_ID_MISSING'
            );
        }

        if (epoch === undefined || epoch === null) {
            throw new Error(
                'DISTRIBUTED_CAK_EPOCH_MISSING'
            );
        }

        if (!keyBase64) {
            throw new Error(
                'DISTRIBUTED_CAK_BYTES_MISSING'
            );
        }

        const bytes =
            new Uint8Array(
                base64ToBuffer(
                    keyBase64
                )
            );

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

            const key =
                await importCak(
                    bytes
                );

            await archiveKeyRepo.put({
                conversationId,
                epoch,
                key
            });

        } catch (error) {
            throw error;

        } finally {
            bytes.fill(0);
        }
    }
};


/* =========================================================
 * ROW CONVERSION
 * ========================================================= */

function toRow(row) {
    const result = {
        conversationId:
            String(row.conversationId),

        seq:
        row.seq,

        messageId:
            String(row._id),

        clientMessageId:
        row.clientMessageId,

        senderId:
        row.senderId,

        senderDeviceId:
        row.senderDeviceId,

        contentType:
        row.contentType,

        sentAt:
            row.sentAt ??
            row.sendAt ??
            null,

        receivedAt:
            Date.now(),

        isRevoked:
            !!row.isRevoked,

        isOutgoing:
            false,

        state:
            'archived'
    };

    console.log(
        '[ROW] toRow',
        {
            input: row,
            output: result
        }
    );

    return result;
}