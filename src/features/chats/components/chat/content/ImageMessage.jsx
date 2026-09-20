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
            <div className="ec-att-error" role="alert">
                <ImageOff width={18} height={18} style={{ flex: '0 0 auto' }} />
                <span>{errorMessage}</span>
            </div>
        );
    }

    if (!url) {
        return (
            <div className="ec-att-placeholder" role="status" aria-label="Decrypting image">
                {loading ? <Loader2 className="ec-spin" width={18} height={18} /> : null}
            </div>
        );
    }

    return (
        <img
            src={url}
            alt={attachment.originalFileName || 'Image'}
            className="ec-att-image"
            loading="lazy"
        />
    );
}
