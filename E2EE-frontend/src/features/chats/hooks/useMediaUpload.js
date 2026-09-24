import { useCallback, useRef, useState } from 'react';
import { mediaService } from '../../media/mediaService.js';
import { messageComposer } from '../../conversation/service/messageComposer.js';
import { messageFor } from '../../../shared/constants/errorCodes.js';

/**
 * useMediaUpload
 *
 *   Composer -> this hook -> mediaService -> mediaCrypto -> uploadTransport
 *
 * Owns only UI concerns: per-file progress, per-file failure, cancellation.
 * Encryption and transport live in the service layer, which is why this file
 * contains no crypto and no knowledge of where the bytes end up.
 */
export function useMediaUpload(conversationId) {
    const [uploads, setUploads] = useState([]);   // [{id, name, phase, percent, error}]
    const [busy, setBusy] = useState(false);
    const controllers = useRef(new Map());

    const update = useCallback((id, changes) => {
        setUploads((current) => current.map((row) =>
            row.id === id ? { ...row, ...changes } : row
        ));
    }, []);

    const cancel = useCallback((id) => {
        controllers.current.get(id)?.abort();
        controllers.current.delete(id);
        setUploads((current) => current.filter((row) => row.id !== id));
    }, []);

    const clear = useCallback(() => {
        for (const controller of controllers.current.values()) controller.abort();
        controllers.current.clear();
        setUploads([]);
    }, []);

    /**
     * Encrypt, upload and send. One message carries every file that succeeded;
     * a file that fails is reported and the rest still go.
     */
    const sendFiles = useCallback(async (files, { text = '' } = {}) => {
        const list = Array.from(files ?? []);
        if (!conversationId || !list.length) return null;

        setBusy(true);

        const staged = list.map((file, index) => ({
            id: `${Date.now()}-${index}`,
            name: file.name || 'attachment',
            phase: 'queued',
            percent: 0,
            error: null
        }));
        setUploads(staged);

        const bodyAttachments = [];
        const serverAttachments = [];
        const failures = [];

        for (let index = 0; index < list.length; index++) {
            const file = list[index];
            const row = staged[index];

            const controller = new AbortController();
            controllers.current.set(row.id, controller);

            try {
                const result = await mediaService.encryptAndUpload(conversationId, file, {
                    signal: controller.signal,
                    onProgress: ({ phase, done, total }) => update(row.id, {
                        phase,
                        percent: total ? Math.round((done / total) * 100) : 0
                    })
                });

                bodyAttachments.push(result.bodyAttachment);
                serverAttachments.push(result.serverAttachment);
                update(row.id, { phase: 'done', percent: 100 });
            } catch (uploadError) {
                failures.push({ name: row.name, error: uploadError });
                update(row.id, { phase: 'failed', error: messageFor(uploadError) });
            } finally {
                controllers.current.delete(row.id);
            }
        }

        try {
            if (!bodyAttachments.length) {
                return { sent: null, failures };
            }

            const sent = await messageComposer.sendAttachments(conversationId, {
                text,
                bodyAttachments,
                serverAttachments
            });

            setUploads([]);
            return { sent, failures };
        } catch (sendError) {
            failures.push({ name: 'message', error: sendError });
            return { sent: null, failures };
        } finally {
            setBusy(false);
        }
    }, [conversationId, update]);

    return { uploads, busy, sendFiles, cancel, clear };
}

export default useMediaUpload;
