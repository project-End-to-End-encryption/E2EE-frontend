/**
 * IDENTITY HANDOFF
 *
 * The recovery vault stores the identity private key encrypted under the
 * recovery key, so at sign-up the key has to be exported exactly once. The
 * copy kept in IndexedDB is non-extractable and stays that way; this module
 * holds the exported PKCS8 bytes in memory only, between key generation and
 * the recovery-key page (/signup/keys) that seals them into the vault.
 *
 *      keyBundle.generateAndRegisterKeys  --hold-->  identityHandoff
 *      KeysSetupPage -> vaultService.enroll  <--peek--  identityHandoff
 *                                            --release-->  (bytes zeroed)
 *
 * Never persisted. A page refresh empties it. It also empties itself after
 * TTL_MS, so a tab left open does not keep the key material around.
 */
const TTL_MS = 20 * 60 * 1000;

let held = null;
let timer = null;

export const identityHandoff = {
    hold(bytes) {
        identityHandoff.release();
        held = bytes;
        timer = setTimeout(identityHandoff.release, TTL_MS);
    },

    has() {
        return held !== null;
    },

    /** Returns the bytes WITHOUT removing them, so a failed enrol can retry. */
    peek() {
        return held;
    },

    /** Zero and forget. Safe to call when nothing is held. */
    release() {
        if (held) held.fill(0);
        held = null;
        if (timer) clearTimeout(timer);
        timer = null;
    }
};

export default identityHandoff;
