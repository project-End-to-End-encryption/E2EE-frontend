import React from 'react';
import Avatar from '../../../../components/common/Avatar.jsx';

const formatTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();

    return sameDay
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

/**
 * One row in the sidebar. Presentational: it receives a decorated conversation
 * from useConversations and renders it. No repository access, no socket calls.
 *
 * Unread rows get a heavier preview and a coloured time, so the badge is not
 * the only thing saying "new".
 */
export default function ConversationItem({ conversation, isActive, onSelect }) {
    const isGroup = conversation.type === 'group';
    const preview = conversation.preview?.text || '';
    const unread = conversation.unreadCount || 0;

    return (
        <button
            type="button"
            onClick={() => onSelect(conversation._id)}
            aria-current={isActive ? 'true' : undefined}
            className={`flex items-center gap-[12px] w-full p-[10px] border-0 rounded-[16px] text-left transition-colors duration-150 select-none ${
                isActive ? 'bg-[var(--surface-3)]' : 'bg-transparent hover:bg-[var(--surface-2)]'
            }`}
        >
            <Avatar
                name={conversation.displayName}
                seed={conversation._id}
                group={isGroup}
                size={48}
            />

            <span className="flex flex-col flex-1 min-w-0 justify-center mt-[-1px]">
                <span className="flex items-baseline justify-between gap-2 mb-[4px]">
                    <span className="truncate font-semibold text-[15px] leading-[1.2] [font-family:var(--font-body)] text-[var(--ink)]">
                        {conversation.displayName}
                    </span>
                    <span className={`flex-none font-medium text-[11.5px] leading-none whitespace-nowrap tabular-nums ${
                        unread > 0 ? 'text-[var(--accent)]' : 'text-[var(--ink-3)]'
                    }`}>
                        {formatTime(conversation.lastMessageAt)}
                    </span>
                </span>

                <span className="flex items-center justify-between gap-3">
                    <span className={`truncate text-[13.5px] leading-[1.3] [font-family:var(--font-body)] ${
                        unread > 0 ? 'font-semibold text-[var(--ink)]' : 'font-normal text-[var(--ink-2)]'
                    }`}>
                        {preview || 'No messages yet'}
                    </span>

                    {unread > 0 && (
                        <span className="inline-flex items-center justify-center flex-none min-w-[20px] h-[20px] px-[6px] rounded-full bg-[var(--accent)] text-white font-bold text-[11px] leading-none tabular-nums" aria-label={`${unread} unread`}>
                            {unread > 99 ? '99+' : unread}
                        </span>
                    )}
                </span>
            </span>
        </button>
    );
}