import React, { useRef, useState } from 'react';
import { Upload, CheckCircle2, Loader2 } from 'lucide-react';
import { COLORS, CAPTION_FONT, DISPLAY_FONT } from '../../auth/components/sidepanel.jsx';

/**
 * Upload the .key file.
 *
 * The file is read in this tab, PBKDF2'd into a vault key, and used to unwrap
 * the MBK. Neither the file nor anything derived from it is uploaded - the
 * server sees only the fact that a restore happened.
 */
export default function UploadKeyPanel({ onUpload, busy, result, error }) {
    const input = useRef(null);
    const [filename, setFilename] = useState('');
    const [remember, setRemember] = useState(true);

    const handlePick = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setFilename(file.name);
        await onUpload(file, { rememberDevice: remember });
    };

    return (
        <section className="mt-8">
            <h2 style={{ color: COLORS.obsidian, fontFamily: DISPLAY_FONT, fontSize: 18 }} className="font-medium">
                Upload recovery key
            </h2>
            <p style={{ color: COLORS.ash, fontFamily: CAPTION_FONT, fontSize: 13, lineHeight: 1.6 }} className="mt-1">
                Unlocks your history on this device. Your key file is read here and never sent to the server.
            </p>

            <label className="mt-3 flex items-center gap-2 cursor-pointer" style={{ fontFamily: CAPTION_FONT, fontSize: 13, color: COLORS.obsidian }}>
                <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                />
                Stay unlocked on this device
            </label>

            <input ref={input} type="file" accept=".key,text/plain" hidden onChange={handlePick} />

            <button
                type="button"
                disabled={busy}
                onClick={() => input.current?.click()}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded px-6 py-3.5 text-base font-medium transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
                style={{ background: COLORS.signal, color: COLORS.obsidian, fontFamily: DISPLAY_FONT }}
            >
                {busy ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
                {busy ? 'Unlocking...' : 'Choose recovery key file'}
            </button>

            {filename && !busy && !error && (
                <p style={{ color: COLORS.ash, fontFamily: CAPTION_FONT, fontSize: 12 }} className="mt-2">
                    {filename}
                </p>
            )}

            {result && (
                <p className="mt-3 flex items-center gap-2 text-sm" style={{ color: COLORS.teal, fontFamily: CAPTION_FONT }}>
                    <CheckCircle2 size={15} />
                    History unlocked. Older messages are being restored in the background.
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
