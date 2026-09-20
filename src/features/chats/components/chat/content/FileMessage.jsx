import React from 'react';
import { Loader2, Download, FileText, FileArchive, File as FileIcon, Music } from 'lucide-react';
import { useAttachment } from '../../../hooks/useAttachment.js';

const humanSize = (bytes) => {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
    return `${size.toFixed(size < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
};

/** Icon by mime family - PDFs, archives, audio and everything else. */
const iconFor = (mimeType = '') => {
    if (mimeType.startsWith('audio/')) return Music;
    if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) return FileText;
    if (/zip|compressed|tar|rar|7z/.test(mimeType)) return FileArchive;
    return FileIcon;
};

/**
 * Anything that is not an image or a video: PDFs, text documents, ZIPs,
 * spreadsheets, whatever else arrives. Decrypted on click, then saved.
 */
export default function FileMessage({ conversationId, attachment }) {
    const { loading, progress, error, errorMessage, download } = useAttachment(conversationId, attachment);
    const Icon = iconFor(attachment.mimeType);

    return (
        <button
            type="button"
            onClick={download}
            disabled={loading}
            className="ec-att-file"
        >
            <span className="ec-att-file__icon">
                {loading ? <Loader2 className="ec-spin" /> : <Icon />}
            </span>

            <span className="ec-att-file__text">
                <span className="ec-att-file__name">
                    {attachment.originalFileName || 'Attachment'}
                </span>
                <span className="ec-att-file__sub">
                    {error ? errorMessage : loading ? `${progress || 0}%` : humanSize(attachment.size)}
                </span>
            </span>

            {!loading && <Download aria-hidden="true" />}
        </button>
    );
}
