import React from 'react';
import { Loader2, UserPlus, SearchX, WifiOff } from 'lucide-react';
import Avatar from '../../../../components/common/Avatar.jsx';

/**
 * Search results panel.
 *
 * Every state the brief asks for is drawn explicitly rather than collapsed
 * into one "no results" message: a query that is too short, a request in
 * flight, an empty result, a dead socket, a rate limit. They mean different
 * things and the user can act on each differently.
 */
export default function UserSearchResults({ status, users, errorMessage, onSelect, busyUserId }) {
    const hint = (Icon, text, spin = false) => (
        <p className="ec-hint" role="status">
            <Icon className={spin ? 'ec-spin' : undefined} />
            <span>{text}</span>
        </p>
    );

    if (status === 'tooShort') return hint(SearchX, 'Type at least two characters.');
    if (status === 'loading') return hint(Loader2, 'Searching...', true);
    if (status === 'empty') return hint(SearchX, 'No one matched that username or email.');
    if (status === 'error') return hint(WifiOff, errorMessage || 'Search is unavailable.');
    if (status !== 'results') return null;

    return (
        <div className="ec-people">
            <p className="ec-section-label">People</p>

            {users.map((user) => {
                const busy = busyUserId === user.userId;
                const name = user.fullName || `@${user.username}`;

                return (
                    <button
                        key={user.userId}
                        type="button"
                        disabled={busy}
                        onClick={() => onSelect(user)}
                        className="ec-conv"
                        style={busy ? { opacity: 0.6 } : undefined}
                    >
                        <Avatar name={name} seed={user.userId} size={40} />

                        <span className="ec-conv__body">
                            <span className="ec-conv__top">
                                <span className="ec-conv__name">{name}</span>
                            </span>
                            <span className="ec-conv__bottom">
                                <span className="ec-conv__preview">@{user.username}</span>
                            </span>
                        </span>

                        {busy
                            ? <Loader2 className="ec-spin" width={16} height={16} aria-label="Opening chat" />
                            : <UserPlus width={16} height={16} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />}
                    </button>
                );
            })}
        </div>
    );
}
