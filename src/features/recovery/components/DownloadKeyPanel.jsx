import React, { useRef, useState } from 'react';
import { Download, RefreshCw, Loader2, Info } from 'lucide-react';
import { COLORS, CAPTION_FONT, DISPLAY_FONT } from '../../auth/components/sidepanel.jsx';

/**
 * Download / rotate.
 *
 * These are two different operations and the UI says so, because confusing
 * them destroys data:
 *
 *   download   re-save a key you already hold. The original 32 bytes are not
 *              stored on this device or on the server - by design - so there
 *              is nothing to "download again" unless the user supplies the
 *              file. No button here silently mints one.
 *
 *   rotate     mint a NEW recovery key, re-wrap the SAME master key under it,
 *              and replace the vault. Requires the current key file as proof.
 *              History survives, because the master key inside never changed.
 *
 * The destructive third option (reset) is deliberately not in this panel.
 */
export default function DownloadKeyPanel({ onRotate, busy, error, lastFilename }) {
    const input = useRef(null);
    const [confirming, setConfirming] = useState(false);

    const handlePick = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setConfirming(false);
        await onRotate(file);
    };

    return (
        <section className="mt-8">
            <h2 style={{ color: COLORS.obsidian, fontFamily: DISPLAY_FONT, fontSize: 18 }} className="font-medium">
                Your recovery key
            </h2>

            <div
                className="mt-3 flex gap-3 rounded p-3"
                style={{ border: `1px solid ${COLORS.hairline}`, background: COLORS.paper }}
            >
                <Info size={16} style={{ color: COLORS.ash }} className="mt-0.5 shrink-0" />
                <p style={{ color: COLORS.ash, fontFamily: CAPTION_FONT, fontSize: 13, lineHeight: 1.6 }}>
                    Your recovery key was generated once, in your browser, when you created your
                    account, and the file was handed to you then. It is not kept on this device
                    and it is not kept on our servers, so it cannot be shown to you again. If you
                    still have the file, that file is your key.
                </p>
            </div>

            <h3 style={{ color: COLORS.obsidian, fontFamily: DISPLAY_FONT, fontSize: 15 }} className="mt-6 font-medium">
                Replace it with a new one
            </h3>
            <p style={{ color: COLORS.ash, fontFamily: CAPTION_FONT, fontSize: 13, lineHeight: 1.6 }} className="mt-1">
                Issues a new key file and retires the old one. Your messages stay readable -
                this changes the lock, not what is behind it. You will need your current key
                file to do it.
            </p>

            <input ref={input} type="file" accept=".key,text/plain" hidden onChange={handlePick} />

            {!confirming ? (
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirming(true)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded px-6 py-3.5 text-base font-medium transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
                    style={{ border: `1px solid ${COLORS.hairline}`, color: COLORS.obsidian, fontFamily: DISPLAY_FONT }}
                >
                    <RefreshCw size={17} />
                    Generate a new recovery key
                </button>
            ) : (
                <div className="mt-4 flex flex-col gap-2">
                    <p style={{ color: COLORS.obsidian, fontFamily: CAPTION_FONT, fontSize: 13 }}>
                        Select your <strong>current</strong> key file to continue. The new file
                        downloads immediately afterwards.
                    </p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => input.current?.click()}
                            className="flex flex-1 items-center justify-center gap-2 rounded px-4 py-3 text-sm font-medium disabled:opacity-50"
                            style={{ background: COLORS.signal, color: COLORS.obsidian, fontFamily: DISPLAY_FONT }}
                        >
                            {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            {busy ? 'Rotating...' : 'Choose current key'}
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => setConfirming(false)}
                            className="rounded px-4 py-3 text-sm font-medium"
                            style={{ border: `1px solid ${COLORS.hairline}`, color: COLORS.ash, fontFamily: DISPLAY_FONT }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {lastFilename && !busy && !error && (
                <p className="mt-3 text-sm" style={{ color: COLORS.teal, fontFamily: CAPTION_FONT }}>
                    New key saved as {lastFilename}. Store it somewhere safe - the old file no longer works.
                </p>
            )}

            {error && (
                <div className="mt-3 rounded bg-red-100 p-3 text-sm text-red-600" style={{ fontFamily: CAPTION_FONT }}>
                    {error}
                </div>
            )}
        </section>
    );
}
