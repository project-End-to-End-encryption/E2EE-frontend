import React, { useMemo, useState } from 'react';
import { useConversations } from '../../hooks/useConversations.js';
import { useUserSearch } from '../../hooks/useUserSearch.js';
import SidebarNav from './SidebarNav.jsx';
import SearchBar from './SearchBar.jsx';
import ConversationList from '../conversation/ConversationList.jsx';
import UserSearchResults from '../conversation/UserSearchResults.jsx';
import { messageFor } from '../../../../shared/constants/errorCodes.js';

const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'direct', label: 'Direct' },
    { id: 'group', label: 'Groups' },
    { id: 'unread', label: 'Unread' }
];

const matches = (filter, conversation) => {
    if (filter === 'direct') return conversation.type !== 'group';
    if (filter === 'group') return conversation.type === 'group';
    if (filter === 'unread') return (conversation.unreadCount || 0) > 0;
    return true;
};

/**
 * AppSidebar
 *
 * Renders two siblings - the icon rail and the conversation panel - and owns
 * the state that belongs to them (what is typed in the search box, which
 * filter is on, whether the settings menu is open). Conversations come from
 * useConversations, people come from useUserSearch; neither this file nor
 * anything below it touches IndexedDB or the socket.
 */
export default function AppSidebar({
                                       activeTab,
                                       onTabChange,
                                       activeConversationId,
                                       onSelectConversation
                                   }) {
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [settingsView, setSettingsView] = useState('main');
    const [openingUserId, setOpeningUserId] = useState(null);
    const [openError, setOpenError] = useState(null);

    const { conversations, loading, openDirectWith } = useConversations();
    const search = useUserSearch(query, { enabled: activeTab === 'chat' });

    const unreadTotal = useMemo(
        () => conversations.reduce((sum, row) => sum + (row.unreadCount || 0), 0),
        [conversations]
    );

    const unreadRows = useMemo(
        () => conversations.filter((row) => (row.unreadCount || 0) > 0).length,
        [conversations]
    );

    const visible = useMemo(
        () => conversations.filter((row) => matches(filter, row)),
        [conversations, filter]
    );

    const closeSettings = () => {
        setShowSettingsMenu(false);
        setSettingsView('main');
    };

    const handleTabChange = (tab) => {
        onTabChange(tab);
        closeSettings();
    };

    // Settings is a menu, not a page: opening it leaves the current tab and
    // the open conversation exactly where they were.
    const handleToggleSettings = () => {
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
        <>
            <SidebarNav
                activeTab={activeTab}
                onTabChange={handleTabChange}
                unreadTotal={unreadTotal}
                showSettingsMenu={showSettingsMenu}
                onToggleSettings={handleToggleSettings}
                settingsView={settingsView}
                onSettingsViewChange={setSettingsView}
                onCloseSettings={closeSettings}
            />

            <aside className="ec-list" aria-label="Conversations">
                <div className="ec-brand">
                    <h2 className="ec-brand__mark">E<b>2</b>EE</h2>
                    <p className="ec-brand__tag">Chat Beyond Limits</p>
                </div>

                <SearchBar value={query} onChange={setQuery} isSearching={search.isSearching} />

                {!searching && conversations.length > 0 && (
                    <div className="ec-chips" role="group" aria-label="Filter conversations">
                        {FILTERS.map(({ id, label }) => (
                            <button
                                key={id}
                                type="button"
                                aria-pressed={filter === id}
                                onClick={() => setFilter(id)}
                                className={`ec-chip ${filter === id ? 'is-active' : ''}`}
                            >
                                {label}
                                {id === 'unread' && unreadRows > 0 && (
                                    <span className="ec-chip__n">{unreadRows}</span>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {openError && <p className="ec-alert" role="alert">{messageFor(openError)}</p>}

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
                    conversations={visible}
                    totalCount={conversations.length}
                    filter={filter}
                    loading={loading}
                    activeConversationId={activeConversationId}
                    onSelect={onSelectConversation}
                />
            </aside>
        </>
    );
}
