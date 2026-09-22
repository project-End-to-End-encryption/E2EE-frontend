import React, { useMemo, useState } from 'react';
import { useConversations } from '../../hooks/useConversations.js';
import { useUserSearch } from '../../hooks/useUserSearch.js';
import SidebarNav from './SidebarNav.jsx';
import SearchBar from './SearchBar.jsx';
import ConversationList from '../conversation/ConversationList.jsx';
import UserSearchResults from '../conversation/UserSearchResults.jsx';
import { messageFor } from '../../../../shared/constants/errorCodes.js';
import CreateGroupModal from '../conversation/CreateGroupModal.jsx';

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
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false); // New state for CreateGroupModal

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

            <aside className="flex flex-col flex-1 md:flex-none w-full md:w-[340px] min-h-0 h-full border-r border-[var(--line)] bg-[var(--surface)] select-none overflow-hidden" aria-label="Conversations">
                <div className="px-5 pt-5 pb-2">
                    <h2 className="m-0 font-bold text-[22px] leading-none tracking-tight [font-family:var(--font-display)] text-[var(--ink)]">
                        E<b className="text-[var(--accent)] font-extrabold not-italic">2</b>EE
                    </h2>
                    <p className="m-0 mt-1 font-semibold text-[11px] leading-none tracking-wider uppercase [font-family:var(--font-body)] text-[var(--ink-3)]">
                        Chat Beyond Limits
                    </p>
                </div>

                <SearchBar value={query} onChange={setQuery} isSearching={search.isSearching} />

                <div className="px-5 py-2"> {/* New Group button container */}
                    <button
                        type="button"
                        onClick={() => setShowCreateGroupModal(true)}
                        className="w-full inline-flex items-center justify-center px-4 py-2 border-0 rounded-full font-semibold text-[15px] leading-none [font-family:var(--font-body)] whitespace-nowrap transition-colors duration-150 select-none bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                    >
                        + New Group
                    </button>
                </div>

                {!searching && conversations.length > 0 && (
                    <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filter conversations">
                        {FILTERS.map(({ id, label }) => (
                            <button
                                key={id}
                                type="button"
                                aria-pressed={filter === id}
                                onClick={() => setFilter(id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-[6px] border-0 rounded-full font-medium text-[13px] leading-none [font-family:var(--font-body)] whitespace-nowrap transition-colors duration-150 select-none ${
                                    filter === id
                                        ? 'bg-[var(--surface-3)] text-[var(--ink)] font-semibold'
                                        : 'bg-transparent text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
                                }`}
                            >
                                {label}
                                {id === 'unread' && unreadRows > 0 && (
                                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--accent)] text-white font-bold text-[10.5px] leading-none">
                                        {unreadRows}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {openError && (
                    <p className="mx-4 my-2 px-3 py-2 rounded-[12px] bg-[var(--danger-soft)] text-[var(--danger)] font-medium text-[13px] leading-[1.35] [font-family:var(--font-body)]" role="alert">
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
                    conversations={visible}
                    totalCount={conversations.length}
                    filter={filter}
                    loading={loading}
                    activeConversationId={activeConversationId}
                    onSelect={onSelectConversation}
                />
            </aside>
            {/* CreateGroupModal will be rendered here */}
            <CreateGroupModal
                            isOpen={showCreateGroupModal}
                            onClose={() => setShowCreateGroupModal(false)}
                            onCreated={(conversationId) => {
                                setShowCreateGroupModal(false);
                                onSelectConversation(conversationId);
                            }}
                        />
        </>
    );
}