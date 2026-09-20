import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    KeyRound,
    Download,
    CheckCircle2,
    Loader2,
    AlertCircle,
    EyeOff,
    HardDrive
} from 'lucide-react';
import {
    AuthPageShell,
    COLORS,
    DISPLAY_FONT,
    CAPTION_FONT
} from '../../auth/components/sidepanel.jsx';

import { authStore } from '../../auth/storage/authStore.js';
import { userDirectory } from '../../user/service/userDirectory.js';
import { vaultService } from '../vaultService.js';
import { recoveryKey } from '../recoveryKey.js';
import { identityHandoff } from '../identityHandoff.js';
import { claimDevice } from "../deviceState.js";

/**
 * KeysSetupPage  (/signup/keys)
 *
 * The step after profile setup: hand the new user their recovery key file.
 *
 *      checking -> ready -> working -> saved -> (tick the box) -> /chat
 *                     \-> blocked       can't build a key in this session
 *                     \-> exists        a vault was already created earlier
 *                     \-> unreachable   the recovery service didn't answer
 *
 * Same AuthPageShell as login / profile setup. Nothing here touches crypto:
 *
 *      this page -> vaultService.enroll -> recoveryKey / mbkStore -> server vault
 *
 * The vault is created when the user presses the button, not when the page
 * opens, so refreshing before that changes nothing. The key itself lives in
 * component state only until the user leaves the page; it is what makes
 * "Download again" possible, and it is dropped on Continue.
 *
 * Text colours here are chosen for contrast (all >= 4.5:1 on white). The
 * shared COLORS.obsidian / midGray / ash are too pale for body text, so this
 * page uses COLORS.otherText plus the two greys below instead.
 */

const INK = COLORS.otherText;          // #191687  13.9:1 on white
const INK_2 = '#4a5480';               //          7.3:1
const OK = '#0e7c5a';                  //          5.2:1
const DANGER = '#b42318';              //          6.6:1
const TILE_BG = '#f5f8ff';

const RULES = [
    {
        Icon: EyeOff,
        text: 'Keep it private. Anyone who has this file can read your chat history.'
    },
    {
        Icon: HardDrive,
        text: 'Store a copy away from this device, like a password manager or a USB drive.'
    },
    {
        Icon: AlertCircle,
        text: 'We cannot reissue it. If you lose it and switch devices, your old messages are gone.'
    }
];

const GLOBAL_CSS = `
  .ks-btn { transition: transform 200ms, opacity 200ms; }
  .ks-btn:not(:disabled):hover { transform: translateY(-2px); }
  .ks-btn:focus-visible, .ks-link:focus-visible, .ks-check:focus-visible {
    outline: 2px solid ${INK};
    outline-offset: 2px;
  }
  @keyframes ks-spin { to { transform: rotate(360deg); } }
  .ks-spin { animation: ks-spin 0.9s linear infinite; }
  @media (prefers-reduced-motion: reduce) {
    .ks-btn { transition: none; }
    .ks-btn:not(:disabled):hover { transform: none; }
    .ks-spin { animation: none; }
  }
`;

function PrimaryButton({ children, busy, disabled, onClick, type = 'button' }) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled || busy}
            className="ks-btn flex w-full items-center justify-center gap-2 rounded px-6 py-3.5 text-base font-medium"
            style={{
                background: COLORS.signal,
                color: INK,
                fontFamily: DISPLAY_FONT,
                opacity: disabled && !busy ? 0.55 : 1,
                cursor: disabled || busy ? 'default' : 'pointer'
            }}
        >
            {children}
        </button>
    );
}

function SecondaryButton({ children, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="ks-btn flex w-full items-center justify-center gap-2 rounded px-6 py-3 text-base font-medium"
            style={{
                background: COLORS.paper,
                color: INK,
                border: `1px solid ${COLORS.hairline}`,
                fontFamily: DISPLAY_FONT
            }}
        >
            {children}
        </button>
    );
}

