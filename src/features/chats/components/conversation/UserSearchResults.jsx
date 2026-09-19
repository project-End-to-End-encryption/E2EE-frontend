import React from 'react';
import { Loader2, UserPlus, SearchX, WifiOff } from 'lucide-react';
import { useTheme } from '../../../../providers/useTheme.js';

/**
 * Search results panel.
 *
 * Every state the brief asks for is drawn explicitly rather than collapsed
 * into one "no results" message: a query that is too short, a request in
 * flight, an empty result, a dead socket, a rate limit. They mean different
 * things and the user can act on each differently.
 */
export default function UserSearchResults({ status, users, errorMessage, onSelect, busyUserId }) {
    const { isDark } = useTheme();

    const hint = (Icon, text) => (
        <div className={`flex items-center gap-2 px-2.5 py-3 text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{text}</span>
        </div>
    );

    if (status === 'tooShort') return hint(SearchX, 'Type at least two characters.');
    if (status === 'loading') return hint(Loader2, 'Searching...');
    if (status === 'empty') return hint(SearchX, 'No one matched that username or email.');
    if (status === 'error') return hint(WifiOff, errorMessage || 'Search is unavailable.');
    if (status !== 'results') return null;

    return (
        <div className="flex flex-col gap-1 -mx-1 px-1 mb-3">
            <p className="text-[10px] font-bold px-2 py-1 text-slate-400 uppercase tracking-wider">People</p>

            {users.map((user) => (
                <button
                    key={user.userId}
                    type="button"
                    disabled={busyUserId === user.userId}
                    onClick={() => onSelect(user)}
                    className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors disabled:opacity-60 ${
                        isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#b2d1f8]/60 text-[#0a1968]'
                    }`}
                >
                    <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-[#b2d1f8]'}`}>
                        {busyUserId === user.userId
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <UserPlus className="w-3.5 h-3.5" />}
                    </span>

                    <span className="flex-1 min-w-0">
                        <span className="block text-xs font-bold truncate">
                            {user.fullName || `@${user.username}`}
                        </span>
                        <span className={`block text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            @{user.username}
                        </span>
                    </span>
                </button>
            ))}
        </div>
    );
}
