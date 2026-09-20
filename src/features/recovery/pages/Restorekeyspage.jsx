import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Upload, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
    AuthPageShell,
    COLORS,
    DISPLAY_FONT,
    CAPTION_FONT
} from '../../auth/components/sidepanel.jsx';

import { authStore } from '../../auth/storage/authStore.js';
import { vaultService } from '../vaultService.js';
import { installRestoredIdentity} from "../Identityinstall.js"
import { getDeviceState, wipeLocalKeys, claimDevice } from '../deviceState.js';
import webSocketClient from "../../../infrastructure/websocket/WebSocketClient.js";
import { generateAndRegisterKeys } from "../../auth/service/keyBundle.js";

/**
 * RestoreKeysPage  (/restore)
 *
 * Shown once per device/browser: the user uploads the .key file they saved at
 * sign-up and we unlock their vault locally. After that the MBK and identity
 * live in this browser's IndexedDB, so reloads never ask again.
 *
 *      checking -> ready -> working -> (navigate to /chat)
 *                     \-> novault      this account never enrolled a vault
 *                     \-> unreachable  the server did not answer
 *
 * The file is read in the browser and never uploaded anywhere.
 */

const INK = COLORS.otherText;
const INK_2 = '#4a5480';
const DANGER = '#b42318';
const TILE_BG = '#f5f8ff';

const headingStyle = {
    color: INK,
    fontFamily: DISPLAY_FONT,
    fontSize: 'clamp(28px, 4vw, 36px)',
    letterSpacing: '-0.01em'
};
const leadStyle = { color: INK_2, fontFamily: DISPLAY_FONT, fontSize: 15, lineHeight: 1.5 };

const buttonBase = {
    fontFamily: DISPLAY_FONT,
    color: INK,
    borderRadius: 4,
    cursor: 'pointer'
};

// Turn whatever went wrong into one sentence the user can act on.
function friendlyError(error) {
    // recoveryKey.js / vaultService.js throw RecoveryKeyError with a readable
    // message: empty file, wrong length, key belongs to another account.
    if (error?.name === 'RecoveryKeyError') return error.message;
    // WebCrypto refused to decrypt: the file was altered or is from another vault.
    if (error?.name === 'OperationError') return 'That key file could not unlock this account.';
    return error?.message || 'Something went wrong. Try again.';
}

