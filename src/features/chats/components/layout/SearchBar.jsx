import React from 'react';
import { Search, Loader2, X } from 'lucide-react';

/**
 * The sidebar search field. The placeholder says what it actually searches,
 * and a spinner or clear button appears only when there is something to
 * report.
 */
export default function SearchBar({ value, onChange, isSearching = false }) {
    return (
        <div className="relative flex items-center mx-4 my-2 px-3 h-[42px] border border-[var(--line)] rounded-[14px] bg-[var(--surface-2)] transition-[border-color,box-shadow,background-color] duration-150 focus-within:border-[var(--focus)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--focus)_22%,transparent)] focus-within:bg-[var(--surface)]">
            <Search className="w-[18px] h-[18px] flex-none text-[var(--ink-3)]" aria-hidden="true" />

            <input
                type="text"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Search by username or email"
                aria-label="Search conversations and people"
                autoComplete="off"
                className="flex-1 min-w-0 h-full px-2.5 border-0 bg-transparent text-[14.5px] leading-none [font-family:var(--font-body)] text-[var(--ink)] placeholder:text-[var(--ink-3)] outline-none"
            />

            {isSearching && (
                <span className="flex items-center justify-center flex-none w-[24px] h-[24px] -mr-1" aria-hidden="true">
                    <Loader2 className="w-[16px] h-[16px] text-[var(--ink-3)] animate-[ec-spin_0.9s_linear_infinite]" />
                </span>
            )}

            {!isSearching && value && (
                <button
                    type="button"
                    onClick={() => onChange('')}
                    aria-label="Clear search"
                    className="inline-grid place-items-center flex-none w-[24px] h-[24px] -mr-1 p-0 border-0 rounded-full bg-transparent text-[var(--ink-3)] transition-all duration-150 hover:bg-[var(--surface-3)] hover:text-[var(--ink)] active:scale-95"
                >
                    <X className="w-[15px] h-[15px]" />
                </button>
            )}
        </div>
    );
}