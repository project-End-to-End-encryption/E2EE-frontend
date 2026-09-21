const DB_NAME = "e2ee_keystore";
const DB_VERSION = 2;

const STORE_IDENTITY = "identityKey";
const STORE_SIGNED_PREKEY = "signedPreKey";
const STORE_ONE_TIME_PREKEYS = "oneTimePreKeys";
const STORE_MASTER_KEY = "masterBackupKey";

let dbInstance = null;
let openingPromise = null;

function openDb() {
    if (dbInstance) return Promise.resolve(dbInstance);
    if (openingPromise) return openingPromise;

    openingPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = request.result;
            const oldVersion = event.oldVersion;

            if (oldVersion < 1) {
                db.createObjectStore(STORE_IDENTITY);
                db.createObjectStore(STORE_SIGNED_PREKEY);
                db.createObjectStore(STORE_ONE_TIME_PREKEYS, { keyPath: 'keyId' });
            }

            if (oldVersion < 2) {
                if (!db.objectStoreNames.contains(STORE_MASTER_KEY)) {
                    db.createObjectStore(STORE_MASTER_KEY);
                }
            }
        };

        request.onsuccess = () => {
            const db = request.result;
            db.onclose = () => { if (dbInstance === db) dbInstance = null; };
            db.onversionchange = () => {
                db.close();
                if (dbInstance === db) dbInstance = null;
            };
            dbInstance = db;
            openingPromise = null;
            resolve(db);
        };

        request.onerror = () => {
            openingPromise = null;
            reject(request.error);
        };

        request.onblocked = () => {
            console.warn("[keyStorage] IndexedDB upgrade blocked - another tab holds v1 open");
        };
    });

    return openingPromise;
}

function wrapRequest(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function runTx(storeNames, mode, fn) {
    const db = await openDb();
    const transaction = db.transaction(storeNames, mode);
    const stores = {};
    for (const name of storeNames) stores[name] = transaction.objectStore(name);
    fn(stores);
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('TX_ABORTED'));
    });
}

export const keyStorage = {
    async hasIdentityKey() {
        const db = await openDb();
        const result = await wrapRequest(
            db.transaction(STORE_IDENTITY, 'readonly').objectStore(STORE_IDENTITY).get('current')
        );
        return !!result;
    },

    async saveIdentityKeyPair(keyPair) {
        return runTx([STORE_IDENTITY], 'readwrite', (s) => {
            s[STORE_IDENTITY].put(keyPair, 'current');
        });
    },

    async getIdentityKeyPair() {
        const db = await openDb();
        return wrapRequest(
            db.transaction(STORE_IDENTITY, 'readonly').objectStore(STORE_IDENTITY).get('current')
        );
    },

    async saveSignedPreKey(record) {
        return runTx([STORE_SIGNED_PREKEY], 'readwrite', (s) => {
            s[STORE_SIGNED_PREKEY].put(record, 'current');
        });
    },

    async getSignedPreKey() {
        const db = await openDb();
        return wrapRequest(
            db.transaction(STORE_SIGNED_PREKEY, 'readonly').objectStore(STORE_SIGNED_PREKEY).get('current')
        );
    },

    async saveOneTimePreKeys(records) {
        return runTx([STORE_ONE_TIME_PREKEYS], 'readwrite', (s) => {
            for (const record of records) s[STORE_ONE_TIME_PREKEYS].put(record);
        });
    },

    async getOneTimePreKey(keyId) {
        const db = await openDb();
        return wrapRequest(
            db.transaction(STORE_ONE_TIME_PREKEYS, 'readonly')
                .objectStore(STORE_ONE_TIME_PREKEYS).get(keyId)
        );
    },

    async deleteOneTimePreKey(keyId) {
        return runTx([STORE_ONE_TIME_PREKEYS], 'readwrite', (s) => {
            s[STORE_ONE_TIME_PREKEYS].delete(keyId);
        });
    },

    async saveMasterBackupKey(cryptoKey) {
        return runTx([STORE_MASTER_KEY], 'readwrite', (s) => {
            s[STORE_MASTER_KEY].put(cryptoKey, 'current');
        });
    },

    async getMasterBackupKey() {
        const db = await openDb();
        return wrapRequest(
            db.transaction(STORE_MASTER_KEY, 'readonly').objectStore(STORE_MASTER_KEY).get('current')
        );
    },

    async deleteMasterBackupKey() {
        return runTx([STORE_MASTER_KEY], 'readwrite', (s) => {
            s[STORE_MASTER_KEY].delete('current');
        });
    }
};