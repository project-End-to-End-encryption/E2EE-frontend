import { request } from '../../infrastructure/http/httpClient.js';
import { recoveryKey } from './recoveryKey.js';
import { mbkStore } from './mbkStore.js';
import { metaRepo } from '../../infrastructure/storage/repos.js';
import { bufferToBase64, base64ToBuffer } from '../../shared/utils/encoding.js';

/**
 * VAULT SERVICE
 *
 * Ordering rule for enroll() and rotate() - the whole point of this rewrite:
 *
 *   1. mint the recovery key IN MEMORY (nothing is downloaded yet)
 *   2. derive the vault key from it and encrypt the MBK + identity key
 *   3. send the encrypted vault to the server
 *   4. ONLY IF the server accepted it, hand the key file to the user
 *
 * Why: previously the .key file was downloaded in step 1. If the request in
 * step 3 then failed (offline, 401, 409, 500), the user was left holding a
 * key file that matches nothing on the server - and, in rotate(), they might
 * throw away their OLD file believing the new one was valid. Now a key file
 * only ever exists for a vault the server has really stored.
 */

const unwrap = (res) => (res && typeof res === 'object' && 'success' in res && 'data' in res ? res.data : res);

const AES = 'AES-GCM';
const KDF_ITERATIONS = 210000;

const importVaultKey = (rawBytes, usages) =>
    crypto.subtle.importKey('raw', rawBytes, AES, false, usages);

// Encrypt bytes under the vault key. A fresh random 12-byte IV per call.
const sealUnder = async (vaultKeyBytes, plaintextBytes) => {
    const key = await importVaultKey(vaultKeyBytes, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: AES, iv }, key, plaintextBytes);
    return { iv: bufferToBase64(iv), ciphertext: bufferToBase64(ciphertext) };
};

// Reverse of sealUnder. Throws an OperationError if the key or data is wrong.
const openUnder = async (vaultKeyBytes, box) => {
    const key = await importVaultKey(vaultKeyBytes, ['decrypt']);
    return crypto.subtle.decrypt(
        { name: AES, iv: new Uint8Array(base64ToBuffer(box.iv)) },
        key,
        base64ToBuffer(box.ciphertext)
    );
};