export default function RestoreKeysPage() {
    const navigate = useNavigate();
    const inputRef = useRef(null);

    const [phase, setPhase] = useState('checking');
    const [file, setFile] = useState(null);
    const [error, setError] = useState(null);
    const [attempt, setAttempt] = useState(0);

    // Decide what to show. Runs on mount and on "Try again".
    useEffect(() => {
        let cancelled = false;

        (async () => {
            setPhase('checking');
            try {
                let state = await getDeviceState(authStore.getUserId());

                // Keys left here by a different account must never mix with this one.
                if (state === 'foreign') {
                    await wipeLocalKeys();
                    state = 'restore-needed';
                }

                // This browser already has everything: nothing to upload.
                if (state === 'ok') {
                    if (!cancelled) navigate('/chat', { replace: true });
                    return;
                }

                const { exists } = await vaultService.status();
                if (!cancelled) setPhase(exists ? 'ready' : 'novault');
            } catch {
                if (!cancelled) setPhase('unreachable');
            }
        })();

        return () => { cancelled = true; };
    }, [attempt, navigate]);

    const handlePick = (event) => {
        setError(null);
        setFile(event.target.files?.[0] ?? null);
    };

    const handleRestore = useCallback(async () => {
        if (!file) return;
        setError(null);
        setPhase('working');

        try {
            // 1. Unlock the vault. This saves the MBK in this browser's IndexedDB
            //    (that is what lets a reload skip this page) and returns the
            //    identity private key as PKCS8 bytes.
            const { identityPkcs8 } = await vaultService.restore(file);

            // 2. Save that identity here (non-extractable), then wipe the bytes.
            //    The vault is the source of truth, so this always overwrites.
            try {
                await installRestoredIdentity(identityPkcs8);
            } finally {
                new Uint8Array(identityPkcs8).fill(0);
            }

            // 3. Record whose keys these are and ask the browser to keep them.
            await claimDevice(authStore.getUserId());

            const socket = await webSocketClient.connect();

            await generateAndRegisterKeys(socket, {
                createIdentity: false,
                retainForVault: false,
            });

            navigate('/chat', { replace: true });
        } catch (restoreError) {
            setError(friendlyError(restoreError));
            setPhase('ready');
        }
    }, [file, navigate]);

    return (
        <AuthPageShell
            tagline="Welcome back."
            subtext="Upload your recovery key once to unlock your chat history on this device."
        >
            {phase === 'checking' && (
                <div className="flex items-center gap-3" role="status" style={{ color: INK_2, fontFamily: CAPTION_FONT }}>
                    <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                    <span className="text-sm">Checking your account...</span>
                </div>
            )}

            {phase === 'unreachable' && (
                <>
                    <h1 style={headingStyle} className="font-medium">Could not reach the server</h1>
                    <p style={leadStyle} className="mt-2">Check your connection and try again.</p>
                    <button
                        type="button"
                        onClick={() => setAttempt((n) => n + 1)}
                        className="mt-8 w-full px-6 py-3.5 text-base font-medium"
                        style={{ ...buttonBase, background: COLORS.signal }}
                    >
                        Try again
                    </button>
                </>
            )}

            {phase === 'novault' && (
                <>
                    <h1 style={headingStyle} className="font-medium">No recovery key on this account</h1>
                    <p style={leadStyle} className="mt-2">
                        This account never finished setting up a recovery key, so there is nothing
                        to restore on this device.
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate('/login', { replace: true })}
                        className="mt-8 w-full px-6 py-3.5 text-base font-medium"
                        style={{ ...buttonBase, background: COLORS.signal }}
                    >
                        Back to login
                    </button>
                </>
            )}

            {(phase === 'ready' || phase === 'working') && (
                <>
                    <h1 style={headingStyle} className="font-medium">Restore your chats</h1>
                    <p style={leadStyle} className="mt-2">
                        Choose the recovery key file you saved when you signed up. It is read in
                        this browser and never uploaded. You will only need to do this once on
                        this device.
                    </p>

                    {/* Hidden native input; the tile below is the visible, clickable part. */}
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".key,.txt,text/plain"
                        onChange={handlePick}
                        className="hidden"
                        aria-label="Recovery key file"
                    />

                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={phase === 'working'}
                        className="mt-7 flex w-full items-center gap-4 p-4 text-left"
                        style={{ border: `1px dashed ${COLORS.hairline}`, background: TILE_BG, borderRadius: 8 }}
                    >
                        <span
                            className="flex h-12 w-12 shrink-0 items-center justify-center"
                            style={{ background: '#dff8fd', color: INK, borderRadius: 8 }}
                        >
                            <KeyRound size={22} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block break-all text-sm font-medium" style={{ color: INK, fontFamily: DISPLAY_FONT }}>
                                {file ? file.name : 'Choose your .key file'}
                            </span>
                            <span className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: INK_2, fontFamily: CAPTION_FONT }}>
                                {file ? <CheckCircle2 size={14} aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
                                {file ? 'Ready to restore' : 'e2ee-recovery-...key'}
                            </span>
                        </span>
                    </button>

                    {error && (
                        <div
                            role="alert"
                            className="mt-5 flex items-start gap-2.5 p-3 text-sm"
                            style={{
                                background: '#fdecea', color: DANGER, border: '1px solid #f5c6c1',
                                borderRadius: 8, fontFamily: CAPTION_FONT, lineHeight: 1.5
                            }}
                        >
                            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleRestore}
                        disabled={!file || phase === 'working'}
                        className="mt-8 flex w-full items-center justify-center gap-2 px-6 py-3.5 text-base font-medium"
                        style={{
                            ...buttonBase,
                            background: COLORS.signal,
                            opacity: !file && phase !== 'working' ? 0.55 : 1,
                            cursor: !file || phase === 'working' ? 'default' : 'pointer'
                        }}
                    >
                        {phase === 'working'
                            ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" /><span>Unlocking...</span></>
                            : <span>Restore my chats</span>}
                    </button>
                </>
            )}
        </AuthPageShell>
    );
}