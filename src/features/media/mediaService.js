import { rpc } from '../../infrastructure/websocket/socketRpc.js';
import { SOCKET_EVENTS } from '../../shared/constants/socketEvents.js';
import { bus, TOPICS } from '../../infrastructure/websocket/eventBus.js';
import { ERROR_CODES, fail } from '../../shared/constants/errorCodes.js';
import { mediaCrypto } from './mediaCrypto.js';
import { uploadTransport } from './uploadTransport.js';

/**
 * MEDIA SERVICE
 *
 *   Composer
 *      |
 *   useMediaUpload (React)
 *      |
 *   mediaService            <- you are here: orchestration only
 *      |
 *      +-- mediaCrypto      client-side encryption
 *      +-- uploadTransport  presigned PUT / GET
 *      +-- socket RPC       media:requestUpload / media:completeUpload
 *
 * The API is deliberately storage-agnostic: requestUpload / uploadEncryptedMedia /
 * completeUpload / downloadEncryptedMedia. Nothing in this file (or anywhere
 * above it) mentions MinIO, buckets or regions - the backend hands over a
 * self-describing grant and swapping to S3 changes nothing here.
 */

/** Plaintext ceiling. The server enforces its own on the ciphertext. */
export const MAX_FILE_BYTES = 200 * 1024 * 1024;

const CATEGORY_BY_PREFIX = [
    ['image/', 'image'],
    ['video/', 'video'],
    ['audio/', 'audio']
];

/**
 * Category is a coarse rendering hint, not a whitelist: anything that is not
 * image/video/audio is 'file', which covers PDFs, text documents, ZIPs and
 * everything else. There is no allow-list of three types anywhere.
 */
export const categoryOf = (file) => {
    const type = (file?.type || '').toLowerCase();
    for (const [prefix, category] of CATEGORY_BY_PREFIX) {
        if (type.startsWith(prefix)) return category;
    }
    return 'file';
};

/** Cheap client-side checks before any crypto work happens. */
export const describeFile = (file) => {
    if (!file || typeof file.size !== 'number') {
        fail(ERROR_CODES.INVALID_MEDIA, 'That file could not be read');
    }
    if (file.size === 0) {
        fail(ERROR_CODES.INVALID_MEDIA, 'That file is empty');
    }
    if (file.size > MAX_FILE_BYTES) {
        fail(ERROR_CODES.FILE_TOO_LARGE, 'That file is too large to send');
    }

    return {
        originalFileName: file.name || 'attachment',
        // Browsers leave type empty for unknown extensions; keep a sane default
        // rather than rejecting the file.
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        category: categoryOf(file)
    };
};

