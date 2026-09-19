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
        return (
            <video
                src={url}
                controls
                preload="metadata"
                className="rounded-lg max-w-[280px] max-h-[320px]"
            />
        );
    }

    return (
        <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 w-[240px] h-[120px] justify-center rounded-lg bg-black/15 text-xs font-semibold"
        >
            {loading ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{progress ? `${progress}%` : 'Decrypting...'}</span>
                </>
            ) : (
                <>
                    <Play className="w-4 h-4" />
                    <span>{error ? errorMessage : 'Play video'}</span>
                </>
            )}
        </button>
    );
}
