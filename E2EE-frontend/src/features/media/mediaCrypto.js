import { bufferToBase64, base64ToBuffer, stringToBuffer } from '../../shared/utils/encoding.js';
import { ERROR_CODES, fail } from '../../shared/constants/errorCodes.js';

/**
 * MEDIA CRYPTO
 *
 * One random AES-256-GCM key per file. The file is sealed here, in the tab,
 * before a single byte is handed to the upload transport. The storage bucket
 * only ever holds this module's output.
 *
 * The key itself is not managed here. It is handed back to the caller as raw
 * bytes, goes into the message body, and from that point it is protected by
 * the SAME machinery as the message text:
 *
 *      body {..., attachments:[{keyBase64}]}
 *              |
 *              +--> archiveCrypto.encryptArchive()  -> sealed under the CAK,
 *              |                                       which is itself sealed
 *              |                                       under the MBK
 *              |
 *              +--> SessionManager.encryptDirectMessage() -> sealed under the
 *                                                            Double Ratchet,
 *                                                            per device
 *
 * So there is no second key-management system: a media key is just another
 * field of a message, and it inherits the conversation's security properties
 * for both direct chats and groups.
 *
 * FRAMING
 *
 *   header : 'E2M1' | version(1) | reserved(3) | chunkSize(uint32 BE)
 *   chunk  : iv(12) | ciphertext+tag
 *
 * Chunked for three reasons: a 200 MB video never exists as one plaintext
 * Uint8Array; the ciphertext is assembled as a Blob, which the browser is free
 * to spill to disk; and the same frame format is what a future streaming or
 * resumable upload would emit, so the storage layer can change without the
 * format changing.
 *
 * Each chunk's AAD binds the attachment id, the chunk index and whether the
 * chunk is the last one. Reordering, splicing in a chunk from another file and
 * truncating the tail all fail to authenticate.
 */

const MAGIC = 'E2M1';
const VERSION = 1;
const HEADER_BYTES = 12;
const IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

/** 4 MiB plaintext per frame. Big enough to be cheap, small enough to stream. */
export const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024;

/** Above this, the ciphertext digest is skipped rather than re-read in full. */
const SHA256_CEILING_BYTES = 32 * 1024 * 1024;

const chunkAad = (attachmentId, index, isLast) =>
    stringToBuffer(`media:v1:${attachmentId}:${index}:${isLast ? 1 : 0}`);

const importMediaKey = (rawBytes, usages) =>
    crypto.subtle.importKey('raw', rawBytes, { name: 'AES-GCM' }, false, usages);

function buildHeader(chunkSize) {
    const header = new Uint8Array(HEADER_BYTES);
    header.set(stringToBuffer(MAGIC), 0);
    header[4] = VERSION;
    new DataView(header.buffer).setUint32(8, chunkSize, false);
    return header;
}

function readHeader(bytes) {
    const magic = String.fromCharCode(...bytes.subarray(0, 4));
    if (magic !== MAGIC) fail(ERROR_CODES.DECRYPTION_FAILED, 'Not an encrypted media object');

    const version = bytes[4];
    if (version !== VERSION) {
        fail(ERROR_CODES.DECRYPTION_FAILED, `Unsupported media format v${version}`);
    }

    const chunkSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8, false);
    if (!chunkSize) fail(ERROR_CODES.DECRYPTION_FAILED, 'Corrupt media header');

    return { version, chunkSize };
}

/** 32 fresh bytes. The caller is responsible for zeroing them when done. */
export const generateMediaKeyBytes = () => crypto.getRandomValues(new Uint8Array(32));

