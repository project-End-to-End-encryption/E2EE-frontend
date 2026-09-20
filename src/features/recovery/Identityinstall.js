import { keyStorage } from '../../infrastructure/crypto/storage/keyStorage.js';

/**
 * IDENTITY INSTALL
 *
 * vaultService.restore() hands back the identity private key as raw PKCS8
 * bytes (it was decrypted out of the vault). A device stores the identity as
 * a { publicKey, privateKey } pair with a NON-extractable private key - the
 * same shape sign-up produces (see exportAndLockIdentityKeyPair). This turns
 * one into the other and saves it.
 *
 * Put this file next to vaultService.js (features/recovery/).
 */

const ED25519 = { name: 'Ed25519' };

export async function installRestoredIdentity(pkcs8) {
    // WebCrypto cannot derive an Ed25519 PUBLIC key from a private CryptoKey
    // directly. The trick: import the private key once as extractable, export
    // it as a JWK, and read the public half ("x") out of that. This temporary
    // key object is never stored and is garbage collected.
    const temporary = await crypto.subtle.importKey('pkcs8', pkcs8, ED25519, true, ['sign']);
    const { x } = await crypto.subtle.exportKey('jwk', temporary);

    // Public keys are not secret, so this one can stay extractable
    // (generateKey produces extractable public keys too).
    const publicKey = await crypto.subtle.importKey(
        'jwk',
        { kty: 'OKP', crv: 'Ed25519', x },
        ED25519,
        true,
        ['verify']
    );

    // The private key we actually KEEP is non-extractable, like everywhere else.
    const privateKey = await crypto.subtle.importKey('pkcs8', pkcs8, ED25519, false, ['sign']);

    await keyStorage.saveIdentityKeyPair({ publicKey, privateKey });
    return { publicKey };
}