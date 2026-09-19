import React from 'react';
import { MessageSquare, Phone, Bookmark, Settings } from 'lucide-react';
import { useTheme } from '../../../../providers/useTheme.js';
import SettingsMenu from './SettingsMenu.jsx';

const TABS = [
    { id: 'chat', Icon: MessageSquare, label: 'Chats' },
    { id: 'calls', Icon: Phone, label: 'Calls' },
    { id: 'saved', Icon: Bookmark, label: 'Saved' }
];

/**
 * The vertical tab rail. Identical buttons, states and colours to the
 * original; the settings popover is now its own component instead of eighty
 * lines of nested ternaries inside the nav.
 */
export default function SidebarNav({
    activeTab,
    onTabChange,
    showSettingsMenu,
    onToggleSettings,
    settingsView,
    onSettingsViewChange,
    onCloseSettings
}) {
    const { isDark } = useTheme();

    const buttonClass = (isActive) => `w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all cursor-pointer ${
        isActive
            ? 'bg-[#0a1968] text-white shadow-md'
            : isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-[#0a1968] hover:bg-[#b2d1f8]/60'
    }`;

    return (
        <nav className="flex flex-col gap-2 mb-4">
            {TABS.map(({ id, Icon, label }) => (
                <button
                    key={id}
                    aria-label={label}
                    onClick={() => onTabChange(id)}
                    className={buttonClass(activeTab === id)}
                >
                    <Icon className={`w-4.5 h-4.5 ${activeTab === id ? 'fill-current stroke-none' : ''}`} />
                </button>
            ))}

            <div className="relative">
                <button
                    aria-label="Settings"
                    onClick={onToggleSettings}
                    className={buttonClass(activeTab === 'settings')}
                >
                    <Settings className="w-4.5 h-4.5" />
                </button>

                {showSettingsMenu && activeTab === 'settings' && (
                    <SettingsMenu
                        view={settingsView}
                        onViewChange={onSettingsViewChange}
                        onClose={onCloseSettings}
                    />
                )}
            </div>
        </nav>
    );
}
