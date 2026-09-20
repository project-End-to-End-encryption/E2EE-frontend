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
            <div className="ec-menu" role="menu">
                <div className="ec-menu__row">
                    <button
                        type="button"
                        className="ec-menu__back"
                        aria-label="Back to settings"
                        onClick={() => onViewChange('main')}
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <p className="ec-menu__title" style={{ margin: 0 }}>Theme</p>
                </div>

                <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={!isDark}
                    className={`ec-menu__item ${!isDark ? 'is-selected' : ''}`}
                    onClick={() => { setTheme('light'); onClose?.(); }}
                >
                    <span><Sun />Light</span>
                </button>

                <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={isDark}
                    className={`ec-menu__item ${isDark ? 'is-selected' : ''}`}
                    onClick={() => { setTheme('dark'); onClose?.(); }}
                >
                    <span><Moon />Dark</span>
                </button>
            </div>
        );
    }

    return (
        <div className="ec-menu" role="menu">
            <p className="ec-menu__title">Settings</p>

            <button type="button" role="menuitem" className="ec-menu__item" onClick={() => onViewChange('theme')}>
                <span>{isDark ? <Moon /> : <Sun />}Theme</span>
                <ChevronRight className="ec-menu__chev" />
            </button>

            <button
                type="button"
                role="menuitem"
                className="ec-menu__item"
                onClick={() => { onClose?.(); navigate('/keys'); }}
            >
                <span><KeyRound />Encryption keys</span>
                <ChevronRight className="ec-menu__chev" />
            </button>
        </div>
    );
}
