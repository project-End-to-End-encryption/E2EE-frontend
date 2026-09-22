const DB_NAME = "e2ee_group_keys";
const DB_VERSION = 1;

const STORE_OWN = "ownSenderKeys";
const STORE_RECEIVED = "receivedSenderKeys";

let dbInstance = null;
let openingPromise = null;

function openDb() {
    if (dbInstance) return Promise.resolve(dbInstance);
    if (openingPromise) return openingPromise;

    openingPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_OWN)) {
                db.createObjectStore(STORE_OWN, { keyPath: 'groupId' });
            }
            if (!db.objectStoreNames.contains(STORE_RECEIVED)) {
                db.createObjectStore(STORE_RECEIVED, { keyPath: 'senderKey' });
            }
        };

        request.onsuccess = () => {
            const db = request.result;

            db.onclose = () => {
                if (dbInstance === db) dbInstance = null;
            };

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
    });

    return openingPromise;
}

function wrapRequest(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

const receivedKey = (groupId, userId, deviceId) => `${groupId}:${userId}:${deviceId}`;

export const senderKeyStorage = {
    async getOwnSenderKey(groupId) {
        const db = await openDb();
        return wrapRequest(
            db.transaction(STORE_OWN, 'readonly').objectStore(STORE_OWN).get(groupId)
        );
    },

    async saveOwnSenderKey(groupId, state) {
        const db = await openDb();
        return wrapRequest(
            db.transaction(STORE_OWN, 'readwrite').objectStore(STORE_OWN).put({ groupId, ...state })
        );
    },

    async getReceivedSenderKey(groupId, userId, deviceId) {
        const db = await openDb();
        return wrapRequest(
            db.transaction(STORE_RECEIVED, 'readonly')
                .objectStore(STORE_RECEIVED)
                .get(receivedKey(groupId, userId, deviceId))
        );
    },

    async saveReceivedSenderKey(groupId, userId, deviceId, state) {
        const db = await openDb();
        return wrapRequest(
            db.transaction(STORE_RECEIVED, 'readwrite')
                .objectStore(STORE_RECEIVED)
                .put({ senderKey: receivedKey(groupId, userId, deviceId), ...state })
        );
    }
};