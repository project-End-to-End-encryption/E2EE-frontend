import React from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import ConversationItem from './ConversationItem.jsx';

const NOTHING_HERE = {
    direct: 'No direct chats yet.',
    group: 'No group chats yet.',
    unread: 'You are all caught up.'
};

/**
 * The conversation list, plus the empty states: no conversations at all, and
 * a filter that matches none of them.
 */
export default function ConversationList({
                                             conversations,
                                             totalCount = conversations.length,
                                             filter = 'all',
                                             loading,
                                             activeConversationId,
                                             onSelect
                                         }) {
    if (loading) {
        return (
            <div className="ec-center" role="status" aria-label="Loading conversations">
                <Loader2 className="ec-spin" />
            </div>
        );
    }

    if (!totalCount) {
        return (
            <div className="ec-empty">
                <span className="ec-empty__icon"><MessageSquare /></span>
                <h4>No conversations yet</h4>
                <p>Search for someone above to start your first chat.</p>
            </div>
        );
    }

    if (!conversations.length) {
        return (
            <p className="ec-hint" role="status">
                {NOTHING_HERE[filter] ?? 'Nothing to show.'}
            </p>
        );
    }

    return (
        <div className="ec-convlist">
            {conversations.map((conversation) => (
                <ConversationItem
                    key={conversation._id}
                    conversation={conversation}
                    isActive={conversation._id === activeConversationId}
                    onSelect={onSelect}
                />
            ))}
        </div>
    );
}