export const vaultService = {

    /**
     * Sign-up: create the vault.
     *
     * @param {boolean} [autoDownload=true]  true  = this function downloads the
     *        key file itself, right after the server accepts the vault.
     *        false = the caller (the /signup/keys page) shows a button and
     *        downloads it later using the returned keyBase64.
     */
    async enroll({ username, identityPrivateKeyPkcs8, autoDownload = true }) {
        const { keyBytes, keyBase64, filename } =
            await recoveryKey.create({ username });

        let vaultKey = null;
        const mbkBytes = crypto.getRandomValues(
            new Uint8Array(32)
        );

        try {
            const saltBase64 = recoveryKey.newSalt();

            const derived = await recoveryKey.deriveVaultKeys(
                keyBytes,
                {
                    saltBase64,
                    iterations: KDF_ITERATIONS
                }
            );

            vaultKey = derived.vaultKey;

            const encryptedMasterBackupKey =
                await sealUnder(vaultKey, mbkBytes);

            const encryptedIdentityKey =
                await sealUnder(
                    vaultKey,
                    identityPrivateKeyPkcs8
                );

            const result = unwrap(
                await request(
                    '/api/v1/recovery/vault',
                    {
                        version: 1,
                        kdf: {
                            algorithm: 'PBKDF2',
                            hash: 'SHA-256',
                            iterations: KDF_ITERATIONS,
                            salt: saltBase64
                        },
                        verifier: derived.verifier,
                        encryptedIdentityKey,
                        encryptedMasterBackupKey
                    },
                    {
                        method: 'POST'
                    }
                )
            );

            if (autoDownload) {
                recoveryKey.downloadExisting({
                    keyBase64,
                    username,
                    filename
                });
            }

            try {
                await mbkStore.set(mbkBytes);

                await metaRepo.set(
                    'vault.generation',
                    result.generation ?? 1
                );
            } catch (error) {
                console.warn(
                    '[vaultService] enrolled, but local cache failed:',
                    error.message
                );
            }

            return {
                filename,
                keyBase64,
                generation: result.generation
            };
        } finally {
            mbkBytes.fill(0);
            keyBytes.fill(0);
            vaultKey?.fill(0);
        }
    },

    async status() {
        const data = unwrap(await request('/api/v1/recovery/vault/status', null, { method: 'GET' }));
        return { exists: !!data?.exists, generation: data?.generation ?? null };
    },


    /**
     * New device / cleared storage: read the .key file, unlock the vault.
     * (Unchanged apart from comments - restore never creates a key file.)
     */
    async restore(file, { rememberDevice = true } = {}) {
        const { keyBytes } = await recoveryKey.readKeyFromFile(file);

        try {
            const vault = unwrap(await request('/api/v1/recovery/vault', null, { method: 'GET' }));

            const { vaultKey, verifier } = await recoveryKey.deriveVaultKeys(keyBytes, {
                saltBase64: vault.kdf.salt,
                iterations: vault.kdf.iterations
            });

            try {
                // Cheap check so we can say "wrong key file" instead of
                // surfacing a raw WebCrypto OperationError.
                if (verifier !== vault.verifier) {
                    throw new recoveryKey.RecoveryKeyError(
                        'WRONG_KEY',
                        'That recovery key does not belong to this account.'
                    );
                }

                const box = vault.encryptedMasterBackupKey;
                const unwrappingKey = await importVaultKey(vaultKey, ['unwrapKey']);

                // Unwrap straight into a NON-extractable CryptoKey, so the raw
                // MBK bytes never exist in JS on this path.
                const mbkKey = await crypto.subtle.unwrapKey(
                    'raw',
                    base64ToBuffer(box.ciphertext),
                    unwrappingKey,
                    { name: AES, iv: new Uint8Array(base64ToBuffer(box.iv)) },
                    { name: AES },
                    false,
                    ['encrypt', 'decrypt']
                );

                const identityPkcs8 = await openUnder(vaultKey, vault.encryptedIdentityKey);

                await mbkStore.setKey(mbkKey, { persist: rememberDevice });
                await metaRepo.set('vault.generation', vault.generation ?? 1);

                // Fire-and-forget: tells the server a restore happened.
                request('/api/v1/recovery/vault/restore', {}, { method: 'POST' }).catch(() => {});

                return { identityPkcs8, generation: vault.generation };

            } finally {
                vaultKey.fill(0);
            }
        } finally {
            keyBytes.fill(0);
        }
    },


    /**
     * Replace the recovery key. The MBK and identity key stay the same; only
     * the wrapping changes, so old chat history stays readable.
     *
     * Same ordering rule as enroll(): the NEW key file is only handed over
     * after the server has accepted the re-wrapped vault. Until then the OLD
     * key file is still the valid one - and the user is never told otherwise.
     */
    async rotate({ username, currentKeyFile, autoDownload = true }) {
        // 1. Prove ownership of the current key and unlock the secrets.
        const { keyBytes: oldKeyBytes } = await recoveryKey.readKeyFromFile(currentKeyFile);

        let mbkBytes = null;
        let identityBytes = null;
        let oldVaultKey = null;
        let newKeyBytes = null;
        let newVaultKey = null;

        try {
            const vault = await request('/api/v1/recovery/vault', null, { method: 'GET' });

            const old = await recoveryKey.deriveVaultKeys(oldKeyBytes, {
                saltBase64: vault.kdf.salt,
                iterations: vault.kdf.iterations
            });
            oldVaultKey = old.vaultKey;

            if (old.verifier !== vault.verifier) {
                throw new recoveryKey.RecoveryKeyError(
                    'WRONG_KEY',
                    'That is not the current recovery key for this account.'
                );
            }

            mbkBytes = new Uint8Array(await openUnder(oldVaultKey, vault.encryptedMasterBackupKey));
            identityBytes = new Uint8Array(await openUnder(oldVaultKey, vault.encryptedIdentityKey));

            // 2. Mint the NEW key in memory only - no download yet.
            const created = await recoveryKey.create({ username });
            newKeyBytes = created.keyBytes;

            // 3. Re-wrap the SAME secrets under the new key.
            const saltBase64 = recoveryKey.newSalt();
            const fresh = await recoveryKey.deriveVaultKeys(newKeyBytes, {
                saltBase64,
                iterations: KDF_ITERATIONS
            });
            newVaultKey = fresh.vaultKey;

            const result = await request('/api/v1/recovery/vault', {
                version: 1,
                kdf: { algorithm: 'PBKDF2', hash: 'SHA-256', iterations: KDF_ITERATIONS, salt: saltBase64 },
                verifier: fresh.verifier,
                encryptedIdentityKey: await sealUnder(newVaultKey, identityBytes),
                encryptedMasterBackupKey: await sealUnder(newVaultKey, mbkBytes)
            }, { method: 'PUT' });

            // 4. Server accepted -> the OLD file is now dead, the NEW one is
            // live. Only now give the user the new file.
            if (autoDownload) {
                recoveryKey.downloadExisting({
                    keyBase64: created.keyBase64,
                    username,
                    filename: created.filename
                });
            }

            // The local MBK did not change, so mbkStore is untouched and the
            // user stays logged in with nothing to resync.
            try {
                await metaRepo.set('vault.generation', result.generation);
            } catch (error) {
                console.warn('[vaultService] rotated, but local generation write failed:', error.message);
            }

            return { filename: created.filename, keyBase64: created.keyBase64, generation: result.generation };

        } finally {
            // Wipe everything that touched raw key material.
            mbkBytes?.fill(0);
            identityBytes?.fill(0);
            oldVaultKey?.fill(0);
            newVaultKey?.fill(0);
            newKeyBytes?.fill(0);
            oldKeyBytes.fill(0);
        }
    },


    /** Destroy the vault on the server and forget the local MBK. */
    async reset() {
        const result = await request(
            '/api/v1/recovery/vault',
            { confirm: 'DELETE_MY_HISTORY' },
            { method: 'DELETE' }
        );

        await mbkStore.clear({ persistent: true });
        return result;
    }
};