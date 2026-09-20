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
            <div className="flex flex-auto items-center justify-center p-6" role="status" aria-label="Loading conversations">
                <Loader2 className="w-[26px] h-[26px] text-[var(--ink-3)] animate-[ec-spin_0.9s_linear_infinite]" />
            </div>
        );
    }

    if (!totalCount) {
        return (
            <div className="flex flex-col flex-auto items-center justify-center gap-2 p-8 text-center select-none">
                <span className="inline-grid place-items-center w-[64px] h-[64px] mb-[6px] rounded-full bg-[var(--surface-2)] text-[var(--ink-3)]">
                    <MessageSquare className="w-8 h-8" />
                </span>
                <h4 className="m-0 font-semibold text-[17px] leading-[1.2] [font-family:var(--font-display)] text-[var(--ink)]">
                    No conversations yet
                </h4>
                <p className="m-0 max-w-[240px] font-normal text-[14.5px] leading-[1.4] [font-family:var(--font-body)] text-[var(--ink-2)]">
                    Search for someone above to start your first chat.
                </p>
            </div>
        );
    }

    if (!conversations.length) {
        return (
            <p className="m-0 mt-8 px-4 text-center font-medium text-[13.5px] leading-[1.4] [font-family:var(--font-body)] text-[var(--ink-3)] select-none" role="status">
                {NOTHING_HERE[filter] ?? 'Nothing to show.'}
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-[2px] w-full p-2">
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