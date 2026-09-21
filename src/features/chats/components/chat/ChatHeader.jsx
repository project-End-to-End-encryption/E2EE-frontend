import React, { useState } from 'react';
import { ChevronLeft, MoreVertical, X, Video, Search } from 'lucide-react';
import Avatar from '../../../../components/common/Avatar.jsx';
import ChatInfoSidebar from './ChatInfoSidebar.jsx';

export default function ChatHeader({ conversation, keyState, actions = null, onBack, onCloseChat }) {
    const [showSidebar, setShowSidebar] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const isGroup = conversation?.type === 'group';
    const name = conversation?.displayName || 'Conversation';
    const peer = conversation?.peer;
    const isOnline = peer?.presence === 'online';
    const isTyping = peer?.isTyping;

    // Safely extract a comma-separated list of names. Adjust 'conversation.participants' based on your actual data structure.
    const memberNames = isGroup
        ? (conversation?.participants?.map(p => p.name || p.username).join(', ') || `${conversation?.memberIds?.length || 0} members`)
        : '';

    return (
        <>
            <header className="flex flex-none items-center gap-3 px-[14px] py-[10px] md:px-5 md:py-3 bg-[var(--glass-strong)] border-b border-[var(--line)] backdrop-blur-[14px] h-[64px]">
                {onBack && (
                    <button type="button" className="inline-flex md:hidden items-center justify-center w-10 h-10 -ml-2 p-0 border-0 rounded-[14px] bg-transparent text-[var(--ink)] hover:bg-[var(--surface-3)]" onClick={onBack}>
                        <ChevronLeft className="w-[22px] h-[22px]" />
                    </button>
                )}

                <Avatar name={name} seed={conversation?._id} profilePictureKey={peer?.profilePictureKey} group={isGroup} size={42} />

                <button type="button" onClick={() => setShowSidebar(true)} className="flex-auto min-w-0 text-left hover:opacity-80">
                    <h3 className="m-0 truncate font-semibold text-[16px] text-[var(--ink)] leading-tight">{name}</h3>
                    <p className="mt-[2px] truncate font-medium text-[13px] text-[var(--ink-2)] leading-tight">
                        {!isGroup && (isTyping ? 'typing...' : isOnline ? 'online' : 'offline')}
                        {isGroup && memberNames}
                    </p>
                </button>

                <div className="flex items-center gap-1 relative flex-shrink-0">
                    {actions}

                    {/* Added Video Icon */}
                    <button type="button" className="inline-flex items-center justify-center w-9 h-9 p-0 border-0 rounded-full bg-transparent text-[var(--ink-2)] hover:bg-[var(--surface-3)]">
                        <Video className="w-[20px] h-[20px]" />
                    </button>

                    {/* Added Search Icon */}
                    <button type="button" className="inline-flex items-center justify-center w-9 h-9 p-0 border-0 rounded-full bg-transparent text-[var(--ink-2)] hover:bg-[var(--surface-3)]">
                        <Search className="w-[18px] h-[18px]" />
                    </button>

                    <div className="w-[1px] h-5 bg-[var(--line)] mx-1" aria-hidden="true" />

                    <button type="button" className="inline-flex items-center justify-center w-9 h-9 p-0 border-0 rounded-full bg-transparent text-[var(--ink-2)] hover:bg-[var(--surface-3)]" onClick={() => setShowMenu(!showMenu)}>
                        <MoreVertical className="w-[20px] h-[20px]" />
                    </button>

                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[180px] p-[6px] border border-[var(--line)] rounded-[12px] bg-[var(--surface)] shadow-[var(--shadow-menu)]">
                                <button type="button" className="flex items-center gap-[10px] w-full p-[10px] border-0 rounded-[8px] bg-transparent text-[var(--ink)] font-medium text-[14px] text-left hover:bg-[var(--surface-2)]" onClick={() => { setShowMenu(false); onCloseChat?.(); }}>
                                    <X className="w-[17px] h-[17px] text-[var(--ink-2)]" />Close chat
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </header>

            <ChatInfoSidebar isOpen={showSidebar} onClose={() => setShowSidebar(false)} conversation={conversation} />
        </>
    );
}