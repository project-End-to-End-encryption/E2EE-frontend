// src/features/auth/storage/keyOwner.js
const OWNER_KEY = 'e2ee.keyOwnerId';

export const keyOwner = {
    // Call after generating device keys (register) or a successful restore
    set: (userId) => localStorage.setItem(OWNER_KEY, String(userId)),
    clear: () => localStorage.removeItem(OWNER_KEY),
    // True when the keys in this browser belong to a DIFFERENT account than the session
    mismatch: (userId) => {
        const owner = localStorage.getItem(OWNER_KEY);
        return owner !== null && owner !== String(userId);
    }
};

// Delete every local crypto database. Existing connections close themselves on
// "versionchange", so the delete can proceed.
export async function wipeLocalCryptoState(extraDbNames = []) {
    const names = ['e2ee_keystore', 'e2ee_sessions', 'e2ee_group_keys', ...extraDbNames];
    await Promise.all(names.map((name) => new Promise((resolve) => {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
    })));
    keyOwner.clear();
}