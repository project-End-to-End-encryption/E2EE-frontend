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
                className="block w-full max-w-full max-h-[400px] rounded-[14px] bg-black/10 dark:bg-black/40"
            />
        );
    }

    return (
        <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex flex-col items-center justify-center gap-[6px] w-[240px] h-[128px] max-w-full rounded-[14px] bg-[color-mix(in_srgb,currentColor_6%,transparent)] border border-[color-mix(in_srgb,currentColor_10%,transparent)] font-medium text-[13px] leading-[1.35] [font-family:var(--font-body)] transition-colors hover:enabled:bg-[color-mix(in_srgb,currentColor_12%,transparent)] active:enabled:scale-[0.98] disabled:cursor-not-allowed"
        >
            {loading ? (
                <>
                    <Loader2 className="w-[18px] h-[18px] opacity-70 animate-[ec-spin_0.9s_linear_infinite]" />
                    <span className="opacity-90">{progress ? `${progress}%` : 'Decrypting...'}</span>
                </>
            ) : (
                <>
                    <Play className={`w-[18px] h-[18px] ${error ? 'text-[var(--danger)] opacity-80' : 'opacity-70'}`} />
                    <span className={error ? 'text-[var(--danger)] px-3 text-center' : 'opacity-90'}>
                        {error ? errorMessage : 'Play video'}
                    </span>
                </>
            )}
        </button>
    );
}