/**
 * DECRYPTED MEDIA CACHE
 *
 * In memory, for this tab, for this session. Deliberately NOT IndexedDB:
 * a decrypted attachment on disk is the same class of exposure as a plaintext
 * key on disk, and the security model here is that nothing readable survives
 * the tab.
 *
 * STORES.MEDIA in IndexedDB is used only for upload bookkeeping (which
 * attachment belongs to which pending message) and never holds plaintext or
 * key material.
 */

const entries = new Map();   // storageKey -> { blob, url, bytes }

let totalBytes = 0;
const MAX_BYTES = 256 * 1024 * 1024;

function evictOldest() {
    // Map preserves insertion order, so the first key is the oldest.
    for (const key of entries.keys()) {
        if (totalBytes <= MAX_BYTES) return;
        release(key);
    }
}

export function get(storageKey) {
    return entries.get(storageKey) ?? null;
}

export function put(storageKey, blob) {
    release(storageKey);

    const url = URL.createObjectURL(blob);
    entries.set(storageKey, { blob, url, bytes: blob.size });
    totalBytes += blob.size;

    evictOldest();
    return url;
}

export function release(storageKey) {
    const entry = entries.get(storageKey);
    if (!entry) return;

    URL.revokeObjectURL(entry.url);
    totalBytes -= entry.bytes;
    entries.delete(storageKey);
}

export function clear() {
    for (const key of [...entries.keys()]) release(key);
    totalBytes = 0;
}

export const mediaCache = { get, put, release, clear };
export default mediaCache;
