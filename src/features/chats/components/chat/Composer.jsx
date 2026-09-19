import React, { useRef, useState } from 'react';
import { Paperclip, Send, X, Loader2, Image as ImageIcon, Film, FileText } from 'lucide-react';
import { useTheme } from '../../../../providers/useTheme.js';
import { useMediaUpload } from '../../hooks/useMediaUpload.js';
import { describeFile } from '../../../media/mediaService.js';
import { messageFor } from '../../../../shared/constants/errorCodes.js';

/**
 * Composer
 *
 *      Composer
 *        |- AttachmentButton
 *        |- TextInput
 *        |- [VoiceMessageButton]  <- v2
 *        `- SendButton
 *
 * The voice-message slot is left as a gap in the flex row with a comment, not
 * as a dead microphone icon. Recording needs a recorder, a waveform, a
 * duration and a cancel gesture; a button that does none of that is a lie.
 *
 * The attach menu offers Photo / Video / Document, but those are only accept
 * filters on one file input - the pipeline underneath is type-agnostic, so a
 * spreadsheet or a .tar.gz goes through the identical path.
 */
export default function Composer({ conversationId, onSendText, disabled = false }) {
    const { isDark } = useTheme();

    const [text, setText] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);
    const [staged, setStaged] = useState([]);
    const [stageError, setStageError] = useState(null);

    const fileInput = useRef(null);
    const acceptRef = useRef('*/*');

    const { uploads, busy, sendFiles, clear } = useMediaUpload(conversationId);

    const openPicker = (accept) => {
        acceptRef.current = accept;
        setMenuOpen(false);
        if (fileInput.current) {
            fileInput.current.accept = accept;
            fileInput.current.click();
        }
    };

    const handleFiles = (event) => {
        const picked = Array.from(event.target.files ?? []);
        event.target.value = '';
        if (!picked.length) return;

        setStageError(null);
        const accepted = [];

        for (const file of picked) {
            try {
                describeFile(file);          // size / emptiness checks, pre-crypto
                accepted.push(file);
            } catch (error) {
                setStageError(error);
            }
        }

        setStaged((current) => [...current, ...accepted]);
    };

    const removeStaged = (index) =>
        setStaged((current) => current.filter((_, position) => position !== index));

    const handleSend = async () => {
        if (disabled || busy) return;

        if (staged.length) {
            const files = staged;
            setStaged([]);
            const caption = text;
            setText('');

            const result = await sendFiles(files, { text: caption });
            if (result?.failures?.length) {
                setStageError(result.failures[0].error);
            }
            return;
        }

        if (!text.trim()) return;
        const outgoing = text;
        setText('');
        await onSendText(outgoing);
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void handleSend();
        }
    };

    const canSend = !disabled && !busy && (text.trim().length > 0 || staged.length > 0);

    return (
        <div className={`shrink-0 border-t px-3 py-2.5 rounded-b-2xl ${
            isDark ? 'border-slate-800 bg-[#0f172a]/80' : 'border-[#b2d1f8]/60 bg-white/70'
        } backdrop-blur-sm`}>

            {(staged.length > 0 || uploads.length > 0) && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {staged.map((file, index) => (
                        <span key={`${file.name}-${index}`} className={`flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-lg text-[11px] font-medium ${
                            isDark ? 'bg-slate-800 text-slate-200' : 'bg-[#b2d1f8]/60 text-[#0a1968]'
                        }`}>
                            <span className="max-w-[160px] truncate">{file.name}</span>
                            <button type="button" onClick={() => removeStaged(index)} aria-label="Remove attachment">
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}

                    {uploads.map((upload) => (
                        <span key={upload.id} className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-medium ${
                            upload.error ? 'bg-red-500/15 text-red-400'
                                : isDark ? 'bg-slate-800 text-slate-300' : 'bg-[#b2d1f8]/60 text-[#0a1968]'
                        }`}>
                            {!upload.error && upload.phase !== 'done' && <Loader2 className="w-3 h-3 animate-spin" />}
                            <span className="max-w-[160px] truncate">{upload.name}</span>
                            <span className="opacity-70">
                                {upload.error ? upload.error : `${upload.phase} ${upload.percent}%`}
                            </span>
                        </span>
                    ))}
                </div>
            )}

            {stageError && (
                <p className="text-[11px] font-medium text-red-500 mb-2 px-1">
                    {messageFor(stageError)}
                </p>
            )}

            <div className="flex items-end gap-2">

                <div className="relative">
                    <button
                        type="button"
                        aria-label="Attach"
                        disabled={disabled}
                        onClick={() => setMenuOpen((open) => !open)}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 ${
                            isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-[#0a1968] hover:bg-[#b2d1f8]/60'
                        }`}
                    >
                        <Paperclip className="w-4 h-4" />
                    </button>

                    {menuOpen && (
                        <div className={`absolute bottom-11 left-0 w-40 rounded-xl shadow-2xl p-2 z-50 border ${
                            isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                        }`}>
                            <AttachOption Icon={ImageIcon} label="Photo" onClick={() => openPicker('image/*')} isDark={isDark} />
                            <AttachOption Icon={Film} label="Video" onClick={() => openPicker('video/*')} isDark={isDark} />
                            <AttachOption Icon={FileText} label="Document" onClick={() => openPicker('*/*')} isDark={isDark} />
                        </div>
                    )}
                </div>

                <input
                    ref={fileInput}
                    type="file"
                    multiple
                    hidden
                    onChange={handleFiles}
                />

                <textarea
                    rows={1}
                    value={text}
                    disabled={disabled}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={disabled ? 'Waiting for the conversation key...' : 'Write a message'}
                    className={`flex-1 resize-none max-h-32 px-3.5 py-2.5 rounded-xl text-sm outline-none transition-colors ${
                        isDark
                            ? 'bg-[#1e293b] border border-slate-700 text-white placeholder:text-slate-500 focus:border-[#00a8cc]'
                            : 'bg-white border border-[#c5ddfa] text-[#0a1968] placeholder:text-slate-500 focus:border-[#00a8cc]'
                    }`}
                />

                {/* Voice-message button goes here in v2, between input and send. */}

                <button
                    type="button"
                    aria-label="Send"
                    onClick={handleSend}
                    disabled={!canSend}
                    className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#0a1968] text-white shadow-md disabled:opacity-40 transition-opacity"
                >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
}

function AttachOption({ Icon, label, onClick, isDark }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
            }`}
        >
            <Icon className="w-3.5 h-3.5 text-cyan-400" />
            {label}
        </button>
    );
}
