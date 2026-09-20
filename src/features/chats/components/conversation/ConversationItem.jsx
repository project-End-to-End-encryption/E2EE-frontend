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
            className={`ec-conv ${isActive ? 'is-active' : ''} ${unread > 0 ? 'is-unread' : ''}`}
        >
            <Avatar
                name={conversation.displayName}
                seed={conversation._id}
                group={isGroup}
                size={48}
            />

            <span className="ec-conv__body">
                <span className="ec-conv__top">
                    <span className="ec-conv__name">{conversation.displayName}</span>
                    <span className="ec-conv__time">{formatTime(conversation.lastMessageAt)}</span>
                </span>

                <span className="ec-conv__bottom">
                    <span className="ec-conv__preview">{preview || 'No messages yet'}</span>

                    {unread > 0 && (
                        <span className="ec-badge" aria-label={`${unread} unread`}>
                            {unread > 99 ? '99+' : unread}
                        </span>
                    )}
                </span>
            </span>
        </button>
    );
}
