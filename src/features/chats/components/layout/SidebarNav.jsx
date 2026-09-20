import React, { useEffect, useRef } from 'react';
import { MessageSquare, Phone, Bookmark, Settings } from 'lucide-react';
import SettingsMenu from './SettingsMenu.jsx';
import Avatar from '../../../../components/common/Avatar.jsx';
import { useSelf } from '../../hooks/useSelf.js';

import E2ELogoSVG from '../../../../assets/E2EE.svg';

const TABS = [
    { id: 'chat', Icon: MessageSquare, label: 'Chats' },
    { id: 'calls', Icon: Phone, label: 'Calls' },
    { id: 'saved', Icon: Bookmark, label: 'Saved' }
];

const CONNECTION_LABEL = {
    online: 'Connected',
    connecting: 'Connecting',
    offline: 'Offline'
};

/**
 * The icon rail: logo, the three tabs, then settings and the user's own
 * avatar at the bottom. On a phone the same markup becomes a bottom bar (see
 * the max-width: 767px block in chat.css).
 *
 * The settings popover is its own component. It closes on Escape and on a
 * click anywhere outside it.
 */
export default function SidebarNav({
                                       activeTab,
                                       onTabChange,
                                       unreadTotal = 0,
                                       showSettingsMenu,
                                       onToggleSettings,
                                       settingsView,
                                       onSettingsViewChange,
                                       onCloseSettings
                                   }) {
    const { profile, connection } = useSelf();
    const settingsRef = useRef(null);

    useEffect(() => {
        if (!showSettingsMenu) return undefined;

        const onPointerDown = (event) => {
            if (!settingsRef.current?.contains(event.target)) onCloseSettings?.();
        };
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onCloseSettings?.();
        };

        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [showSettingsMenu, onCloseSettings]);

    const selfName = profile?.fullName || profile?.username || '';

    return (
        <nav className="ec-rail" aria-label="Main">
            <img src={E2ELogoSVG} alt="E2EE" className="ec-rail__logo" />

            <div className="ec-rail__nav">
                {TABS.map(({ id, Icon, label }) => (
                    <button
                        key={id}
                        type="button"
                        title={label}
                        aria-label={label}
                        aria-current={activeTab === id ? 'page' : undefined}
                        onClick={() => onTabChange(id)}
                        className={`ec-navbtn ${activeTab === id ? 'is-active' : ''}`}
                    >
                        <Icon />
                        {id === 'chat' && unreadTotal > 0 && activeTab !== 'chat' && (
                            <span className="ec-navbtn__count">{unreadTotal > 99 ? '99+' : unreadTotal}</span>
                        )}
                    </button>
                ))}
            </div>

            <div className="ec-rail__spacer" />

            <div className="ec-rail__foot">
                <div ref={settingsRef} style={{ position: 'relative' }}>
                    <button
                        type="button"
                        title="Settings"
                        aria-label="Settings"
                        aria-haspopup="menu"
                        aria-expanded={showSettingsMenu}
                        onClick={onToggleSettings}
                        className={`ec-navbtn ${showSettingsMenu ? 'is-active' : ''}`}
                    >
                        <Settings />
                    </button>

                    {showSettingsMenu && (
                        <SettingsMenu
                            view={settingsView}
                            onViewChange={onSettingsViewChange}
                            onClose={onCloseSettings}
                        />
                    )}
                </div>

                <span className="ec-self" title={`${selfName || 'You'} - ${CONNECTION_LABEL[connection] ?? ''}`}>
                    <Avatar name={selfName} seed={profile?.userId ?? selfName} size={44} />
                    <span
                        className="ec-status"
                        data-state={connection}
                        role="img"
                        aria-label={CONNECTION_LABEL[connection] ?? 'Connection unknown'}
                    />
                </span>
            </div>
        </nav>
    );
}
