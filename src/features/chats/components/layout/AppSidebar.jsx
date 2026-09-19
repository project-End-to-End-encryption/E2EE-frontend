import React, { useState } from 'react';
import { useTheme } from '../../../../providers/useTheme.js';
import { useConversations } from '../../hooks/useConversations.js';
import { useUserSearch } from '../../hooks/useUserSearch.js';
import SidebarNav from './SidebarNav.jsx';
import SearchBar from './SearchBar.jsx';
import ConversationList from '../conversation/ConversationList.jsx';
import UserSearchResults from '../conversation/UserSearchResults.jsx';
import { messageFor } from '../../../../shared/constants/errorCodes.js';

import E2ELogoSVG from '../../../../assets/E2EE.svg';

/**
 * AppSidebar
 *
 * Owns the sidebar's own state (what is typed in the search box, which tab is
 * open) and nothing else. Conversations come from useConversations, people
 * come from useUserSearch; neither this file nor anything below it touches
 * IndexedDB or the socket.
 */
export default function AppSidebar({
                                       activeTab,
                                       onTabChange,
                                       activeConversationId,
                                       onSelectConversation
                                   }) {
    const { isDark } = useTheme();

    const [query, setQuery] = useState('');
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [settingsView, setSettingsView] = useState('main');
    const [openingUserId, setOpeningUserId] = useState(null);
    const [openError, setOpenError] = useState(null);

    const { conversations, loading, openDirectWith } = useConversations();
    const search = useUserSearch(query, { enabled: activeTab === 'chat' });

    const handleTabChange = (tab) => {
        onTabChange(tab);
        setShowSettingsMenu(false);
        setSettingsView('main');
    };

    const handleToggleSettings = () => {
        onTabChange('settings');
        setShowSettingsMenu((open) => !open);
        setSettingsView('main');
    };

    /**
     * Picking a search result opens the existing chat if there is one and
     * creates it exactly once if there is not - the dedupe lives in
     * conversationService and in the unique directKey index behind it.
     */
    const handleSelectUser = async (user) => {
        setOpeningUserId(user.userId);
        setOpenError(null);

        try {
            const { conversationId } = await openDirectWith(user);
            setQuery('');
            onSelectConversation(conversationId);
        } catch (error) {
            setOpenError(error);
        } finally {
            setOpeningUserId(null);
        }
    };

    const searching = Boolean(query.trim());

    return (
        <aside className={`w-[280px] rounded-2xl flex flex-col p-4 shrink-0 shadow-md relative transition-colors duration-300 overflow-visible ${
            isDark
                ? 'bg-[#0f172a] border border-slate-800 text-slate-100'
                : 'bg-[#9cc2f5] border border-[#b2d1f8]/60 text-slate-800'
        }`}>

            <div className="flex items-center gap-3 mb-5 pl-1">
                <img src={E2ELogoSVG} alt="E2EE Logo" className="w-10 h-10 object-contain" />
                <div className="flex flex-col">
                    <h2 className="text-2xl font-black leading-none tracking-wide flex items-center">
                        <span className={isDark ? 'text-white' : 'text-[#0a1968]'}>E</span>
                        <span className="text-[#00a8cc]">2</span>
                        <span className={isDark ? 'text-white' : 'text-[#0a1968]'}>EE</span>
                    </h2>
                    <span className={`text-[11px] font-bold tracking-tight mt-1 ${isDark ? 'text-slate-400' : 'text-[#0a1968]'}`}>
                        Chat Beyond Limits
                    </span>
                </div>
            </div>

            <SearchBar value={query} onChange={setQuery} isSearching={search.isSearching} />

            <SidebarNav
                activeTab={activeTab}
                onTabChange={handleTabChange}
                showSettingsMenu={showSettingsMenu}
                onToggleSettings={handleToggleSettings}
                settingsView={settingsView}
                onSettingsViewChange={setSettingsView}
                onCloseSettings={() => setShowSettingsMenu(false)}
            />

            <div className={`w-full h-[1px] mb-4 ${isDark ? 'bg-slate-800' : 'bg-[#b2d1f8]'}`} />

            {openError && (
                <p className="text-[11px] font-medium text-red-500 px-2 pb-2">
                    {messageFor(openError)}
                </p>
            )}

            {searching && (
                <UserSearchResults
                    status={search.status}
                    users={search.users}
                    errorMessage={search.errorMessage}
                    onSelect={handleSelectUser}
                    busyUserId={openingUserId}
                />
            )}

            <ConversationList
                conversations={conversations}
                loading={loading}
                activeConversationId={activeConversationId}
                onSelect={onSelectConversation}
            />
        </aside>
    );
}
