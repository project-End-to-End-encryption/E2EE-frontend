import { request } from '../../infrastructure/http/httpClient.js';
import { recoveryKey } from './recoveryKey.js';
import { mbkStore } from './mbkStore.js';
import { metaRepo } from '../../infrastructure/storage/repos.js';
import { bufferToBase64, base64ToBuffer } from '../../shared/utils/encoding.js';



const AES = 'AES-GCM';

const importVaultKey = (rawBytes, usages) =>
    crypto.subtle.importKey('raw', rawBytes, AES, false, usages);

const sealUnder = async (vaultKeyBytes, plaintextBytes) => {
    const key = await importVaultKey(vaultKeyBytes, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: AES, iv }, key, plaintextBytes);
    return { iv: bufferToBase64(iv), ciphertext: bufferToBase64(ciphertext) };
};

const openUnder = async (vaultKeyBytes, box) => {
    const key = await importVaultKey(vaultKeyBytes, ['decrypt']);
    return crypto.subtle.decrypt(
        { name: AES, iv: new Uint8Array(base64ToBuffer(box.iv)) },
        key,
        base64ToBuffer(box.ciphertext)
    );
};

export const vaultService = {

    async enroll({ username, identityPrivateKeyPkcs8 }) {
        const { keyBytes, keyBase64, filename } = await recoveryKey.createAndDownload({ username });

        const saltBase64 = recoveryKey.newSalt();
        const iterations = 210000;
        const { vaultKey, verifier } = await recoveryKey.deriveVaultKeys(keyBytes, {
            saltBase64, iterations
        });

        // The MBK. These 32 bytes exist in JS for the duration of this function
        // and never again.
        const mbkBytes = crypto.getRandomValues(new Uint8Array(32));

        try {
            const encryptedMasterBackupKey = await sealUnder(vaultKey, mbkBytes);
            const encryptedIdentityKey = await sealUnder(vaultKey, identityPrivateKeyPkcs8);

            const result = await request('/api/v1/recovery/vault', {
                version: 1,
                kdf: { algorithm: 'PBKDF2', hash: 'SHA-256', iterations, salt: saltBase64 },
                verifier,
                encryptedIdentityKey,
                encryptedMasterBackupKey
            }, { method: 'POST' });

            // Import as non-extractable and persist. From here the user can
            // refresh and restart without touching the key file again.
            await mbkStore.set(mbkBytes);
            await metaRepo.set('vault.generation', result.generation ?? 1);

            return { filename, keyBase64, generation: result.generation };

        } finally {
            mbkBytes.fill(0);
            keyBytes.fill(0);
            vaultKey.fill(0);
        }
    },


    async restore(file, { rememberDevice = true } = {}) {
        const { keyBytes } = await recoveryKey.readKeyFromFile(file);

        try {
            const vault = await request('/api/v1/recovery/vault', null, { method: 'GET' });

            const { vaultKey, verifier } = await recoveryKey.deriveVaultKeys(keyBytes, {
                saltBase64: vault.kdf.salt,
                iterations: vault.kdf.iterations
            });

            try {
                // Cheap check that lets us say "wrong key file" instead of
                // surfacing a raw OperationError from WebCrypto.
                if (verifier !== vault.verifier) {
                    throw new recoveryKey.RecoveryKeyError(
                        'WRONG_KEY',
                        'That recovery key does not belong to this account.'
                    );
                }

                const box = vault.encryptedMasterBackupKey;
                const unwrappingKey = await importVaultKey(vaultKey, ['unwrapKey']);

                const mbkKey = await crypto.subtle.unwrapKey(
                    'raw',
                    base64ToBuffer(box.ciphertext),
                    unwrappingKey,
                    { name: AES, iv: new Uint8Array(base64ToBuffer(box.iv)) },
                    { name: AES },        // algorithm of the unwrapped key
                    false,                // <- non-extractable, the whole point
                    ['encrypt', 'decrypt']
                );

                const identityPkcs8 = await openUnder(vaultKey, vault.encryptedIdentityKey);

                await mbkStore.setKey(mbkKey, { persist: rememberDevice });
                await metaRepo.set('vault.generation', vault.generation ?? 1);

                request('/api/v1/recovery/vault/restore', {}, { method: 'POST' }).catch(() => {});

                return { identityPkcs8, generation: vault.generation };

            } finally {
                vaultKey.fill(0);
            }
        } finally {
            keyBytes.fill(0);
        }
    },


    async rotate({ username, currentKeyFile }) {
        // 1. prove ownership of the current key and pull the MBK back out
        const { keyBytes: oldKeyBytes } = await recoveryKey.readKeyFromFile(currentKeyFile);

        let mbkBytes = null;
        let oldVaultKey = null;

        try {
            const vault = await request('/api/v1/recovery/vault', null, { method: 'GET' });

            const derived = await recoveryKey.deriveVaultKeys(oldKeyBytes, {
                saltBase64: vault.kdf.salt,
                iterations: vault.kdf.iterations
            });
            oldVaultKey = derived.vaultKey;

            if (derived.verifier !== vault.verifier) {
                throw new recoveryKey.RecoveryKeyError(
                    'WRONG_KEY',
                    'That is not the current recovery key for this account.'
                );
            }

            mbkBytes = new Uint8Array(await openUnder(oldVaultKey, vault.encryptedMasterBackupKey));
            const identityPkcs8 = await openUnder(oldVaultKey, vault.encryptedIdentityKey);

            // 2. mint the new recovery key and hand the file over
            const { keyBytes: newKeyBytes, keyBase64, filename } =
                await recoveryKey.createAndDownload({ username });

            let newVaultKey = null;
            try {
                const saltBase64 = recoveryKey.newSalt();
                const iterations = 210000;
                const fresh = await recoveryKey.deriveVaultKeys(newKeyBytes, { saltBase64, iterations });
                newVaultKey = fresh.vaultKey;

                const result = await request('/api/v1/recovery/vault', {
                    version: 1,
                    kdf: { algorithm: 'PBKDF2', hash: 'SHA-256', iterations, salt: saltBase64 },
                    verifier: fresh.verifier,
                    // SAME identity key, SAME MBK, new wrapping. This is what
                    // keeps history readable across a rotation.
                    encryptedIdentityKey: await sealUnder(newVaultKey, identityPkcs8),
                    encryptedMasterBackupKey: await sealUnder(newVaultKey, mbkBytes)
                }, { method: 'PUT' });

                await metaRepo.set('vault.generation', result.generation);

                // The local MBK is unchanged, so mbkStore is not touched. The
                // user stays logged in and nothing has to resync.
                return { filename, keyBase64, generation: result.generation };

            } finally {
                newKeyBytes.fill(0);
                newVaultKey?.fill(0);
            }
        } finally {
            mbkBytes?.fill(0);
            oldVaultKey?.fill(0);
            oldKeyBytes.fill(0);
        }
    },


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