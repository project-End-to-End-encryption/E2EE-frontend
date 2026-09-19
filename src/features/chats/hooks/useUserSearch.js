import { useEffect, useRef, useState } from 'react';
import { userDirectory } from '../../user/service/userDirectory.js';
import { ERROR_CODES, messageFor } from '../../../shared/constants/errorCodes.js';
import { useDebouncedValue } from './useDebouncedValue.js';

const MIN_QUERY = 2;

/**
 * useUserSearch
 *
 * Debounced username-or-email lookup over the socket.
 *
 * States it distinguishes, because the sidebar renders each differently:
 *   idle       nothing typed
 *   tooShort   one character - no request sent
 *   loading    request in flight
 *   empty      server answered, nobody matched
 *   results    at least one match
 *   error      offline socket, rate limit, or a server failure
 *
 * Out-of-order responses are dropped by sequence number, so a slow request for
 * "viv" can never overwrite the results for "vivek".
 */
export function useUserSearch(query, { limit = 10, enabled = true } = {}) {
    const term = (query ?? '').trim();
    const debounced = useDebouncedValue(term, 300);

    const [state, setState] = useState({ status: 'idle', users: [], error: null });
    const sequence = useRef(0);

    useEffect(() => {
        if (!enabled || !debounced) {
            setState({ status: 'idle', users: [], error: null });
            return;
        }

        if (debounced.length < MIN_QUERY) {
            setState({ status: 'tooShort', users: [], error: null });
            return;
        }

        const ticket = ++sequence.current;
        let cancelled = false;

        setState((current) => ({ ...current, status: 'loading', error: null }));

        userDirectory.search(debounced, { limit })
            .then(({ users }) => {
                if (cancelled || ticket !== sequence.current) return;
                setState({
                    status: users.length ? 'results' : 'empty',
                    users,
                    error: users.length ? null : { code: ERROR_CODES.NO_SEARCH_RESULTS }
                });
            })
            .catch((searchError) => {
                if (cancelled || ticket !== sequence.current) return;
                setState({ status: 'error', users: [], error: searchError });
            });

        return () => { cancelled = true; };
    }, [debounced, limit, enabled]);

    return {
        ...state,
        isSearching: state.status === 'loading',
        errorMessage: state.error ? messageFor(state.error) : null
    };
}

export default useUserSearch;
