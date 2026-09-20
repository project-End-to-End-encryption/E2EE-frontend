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

const STATUS_COLORS = {
    online: 'bg-[#22c55e]',
    connecting: 'bg-[#eab308]',
    offline: 'bg-[var(--ink-3)]'
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
    const statusColor = STATUS_COLORS[connection] || STATUS_COLORS.offline;

    return (
        <nav className="flex max-md:flex-row md:flex-col items-center max-md:justify-between flex-none w-full md:w-[72px] h-[58px] md:h-full px-2 md:px-0 py-0 md:py-5 border-t md:border-t-0 md:border-r border-[var(--line)] bg-[var(--surface-2)] z-20 md:z-auto order-3 md:order-none select-none" aria-label="Main">
            <img src={E2ELogoSVG} alt="E2EE" className="w-[34px] h-[34px] mb-5 max-md:hidden object-contain drop-shadow-sm" />

            <div className="flex max-md:flex-row md:flex-col items-center max-md:flex-1 max-md:justify-evenly gap-2 w-full md:px-2">
                {TABS.map(({ id, Icon, label }) => (
                    <button
                        key={id}
                        type="button"
                        title={label}
                        aria-label={label}
                        aria-current={activeTab === id ? 'page' : undefined}
                        onClick={() => onTabChange(id)}
                        className={`relative flex items-center justify-center flex-none w-[44px] h-[44px] border-0 rounded-[14px] transition-[background-color,color] duration-150 active:scale-95 ${
                            activeTab === id
                                ? 'bg-[var(--surface-3)] text-[var(--ink)]'
                                : 'bg-transparent text-[var(--ink-2)] hover:bg-[var(--surface-3)] hover:text-[var(--ink)]'
                        }`}
                    >
                        <Icon className="w-[22px] h-[22px]" />
                        {id === 'chat' && unreadTotal > 0 && activeTab !== 'chat' && (
                            <span className="absolute top-[4px] right-[4px] flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--accent)] border-2 border-[var(--surface-2)] text-white font-bold text-[9px] leading-none pointer-events-none">
                                {unreadTotal > 99 ? '99+' : unreadTotal}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <div className="md:flex-auto" />

            <div className="flex max-md:flex-row md:flex-col items-center gap-2 max-md:ml-auto max-md:pr-1 md:mt-auto md:px-2">
                <div ref={settingsRef} className="relative">
                    <button
                        type="button"
                        title="Settings"
                        aria-label="Settings"
                        aria-haspopup="menu"
                        aria-expanded={showSettingsMenu}
                        onClick={onToggleSettings}
                        className={`relative flex items-center justify-center flex-none w-[44px] h-[44px] border-0 rounded-[14px] transition-[background-color,color] duration-150 active:scale-95 ${
                            showSettingsMenu
                                ? 'bg-[var(--surface-3)] text-[var(--ink)]'
                                : 'bg-transparent text-[var(--ink-2)] hover:bg-[var(--surface-3)] hover:text-[var(--ink)]'
                        }`}
                    >
                        <Settings className="w-[22px] h-[22px]" />
                    </button>

                    {showSettingsMenu && (
                        <SettingsMenu
                            view={settingsView}
                            onViewChange={onSettingsViewChange}
                            onClose={onCloseSettings}
                        />
                    )}
                </div>

                <span className="relative inline-flex flex-none md:mt-2 max-md:ml-2 cursor-pointer transition-transform duration-150 active:scale-95" title={`${selfName || 'You'} - ${CONNECTION_LABEL[connection] ?? ''}`}>
                    <Avatar name={selfName} seed={profile?.userId ?? selfName} size={42} />
                    <span
                        className={`absolute bottom-[-2px] right-[-2px] w-[14px] h-[14px] border-[2.5px] border-[var(--surface-2)] rounded-full ${statusColor}`}
                        role="img"
                        aria-label={CONNECTION_LABEL[connection] ?? 'Connection unknown'}
                    />
                </span>
            </div>
        </nav>
    );
}