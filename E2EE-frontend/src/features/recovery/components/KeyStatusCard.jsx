import React from 'react';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { COLORS, CAPTION_FONT, DISPLAY_FONT } from '../../auth/components/sidepanel.jsx';

const formatDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
    });
};

/**
 * What this browser can currently read, in plain language.
 *
 * "Unlocked" means the master backup key is present as a non-extractable
 * CryptoKey in IndexedDB - see mbkStore. It does NOT mean the recovery key is
 * stored anywhere, because it never is.
 */
export default function KeyStatusCard({ loading, hasLocalKey, vault, error }) {
    const Icon = hasLocalKey ? ShieldCheck : ShieldAlert;
    const accent = hasLocalKey ? COLORS.teal : '#e0a500';

    return (
        <div
            className="rounded p-4"
            style={{ border: `1px solid ${COLORS.hairline}`, background: COLORS.paper }}
        >
            <div className="flex items-start gap-3">
                {loading
                    ? <Loader2 size={18} className="animate-spin" style={{ color: COLORS.midGray }} />
                    : <Icon size={18} style={{ color: accent }} />}

                <div className="flex-1">
                    <p style={{ color: COLORS.obsidian, fontFamily: DISPLAY_FONT, fontSize: 15 }} className="font-medium">
                        {loading
                            ? 'Checking this device...'
                            : hasLocalKey
                                ? 'History is unlocked on this device'
                                : 'History is locked on this device'}
                    </p>

                    <p style={{ color: COLORS.ash, fontFamily: CAPTION_FONT, fontSize: 13, lineHeight: 1.5 }} className="mt-1">
                        {loading ? '\u00a0' : hasLocalKey
                            ? 'Your master key is held here as a non-extractable key. Restarting the browser will not lock it again.'
                            : 'Upload your recovery key below to read messages sent before this device was set up.'}
                    </p>

                    {!loading && vault && (
                        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1" style={{ fontFamily: CAPTION_FONT, fontSize: 12 }}>
                            <div>
                                <dt style={{ color: COLORS.ash }} className="inline">Vault version </dt>
                                <dd style={{ color: COLORS.obsidian }} className="inline font-medium">{vault.generation ?? 1}</dd>
                            </div>
                            {formatDate(vault.createdAt) && (
                                <div>
                                    <dt style={{ color: COLORS.ash }} className="inline">Created </dt>
                                    <dd style={{ color: COLORS.obsidian }} className="inline font-medium">{formatDate(vault.createdAt)}</dd>
                                </div>
                            )}
                            {formatDate(vault.lastRestoredAt) && (
                                <div>
                                    <dt style={{ color: COLORS.ash }} className="inline">Last restored </dt>
                                    <dd style={{ color: COLORS.obsidian }} className="inline font-medium">{formatDate(vault.lastRestoredAt)}</dd>
                                </div>
                            )}
                        </dl>
                    )}

                    {!loading && error && (
                        <p className="mt-2 text-sm text-red-600" style={{ fontFamily: CAPTION_FONT }}>{error}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