export const mediaCrypto = {

    DEFAULT_CHUNK_SIZE,

    /**
     * Seal a File/Blob.
     *
     * @returns {Promise<{ciphertext: Blob, encryptedSize: number, chunkSize: number,
     *                    chunkCount: number, sha256: string|null}>}
     */
    async encryptBlob(source, { attachmentId, keyBytes, chunkSize = DEFAULT_CHUNK_SIZE, onProgress, signal } = {}) {
        if (!attachmentId) fail(ERROR_CODES.ENCRYPTION_FAILED, 'attachmentId required');
        if (!(source instanceof Blob)) fail(ERROR_CODES.INVALID_MEDIA, 'Not a readable file');
        if (!source.size) fail(ERROR_CODES.INVALID_MEDIA, 'File is empty');

        const key = await importMediaKey(keyBytes, ['encrypt']);

        const chunkCount = Math.max(1, Math.ceil(source.size / chunkSize));
        const parts = [buildHeader(chunkSize)];
        let encryptedSize = HEADER_BYTES;

        try {
            for (let index = 0; index < chunkCount; index++) {
                if (signal?.aborted) fail(ERROR_CODES.UPLOAD_FAILED, 'Cancelled');

                const start = index * chunkSize;
                const slice = source.slice(start, Math.min(start + chunkSize, source.size));
                const plaintext = await slice.arrayBuffer();

                const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
                const sealed = await crypto.subtle.encrypt(
                    {
                        name: 'AES-GCM',
                        iv,
                        additionalData: chunkAad(attachmentId, index, index === chunkCount - 1)
                    },
                    key,
                    plaintext
                );

                parts.push(iv, sealed);
                encryptedSize += IV_BYTES + sealed.byteLength;

                onProgress?.({
                    phase: 'encrypt',
                    done: Math.min(start + chunkSize, source.size),
                    total: source.size
                });
            }
        } catch (error) {
            if (error?.code) throw error;
            fail(ERROR_CODES.ENCRYPTION_FAILED, error.message);
        }

        const ciphertext = new Blob(parts, { type: 'application/octet-stream' });

        return {
            ciphertext,
            encryptedSize,
            chunkSize,
            chunkCount,
            sha256: await digestOf(ciphertext)
        };
    },

    /**
     * Open a sealed object back into a Blob the browser can render.
     * `mimeType` comes from the encrypted message body, never from storage.
     */
    async decryptBlob(cipherSource, { attachmentId, keyBytes, mimeType = 'application/octet-stream', onProgress, signal } = {}) {
        if (!attachmentId) fail(ERROR_CODES.DECRYPTION_FAILED, 'attachmentId required');
        if (!(cipherSource instanceof Blob)) fail(ERROR_CODES.DECRYPTION_FAILED, 'Not a readable object');

        const headerBytes = new Uint8Array(await cipherSource.slice(0, HEADER_BYTES).arrayBuffer());
        const { chunkSize } = readHeader(headerBytes);

        const key = await importMediaKey(keyBytes, ['decrypt']);

        const frameSize = IV_BYTES + chunkSize + GCM_TAG_BYTES;
        const bodySize = cipherSource.size - HEADER_BYTES;
        const chunkCount = Math.max(1, Math.ceil(bodySize / frameSize));

        const parts = [];

        try {
            for (let index = 0; index < chunkCount; index++) {
                if (signal?.aborted) fail(ERROR_CODES.DOWNLOAD_FAILED, 'Cancelled');

                const start = HEADER_BYTES + index * frameSize;
                const end = Math.min(start + frameSize, cipherSource.size);

                const frame = new Uint8Array(await cipherSource.slice(start, end).arrayBuffer());
                const iv = frame.subarray(0, IV_BYTES);
                const sealed = frame.subarray(IV_BYTES);

                const plaintext = await crypto.subtle.decrypt(
                    {
                        name: 'AES-GCM',
                        iv,
                        additionalData: chunkAad(attachmentId, index, index === chunkCount - 1)
                    },
                    key,
                    sealed
                );

                parts.push(plaintext);
                onProgress?.({ phase: 'decrypt', done: end, total: cipherSource.size });
            }
        } catch (error) {
            if (error?.code) throw error;
            // A GCM failure here means the bytes were altered, truncated, or
            // the key is wrong. All three are the same answer to the user.
            fail(ERROR_CODES.DECRYPTION_FAILED, 'Authentication failed');
        }

        return new Blob(parts, { type: mimeType });
    },

    keyToBase64: (keyBytes) => bufferToBase64(keyBytes),

    keyFromBase64: (keyBase64) => new Uint8Array(base64ToBuffer(keyBase64)),

    generateMediaKeyBytes
};

/**
 * SHA-256 over the ciphertext. Integrity of the bytes at rest - it tells you
 * nothing about the plaintext, which is why it is safe to hand to the server.
 * Skipped for very large objects: digesting requires the whole buffer in
 * memory and GCM already authenticates every chunk on the way out.
 */
async function digestOf(blob) {
    if (blob.size > SHA256_CEILING_BYTES) return null;
    try {
        const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
        return bufferToBase64(digest);
    } catch {
        return null;
    }
}

export default mediaCrypto;
