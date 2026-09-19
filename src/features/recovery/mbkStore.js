import { keyStorage } from '../../infrastructure/crypto/storage/keyStorage.js';

const MBK_ALGORITHM = { name: 'AES-GCM' };
const MBK_USAGES = ['encrypt', 'decrypt'];

let mbkKey = null;          // CryptoKey | null
let waiters = [];
let initPromise = null;     // dedupes concurrent init() calls

/* -------------------------------------------------------------------------- */


async function importNonExtractable(rawBytes) {
    if (!(rawBytes instanceof Uint8Array) || rawBytes.length !== 32) {
        throw new Error('MBK_INVALID_LENGTH');
    }
    return crypto.subtle.importKey('raw', rawBytes, MBK_ALGORITHM, false, MBK_USAGES);
}

function resolveWaiters(key) {
    const pending = waiters;
    waiters = [];
    for (const resolve of pending) resolve(key);
}


export const mbkStore = {


    async init() {
        if (mbkKey) return true;
        if (initPromise) return initPromise;

        initPromise = (async () => {
            try {
                const stored = await keyStorage.getMasterBackupKey();

                if (!stored) return false;


                if (stored.extractable !== false) {
                    console.error('[mbkStore] persisted key is extractable - discarding it');
                    await keyStorage.deleteMasterBackupKey();
                    return false;
                }

                mbkKey = stored;
                resolveWaiters(mbkKey);
                return true;

            } catch (error) {

                console.warn('[mbkStore] init failed, continuing without a local MBK:', error.message);
                return false;
            } finally {
                initPromise = null;
            }
        })();

        return initPromise;
    },

    async set(rawBytes, { persist = true } = {}) {
        const key = await importNonExtractable(rawBytes);

        if (persist) {
            try {
                await keyStorage.saveMasterBackupKey(key);
            } catch (error) {
                // Storage failure must not break the session. The user simply
                // has to upload the recovery file again next launch.
                console.warn('[mbkStore] could not persist MBK:', error.message);
            }
        }

        mbkKey = key;
        resolveWaiters(key);
        return key;
    },

    async setKey(cryptoKey, { persist = true } = {}) {
        if (!(cryptoKey instanceof CryptoKey)) throw new Error('MBK_NOT_A_CRYPTOKEY');
        if (cryptoKey.extractable !== false) throw new Error('MBK_MUST_BE_NON_EXTRACTABLE');

        if (persist) {
            try {
                await keyStorage.saveMasterBackupKey(cryptoKey);
            } catch (error) {
                console.warn('[mbkStore] could not persist MBK:', error.message);
            }
        }

        mbkKey = cryptoKey;
        resolveWaiters(cryptoKey);
        return cryptoKey;
    },

    /** @returns {CryptoKey|null} */
    get() { return mbkKey; },

    has() { return mbkKey !== null; },

    async require() {
        if (mbkKey) return mbkKey;

        // One lazy attempt, for callers that ran before init() completed.
        await this.init();
        if (mbkKey) return mbkKey;

        const error = new Error('MBK_NOT_LOADED');
        error.code = 'MBK_NOT_LOADED';
        throw error;
    },

    async waitFor({ timeout = 120000 } = {}) {
        if (mbkKey) return mbkKey;

        await this.init();
        if (mbkKey) return mbkKey;

        return new Promise((resolve, reject) => {
            const onReady = (key) => { clearTimeout(timer); resolve(key); };

            const timer = setTimeout(() => {
                waiters = waiters.filter((w) => w !== onReady);
                reject(new Error('MBK_TIMEOUT'));
            }, timeout);

            waiters.push(onReady);
        });
    },

    async clear({ persistent = false } = {}) {
        if (persistent) {
            try {
                await keyStorage.deleteMasterBackupKey();
            } catch (error) {
                console.warn('[mbkStore] could not delete persisted MBK:', error.message);
            }
        }

        mbkKey = null;


        const pending = waiters;
        waiters = [];
        for (const resolve of pending) resolve(null);
    }
};