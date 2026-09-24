import React, {
    useCallback,
    useEffect,
    useRef,
    useState
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
    KeyRound,
    Upload,
    Loader2,
    AlertCircle,
    CheckCircle2,
    X,
    AlertTriangle
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

import {
    installRestoredIdentity
} from '../Identityinstall.js';

import {
    getDeviceState,
    wipeLocalKeys,
    claimDevice
} from '../deviceState.js';

import webSocketClient from '../../../infrastructure/websocket/WebSocketClient.js';

import {
    generateAndRegisterKeys
} from '../../auth/service/keyBundle.js';

import {
    identityHandoff
} from '../identityHandoff.js';

/**
 * RestoreKeysPage
 *
 * Normal restore:
 *
 *   checking
 *      ↓
 *   ready
 *      ↓
 *   upload recovery key
 *      ↓
 *   vaultService.restore()
 *      ↓
 *   /chat
 *
 * Lost recovery key:
 *
 *   Can't find your recovery key?
 *      ↓
 *   confirm
 *      ↓
 *   vaultService.reset()
 *      ↓
 *   wipe old local keys
 *      ↓
 *   create NEW identity
 *      ↓
 *   vaultService.enroll()
 *      ↓
 *   create NEW MBK
 *      ↓
 *   download NEW recovery key
 *      ↓
 *   /chat
 *
 * IMPORTANT:
 *
 * We do NOT navigate to /signup/keys.
 * That page depends on the normal signup lifecycle.
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

const leadStyle = {
    color: INK_2,
    fontFamily: DISPLAY_FONT,
    fontSize: 15,
    lineHeight: 1.5
};

const buttonBase = {
    fontFamily: DISPLAY_FONT,
    color: INK,
    borderRadius: 4,
    cursor: 'pointer'
};

function friendlyError(error) {
    if (error?.name === 'RecoveryKeyError') {
        return error.message;
    }

    if (error?.name === 'OperationError') {
        return 'That key file could not unlock this account.';
    }

    return error?.message || 'Something went wrong. Try again.';
}

export default function RestoreKeysPage() {
    const navigate = useNavigate();
    const inputRef = useRef(null);

    const [phase, setPhase] = useState('checking');

    const [file, setFile] = useState(null);

    const [error, setError] = useState(null);

    const [attempt, setAttempt] = useState(0);

    const [resetBusy, setResetBusy] = useState(false);

    const [resetError, setResetError] = useState(null);

    const [showResetConfirm, setShowResetConfirm] = useState(false);

    const [username, setUsername] = useState(null);

    /*
     * Check device/vault state.
     */
    useEffect(() => {
        let cancelled = false;

        (async () => {
            setPhase('checking');
            setError(null);
            setResetError(null);

            try {
                let state = await getDeviceState(
                    authStore.getUserId()
                );

                /*
                 * Never allow another account's local crypto material
                 * to remain in this browser.
                 */
                if (state === 'foreign') {
                    await wipeLocalKeys();
                    state = 'restore-needed';
                }

                /*
                 * Already unlocked on this browser.
                 */
                if (state === 'ok') {
                    if (!cancelled) {
                        navigate('/chat', {
                            replace: true
                        });
                    }

                    return;
                }

                /*
                 * Username is only used for the recovery-key filename.
                 * It is not allowed to block restore.
                 */
                try {
                    const [profile] =
                        await userDirectory.profiles([
                            authStore.getUserId()
                        ]);

                    if (!cancelled) {
                        setUsername(
                            profile?.username ?? null
                        );
                    }
                } catch {
                    if (!cancelled) {
                        setUsername(null);
                    }
                }

                const { exists } =
                    await vaultService.status();

                if (!cancelled) {
                    setPhase(
                        exists
                            ? 'ready'
                            : 'novault'
                    );
                }
            } catch {
                if (!cancelled) {
                    setPhase('unreachable');
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [attempt, navigate]);

    /*
     * User selected a recovery file.
     */
    const handlePick = (event) => {
        setError(null);
        setResetError(null);

        setFile(
            event.target.files?.[0] ?? null
        );
    };

    /*
     * NORMAL RESTORE
     */
    const handleRestore = useCallback(
        async () => {
            if (!file) return;

            setError(null);
            setResetError(null);
            setPhase('working');

            try {
                /*
                 * 1. Unlock the vault.
                 *
                 * This:
                 * - derives the vault key
                 * - unwraps the MBK
                 * - saves the MBK locally
                 * - gives us the identity PKCS8
                 */
                const {
                    identityPkcs8
                } = await vaultService.restore(
                    file
                );

                /*
                 * 2. Install the restored identity.
                 */
                try {
                    await installRestoredIdentity(
                        identityPkcs8
                    );
                } finally {
                    /*
                     * Do not retain raw PKCS8 bytes.
                     */
                    new Uint8Array(
                        identityPkcs8
                    ).fill(0);
                }

                /*
                 * 3. Claim this browser for this account.
                 */
                await claimDevice(
                    authStore.getUserId()
                );

                /*
                 * 4. Register restored identity/chat keys.
                 */
                const socket =
                    await webSocketClient.connect();

                await generateAndRegisterKeys(
                    socket,
                    {
                        createIdentity: false,
                        retainForVault: false
                    }
                );

                /*
                 * 5. Done.
                 */
                navigate('/chat', {
                    replace: true
                });
            } catch (restoreError) {
                setError(
                    friendlyError(
                        restoreError
                    )
                );

                setPhase('ready');
            }
        },
        [file, navigate]
    );

    /*
     * LOST RECOVERY KEY
     *
     * This is the important part.
     *
     * We use the EXISTING APIs:
     *
     * 1. vaultService.reset()
     * 2. wipeLocalKeys()
     * 3. generateAndRegisterKeys(... retainForVault:true)
     * 4. vaultService.enroll(...)
     */
    const handleLostRecoveryKey = useCallback(
        async () => {
            if (resetBusy) {
                return;
            }

            setResetBusy(true);
            setResetError(null);
            setError(null);
            setPhase('working');

            let identityPkcs8 = null;

            try {
                await vaultService.reset();

                await wipeLocalKeys();

                const socket =
                    await webSocketClient.connect();

                await generateAndRegisterKeys(
                    socket,
                    {
                        retainForVault: true
                    }
                );

                identityPkcs8 =
                    identityHandoff.peek();

                if (!identityPkcs8) {
                    throw new Error(
                        'A new identity key could not be created.'
                    );
                }

                await vaultService.enroll({
                    username,
                    identityPrivateKeyPkcs8:
                    identityPkcs8,
                    autoDownload: true
                });

                identityHandoff.release();
                identityPkcs8 = null;

                await claimDevice(
                    authStore.getUserId()
                );

                setShowResetConfirm(false);

                navigate('/chat', {
                    replace: true
                });
            } catch (resetErrorCaught) {
                console.error(
                    '[restore] lost recovery key reset failed:',
                    resetErrorCaught
                );

                setResetError(
                    resetErrorCaught?.message ||
                    'Could not create your new encryption vault.'
                );

                setPhase('ready');
            } finally {
                if (identityHandoff.has()) {
                    identityHandoff.release();
                }

                if (identityPkcs8) {
                    try {
                        new Uint8Array(
                            identityPkcs8
                        ).fill(0);
                    } catch {
                        // ignore cleanup errors
                    }
                }

                setResetBusy(false);
            }
        },
        [
            navigate,
            resetBusy,
            username
        ]
    );

    return (
        <AuthPageShell
            tagline="Welcome back."
            subtext="Upload your recovery key once to unlock your chat history on this device."
        >
            {phase === 'checking' && (
                <div
                    className="flex items-center gap-3"
                    role="status"
                    style={{
                        color: INK_2,
                        fontFamily: CAPTION_FONT
                    }}
                >
                    <Loader2
                        size={20}
                        className="animate-spin"
                        aria-hidden="true"
                    />

                    <span className="text-sm">
                        Checking your account...
                    </span>
                </div>
            )}

            {phase === 'unreachable' && (
                <>
                    <h1
                        style={headingStyle}
                        className="font-medium"
                    >
                        Could not reach the server
                    </h1>

                    <p
                        style={leadStyle}
                        className="mt-2"
                    >
                        Check your connection and try again.
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            setAttempt(
                                (n) => n + 1
                            )
                        }
                        className="mt-8 w-full px-6 py-3.5 text-base font-medium"
                        style={{
                            ...buttonBase,
                            background:
                            COLORS.signal
                        }}
                    >
                        Try again
                    </button>
                </>
            )}

            {phase === 'novault' && (
                <>
                    <h1
                        style={headingStyle}
                        className="font-medium"
                    >
                        No recovery key on this account
                    </h1>

                    <p
                        style={leadStyle}
                        className="mt-2"
                    >
                        This account does not currently
                        have a recovery vault.
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                '/login',
                                { replace: true }
                            )
                        }
                        className="mt-8 w-full px-6 py-3.5 text-base font-medium"
                        style={{
                            ...buttonBase,
                            background:
                            COLORS.signal
                        }}
                    >
                        Back to login
                    </button>
                </>
            )}

            {(phase === 'ready' ||
                phase === 'working') && (
                <>
                    <h1
                        style={headingStyle}
                        className="font-medium"
                    >
                        Restore your chats
                    </h1>

                    <p
                        style={leadStyle}
                        className="mt-2"
                    >
                        Choose the recovery key file
                        you saved when you signed up.
                        It is read in this browser
                        and never uploaded.
                    </p>

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
                        onClick={() =>
                            inputRef.current?.click()
                        }
                        disabled={
                            phase === 'working' ||
                            resetBusy
                        }
                        className="mt-7 flex w-full items-center gap-4 p-4 text-left"
                        style={{
                            border:
                                `1px dashed ${COLORS.hairline}`,
                            background: TILE_BG,
                            borderRadius: 8
                        }}
                    >
                        <span
                            className="flex h-12 w-12 shrink-0 items-center justify-center"
                            style={{
                                background: '#dff8fd',
                                color: INK,
                                borderRadius: 8
                            }}
                        >
                            <KeyRound
                                size={22}
                                aria-hidden="true"
                            />
                        </span>

                        <span className="min-w-0 flex-1">
                            <span
                                className="block break-all text-sm font-medium"
                                style={{
                                    color: INK,
                                    fontFamily:
                                    DISPLAY_FONT
                                }}
                            >
                                {file
                                    ? file.name
                                    : 'Choose your .key file'}
                            </span>

                            <span
                                className="mt-1 flex items-center gap-1.5 text-xs"
                                style={{
                                    color: INK_2,
                                    fontFamily:
                                    CAPTION_FONT
                                }}
                            >
                                {file ? (
                                    <CheckCircle2
                                        size={14}
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <Upload
                                        size={14}
                                        aria-hidden="true"
                                    />
                                )}

                                {file
                                    ? 'Ready to restore'
                                    : 'e2ee-recovery-...key'}
                            </span>
                        </span>
                    </button>

                    {error && (
                        <div
                            role="alert"
                            className="mt-5 flex items-start gap-2.5 p-3 text-sm"
                            style={{
                                background: '#fdecea',
                                color: DANGER,
                                border:
                                    '1px solid #f5c6c1',
                                borderRadius: 8,
                                fontFamily:
                                CAPTION_FONT,
                                lineHeight: 1.5
                            }}
                        >
                            <AlertCircle
                                size={16}
                                className="mt-0.5 shrink-0"
                                aria-hidden="true"
                            />

                            <span>
                                {error}
                            </span>
                        </div>
                    )}

                    {resetError && (
                        <div
                            role="alert"
                            className="mt-5 flex items-start gap-2.5 p-3 text-sm"
                            style={{
                                background: '#fdecea',
                                color: DANGER,
                                border:
                                    '1px solid #f5c6c1',
                                borderRadius: 8,
                                fontFamily:
                                CAPTION_FONT,
                                lineHeight: 1.5
                            }}
                        >
                            <AlertCircle
                                size={16}
                                className="mt-0.5 shrink-0"
                                aria-hidden="true"
                            />

                            <span>
                                {resetError}
                            </span>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleRestore}
                        disabled={
                            !file ||
                            phase === 'working' ||
                            resetBusy
                        }
                        className="mt-8 flex w-full items-center justify-center gap-2 px-6 py-3.5 text-base font-medium"
                        style={{
                            ...buttonBase,
                            background:
                            COLORS.signal,
                            opacity:
                                !file ||
                                phase === 'working' ||
                                resetBusy
                                    ? 0.55
                                    : 1,
                            cursor:
                                !file ||
                                phase === 'working' ||
                                resetBusy
                                    ? 'default'
                                    : 'pointer'
                        }}
                    >
                        {phase === 'working' &&
                        !resetBusy ? (
                            <>
                                <Loader2
                                    size={18}
                                    className="animate-spin"
                                    aria-hidden="true"
                                />

                                <span>
                                    Unlocking...
                                </span>
                            </>
                        ) : (
                            <span>
                                Restore my chats
                            </span>
                        )}
                    </button>

                    <div className="mt-6">
                        <button
                            type="button"
                            onClick={() => setShowResetConfirm(true)}
                            disabled={
                                resetBusy ||
                                phase === 'working'
                            }
                            className="w-full text-center text-sm underline"
                            style={{
                                color: INK_2,
                                fontFamily:
                                CAPTION_FONT,
                                opacity:
                                    resetBusy
                                        ? 0.6
                                        : 1,
                                cursor:
                                    resetBusy
                                        ? 'default'
                                        : 'pointer'
                            }}
                        >
                            {resetBusy
                                ? 'Creating your new encryption...'
                                : "Can't find your recovery key?"}
                        </button>
                    </div>
                </>
            )}
            {showResetConfirm && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center px-4"
                    role="presentation"
                    style={{
                        background: 'rgba(17, 24, 39, 0.48)',
                        backdropFilter: 'blur(4px)'
                    }}
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget && !resetBusy) {
                            setShowResetConfirm(false);
                            setResetError(null);
                        }
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="reset-vault-title"
                        aria-describedby="reset-vault-description"
                        className="w-full max-w-md overflow-hidden rounded-2xl"
                        style={{
                            background: COLORS.paper,
                            border: `1px solid ${COLORS.hairline}`,
                            boxShadow:
                                '0 24px 80px rgba(17, 24, 39, 0.20)'
                        }}
                        onMouseDown={(event) => {
                            event.stopPropagation();
                        }}
                    >
                        {/* Header */}
                        <div
                            className="flex items-start justify-between px-6 pt-6"
                        >
                            <div
                                className="flex h-11 w-11 items-center justify-center rounded-full"
                                style={{
                                    background: '#fff0ee',
                                    color: DANGER
                                }}
                            >
                                <AlertTriangle
                                    size={22}
                                    aria-hidden="true"
                                />
                            </div>

                            <button
                                type="button"
                                aria-label="Close"
                                onClick={() => {
                                    if (!resetBusy) {
                                        setShowResetConfirm(false);
                                        setResetError(null);
                                    }
                                }}
                                disabled={resetBusy}
                                className="flex h-9 w-9 items-center justify-center rounded-full"
                                style={{
                                    color: INK_2,
                                    background: 'transparent',
                                    opacity: resetBusy ? 0.45 : 1,
                                    cursor: resetBusy
                                        ? 'default'
                                        : 'pointer'
                                }}
                            >
                                <X
                                    size={19}
                                    aria-hidden="true"
                                />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-6 pb-6 pt-5">
                            <h2
                                id="reset-vault-title"
                                className="text-xl font-medium"
                                style={{
                                    color: INK,
                                    fontFamily: DISPLAY_FONT,
                                    letterSpacing: '-0.01em'
                                }}
                            >
                                Create a new recovery key?
                            </h2>

                            <p
                                id="reset-vault-description"
                                className="mt-3 text-sm"
                                style={{
                                    color: INK_2,
                                    fontFamily: CAPTION_FONT,
                                    lineHeight: 1.65
                                }}
                            >
                                Since your current recovery key is unavailable,
                                you can reset your encryption and start with a
                                completely new vault.
                            </p>

                            <div
                                className="mt-5 rounded-xl p-4"
                                style={{
                                    background: '#fff8f7',
                                    border: '1px solid #f5c6c1'
                                }}
                            >
                                <p
                                    className="text-sm font-medium"
                                    style={{
                                        color: DANGER,
                                        fontFamily: CAPTION_FONT
                                    }}
                                >
                                    This permanently deletes your current
                                    encrypted history.
                                </p>

                                <p
                                    className="mt-2 text-xs"
                                    style={{
                                        color: '#6b4a47',
                                        fontFamily: CAPTION_FONT,
                                        lineHeight: 1.6
                                    }}
                                >
                                    A new master backup key and a new recovery
                                    key will be created. Your previous encrypted
                                    messages cannot be recovered afterward.
                                </p>
                            </div>

                            {resetError && (
                                <div
                                    role="alert"
                                    className="mt-4 flex items-start gap-2.5 rounded-lg p-3 text-sm"
                                    style={{
                                        background: '#fdecea',
                                        color: DANGER,
                                        border: '1px solid #f5c6c1',
                                        fontFamily: CAPTION_FONT,
                                        lineHeight: 1.5
                                    }}
                                >
                                    <AlertCircle
                                        size={16}
                                        className="mt-0.5 shrink-0"
                                        aria-hidden="true"
                                    />

                                    <span>
                            {resetError}
                        </span>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="mt-6 flex flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={handleLostRecoveryKey}
                                    disabled={resetBusy}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3.5 text-sm font-medium"
                                    style={{
                                        background: DANGER,
                                        color: '#fff',
                                        fontFamily: DISPLAY_FONT,
                                        opacity: resetBusy ? 0.65 : 1,
                                        cursor: resetBusy
                                            ? 'default'
                                            : 'pointer'
                                    }}
                                >
                                    {resetBusy ? (
                                        <>
                                            <Loader2
                                                size={17}
                                                className="animate-spin"
                                                aria-hidden="true"
                                            />
                                            <span>
                                    Creating new encryption...
                                </span>
                                        </>
                                    ) : (
                                        <span>
                                Delete history & create new key
                            </span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!resetBusy) {
                                            setShowResetConfirm(false);
                                            setResetError(null);
                                        }
                                    }}
                                    disabled={resetBusy}
                                    className="w-full rounded-lg px-5 py-3 text-sm font-medium"
                                    style={{
                                        background: COLORS.paper,
                                        color: INK,
                                        border:
                                            `1px solid ${COLORS.hairline}`,
                                        fontFamily: DISPLAY_FONT,
                                        opacity: resetBusy ? 0.5 : 1,
                                        cursor: resetBusy
                                            ? 'default'
                                            : 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AuthPageShell>
    );
}