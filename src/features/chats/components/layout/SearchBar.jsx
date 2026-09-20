import React from 'react';
import { Search, Loader2, X } from 'lucide-react';

/**
 * The sidebar search field. The placeholder says what it actually searches,
 * and a spinner or clear button appears only when there is something to
 * report.
 */
export default function SearchBar({ value, onChange, isSearching = false }) {
    return (
        <div className="ec-search">
            <Search className="ec-search__icon" aria-hidden="true" />

            <input
                type="text"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Search by username or email"
                aria-label="Search conversations and people"
                autoComplete="off"
                className="ec-search__input"
            />

            {isSearching && (
                <span className="ec-search__end" aria-hidden="true">
                    <Loader2 className="ec-spin" />
                </span>
            )}

            {!isSearching && value && (
                <button
                    type="button"
                    onClick={() => onChange('')}
                    aria-label="Clear search"
                    className="ec-search__end"
                >
                    <X />
                </button>
            )}
        </div>
    );
}
