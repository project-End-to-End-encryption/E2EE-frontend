import { useCallback, useEffect, useRef, useState } from 'react';
import { bus, TOPICS } from '../../../infrastructure/websocket/eventBus.js';
import { messageRepo } from '../../../infrastructure/storage/repos.js';
import { messageSync } from '../../sync/messageSync.js';
import { messageComposer } from '../../conversation/service/messageComposer.js';
import { conversationService } from '../../conversation/service/conversationService.js';
import { sidebarSync } from '../../sync/sidebarSync.js';
import { messageFor } from '../../../shared/constants/errorCodes.js';

const PAGE = 50;

/**
 * useMessages
 *
 *      MessageList / Composer
 *              |
 *          this hook
 *              |
 *   messageRepo | messageSync | messageComposer | bus
 *
 * All decryption already happened before a row reaches IndexedDB - messageSync
 * does it on the way in. This hook reads plaintext rows out of the local store
 * and keeps them in sync with the bus. It contains no crypto and no socket
 * calls of its own.
 *
 * KEY-STATE FIX (2026-09-20):
 * When the user opens a chat where they are NOT the CAK minter, the
 * original code left keyState stuck on 'awaitingKey' forever. With
 * ensureArchiveKey now always minting on whoever opens first, keyState
 * resolves to 'ready' on open. The bus listener additionally re-checks
 * keyState when a SIDEBAR_CHANGED or MESSAGE_ADDED event arrives so the
 * UI transitions instantly once the envelope lands over the wire.
 */
export function useMessages(conversationId) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [keyState, setKeyState] = useState('ready');

    const loadingOlder = useRef(false);

    const reload = useCallback(async () => {
        if (!conversationId) {
            setMessages([]);
            return;
        }
        try {
            const rows = await messageRepo.page(conversationId, { limit: PAGE });
            setMessages(rows.filter(isDisplayable));
            setError(null);
        } catch (loadError) {
            console.error('[useMessages] load failed:', loadError);
            setError(loadError);
        }
    }, [conversationId]);

    // Resolve key state for a given conversation (used on open + on live events)
    const resolveKeyState = useCallback(async (cid) => {
        if (!cid) return;
        try {
            const conversation = await conversationService.get(cid);
            if (conversation) {
                const state = await conversationService.ensureArchiveKey(conversation);
                setKeyState(state);
            }
        } catch (keyError) {
            if (keyError?.code === ERROR_CODES.MBK_NOT_LOADED) {
                setKeyState('awaitingKey');
            }
        }
    }, []);

    // Open the conversation: paint from cache, then fill any gaps in the
    // background so a slow backfill never blocks first render.
    useEffect(() => {
        if (!conversationId) return;

        let cancelled = false;
        setLoading(true);
        setHasMore(true);

        (async () => {
            await reload();
            if (cancelled) return;
            setLoading(false);

            try {
                await resolveKeyState(conversationId);
            } catch (keyError) {
                if (!cancelled) setError(keyError);
            }

            try {
                const filled = await messageSync.backfill(conversationId);
                if (!cancelled && filled) await reload();
            } catch (backfillError) {
                console.debug('[useMessages] backfill deferred:', backfillError?.code);
            }
        })();

        return () => { cancelled = true; };
    }, [conversationId, reload, resolveKeyState]);

    // Live updates. Every write path in the app announces itself here, so the
    // hook never polls and never re-fetches on a timer.
    //
    // KEY: re-resolve keyState when sidebar changes or a new message arrives,
    // so the UI unblocks the moment the CAK distribution envelope lands.
    useEffect(() => {
        if (!conversationId) return;

        const matches = (payload) => !payload?.conversationId ||
            String(payload.conversationId) === String(conversationId);

        const off = [
            bus.on(TOPICS.MESSAGE_ADDED, (payload) => {
                if (matches(payload)) void reload();
            }),
            bus.on(TOPICS.MESSAGE_UPDATED, (payload) => { if (matches(payload)) void reload(); }),
            bus.on(TOPICS.MESSAGE_REVOKED, (payload) => { if (matches(payload)) void reload(); }),
            bus.on(TOPICS.SIDEBAR_CHANGED, async () => {
                await resolveKeyState(conversationId);
            })
        ];

        return () => off.forEach((unsubscribe) => unsubscribe());
    }, [conversationId, reload, resolveKeyState]);

    const loadOlder = useCallback(async () => {
        if (!conversationId || loadingOlder.current || !hasMore) return;

        loadingOlder.current = true;
        try {
            const oldest = messages[0]?.seq;
            const rows = await messageSync.loadOlder(conversationId, {
                beforeSeq: oldest ?? Infinity,
                limit: PAGE
            });

            if (!rows.length || rows.length < PAGE) setHasMore(false);
            await reload();
        } catch (olderError) {
            setError(olderError);
        } finally {
            loadingOlder.current = false;
        }
    }, [conversationId, hasMore, messages, reload]);

    const sendText = useCallback(async (text) => {
        const trimmed = (text ?? '').trim();
        if (!trimmed || !conversationId) return null;

        try {
            return await messageComposer.sendText(conversationId, trimmed);
        } catch (sendError) {
            setError(sendError);
            return null;
        }
    }, [conversationId]);

    const markRead = useCallback(() => {
        const newest = messages[messages.length - 1];
        if (!conversationId || !newest || newest.seq < 0) return;
        void sidebarSync.markRead(conversationId, newest.seq);
    }, [conversationId, messages]);

    return {
        messages,
        loading,
        error,
        errorMessage: error ? messageFor(error) : null,
        hasMore,
        keyState,
        loadOlder,
        sendText,
        markRead,
        reload
    };
}

/**
 * System rows exist so history stays contiguous (archive-key handover, future
 * membership events). They are not messages and are not drawn.
 */
function isDisplayable(row) {
    if (row.contentType === 'system') return false;
    return true;
}

export default useMessages;
