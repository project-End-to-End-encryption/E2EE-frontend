import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Paperclip, Send, X, Loader2, Image as ImageIcon, Film, FileText } from 'lucide-react';
import { useMediaUpload } from '../../hooks/useMediaUpload.js';
import { describeFile } from '../../../media/mediaService.js';
import { messageFor } from '../../../../shared/constants/errorCodes.js';

/**
 * Composer
 *
 *      Composer
 *        |- AttachmentButton
 *        |- TextInput (grows with what you type)
 *        |- trailing            <- voice-message button drops in here in v2
 *        `- SendButton
 *
 * The voice-message slot is the `trailing` prop, an empty region rather than a
 * dead microphone icon. Recording needs a recorder, a waveform, a duration and
 * a cancel gesture; a button that does none of that is a lie.
 *
 * The attach menu offers Photo / Video / Document, but those are only accept
 * filters on one file input - the pipeline underneath is type-agnostic, so a
 * spreadsheet or a .tar.gz goes through the identical path.
 */
export default function Composer({ conversationId, onSendText, disabled = false, trailing = null }) {
    const [text, setText] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);
    const [staged, setStaged] = useState([]);
    const [stageError, setStageError] = useState(null);

    const fileInput = useRef(null);
    const inputRef = useRef(null);
    const menuRef = useRef(null);

    const { uploads, busy, sendFiles } = useMediaUpload(conversationId);

    // Grow with the text up to the CSS max-height, then scroll.
    useLayoutEffect(() => {
        const node = inputRef.current;
        if (!node) return;
        node.style.height = 'auto';
        node.style.height = `${node.scrollHeight}px`;
    }, [text]);

    useEffect(() => {
        if (!menuOpen) return undefined;

        const onPointerDown = (event) => {
            if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
        };
        const onKeyDown = (event) => {
            if (event.key === 'Escape') setMenuOpen(false);
        };

        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [menuOpen]);

    const openPicker = (accept) => {
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
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void handleSend();
        }
    };

    const canSend = !disabled && !busy && (text.trim().length > 0 || staged.length > 0);

    return (
        <div className="relative flex-none w-full max-w-[964px] mx-auto px-[10px] pt-1 pb-3 md:px-5 md:pt-[6px] md:pb-[18px] select-none">

            {(staged.length > 0 || uploads.length > 0) && (
                <div className="flex flex-wrap gap-2 mx-2 mb-[10px]">
                    {staged.map((file, index) => (
                        <span key={`${file.name}-${index}`} className="inline-flex items-center gap-2 max-w-full pl-3 pr-2 py-[6px] border border-[var(--line)] rounded-full bg-[var(--surface)] text-[var(--ink)] font-medium text-[12.5px] leading-[1.2] [font-family:var(--font-body)] shadow-[var(--shadow-bubble)]">
                            <span className="max-w-[170px] truncate">{file.name}</span>
                            <button
                                type="button"
                                onClick={() => removeStaged(index)}
                                aria-label={`Remove ${file.name}`}
                                className="inline-grid place-items-center w-[22px] h-[22px] p-0 border-0 rounded-full bg-[var(--surface-3)] text-[var(--ink)]"
                            >
                                <X className="w-[13px] h-[13px]" />
                            </button>
                        </span>
                    ))}

                    {uploads.map((upload) => (
                        <span key={upload.id} className={`inline-flex items-center gap-2 max-w-full pl-3 pr-2 py-[6px] border rounded-full font-medium text-[12.5px] leading-[1.2] [font-family:var(--font-body)] shadow-[var(--shadow-bubble)] ${upload.error ? 'bg-[var(--danger-soft)] border-transparent text-[var(--danger)]' : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)]'}`}>
                            {!upload.error && upload.phase !== 'done' && (
                                <Loader2 className="w-[13px] h-[13px] animate-[ec-spin_0.9s_linear_infinite]" />
                            )}
                            <span className="max-w-[170px] truncate">{upload.name}</span>
                            <span className={upload.error ? 'text-inherit' : 'text-[var(--ink-2)]'}>
                                {upload.error ? upload.error : `${upload.phase} ${upload.percent}%`}
                            </span>
                        </span>
                    ))}
                </div>
            )}

            {stageError && (
                <p className="mx-[10px] mb-[10px] text-[var(--danger)] font-medium text-[13px] leading-[1.35] [font-family:var(--font-body)]" role="alert">
                    {messageFor(stageError)}
                </p>
            )}

            <div className="flex items-end gap-1 p-[7px] pl-[8px] border border-[var(--line)] rounded-[32px] bg-[var(--surface)] shadow-[var(--shadow-float)] transition-[box-shadow,border-color] duration-150 focus-within:border-[var(--focus)] focus-within:shadow-[var(--shadow-float),0_0_0_3px_color-mix(in_srgb,var(--focus)_22%,transparent)]">

                <div className="relative flex" ref={menuRef}>
                    <button
                        type="button"
                        className="inline-flex items-center justify-center flex-none w-[42px] h-[42px] p-0 border-0 rounded-full bg-transparent text-[var(--ink-2)] transition-[background-color,color,transform] duration-150 hover:enabled:bg-[var(--surface-3)] hover:enabled:text-[var(--ink)] active:enabled:scale-[0.94] disabled:opacity-45"
                        aria-label="Attach"
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        disabled={disabled}
                        onClick={() => setMenuOpen((open) => !open)}
                    >
                        <Paperclip className="w-5 h-5" />
                    </button>

                    {menuOpen && (
                        <div className="absolute left-[8px] bottom-[calc(100%+8px)] z-30 w-[190px] p-[6px] border border-[var(--line)] rounded-[18px] bg-[var(--surface)] shadow-[var(--shadow-menu)] animate-[ec-pop_0.14s_ease-out]" role="menu">
                            <AttachOption Icon={ImageIcon} label="Photo" onClick={() => openPicker('image/*')} />
                            <AttachOption Icon={Film} label="Video" onClick={() => openPicker('video/*')} />
                            <AttachOption Icon={FileText} label="Document" onClick={() => openPicker('*/*')} />
                        </div>
                    )}
                </div>

                <input ref={fileInput} type="file" multiple hidden onChange={handleFiles} />

                <textarea
                    ref={inputRef}
                    rows={1}
                    value={text}
                    disabled={disabled}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={handleKeyDown}
                    aria-label="Message"
                    placeholder={disabled ? 'Waiting for the conversation key...' : 'Write a message'}
                    className="flex-1 min-w-0 max-h-[140px] px-2 py-[11px] border-0 bg-transparent text-[var(--ink)] font-normal text-[15px] leading-[1.4] [font-family:var(--font-body)] resize-none outline-none select-text placeholder:text-[var(--ink-3)] placeholder:opacity-100 disabled:cursor-not-allowed focus-visible:outline-none"
                />

                {trailing}

                <button
                    type="button"
                    aria-label="Send"
                    onClick={handleSend}
                    disabled={!canSend}
                    className="inline-grid place-items-center flex-none w-[46px] h-[46px] p-0 border-0 rounded-full bg-[linear-gradient(160deg,var(--bubble-out-a),var(--bubble-out-b))] text-white shadow-[0_8px_18px_-8px_var(--bubble-out-b)] transition-[transform,opacity,background-color] duration-150 hover:enabled:-translate-y-[1px] active:enabled:scale-[0.94] disabled:bg-[var(--surface-3)] disabled:text-[var(--ink-3)] disabled:shadow-none"
                >
                    {busy ? <Loader2 className="w-5 h-5 -ml-[2px] animate-[ec-spin_0.9s_linear_infinite]" /> : <Send className="w-5 h-5 -ml-[2px]" />}
                </button>
            </div>
        </div>
    );
}

function AttachOption({ Icon, label, onClick }) {
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onClick}
            className="flex items-center justify-between gap-[10px] w-full p-[10px] border-0 rounded-[12px] bg-transparent text-[var(--ink)] font-medium text-[14px] leading-[1.2] [font-family:var(--font-body)] text-left hover:bg-[var(--surface-2)] transition-colors duration-120"
        >
            <span className="inline-flex items-center gap-[10px]">
                <Icon className="w-[17px] h-[17px] flex-none text-[var(--accent-text)]" />
                {label}
            </span>
        </button>
    );
}