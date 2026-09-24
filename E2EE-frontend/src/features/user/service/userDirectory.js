import { rpc } from '../../../infrastructure/websocket/socketRpc.js';
import { SOCKET_EVENTS } from '../../../shared/constants/socketEvents.js';
import { ERROR_CODES } from '../../../shared/constants/errorCodes.js';

/**
 * USER DIRECTORY
 *
 * The UI's only door to users:search / users:profiles. Goes over the socket,
 * like every other chat-surface operation - no REST endpoint was added, because
 * the app's convention for anything the chat screen needs is a socket RPC and
 * the socket is already authenticated by the time the sidebar mounts.
 */

// Profiles barely change and the sidebar asks for the same handful over and
// over. One session-lifetime cache saves a round trip per render.
const profileCache = new Map();   // userId -> publicUser

const normaliseError = (error) => {
    if (error?.code === 'TIMEOUT' || error?.code === 'EMPTY_ACK') {
        const wrapped = new Error('You appear to be offline');
        wrapped.code = ERROR_CODES.SOCKET_DISCONNECTED;
        return wrapped;
    }
    if (error?.code === 'INVALID_SEARCH_QUERY') return error;
    if (error?.code === 'RATE_LIMIT') return error;

    const wrapped = new Error(error?.message || 'Search failed');
    wrapped.code = ERROR_CODES.SEARCH_FAILED;
    wrapped.retryAfter = error?.retryAfter;
    return wrapped;
};

export const userDirectory = {

    /**
     * Search by username prefix or by exact email. Which one it is is decided
     * server-side; the client just sends what was typed.
     */
    async search(query, { limit = 10 } = {}) {
        const term = String(query ?? '').trim();
        if (!term) return { users: [], query: term };

        try {
            const ack = await rpc(SOCKET_EVENTS.USERS_SEARCH, { query: term, limit });

            for (const user of ack.users ?? []) profileCache.set(user.userId, user);

            return { users: ack.users ?? [], query: ack.query ?? term };
        } catch (error) {
            throw normaliseError(error);
        }
    },

    /** Batch profile lookup, cache-first. Used to put a name on a direct chat. */
    async profiles(userIds = []) {
        const wanted = [...new Set(userIds.map(String).filter(Boolean))];
        const missing = wanted.filter((id) => !profileCache.has(id));

        if (missing.length) {
            try {
                const ack = await rpc(SOCKET_EVENTS.USERS_PROFILES, { userIds: missing });
                for (const user of ack.users ?? []) profileCache.set(user.userId, user);
            } catch {
                // A missing display name is cosmetic. The conversation still
                // opens and still decrypts.
            }
        }

        return wanted.map((id) => profileCache.get(id)).filter(Boolean);
    },

    cached: (userId) => profileCache.get(String(userId)) ?? null,

    clear: () => profileCache.clear()
};

export default userDirectory;
