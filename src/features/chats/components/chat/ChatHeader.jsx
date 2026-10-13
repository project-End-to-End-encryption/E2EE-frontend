import React, { useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import Avatar from '../../../../components/common/Avatar.jsx';
import ChatInfoSidebar from './ChatInfoSidebar.jsx';

export default function ChatHeader({ conversation, keyState, actions = null, onBack, onCloseChat }) {
    const [showSidebar, setShowSidebar] = useState(false);

    const isGroup = conversation?.type === 'group';
    const name = conversation?.displayName || 'Conversation';
    const peer = conversation?.peer;
    const isOnline = peer?.presence === 'online';
    const isTyping = peer?.isTyping;

    const memberNames = isGroup
        ? (conversation?.participants?.map(p => p.name || p.username).join(', ') || `${conversation?.memberIds?.length || 0} members`)
        : '';

    return (
        <>
            <header className="flex flex-none items-center gap-3 px-[14px] py-[10px] md:px-5 md:py-3 bg-[var(--glass-strong)] border-b border-[var(--line)] backdrop-blur-[14px] h-[64px]">
                {onBack && (
                    <button
                        type="button"
                        className="inline-flex md:hidden items-center justify-center w-10 h-10 -ml-2 p-0 border-0 rounded-[14px] bg-transparent text-[var(--ink)] hover:bg-[var(--surface-3)]"
                        onClick={onBack}
                        aria-label="Back"
                    >
                        <ChevronLeft className="w-[22px] h-[22px]" />
                    </button>
                )}

                <Avatar
                    name={name}
                    seed={conversation?._id}
                    profilePictureKey={peer?.profilePictureKey}
                    group={isGroup}
                    size={42}
                />

                <button
                    type="button"
                    onClick={() => setShowSidebar(true)}
                    className="flex-auto min-w-0 text-left hover:opacity-80"
                >
                    <h3 className="m-0 truncate font-semibold text-[16px] text-[var(--ink)] leading-tight">
                        {name}
                    </h3>
                    <p className="mt-[2px] truncate font-medium text-[13px] text-[var(--ink-2)] leading-tight">
                        {!isGroup && (isTyping ? 'typing...' : isOnline ? 'online' : 'offline')}
                        {isGroup && memberNames}
                    </p>
                </button>
            </header>

            <ChatInfoSidebar
                isOpen={showSidebar}
                onClose={() => setShowSidebar(false)}
                conversation={conversation}
            />
        </>
    );
}
