const DB_NAME = "e2ee_keystore";
const DB_VERSION = 1;
const STORE_IDENTITY = "identityKey";
const STORE_SIGNED_PREKEY = "signedPreKey";
const STORE_ONE_TIME_PREKEYS = "oneTimePreKeys";

function openDb(){
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;

            if(!db.objectStoreNames.contains(STORE_IDENTITY)) db.createObjectStore(STORE_IDENTITY);
            if(!db.objectStoreNames.contains(STORE_SIGNED_PREKEY)) db.createObjectStore(STORE_SIGNED_PREKEY);
            if(!db.objectStoreNames.contains(STORE_ONE_TIME_PREKEYS)){
                db.createObjectStore(STORE_ONE_TIME_PREKEYS, {keyPath: 'keyId'});
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function wrapRequest(request){
    return new Promise((resolve,reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export const keyStorage = {
    async hasIdentityKey(){
        const db = await openDb();
        const result = await wrapRequest(db.transaction(STORE_IDENTITY, 'readonly')
            .objectStore(STORE_IDENTITY).get('current'));

        return !!result;
    },
    async saveIdentityKeyPair(keyPair) {
        const db = await openDb();
        await wrapRequest(db.transaction(STORE_IDENTITY, 'readwrite')
            .objectStore(STORE_IDENTITY).put(keyPair, 'current'));
    },
    async getIdentityKeyPair(){
        const db = await openDb();
        return  wrapRequest(db.transaction(STORE_IDENTITY, 'readonly').objectStore(STORE_IDENTITY).get('current'))
    },
    async saveSignedPreKey(record){
        const db = await openDb();
        await wrapRequest(db.transaction(STORE_SIGNED_PREKEY, 'readwrite')
            .objectStore(STORE_SIGNED_PREKEY).put(record ,'current'));
    },
    async getSignedPreKey(){
        const db = await openDb();
        return wrapRequest(db.transaction(STORE_SIGNED_PREKEY, 'readonly')
            .objectStore(STORE_SIGNED_PREKEY).get('current'));
    },
    async saveOneTimePreKeys(records){
        const db = await openDb();
        const store = db.transaction(STORE_ONE_TIME_PREKEYS, 'readwrite').objectStore(STORE_ONE_TIME_PREKEYS);
        await Promise.all(records.map((r) => wrapRequest(store.put(r))));
    },
    async getOneTimePreKey(keyId) {
        const db = await openDb();
        return wrapRequest(db.transaction(STORE_ONE_TIME_PREKEYS, 'readonly')
            .objectStore(STORE_ONE_TIME_PREKEYS).get(keyId));
    },
    async deleteOneTimePreKey(keyId) {
        const db = await openDb();
        await wrapRequest(db.transaction(STORE_ONE_TIME_PREKEYS, "readwrite").objectStore(STORE_ONE_TIME_PREKEYS).delete(keyId));
    }
};

