import React from 'react';
import { Loader2, ImageOff } from 'lucide-react';
import { useAttachment } from '../../../hooks/useAttachment.js';

/**
 * Images decrypt eagerly - a photo that needs a click to appear is not a photo
 * message. The bytes are fetched as ciphertext and opened in the tab; the
 * object URL points at a Blob that only ever existed after decryption.
 */
export default function ImageMessage({ conversationId, attachment }) {
    const { url, loading, error, errorMessage } = useAttachment(conversationId, attachment, { eager: true });

    if (error) {
        return (
            <div className="flex items-center gap-2 p-3 rounded-[14px] bg-[color-mix(in_srgb,currentColor_6%,transparent)] border border-[color-mix(in_srgb,currentColor_10%,transparent)] font-medium text-[13px] leading-[1.35] [font-family:var(--font-body)]" role="alert">
                <ImageOff className="flex-none w-[18px] h-[18px] opacity-70" />
                <span className="opacity-90">{errorMessage}</span>
            </div>
        );
    }

    if (!url) {
        return (
            <div className="flex items-center justify-center w-full min-w-[200px] min-h-[160px] rounded-[14px] bg-[color-mix(in_srgb,currentColor_6%,transparent)]" role="status" aria-label="Decrypting image">
                {loading ? <Loader2 className="w-[18px] h-[18px] opacity-70 animate-[ec-spin_0.9s_linear_infinite]" /> : null}
            </div>
        );
    }

    return (
        <img
            src={url}
            alt={attachment.originalFileName || 'Image'}
            className="block w-auto max-w-full max-h-[400px] rounded-[14px] object-cover bg-[color-mix(in_srgb,currentColor_6%,transparent)]"
            loading="lazy"
        />
    );
}