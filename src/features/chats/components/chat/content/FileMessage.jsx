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
            className="group flex items-center gap-[10px] w-full p-[6px] pr-2 rounded-[14px] bg-[color-mix(in_srgb,currentColor_6%,transparent)] hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] border border-[color-mix(in_srgb,currentColor_10%,transparent)] text-left transition-colors duration-150 disabled:opacity-70 disabled:cursor-not-allowed"
        >
            <span className="flex-none inline-grid place-items-center w-[38px] h-[38px] rounded-[10px] bg-[color-mix(in_srgb,currentColor_8%,transparent)]">
                {loading ? (
                    <Loader2 className="w-5 h-5 animate-[ec-spin_0.9s_linear_infinite]" />
                ) : (
                    <Icon className="w-[18px] h-[18px]" />
                )}
            </span>

            <span className="flex flex-col flex-1 min-w-0 py-[2px]">
                <span className="truncate font-semibold text-[13.5px] leading-[1.3] [font-family:var(--font-body)]">
                    {attachment.originalFileName || 'Attachment'}
                </span>
                <span className={`truncate font-medium text-[11.5px] leading-[1.3] mt-[2px] ${error ? 'text-[var(--danger)] opacity-100' : 'opacity-70'}`}>
                    {error ? errorMessage : loading ? `${progress || 0}%` : humanSize(attachment.size)}
                </span>
            </span>

            {!loading && (
                <Download
                    className="flex-none w-[18px] h-[18px] mx-1 opacity-40 transition-opacity duration-150 group-hover:opacity-100 group-active:scale-95"
                    aria-hidden="true"
                />
            )}
        </button>
    );
}