function FileTile({ filename, state }) {
    const saved = state === 'saved';
    const working = state === 'working';

    return (
        <div
            className="mt-7 flex items-center gap-4 p-4"
            style={{ border: `1px solid ${COLORS.hairline}`, background: TILE_BG, borderRadius: 8 }}
        >
            <span
                className="flex h-12 w-12 shrink-0 items-center justify-center"
                style={{ background: '#dff8fd', color: INK, borderRadius: 8 }}
            >
                <KeyRound size={22} aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
                <p
                    className="break-all text-sm font-medium"
                    style={{ color: INK, fontFamily: DISPLAY_FONT, lineHeight: 1.3 }}
                >
                    {filename}
                </p>

                <p
                    className="mt-1 flex items-center gap-1.5 text-xs"
                    style={{ color: saved ? OK : INK_2, fontFamily: CAPTION_FONT }}
                    aria-live="polite"
                >
                    {saved && <CheckCircle2 size={14} aria-hidden="true" />}
                    {working && <Loader2 size={14} className="ks-spin" aria-hidden="true" />}
                    {saved
                        ? 'Downloaded to this device'
                        : working
                            ? 'Creating your key...'
                            : 'Made in your browser. We never see it.'}
                </p>
            </div>
        </div>
    );
}

function Rules() {
    return (
        <ul className="mt-6 flex flex-col gap-3.5">
            {RULES.map(({ Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                    <Icon size={17} className="mt-0.5 shrink-0" style={{ color: INK }} aria-hidden="true" />
                    <span style={{ color: INK_2, fontFamily: CAPTION_FONT, fontSize: 14, lineHeight: 1.5 }}>
                        {text}
                    </span>
                </li>
            ))}
        </ul>
    );
}

function Notice({ tone = 'info', children }) {
    const danger = tone === 'danger';
    return (
        <div
            role={danger ? 'alert' : 'status'}
            className="mt-5 flex items-start gap-2.5 p-3 text-sm"
            style={{
                background: danger ? '#fdecea' : TILE_BG,
                color: danger ? DANGER : INK,
                border: `1px solid ${danger ? '#f5c6c1' : COLORS.hairline}`,
                borderRadius: 8,
                fontFamily: CAPTION_FONT,
                lineHeight: 1.5
            }}
        >
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{children}</span>
        </div>
    );
}

export default function KeysSetupPage() {
    const navigate = useNavigate();

    const [phase, setPhase] = useState('checking');
    const [username, setUsername] = useState(null);
    const [file, setFile] = useState(null);           // { filename, keyBase64 }, memory only
    const [error, setError] = useState(null);
    const [confirmed, setConfirmed] = useState(false);
    const [attempt, setAttempt] = useState(0);

    // What is the state of this account's vault?
    useEffect(() => {
        let cancelled = false;

        // A name in the file name is nice to have; never wait on it.
        userDirectory.profiles([authStore.getUserId()])
            .then(([profile]) => { if (!cancelled) setUsername(profile?.username ?? null); })
            .catch(() => {});

        (async () => {
            setPhase('checking');

            try {
                const { exists } = await vaultService.status();
                if (cancelled) return;
                setPhase(exists ? 'exists' : identityHandoff.has() ? 'ready' : 'blocked');
            } catch (checkError) {
                if (cancelled) return;

                setPhase('unreachable');
            }
        })();

        return () => { cancelled = true; };
    }, [attempt]);

    const handleCreate = useCallback(async () => {
        setError(null);

        const identity = identityHandoff.peek();
        if (!identity) {
            setPhase('blocked');
            return;
        }

        setPhase('working');

        try {
            const result = await vaultService.enroll({
                username,
                identityPrivateKeyPkcs8: identity,
                autoDownload: false
            });

            // The vault holds the key now; the exported identity bytes are done.
            identityHandoff.release();
            await claimDevice(authStore.getUserId());

            setFile({ filename: result.filename, keyBase64: result.keyBase64 });
            setPhase('saved');

            recoveryKey.downloadExisting({
                keyBase64: result.keyBase64,
                username,
                filename: result.filename
            });
        } catch (createError) {
            setError(createError?.message || 'Something went wrong. Try again.');
            // If the vault was created but the download failed, the key is
            // still in memory and Download again is on screen.
            setPhase((current) => (current === 'saved' ? 'saved' : 'ready'));
        }
    }, [username]);

    const handleDownloadAgain = () => {
        if (!file) return;
        try {
            recoveryKey.downloadExisting({ ...file, username });
            setError(null);
        } catch (downloadError) {
            setError(downloadError?.message || 'The file could not be downloaded.');
        }
    };

    const handleContinue = () => {
        setFile(null);                                // drop the key from memory
        navigate('/chat', { replace: true });
    };

    const filename = file?.filename ?? recoveryKey.suggestedFilename(username);

    return (
        <AuthPageShell
            tagline="One file. Your whole history."
            subtext="Your recovery key is made in this browser. We never see it, and we cannot recover it for you."
        >
            <style>{GLOBAL_CSS}</style>

            {phase === 'checking' && (
                <div className="flex items-center gap-3" role="status" style={{ color: INK_2, fontFamily: CAPTION_FONT }}>
                    <Loader2 size={20} className="ks-spin" aria-hidden="true" />
                    <span className="text-sm">Checking your account...</span>
                </div>
            )}

            {phase === 'unreachable' && (
                <>
                    <h1 style={headingStyle} className="font-medium">Could not reach the server</h1>
                    <p style={leadStyle} className="mt-2">
                        We could not check your recovery key. Check your connection and try again.
                    </p>
                    <div className="mt-8 flex flex-col gap-3">
                        <PrimaryButton onClick={() => setAttempt((n) => n + 1)}>Try again</PrimaryButton>
                        <SecondaryButton onClick={handleContinue}>Continue to chats</SecondaryButton>
                    </div>
                </>
            )}

            {phase === 'exists' && (
                <>
                    <h1 style={headingStyle} className="font-medium">Your recovery key is set up</h1>
                    <p style={leadStyle} className="mt-2">
                        It was created earlier and cannot be shown again. If you still have the file,
                        keep it safe: it is the only way to read your history on a new device.
                    </p>
                    <div className="mt-8 flex flex-col gap-3">
                        <PrimaryButton onClick={handleContinue}>Continue to chats</PrimaryButton>
                        <SecondaryButton onClick={() => navigate('/keys')}>Manage encryption keys</SecondaryButton>
                    </div>
                </>
            )}

            {phase === 'blocked' && (
                <>
                    <h1 style={headingStyle} className="font-medium">We could not create your key</h1>
                    <p style={leadStyle} className="mt-2">
                        This happens when the page is refreshed during sign-up. You can keep using
                        E2EE, but your history cannot be restored on a new device until a recovery
                        key exists.
                    </p>
                    <div className="mt-8 flex flex-col gap-3">
                        <PrimaryButton onClick={handleContinue}>Continue to chats</PrimaryButton>
                    </div>
                </>
            )}

            {(phase === 'ready' || phase === 'working' || phase === 'saved') && (
                <>
                    <h1 style={headingStyle} className="font-medium">Save your recovery key</h1>
                    <p style={leadStyle} className="mt-2">
                        Your messages are locked with keys only you hold. This file unlocks your
                        history on a new device.
                    </p>

                    <FileTile filename={filename} state={phase} />
                    <Rules />

                    {error && <Notice tone="danger">{error}</Notice>}

                    {phase !== 'saved' ? (
                        <div className="mt-8">
                            <PrimaryButton onClick={handleCreate} busy={phase === 'working'}>
                                {phase === 'working'
                                    ? <><Loader2 size={18} className="ks-spin" aria-hidden="true" /><span>Creating key...</span></>
                                    : <><Download size={18} aria-hidden="true" /><span>Download recovery key</span></>}
                            </PrimaryButton>
                        </div>
                    ) : (
                        <div className="mt-8 flex flex-col gap-4">
                            <label
                                className="flex cursor-pointer items-start gap-3"
                                style={{ color: INK, fontFamily: CAPTION_FONT, fontSize: 14, lineHeight: 1.5 }}
                            >
                                <input
                                    type="checkbox"
                                    className="ks-check mt-1 h-4 w-4 shrink-0"
                                    style={{ accentColor: INK }}
                                    checked={confirmed}
                                    onChange={(event) => setConfirmed(event.target.checked)}
                                />
                                <span>I saved this file somewhere safe and understand it cannot be replaced.</span>
                            </label>

                            <PrimaryButton onClick={handleContinue} disabled={!confirmed}>
                                Continue to chats
                            </PrimaryButton>

                            <button
                                type="button"
                                onClick={handleDownloadAgain}
                                className="ks-link self-center text-sm underline"
                                style={{ color: INK_2, fontFamily: CAPTION_FONT }}
                            >
                                Download again
                            </button>
                        </div>
                    )}
                </>
            )}
        </AuthPageShell>
    );
}

const headingStyle = {
    color: INK,
    fontFamily: DISPLAY_FONT,
    fontSize: 'clamp(28px, 4vw, 36px)',
    letterSpacing: '-0.01em'
};

const leadStyle = {
    color: INK_2,
    fontFamily: DISPLAY_FONT,
    fontSize: 15,
    lineHeight: 1.5
};