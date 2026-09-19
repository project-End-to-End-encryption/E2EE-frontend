import React from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { useTheme } from '../../../../providers/useTheme.js';

/**
 * The sidebar search field. Same input styling as before; the placeholder now
 * says what it actually searches, and a spinner or clear affordance appears
 * only when there is something to report.
 */
export default function SearchBar({ value, onChange, isSearching = false }) {
    const { isDark } = useTheme();

    return (
        <div className="relative mb-5">
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 ${isDark ? 'text-slate-400' : 'text-[#0a1968]'}`} />

            <input
                type="text"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Search by username or email..."
                aria-label="Search conversations and people"
                className={`w-full pl-10 pr-9 py-2.5 rounded-xl text-xs outline-none transition-colors font-medium ${
                    isDark
                        ? 'bg-[#1e293b] border border-slate-700 text-white placeholder:text-slate-500 focus:border-[#00a8cc]'
                        : 'bg-[#b2d1f8] border border-[#c5ddfa] text-[#0a1968] placeholder:text-slate-600 focus:border-[#00a8cc]'
                }`}
            />

            {isSearching && (
                <Loader2 className={`absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin ${isDark ? 'text-slate-400' : 'text-[#0a1968]'}`} />
            )}

            {!isSearching && value && (
                <button
                    type="button"
                    onClick={() => onChange('')}
                    aria-label="Clear search"
                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-400 hover:text-white' : 'text-[#0a1968] hover:text-black'}`}
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}
