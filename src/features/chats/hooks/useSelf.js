import { useEffect, useState } from 'react';
import { bus, TOPICS } from '../../../infrastructure/websocket/eventBus.js';
import webSocketClient from '../../../infrastructure/websocket/WebSocketClient.js';
import { userDirectory } from '../../user/service/userDirectory.js';
import { authStore } from '../../auth/storage/authStore.js';

/**
 * useSelf
 *
 * Two small facts the rail shows next to the user's own avatar: who they are,
 * and whether the socket is up. Both already exist - the profile comes from
 * userDirectory and the connection state from the bus topic bootstrap emits -
 * this just reads them.
 *
 * The initial connection state asks the socket directly, because bootstrap is
 * idempotent and will not emit again when the user comes back to /chat from
 * another page.
 */
export function useSelf() {
    const [profile, setProfile] = useState(null);
    const [connection, setConnection] = useState(() =>
        webSocketClient.getSocket?.()?.connected ? 'online' : 'connecting'
    );

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const [self] = await userDirectory.profiles([authStore.getUserId()]);
                if (!cancelled) setProfile(self ?? null);
            } catch {
                /* the avatar falls back to a placeholder; nothing else depends on it */
            }
        })();

        const off = bus.on(TOPICS.CONNECTION_STATE, (state) => setConnection(state));

        return () => {
            cancelled = true;
            off();
        };
    }, []);

    return { profile, connection };
}

export default useSelf;
