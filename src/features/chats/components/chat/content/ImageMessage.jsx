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
            <div className="flex items-center gap-2 text-xs text-red-400 py-6 px-3">
                <ImageOff className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
            </div>
        );
    }

    if (!url) {
        return (
            <div className="flex items-center justify-center w-48 h-32 rounded-lg bg-black/10">
                {loading ? <Loader2 className="w-4 h-4 animate-spin opacity-60" /> : null}
            </div>
        );
    }

    return (
        <img
            src={url}
            alt={attachment.originalFileName || 'Image'}
            className="rounded-lg max-w-[260px] max-h-[320px] object-cover"
            loading="lazy"
        />
    );
}
