import React from 'react';
import { Loader2, Play } from 'lucide-react';
import { useAttachment } from '../../../hooks/useAttachment.js';

/**
 * Video decrypts on demand. A conversation full of 200 MB videos must not
 * download every one of them the moment it scrolls into view, so the poster
 * state is a button rather than an autoplaying element.
 */
export default function VideoMessage({ conversationId, attachment }) {
    const { url, loading, progress, error, errorMessage, load } = useAttachment(conversationId, attachment);

    if (url) {
        return <video src={url} controls preload="metadata" className="ec-att-video" />;
    }

    return (
        <button
            type="button"
            onClick={load}
            disabled={loading}
            className="ec-att-placeholder"
            style={{ width: 240, height: 128 }}
        >
            {loading ? (
                <>
                    <Loader2 className="ec-spin" width={18} height={18} />
                    <span>{progress ? `${progress}%` : 'Decrypting...'}</span>
                </>
            ) : (
                <>
                    <Play width={18} height={18} />
                    <span>{error ? errorMessage : 'Play video'}</span>
                </>
            )}
        </button>
    );
}
