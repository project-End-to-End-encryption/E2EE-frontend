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
            className="flex items-center gap-3 min-w-[220px] max-w-[280px] px-3 py-2.5 rounded-lg bg-black/10 text-left"
        >
            <span className="w-9 h-9 shrink-0 rounded-lg bg-black/10 flex items-center justify-center">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
            </span>

            <span className="flex-1 min-w-0">
                <span className="block text-xs font-semibold truncate">
                    {attachment.originalFileName || 'Attachment'}
                </span>
                <span className="block text-[11px] opacity-70">
                    {error ? errorMessage : loading ? `${progress || 0}%` : humanSize(attachment.size)}
                </span>
            </span>

            {!loading && <Download className="w-3.5 h-3.5 shrink-0 opacity-70" />}
        </button>
    );
}
