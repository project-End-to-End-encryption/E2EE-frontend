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
        <div className="ec-composer">

            {(staged.length > 0 || uploads.length > 0) && (
                <div className="ec-stage">
                    {staged.map((file, index) => (
                        <span key={`${file.name}-${index}`} className="ec-pill">
                            <span className="ec-pill__name">{file.name}</span>
                            <button type="button" onClick={() => removeStaged(index)} aria-label={`Remove ${file.name}`}>
                                <X />
                            </button>
                        </span>
                    ))}

                    {uploads.map((upload) => (
                        <span key={upload.id} className={`ec-pill ${upload.error ? 'is-error' : ''}`}>
                            {!upload.error && upload.phase !== 'done' && (
                                <Loader2 className="ec-spin" />
                            )}
                            <span className="ec-pill__name">{upload.name}</span>
                            <span className="ec-pill__sub">
                                {upload.error ? upload.error : `${upload.phase} ${upload.percent}%`}
                            </span>
                        </span>
                    ))}
                </div>
            )}

            {stageError && (
                <p className="ec-composer__error" role="alert">{messageFor(stageError)}</p>
            )}

            <div className="ec-composer__bar">

                <div className="ec-composer__attachwrap" ref={menuRef}>
                    <button
                        type="button"
                        className="ec-iconbtn"
                        aria-label="Attach"
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        disabled={disabled}
                        onClick={() => setMenuOpen((open) => !open)}
                    >
                        <Paperclip />
                    </button>

                    {menuOpen && (
                        <div className="ec-attachmenu" role="menu">
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
                    className="ec-composer__input"
                />

                {trailing}

                <button
                    type="button"
                    aria-label="Send"
                    onClick={handleSend}
                    disabled={!canSend}
                    className="ec-send"
                >
                    {busy ? <Loader2 className="ec-spin" /> : <Send />}
                </button>
            </div>
        </div>
    );
}

function AttachOption({ Icon, label, onClick }) {
    return (
        <button type="button" role="menuitem" onClick={onClick} className="ec-menu__item">
            <span><Icon />{label}</span>
        </button>
    );
}
