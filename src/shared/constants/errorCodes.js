/**
 * ERROR CODES
 *
 * The server already speaks in codes: socket acks come back as
 * {ok: false, error: 'CODE'} and RpcError.code carries that string through.
 * This file is the client-side vocabulary for the same convention - the codes
 * the browser raises on its own (encryption, file selection, offline socket)
 * plus the server codes the UI needs to say something specific about.
 *
 * Nothing here duplicates an existing code. NOT_A_MEMBER, RATE_LIMIT,
 * INVALID_PAYLOAD, MESSAGE_TOO_LARGE and friends are raised by the backend and
 * arrive as-is.
 */

export const ERROR_CODES = {
    // media - client side
    ENCRYPTION_FAILED: 'ENCRYPTION_FAILED',
    DECRYPTION_FAILED: 'DECRYPTION_FAILED',
    INVALID_MEDIA: 'INVALID_MEDIA',
    FILE_TOO_LARGE: 'FILE_TOO_LARGE',
    UNSUPPORTED_MEDIA: 'UNSUPPORTED_MEDIA',

    // media - transport
    UPLOAD_FAILED: 'UPLOAD_FAILED',
    DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',

    // transport
    SOCKET_DISCONNECTED: 'SOCKET_DISCONNECTED',

    // search
    SEARCH_FAILED: 'SEARCH_FAILED',
    NO_SEARCH_RESULTS: 'NO_SEARCH_RESULTS',
    INVALID_SEARCH_QUERY: 'INVALID_SEARCH_QUERY',

    // keys / recovery
    MBK_NOT_LOADED: 'MBK_NOT_LOADED',
    RECOVERY_KEY_INVALID: 'RECOVERY_KEY_INVALID',
    NO_ARCHIVE_KEY: 'NO_ARCHIVE_KEY'
};

/** An error that carries a code, so callers can branch without string matching. */
export class AppError extends Error {
    constructor(code, message, extra = {}) {
        super(message || code);
        this.name = 'AppError';
        this.code = code;
        Object.assign(this, extra);
    }
}

export const fail = (code, message, extra) => {
    throw new AppError(code, message, extra);
};

/** One place that decides what a user actually reads. */
export const MESSAGES = {
    ENCRYPTION_FAILED: 'This file could not be encrypted, so it was not sent.',
    DECRYPTION_FAILED: 'This attachment could not be decrypted on this device.',
    INVALID_MEDIA: 'That file could not be read.',
    FILE_TOO_LARGE: 'That file is too large to send.',
    UNSUPPORTED_MEDIA: 'That file type cannot be sent.',
    UPLOAD_FAILED: 'The upload did not finish. Try again.',
    DOWNLOAD_FAILED: 'The attachment could not be downloaded.',
    SOCKET_DISCONNECTED: 'You are offline. This will retry when you reconnect.',
    SEARCH_FAILED: 'Search is unavailable right now.',
    NO_SEARCH_RESULTS: 'No one matched that.',
    INVALID_SEARCH_QUERY: 'Type at least two characters.',
    MBK_NOT_LOADED: 'Upload your recovery key to unlock your history on this device.',
    RECOVERY_KEY_INVALID: 'That does not look like a valid recovery key file.',
    NO_ARCHIVE_KEY: 'Waiting for this conversation\u2019s key to arrive.',
    TIMEOUT: 'The server did not respond. Try again.',
    RATE_LIMIT: 'Slow down for a moment and try again.'
};

export const messageFor = (error) =>
    MESSAGES[error?.code] || error?.message || 'Something went wrong.';
