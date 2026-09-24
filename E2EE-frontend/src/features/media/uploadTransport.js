import { ERROR_CODES, fail } from '../../shared/constants/errorCodes.js';

/**
 * UPLOAD / DOWNLOAD TRANSPORT
 *
 * Takes a grant - {url, method, headers} - and moves bytes. It does not know
 * or care whether the other end is MinIO, S3, R2 or a local disk stub; the
 * grant came from the backend's StorageRepository and describes itself.
 *
 * There is deliberately no minio import, no bucket name and no region here.
 */

/** XHR rather than fetch: upload progress events do not exist on fetch. */
export function putEncrypted(grant, blob, { onProgress, signal } = {}) {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open(grant.method || 'PUT', grant.url, true);

        for (const [header, value] of Object.entries(grant.headers || {})) {
            request.setRequestHeader(header, value);
        }

        request.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                onProgress?.({ phase: 'upload', done: event.loaded, total: event.total });
            }
        };

        request.onload = () => {
            if (request.status >= 200 && request.status < 300) return resolve({ ok: true });
            reject(asError(ERROR_CODES.UPLOAD_FAILED, `Storage responded ${request.status}`));
        };

        request.onerror = () => reject(asError(ERROR_CODES.UPLOAD_FAILED, 'Network error during upload'));
        request.ontimeout = () => reject(asError(ERROR_CODES.UPLOAD_FAILED, 'Upload timed out'));
        request.onabort = () => reject(asError(ERROR_CODES.UPLOAD_FAILED, 'Upload cancelled'));

        signal?.addEventListener('abort', () => request.abort(), { once: true });

        request.send(blob);
    });
}

/** Pull ciphertext back. Still encrypted at this point - decryption is separate. */
export async function getEncrypted(url, { onProgress, signal } = {}) {
    let response;
    try {
        response = await fetch(url, { signal, credentials: 'omit' });
    } catch (error) {
        fail(ERROR_CODES.DOWNLOAD_FAILED, error.message);
    }

    if (!response.ok) {
        fail(ERROR_CODES.DOWNLOAD_FAILED, `Storage responded ${response.status}`);
    }

    // Progress needs a readable stream and a content length; without either,
    // fall back to a plain blob() rather than pretending to report progress.
    const total = Number(response.headers.get('content-length')) || 0;
    if (!onProgress || !total || !response.body) {
        return response.blob();
    }

    const reader = response.body.getReader();
    const chunks = [];
    let done = 0;

    for (;;) {
        const { done: finished, value } = await reader.read();
        if (finished) break;
        chunks.push(value);
        done += value.byteLength;
        onProgress({ phase: 'download', done, total });
    }

    return new Blob(chunks, { type: 'application/octet-stream' });
}

function asError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

export const uploadTransport = { putEncrypted, getEncrypted };
export default uploadTransport;
