import { keyStorage } from '../../infrastructure/crypto/storage/keyStorage.js';
import { metaRepo } from '../../infrastructure/storage/repos.js';
import { mbkStore } from './mbkStore.js';
import { vaultService } from './vaultService.js';

/**
 * DEVICE STATE
 *
 * Answers one question: "does THIS browser already hold THIS account's keys?"
 * If yes the user never sees the upload page again (reloads, new tabs, next
 * day). If no - new device, new browser, cleared storage, or somebody else's
 * keys are sitting here - they are sent to /restore.
 *
 * Put this file next to vaultService.js (features/recovery/).
 *
 * States returned by getDeviceState():
 *   'ok'              identity key + MBK are here and belong to this account
 *   'restore-needed'  something is missing; the user must upload the key file
 *   'foreign'         the keys here belong to a DIFFERENT account
 */

const OWNER_KEY = 'keys.owner';

// Every IndexedDB database that holds per-account crypto material.
const LOCAL_KEY_DBS = ['e2ee_keystore', 'e2ee_sessions', 'e2ee_group_keys'];

export async function getDeviceState(userId) {
    // Load the persisted MBK from IndexedDB into memory. Without this, a page
    // reload always looks like "no MBK" even though it is safely stored.
    await mbkStore.init();

    // The keystore has ONE identity slot for the whole browser, so keys must be
    // tied to an account. Two accounts on one browser would otherwise share them.
    // (No owner recorded yet = older data; treat it as this account's.)
    const owner = await metaRepo.get(OWNER_KEY);
    if (owner && owner !== userId) return 'foreign';

    // Never had keys here: a new device or a new browser.
    if (!(await keyStorage.hasIdentityKey())) return 'restore-needed';

    if (mbkStore.has()) return 'ok';

    // Identity but no MBK (storage was partly cleared). Only ask for the file
    // if the server actually has a vault to unlock; an account that never
    // enrolled one has nothing to restore, so we let it through.
    try {
        const { exists } = await vaultService.status();
        return exists ? 'restore-needed' : 'ok';
    } catch {
        return 'restore-needed';
    }
}

/**
 * Call after keys are installed on this device (sign-up enrol, or restore).
 * Records whose keys these are, and asks the browser not to evict them under
 * storage pressure (best effort - some browsers ignore it).
 */
export async function claimDevice(userId) {
    await metaRepo.set(OWNER_KEY, userId);
    try { await navigator.storage?.persist?.(); } catch { /* not supported, fine */ }
}

const deleteDb = (name) => new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    // An open connection is holding the database. Each storage module must close
    // itself on 'versionchange' (see the note about senderKeyStorage /
    // sessionStorage) or this waits until the tab reloads.
    req.onblocked = () => console.warn(`[deviceState] deleting ${name} is blocked by an open connection`);
});

/**
 * Remove another account's key material from this browser: identity + prekeys +
 * MBK, ratchet sessions, group sender keys. Only used for the 'foreign' state.
 * Anything else you cache per account (sidebar cache, message archive) must be
 * wiped here too - add its database name to LOCAL_KEY_DBS.
 */
export async function wipeLocalKeys() {
    mbkStore.clear();                       // memory only; the DB delete removes the persisted copy
    await Promise.all(LOCAL_KEY_DBS.map(deleteDb));
    await metaRepo.set(OWNER_KEY, null);
}