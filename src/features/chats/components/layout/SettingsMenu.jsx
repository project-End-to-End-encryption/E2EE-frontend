import React from 'react';
import { Sun, Moon, ChevronRight, ArrowLeft, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../../providers/useTheme.js';

/**
 * The settings popover, with both of its views intact: the main list and the
 * theme picker. Includes the route into the encryption-keys page, which is a
 * real destination, not a placeholder control.
 */
export default function SettingsMenu({ view, onViewChange, onClose }) {
    const { isDark, setTheme } = useTheme();
    const navigate = useNavigate();

    if (view === 'theme') {
        return (
            <div className="absolute left-[calc(100%+8px)] bottom-3 z-50 w-[220px] p-[6px] border border-[var(--line)] rounded-[18px] bg-[var(--surface)] shadow-[var(--shadow-menu)] animate-[ec-pop_0.14s_ease-out] select-none" role="menu">
                <div className="flex items-center gap-2 px-2 pt-1 pb-2 mb-1 border-b border-[var(--line)]">
                    <button
                        type="button"
                        className="inline-grid place-items-center w-[28px] h-[28px] p-0 border-0 rounded-full bg-transparent text-[var(--ink-2)] transition-colors duration-150 hover:bg-[var(--surface-3)] hover:text-[var(--ink)] active:scale-95"
                        aria-label="Back to settings"
                        onClick={() => onViewChange('main')}
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <p className="m-0 font-semibold text-[13.5px] leading-none [font-family:var(--font-body)] text-[var(--ink)]">Theme</p>
                </div>

                <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={!isDark}
                    className={`flex items-center justify-between gap-[10px] w-full p-[10px] border-0 rounded-[12px] text-[var(--ink)] font-medium text-[14px] leading-[1.2] [font-family:var(--font-body)] text-left transition-colors duration-150 ${
                        !isDark ? 'bg-[var(--surface-3)] font-semibold' : 'bg-transparent hover:bg-[var(--surface-2)]'
                    }`}
                    onClick={() => { setTheme('light'); onClose?.(); }}
                >
                    <span className="inline-flex items-center gap-[10px]">
                        <Sun className="w-[17px] h-[17px] text-[var(--accent-text)]" />
                        Light
                    </span>
                </button>

                <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={isDark}
                    className={`flex items-center justify-between gap-[10px] w-full p-[10px] border-0 rounded-[12px] text-[var(--ink)] font-medium text-[14px] leading-[1.2] [font-family:var(--font-body)] text-left transition-colors duration-150 ${
                        isDark ? 'bg-[var(--surface-3)] font-semibold' : 'bg-transparent hover:bg-[var(--surface-2)]'
                    }`}
                    onClick={() => { setTheme('dark'); onClose?.(); }}
                >
                    <span className="inline-flex items-center gap-[10px]">
                        <Moon className="w-[17px] h-[17px] text-[var(--accent-text)]" />
                        Dark
                    </span>
                </button>
            </div>
        );
    }

    return (
        <div className="absolute left-[calc(100%+8px)] bottom-3 z-50 w-[220px] p-[6px] border border-[var(--line)] rounded-[18px] bg-[var(--surface)] shadow-[var(--shadow-menu)] animate-[ec-pop_0.14s_ease-out] select-none" role="menu">
            <p className="m-0 px-3 pt-2 pb-1.5 font-semibold text-[11.5px] leading-none uppercase tracking-wider [font-family:var(--font-body)] text-[var(--ink-3)]">
                Settings
            </p>

            <button
                type="button"
                role="menuitem"
                className="flex items-center justify-between gap-[10px] w-full p-[10px] border-0 rounded-[12px] bg-transparent text-[var(--ink)] font-medium text-[14px] leading-[1.2] [font-family:var(--font-body)] text-left hover:bg-[var(--surface-2)] transition-colors duration-150"
                onClick={() => onViewChange('theme')}
            >
                <span className="inline-flex items-center gap-[10px]">
                    {isDark ? <Moon className="w-[17px] h-[17px] text-[var(--accent-text)]" /> : <Sun className="w-[17px] h-[17px] text-[var(--accent-text)]" />}
                    Theme
                </span>
                <ChevronRight className="w-[16px] h-[16px] flex-none text-[var(--ink-3)]" />
            </button>

            <button
                type="button"
                role="menuitem"
                className="flex items-center justify-between gap-[10px] w-full p-[10px] border-0 rounded-[12px] bg-transparent text-[var(--ink)] font-medium text-[14px] leading-[1.2] [font-family:var(--font-body)] text-left hover:bg-[var(--surface-2)] transition-colors duration-150"
                onClick={() => { onClose?.(); navigate('/keys'); }}
            >
                <span className="inline-flex items-center gap-[10px]">
                    <KeyRound className="w-[17px] h-[17px] text-[var(--accent-text)]" />
                    Encryption keys
                </span>
                <ChevronRight className="w-[16px] h-[16px] flex-none text-[var(--ink-3)]" />
            </button>
        </div>
    );
}