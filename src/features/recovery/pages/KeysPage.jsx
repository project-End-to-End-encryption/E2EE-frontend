import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
    AuthPageShell,
    COLORS,
    DISPLAY_FONT,
    CAPTION_FONT
} from '../../auth/components/sidepanel.jsx';

import { request } from '../../../infrastructure/http/httpClient.js';
import { authStore } from '../../auth/storage/authStore.js';
import { userDirectory } from '../../user/service/userDirectory.js';
import { vaultService } from '../vaultService.js';
import { mbkStore } from '../mbkStore.js';
import { onRecoveryKeyLoaded } from '../../../app/bootstrap.js';

import KeyStatusCard from '../components/KeyStatusCard.jsx';
import DownloadKeyPanel from '../components/DownloadKeyPanel.jsx';
import UploadKeyPanel from '../components/UploadKeyPanel.jsx';

/**
 * KeysPage
 *
 *      KeysPage
 *        |- AuthBrandPanel (shared with login / signup)
 *        `- main panel
 *             |- KeyStatusCard        "is this device unlocked?"
 *             |- DownloadKeyPanel     download vs rotate, kept apart
 *             `- UploadKeyPanel       restore on this device
 *
 * The shell, palette, typography and spacing are the same AuthPageShell the
 * login and signup pages use - this is those pages' sibling, not a new design.
 *
 *      KeysPage -> vaultService -> recoveryKey -> mbkStore -> IndexedDB CryptoKey
 *
 * Nothing on this page touches crypto directly.
 */
export default function KeysPage() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [hasLocalKey, setHasLocalKey] = useState(false);
    const [vault, setVault] = useState(null);
    const [statusError, setStatusError] = useState(null);
    const [username, setUsername] = useState(null);

    const [uploadBusy, setUploadBusy] = useState(false);
    const [uploadDone, setUploadDone] = useState(false);
    const [uploadError, setUploadError] = useState(null);

    const [rotateBusy, setRotateBusy] = useState(false);
    const [rotateFilename, setRotateFilename] = useState(null);
    const [rotateError, setRotateError] = useState(null);

    const refreshStatus = useCallback(async () => {
        setLoading(true);
        setStatusError(null);

        try {
            // Reads the persisted non-extractable CryptoKey if there is one.
            // Does not create, unwrap or rotate anything.
            setHasLocalKey(await mbkStore.init());
        } catch {
            setHasLocalKey(false);
        }

        try {
            setVault(await request('/api/v1/recovery/vault', null, { method: 'GET' }));
        } catch (error) {
            setVault(null);
            setStatusError(
                /not found|404/i.test(error.message || '')
                    ? 'No recovery vault exists for this account yet.'
                    : 'Could not reach the recovery service.'
            );
        }

        try {
            const [profile] = await userDirectory.profiles([authStore.getUserId()]);
            setUsername(profile?.username ?? null);
        } catch {
            setUsername(null);
        }

        setLoading(false);
    }, []);

    useEffect(() => { void refreshStatus(); }, [refreshStatus]);

    const handleUpload = async (file, { rememberDevice }) => {
        setUploadBusy(true);
        setUploadError(null);
        setUploadDone(false);

        try {
            // vaultService.restore is the only recovery-key parser in the app.
            // It reads the file, derives the vault key, unwraps the MBK as a
            // non-extractable CryptoKey and persists it via mbkStore.
            await vaultService.restore(file, { rememberDevice });

            setUploadDone(true);
            setHasLocalKey(true);

            // Pull and unwrap every archive key so old conversations become
            // readable. Backgrounded - the page stays usable.
            void onRecoveryKeyLoaded().catch((error) => {
                console.warn('[keys] archive key restore deferred:', error?.message);
            });

            void refreshStatus();
        } catch (error) {
            setUploadError(friendly(error));
        } finally {
            setUploadBusy(false);
        }
    };

    const handleRotate = async (currentKeyFile) => {
        setRotateBusy(true);
        setRotateError(null);
        setRotateFilename(null);

        try {
            const { filename } = await vaultService.rotate({ username, currentKeyFile });
            setRotateFilename(filename);
            void refreshStatus();
        } catch (error) {
            setRotateError(friendly(error));
        } finally {
            setRotateBusy(false);
        }
    };

    return (
        <AuthPageShell
            tagline="Your keys, your history"
            subtext="The only copy of your recovery key is the one you hold. We cannot read it, reissue it, or recover it for you."
        >
            <button
                type="button"
                onClick={() => navigate('/chat')}
                className="mb-6 flex items-center gap-1.5 text-sm hover:underline"
                style={{ color: COLORS.midGray, fontFamily: CAPTION_FONT }}
            >
                <ArrowLeft size={15} />
                Back to chats
            </button>

            <h1
                style={{
                    color: COLORS.obsidian,
                    fontFamily: DISPLAY_FONT,
                    fontSize: 'clamp(28px, 4vw, 36px)',
                    letterSpacing: '-0.01em'
                }}
                className="font-medium"
            >
                Encryption keys
            </h1>
            <p
                style={{ color: COLORS.obsidian, fontFamily: DISPLAY_FONT, fontSize: 15, lineHeight: 1.5 }}
                className="mt-2"
            >
                Manage the key that unlocks your message history.
            </p>

            <div className="mt-8">
                <KeyStatusCard
                    loading={loading}
                    hasLocalKey={hasLocalKey}
                    vault={vault}
                    error={statusError}
                />
            </div>

            <DownloadKeyPanel
                onRotate={handleRotate}
                busy={rotateBusy}
                error={rotateError}
                lastFilename={rotateFilename}
            />

            <UploadKeyPanel
                onUpload={handleUpload}
                busy={uploadBusy}
                result={uploadDone}
                error={uploadError}
            />

            <p
                style={{ color: COLORS.ash, fontFamily: CAPTION_FONT, fontSize: 12, lineHeight: 1.6 }}
                className="mt-10"
            >
                Lost the file entirely? Recovery from scratch is destructive - it permanently
                discards every message you can currently read. That option lives in account
                settings, behind its own confirmation, and is deliberately not on this page.
            </p>
        </AuthPageShell>
    );
}

function friendly(error) {
    if (error?.code === 'WRONG_KEY') {
        return 'That recovery key does not belong to this account.';
    }
    if (error?.code === 'RECOVERY_KEY_INVALID') {
        return error.message || 'That does not look like a valid recovery key file.';
    }
    if (/OperationError|decrypt/i.test(error?.message || '')) {
        return 'That key could not unlock this account.';
    }
    return error?.message || 'Something went wrong.';
}
