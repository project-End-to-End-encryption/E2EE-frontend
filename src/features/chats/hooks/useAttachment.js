import { useCallback, useEffect, useRef, useState } from 'react';
import { mediaService } from '../../media/mediaService.js';
import { mediaCache } from '../../media/mediaCache.js';
import { messageFor } from '../../../shared/constants/errorCodes.js';

/**
 * useAttachment
 *
 * Turns an attachment descriptor into something the DOM can point at:
 *
 *   ciphertext in storage -> download -> decrypt with the key from the
 *   message body -> Blob -> object URL
 *
 * `eager` is for images, which should just appear. Video and documents stay
 * lazy: a chat full of 200 MB videos should not download them all on scroll.
 */
export function useAttachment(conversationId, attachment, { eager = false } = {}) {
    const [url, setUrl] = useState(() => mediaCache.get(attachment?.storageKey)?.url ?? null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);

    const controller = useRef(null);
    const mounted = useRef(true);

    useEffect(() => () => {
        mounted.current = false;
        controller.current?.abort();
    }, []);

    const load = useCallback(async () => {
        if (!conversationId || !attachment?.storageKey) return null;

        const cached = mediaCache.get(attachment.storageKey);
        if (cached) {
            setUrl(cached.url);
            return cached.url;
        }

        controller.current?.abort();
        controller.current = new AbortController();

        setLoading(true);
        setError(null);

        try {
            const blob = await mediaService.downloadEncryptedMedia(conversationId, attachment, {
                signal: controller.current.signal,
                onProgress: ({ done, total }) => {
                    if (mounted.current && total) setProgress(Math.round((done / total) * 100));
                }
            });

            // The object URL is revoked by the cache, not here: two bubbles can
            // reference the same attachment and unmounting one must not blank
            // the other.
            const objectUrl = mediaCache.put(attachment.storageKey, blob);
            if (mounted.current) setUrl(objectUrl);
            return objectUrl;
        } catch (loadError) {
            if (mounted.current) setError(loadError);
            return null;
        } finally {
            if (mounted.current) setLoading(false);
        }
    }, [conversationId, attachment]);

    useEffect(() => {
        if (eager && !url && !loading && !error) void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eager, url]);

    /** Save to disk. The file name comes out of the encrypted body. */
    const download = useCallback(async () => {
        const objectUrl = url ?? await load();
        if (!objectUrl) return;

        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = attachment?.originalFileName || 'attachment';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }, [url, load, attachment]);

    return {
        url,
        loading,
        progress,
        error,
        errorMessage: error ? messageFor(error) : null,
        load,
        download
    };
}

export default useAttachment;
