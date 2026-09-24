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
        <p className="flex items-center justify-center gap-2 m-0 mt-8 px-4 text-center font-medium text-[13.5px] leading-[1.4] [font-family:var(--font-body)] text-[var(--ink-3)] select-none" role="status">
            <Icon className={`w-[18px] h-[18px] flex-none ${spin ? 'animate-[ec-spin_0.9s_linear_infinite]' : ''}`} />
            <span>{text}</span>
        </p>
    );

    if (status === 'tooShort') return hint(SearchX, 'Type at least two characters.');
    if (status === 'loading') return hint(Loader2, 'Searching...', true);
    if (status === 'empty') return hint(SearchX, 'No one matched that username or email.');
    if (status === 'error') return hint(WifiOff, errorMessage || 'Search is unavailable.');
    if (status !== 'results') return null;

    return (
        <div className="flex flex-col gap-[2px] w-full p-2">
            <p className="m-0 px-3 py-2 font-semibold text-[11.5px] leading-none uppercase tracking-wider [font-family:var(--font-body)] text-[var(--ink-3)] select-none">
                People
            </p>

            {users.map((user) => {
                const busy = busyUserId === user.userId;
                const name = user.fullName || `@${user.username}`;

                return (
                    <button
                        key={user.userId}
                        type="button"
                        disabled={busy}
                        onClick={() => onSelect(user)}
                        className="flex items-center gap-[12px] w-full p-[10px] border-0 rounded-[16px] bg-transparent hover:bg-[var(--surface-2)] text-left transition-colors duration-150 select-none disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <Avatar name={name} seed={user.userId} size={40} />

                        <span className="flex flex-col flex-1 min-w-0 justify-center mt-[-1px]">
                            <span className="flex items-baseline justify-between gap-2">
                                <span className="truncate font-semibold text-[15px] leading-[1.2] [font-family:var(--font-body)] text-[var(--ink)]">
                                    {name}
                                </span>
                            </span>
                            <span className="flex items-center justify-between gap-3 mt-[3px]">
                                <span className="truncate text-[13.5px] leading-[1.3] [font-family:var(--font-body)] font-normal text-[var(--ink-2)]">
                                    @{user.username}
                                </span>
                            </span>
                        </span>

                        {busy ? (
                            <Loader2 className="w-[16px] h-[16px] flex-none text-[var(--ink-2)] animate-[ec-spin_0.9s_linear_infinite]" aria-label="Opening chat" />
                        ) : (
                            <UserPlus className="w-[16px] h-[16px] flex-none text-[var(--ink-3)]" aria-hidden="true" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}