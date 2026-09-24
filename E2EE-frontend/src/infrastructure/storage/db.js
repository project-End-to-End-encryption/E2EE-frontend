/**
 * LOCAL DATABASE  (IndexedDB)
 *
 *
 */

const DB_NAME = 'whisper_cache';
const DB_VERSION = 1;
export const STORES = {
    CONVERSATIONS: 'conversations',
    MESSAGES: 'messages',
    OUTBOX: 'outbox',
    ARCHIVE_KEYS: 'archiveKeys',
    META: 'meta',
    MEDIA: 'media',
    CALL_LOGS: 'callLogs'
};

let dbInstance = null;
let openingPromise = null;

function openDb() {
    if(dbInstance) return Promise.resolve(dbInstance);
    if(openingPromise) return openingPromise;

    openingPromise = new Promise((resolve,reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = request.result;
            const oldVersion = event.oldVersion;

            // for v1
            if(oldVersion < 1){
                const conversation = db.createObjectStore(STORES.CONVERSATIONS, {
                    keyPath: '_id'
                });
                conversation.createIndex('by_lastMessageAt', 'lastMessageAt');

                conversation.createIndex('by_rev', 'rev');

                conversation.createIndex('by_pinned', 'isPinned');

                const message = db.createObjectStore(STORES.MESSAGES, {
                    keyPath: ['conversationId', 'seq']
                });

                message.createIndex('by_clientMessageId', 'clientMessageId', {unique: false});
                message.createIndex('by_conversation_sentAt', ['conversationId', 'sentAt']);

                db.createObjectStore(STORES.OUTBOX, {keyPath: 'clientMessageId'})
                    .createIndex('by_conversation', 'conversationId');

                db.createObjectStore(STORES.ARCHIVE_KEYS, {keyPath: ['conversationId', 'epoch']});

                db.createObjectStore(STORES.META, {keyPath: 'key'});

                db.createObjectStore(STORES.MEDIA, {keyPath: 'id'})
                    .createIndex('by_conversation', 'conversationId');

                db.createObjectStore(STORES.CALL_LOGS, {keyPath: 'id'})
                    .createIndex('by_conversation', 'conversationId');
            }
        };

        request.onsuccess = () => {
            const db = request.result;

            // If another tab opens a newer version, close ours so it is not
            // blocked. Next call to openDb() reopens at the new version.

            db.onversionchange = () => {
                db.close();
                if(dbInstance === db) dbInstance = null;
            };

            db.onclose = () => {
                if(dbInstance === db) dbInstance = null;
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
            console.warn('[db] upgrade blocked - another tab is holding the old version open');
        };
    });
    return openingPromise;
}

function wrap(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function tx(storeNames, mode, fn){
    const db = await openDb();
    const transaction = db.transaction(storeNames, mode);

    const stores = {};
    for(const name of storeNames) stores[name] = transaction.objectStore(name);

    const result = fn(stores, transaction);

    return new Promise((resolve,reject) => {
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('TX_ABORTED'));
    });
}

export async function get(storeName, key){
    const db = await openDb();
    return wrap(db.transaction(storeName, 'readonly').objectStore(storeName).get(key));
}

export async function put(storeName, value){
    const db = await openDb();
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(value);
    return new Promise((resolve,reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
    });
}

export async function del(storeName, key){
    const db = await openDb();
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(key);
    return new Promise((resolve,reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
    });
}

export async function getAll(storeName, query = null, count = undefined){
    const db = await openDb();
    return wrap(db.transaction(storeName, 'readonly').objectStore(storeName).getAll(query, count));
}

export {wrap, openDb};

// on logout nuke cache
export async function clearCache(){
    const names = Object.values(STORES);
    await tx(names, 'readwrite', (stores) => {
        for(const name of names) stores[name].clear();
    })
}