export const mediaService = {

    categoryOf,
    describeFile,

    /** Ask the server for object keys and short-lived PUT grants. */
    async requestUpload(conversationId, attachments) {
        try {
            return await rpc(SOCKET_EVENTS.MEDIA_REQUEST_UPLOAD, { conversationId, attachments });
        } catch (error) {
            throw mapRpcError(error, ERROR_CODES.UPLOAD_FAILED);
        }
    },

    /** Push ciphertext straight at storage. Never touches the API server. */
    async uploadEncryptedMedia(grant, ciphertextBlob, options) {
        return uploadTransport.putEncrypted(grant.upload ?? grant, ciphertextBlob, options);
    },

    /** Confirm the object landed; get back the descriptors message:send wants. */
    async completeUpload(conversationId, uploads) {
        try {
            const ack = await rpc(SOCKET_EVENTS.MEDIA_COMPLETE_UPLOAD, { conversationId, uploads });
            return ack.attachments ?? [];
        } catch (error) {
            throw mapRpcError(error, ERROR_CODES.UPLOAD_FAILED);
        }
    },

    async abortUpload(conversationId, attachmentId) {
        try {
            await rpc(SOCKET_EVENTS.MEDIA_ABORT_UPLOAD, { conversationId, attachmentId });
        } catch {
            // Cleanup is best effort; the grant expires on its own.
        }
    },

    /**
     * Encrypt one file and get it into storage.
     *
     * Returns both halves of the result, and they go to different places:
     *
     *   serverAttachment -> message:send `attachments` (opaque metadata)
     *   bodyAttachment   -> the message BODY (file name, mime type, media key)
     *
     * The media key is in the second one, which is why it is only ever seen by
     * the conversation's members.
     */
    async encryptAndUpload(conversationId, file, { onProgress, signal } = {}) {
        const described = describeFile(file);

        const [grantResponse] = [await this.requestUpload(conversationId, [{
            category: described.category,
            // GCM adds a 12-byte IV and a 16-byte tag per 4 MiB frame, plus a
            // 12-byte header. Declaring it up front lets the server reject an
            // oversized upload before any bytes move.
            encryptedSize: estimateEncryptedSize(described.size)
        }])];

        const grant = grantResponse.grants?.[0];
        if (!grant) fail(ERROR_CODES.UPLOAD_FAILED, 'Server did not issue an upload grant');

        const keyBytes = mediaCrypto.generateMediaKeyBytes();
        let keyBase64 = null;

        try {
            const sealed = await mediaCrypto.encryptBlob(file, {
                attachmentId: grant.attachmentId,
                keyBytes,
                onProgress: (progress) => emitProgress(conversationId, grant.attachmentId, progress, onProgress),
                signal
            });

            await this.uploadEncryptedMedia(grant, sealed.ciphertext, {
                onProgress: (progress) => emitProgress(conversationId, grant.attachmentId, progress, onProgress),
                signal
            });

            const [serverAttachment] = await this.completeUpload(conversationId, [{
                attachmentId: grant.attachmentId,
                storageKey: grant.storageKey,
                sha256: sealed.sha256
            }]);

            keyBase64 = mediaCrypto.keyToBase64(keyBytes);

            return {
                serverAttachment,
                bodyAttachment: {
                    attachmentId: grant.attachmentId,
                    storageKey: grant.storageKey,
                    category: described.category,
                    // Everything below this line describes the PLAINTEXT and
                    // therefore lives only inside the encrypted body.
                    originalFileName: described.originalFileName,
                    mimeType: described.mimeType,
                    size: described.size,
                    encryptedSize: sealed.encryptedSize,
                    sha256: sealed.sha256,
                    keyBase64,
                    createdAt: Date.now()
                }
            };
        } catch (error) {
            void this.abortUpload(conversationId, grant.attachmentId);
            throw error;
        } finally {
            // The raw key is gone from memory the moment it has been base64'd
            // into the body that the ratchet is about to seal.
            keyBytes.fill(0);
        }
    },

    /**
     * Fetch and open an attachment.
     * @returns {Promise<Blob>} decrypted, ready for an object URL.
     */
    async downloadEncryptedMedia(conversationId, bodyAttachment, { onProgress, signal } = {}) {
        if (!bodyAttachment?.keyBase64) {
            fail(ERROR_CODES.DECRYPTION_FAILED, 'This attachment has no key on this device');
        }

        let ack;
        try {
            ack = await rpc(SOCKET_EVENTS.MEDIA_REQUEST_DOWNLOAD, {
                conversationId,
                storageKeys: [bodyAttachment.storageKey]
            });
        } catch (error) {
            throw mapRpcError(error, ERROR_CODES.DOWNLOAD_FAILED);
        }

        const target = ack.downloads?.[0];
        if (!target?.url) fail(ERROR_CODES.DOWNLOAD_FAILED, 'No download URL returned');

        const ciphertext = await uploadTransport.getEncrypted(target.url, { onProgress, signal });

        const keyBytes = mediaCrypto.keyFromBase64(bodyAttachment.keyBase64);
        try {
            return await mediaCrypto.decryptBlob(ciphertext, {
                attachmentId: bodyAttachment.attachmentId,
                keyBytes,
                mimeType: bodyAttachment.mimeType,
                onProgress,
                signal
            });
        } finally {
            keyBytes.fill(0);
        }
    }
};

function estimateEncryptedSize(plaintextSize) {
    const frames = Math.max(1, Math.ceil(plaintextSize / mediaCrypto.DEFAULT_CHUNK_SIZE));
    return 12 + plaintextSize + frames * (12 + 16);
}

function emitProgress(conversationId, attachmentId, progress, onProgress) {
    onProgress?.(progress);
    bus.emit(TOPICS.MEDIA_UPLOAD_PROGRESS, { conversationId, attachmentId, ...progress });
}

function mapRpcError(error, fallbackCode) {
    // A disconnected socket surfaces as a TIMEOUT from socketRpc; say the
    // useful thing instead of the literal one.
    if (error?.code === 'TIMEOUT') {
        const wrapped = new Error('You appear to be offline');
        wrapped.code = ERROR_CODES.SOCKET_DISCONNECTED;
        return wrapped;
    }
    if (!error?.code) {
        const wrapped = new Error(error?.message || 'Transfer failed');
        wrapped.code = fallbackCode;
        return wrapped;
    }
    return error;
}

export default mediaService;
