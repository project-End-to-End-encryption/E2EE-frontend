const DB_NAME = 'e2ee_sessions';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';

let dbInstance = null;
let openingPromise = null;

function openDb() {
    if (dbInstance) return Promise.resolve(dbInstance);
    if (openingPromise) return openingPromise;

    openingPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
                db.createObjectStore(STORE_SESSIONS, { keyPath: 'peerKey' });
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

const peerKey = (userId, deviceId) => `${userId}:${deviceId}`;

export const sessionStorage = {
    async getSession(userId, deviceId) {
        const db = await openDb();
        return wrapRequest(
            db.transaction(STORE_SESSIONS, 'readonly')
                .objectStore(STORE_SESSIONS)
                .get(peerKey(userId, deviceId))
        );
    },

    async saveSession(userId, deviceId, state) {
        const db = await openDb();
        return wrapRequest(
            db.transaction(STORE_SESSIONS, 'readwrite')
                .objectStore(STORE_SESSIONS)
                .put({ peerKey: peerKey(userId, deviceId), ...state })
        );
    },

    async deleteSession(userId, deviceId) {
        const db = await openDb();
        return wrapRequest(
            db.transaction(STORE_SESSIONS, 'readwrite')
                .objectStore(STORE_SESSIONS)
                .delete(peerKey(userId, deviceId))
        );
    }
};