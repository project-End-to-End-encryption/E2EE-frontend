import { bufferToBase64, base64ToBuffer, stringToBuffer } from '../../shared/utils/encoding.js';

/**
 * RECOVERY KEY
 *
 * This module was imported by vaultService.js but did not exist in the tree.
 * It is written to that file's existing contract exactly - createAndDownload,
 * newSalt, deriveVaultKeys, readKeyFromFile, RecoveryKeyError - so vaultService
 * is unchanged and there is only ever one recovery-key parser.
 *
 * The recovery key is 32 random bytes. It exists in exactly two places:
 *
 *   1. the .key file the user downloads and stores themselves
 *   2. JS memory, for the few milliseconds it takes to derive the vault key
 *
 * It is never written to localStorage, sessionStorage, IndexedDB or a cookie,
 * and it never leaves the browser. What the server holds is the OUTPUT of the
 * derivation: a salt, an iteration count, a one-way verifier and ciphertext.
 *
 *      recovery key (file)
 *            |  PBKDF2-SHA256, 210k iterations, per-account salt
 *            v
 *      64 derived bytes
 *            |
 *            +-- bytes 0..31  -> vault key   (unwraps the MBK, stays local)
 *            +-- bytes 32..63 -> verifier    (uploaded; proves the file matches
 *                                             the account without revealing it)
 */

const KEY_BYTES = 32;
const SALT_BYTES = 16;
const DERIVED_BYTES = 64;

const BEGIN = '-----BEGIN E2EE RECOVERY KEY-----';
const END = '-----END E2EE RECOVERY KEY-----';

export class RecoveryKeyError extends Error {
    constructor(code, message) {
        super(message || code);
        this.name = 'RecoveryKeyError';
        this.code = code;
    }
}

const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

/**
 * The file the user keeps. Readable enough that someone finding it in six
 * months knows what it is and that losing it is not recoverable.
 */
function renderKeyFile(keyBase64, username) {
    return [
        'E2EE RECOVERY KEY',
        'version: 1',
        `account: @${username ?? 'unknown'}`,
        `created: ${new Date().toISOString()}`,
        '',
        'This file is the ONLY way to read your chat history on a new device.',
        'Anyone holding this file can do the same. Store it somewhere private.',
        'It cannot be reissued - if you lose it, your history is unrecoverable.',
        '',
        BEGIN,
        keyBase64,
        END,
        ''
    ].join('\n');
}

/** Pull the key out of a file we wrote, or out of a bare base64 paste. */
function parseKeyFile(text) {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) throw new RecoveryKeyError('RECOVERY_KEY_INVALID', 'The file is empty.');

    let candidate = null;

    const begin = trimmed.indexOf(BEGIN);
    const end = trimmed.indexOf(END);

    if (begin !== -1 && end > begin) {
        candidate = trimmed.slice(begin + BEGIN.length, end).replace(/\s+/g, '');
    } else {
        // Tolerate a file that is just the key on one line - people do edit
        // these by hand, and failing on whitespace helps nobody.
        const line = trimmed.split(/\r?\n/).map((l) => l.trim()).find((l) => /^[A-Za-z0-9+/]{40,}={0,2}$/.test(l));
        candidate = line ?? null;
    }

    if (!candidate) {
        throw new RecoveryKeyError('RECOVERY_KEY_INVALID', 'No recovery key found in that file.');
    }

    let keyBytes;
    try {
        keyBytes = new Uint8Array(base64ToBuffer(candidate));
    } catch {
        throw new RecoveryKeyError('RECOVERY_KEY_INVALID', 'That recovery key is not readable.');
    }

    if (keyBytes.length !== KEY_BYTES) {
        keyBytes.fill(0);
        throw new RecoveryKeyError('RECOVERY_KEY_INVALID', 'That recovery key is the wrong length.');
    }

    return keyBytes;
}

function triggerDownload(contents, filename) {
    const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    } finally {
        // Give the browser a tick to start the download before the blob goes.
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
}

export const recoveryKey = {

    RecoveryKeyError,

    KEY_BYTES,

    /**
     * Mint a new recovery key and hand the file to the user.
     *
     * Callers own `keyBytes` and MUST zero them - vaultService already does
     * this in its finally blocks.
     */
    async createAndDownload({ username } = {}) {
        const keyBytes = randomBytes(KEY_BYTES);
        const keyBase64 = bufferToBase64(keyBytes);

        const filename = `e2ee-recovery-${username || 'account'}-${new Date()
            .toISOString().slice(0, 10)}.key`;

        triggerDownload(renderKeyFile(keyBase64, username), filename);

        return { keyBytes, keyBase64, filename };
    },

    /** Re-download a key the caller already holds, without minting a new one. */
    downloadExisting({ keyBase64, username } = {}) {
        if (!keyBase64) {
            throw new RecoveryKeyError('RECOVERY_KEY_INVALID', 'No key to download.');
        }
        const filename = `e2ee-recovery-${username || 'account'}-${new Date()
            .toISOString().slice(0, 10)}.key`;

        triggerDownload(renderKeyFile(keyBase64, username), filename);
        return { filename };
    },

    newSalt() {
        return bufferToBase64(randomBytes(SALT_BYTES));
    },

    /**
     * PBKDF2 over the raw key bytes.
     *
     * @returns {{vaultKey: Uint8Array, verifier: string}}
     */
    async deriveVaultKeys(keyBytes, { saltBase64, iterations = 210000 } = {}) {
        if (!(keyBytes instanceof Uint8Array) || keyBytes.length !== KEY_BYTES) {
            throw new RecoveryKeyError('RECOVERY_KEY_INVALID', 'Recovery key is malformed.');
        }
        if (!saltBase64) {
            throw new RecoveryKeyError('RECOVERY_KEY_INVALID', 'Missing KDF salt.');
        }

        const baseKey = await crypto.subtle.importKey(
            'raw', keyBytes, 'PBKDF2', false, ['deriveBits']
        );

        const derived = new Uint8Array(await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                hash: 'SHA-256',
                salt: new Uint8Array(base64ToBuffer(saltBase64)),
                iterations: Number(iterations)
            },
            baseKey,
            DERIVED_BYTES * 8
        ));

        try {
            return {
                vaultKey: derived.slice(0, 32),
                verifier: bufferToBase64(derived.slice(32))
            };
        } finally {
            derived.fill(0);
        }
    },

    /**
     * Read a .key file the user picked.
     * @returns {{keyBytes: Uint8Array}}
     */
    async readKeyFromFile(file) {
        if (!file) {
            throw new RecoveryKeyError('RECOVERY_KEY_INVALID', 'No file selected.');
        }
        // A real key file is well under a kilobyte. Anything larger is a
        // mis-click, and reading it would be pointless work.
        if (file.size > 64 * 1024) {
            throw new RecoveryKeyError('RECOVERY_KEY_INVALID', 'That file is not a recovery key.');
        }

        const text = await file.text();
        return { keyBytes: parseKeyFile(text) };
    },

    /** Exposed for tests and for the paste-a-key path. */
    parseKeyFile,

    fingerprint: async (keyBytes) => {
        const digest = await crypto.subtle.digest('SHA-256', keyBytes);
        return bufferToBase64(digest).slice(0, 12);
    },

    _stringToBuffer: stringToBuffer
};

export default recoveryKey;
