import { useCallback, useEffect, useState } from 'react';
import { bus, TOPICS } from '../../../infrastructure/websocket/eventBus.js';
import { conversationRepo } from '../../../infrastructure/storage/repos.js';
import { conversationService } from '../../conversation/service/conversationService.js';
import { userDirectory } from '../../user/service/userDirectory.js';
import { authStore } from '../../auth/storage/authStore.js';
import { sidebarSync } from '../../sync/sidebarSync.js';

/**
 * useConversations
 *
 *      UI  ->  this hook  ->  conversationRepo / conversationService / bus
 *
 * The component never opens a transaction and never emits a socket event. It
 * reads an array and calls two functions.
 *
 * Reads come from IndexedDB, not from the network: sidebarSync keeps that
 * store current and announces changes on the bus, so first paint is instant
 * and offline still renders the real sidebar.
 */
export function useConversations() {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const selfUserId = safeSelfId();

    const reload = useCallback(async () => {
        try {
            const rows = await conversationRepo.list();

            // A direct row carries memberIds and nothing else, so the name has
            // to be resolved separately. Cached after the first lookup.
            const peerIds = rows
                .filter((row) => row.type === 'direct')
                .map((row) => (row.memberIds ?? []).map(String).find((id) => id !== selfUserId))
                .filter(Boolean);

            if (peerIds.length) await userDirectory.profiles(peerIds);

            setConversations(rows.map((row) => decorate(row, selfUserId)));
            setError(null);
        } catch (loadError) {
            console.error('[useConversations] load failed:', loadError);
            setError(loadError);
        } finally {
            setLoading(false);
        }
    }, [selfUserId]);

    useEffect(() => {
        void reload();

        const off = [
            bus.on(TOPICS.SIDEBAR_CHANGED, () => { void reload(); }),
            bus.on(TOPICS.CONVERSATION_REMOVED, () => { void reload(); })
        ];

        return () => off.forEach((unsubscribe) => unsubscribe());
    }, [reload]);

    /**
     * Open the 1:1 chat with a user picked out of search.
     * Never creates a second conversation - see conversationService.openDirect.
     */
    const openDirectWith = useCallback(async (user) => {
        const result = await conversationService.openDirect(user.userId ?? user);
        await reload();
        return result;
    }, [reload]);

    const markRead = useCallback((conversationId, seq) =>
        sidebarSync.markRead(conversationId, seq), []);

    return { conversations, loading, error, reload, openDirectWith, markRead, selfUserId };
}

function decorate(row, selfUserId) {
    if (row.type !== 'direct') {
        return { ...row, displayName: row.name || 'Group', peer: null };
    }

    const peerId = (row.memberIds ?? []).map(String).find((id) => id !== selfUserId);
    const peer = peerId ? userDirectory.cached(peerId) : null;

    return {
        ...row,
        peer,
        displayName: peer?.fullName || (peer?.username ? `@${peer.username}` : 'Direct chat')
    };
}

function safeSelfId() {
    try {
        return authStore.getUserId();
    } catch {
        return null;
    }
}

export default useConversations;
