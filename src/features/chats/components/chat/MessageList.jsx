import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import MessageBubble from './MessageBubble.jsx';
import { userDirectory } from '../../../user/service/userDirectory.js';

const CLUSTER_GAP_MS = 5 * 60 * 1000;

const toDate = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
};

const dayLabel = (date) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString([], {
        day: 'numeric',
        month: 'long',
        ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {})
    });
};

/**
 * Turn a flat message array into what is drawn: day separators, and for each
 * bubble whether it joins the one above / below it (same sender, same day,
 * within five minutes). Pure - no state, no effects.
 */
function layout(messages, isOwnFn) {
    const items = [];
    let lastDay = null;

    const orderedMessages = [...messages].sort((a, b) => {
        const ta = toDate(a.sentAt)?.getTime() ?? 0;
        const tb = toDate(b.sentAt)?.getTime() ?? 0;

        if (ta !== tb) return ta - tb;

        return Number(a.seq ?? 0) - Number(b.seq ?? 0);
    });

    const joins = (a, b) => {
        if (!a || !b) return false;

        const ta = toDate(a.sentAt);
        const tb = toDate(b.sentAt);

        if (!ta || !tb || ta.toDateString() !== tb.toDateString()) {
            return false;
        }

        if (isOwnFn(a) !== isOwnFn(b)) return false;

        if (
            !isOwnFn(a) &&
            String(a.senderId) !== String(b.senderId)
        ) {
            return false;
        }

        return Math.abs(tb - ta) <= CLUSTER_GAP_MS;
    };

    orderedMessages.forEach((message, index) => {
        const sentAt = toDate(message.sentAt);
        const day = sentAt ? sentAt.toDateString() : null;

        if (day && day !== lastDay) {
            items.push({
                type: 'day',
                key: `day:${day}`,
                label: dayLabel(sentAt)
            });

            lastDay = day;
        }

        items.push({
            type: 'message',
            key: `${message.conversationId}:${message.seq}`,
            message,
            isOwn: isOwnFn(message),
            joinedPrev: joins(
                orderedMessages[index - 1],
                message
            ),
            joinedNext: joins(
                message,
                orderedMessages[index + 1]
            )
        });
    });

    return items;
}

/**
 * The scrolling transcript.
 *
 * Two behaviours worth naming: it sticks to the bottom only when the reader is
 * already near the bottom (so an arriving message never yanks you out of
 * history you were reading), and it asks for an older page when you reach the
 * top rather than on a timer.
 */
export default function MessageList({
                                        messages,
                                        conversation,
                                        conversationId,
                                        selfUserId,
                                        loading,
                                        hasMore,
                                        onLoadOlder,
                                        onVisible
                                    }) {
    const scroller = useRef(null);
    const atBottom = useRef(true);
    const previousCount = useRef(0);
    const askedFor = useRef(new Set());
    const [, refresh] = useState(0);

    const isGroup = conversation?.type === 'group';

    const isOwnFn = (message) =>
        message.isOutgoing || String(message.senderId) === String(selfUserId);

    const items = useMemo(
        () => layout(messages, isOwnFn),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [messages, selfUserId]
    );

    // In a group, name the sender. Profiles for people you never opened a
    // direct chat with are not cached yet, so fetch each one once.
    useEffect(() => {
        if (!isGroup) return;

        const wanted = [...new Set(messages.map((message) => String(message.senderId)).filter(Boolean))]
            .filter((id) => id !== String(selfUserId))
            .filter((id) => !userDirectory.cached(id) && !askedFor.current.has(id));

        if (!wanted.length) return;

        wanted.forEach((id) => askedFor.current.add(id));
        userDirectory.profiles(wanted).then(() => refresh((n) => n + 1));
    }, [isGroup, messages, selfUserId]);

    useLayoutEffect(() => {
        const node = scroller.current;
        if (!node) return;

        const grew = messages.length > previousCount.current;
        previousCount.current = messages.length;

        if (grew && atBottom.current) {
            node.scrollTop = node.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        atBottom.current = true;
        previousCount.current = 0;
        askedFor.current = new Set();
    }, [conversationId]);

    useEffect(() => {
        if (messages.length) onVisible?.();
    }, [messages.length, onVisible]);

    const handleScroll = (event) => {
        const node = event.currentTarget;
        atBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 120;

        if (node.scrollTop < 80 && hasMore) onLoadOlder?.();
    };

    if (loading && !messages.length) {
        return (
            <div className="flex flex-auto items-center justify-center p-6" role="status" aria-label="Loading messages">
                <Loader2 className="w-[22px] h-[22px] text-[var(--ink-2)] animate-[ec-spin_0.9s_linear_infinite]" />
            </div>
        );
    }

    if (!messages.length) {
        return (
            <div className="flex flex-auto items-center justify-center p-6">
                <p className="m-0 px-[18px] py-[9px] border border-[var(--line-soft)] rounded-full bg-[var(--glass-strong)] text-[var(--ink-2)] font-medium text-[13.5px] leading-[1.2] [font-family:var(--font-body)]">
                    No messages yet. Say something.
                </p>
            </div>
        );
    }

    const senderNameFor = (message) => {
        if (!isGroup) return conversation?.displayName ?? '';
        const profile = userDirectory.cached(message.senderId);
        return profile?.fullName || (profile?.username ? `@${profile.username}` : '');
    };

    return (
        <div ref={scroller} onScroll={handleScroll} className="flex-auto min-h-0 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,var(--ink)_30%,transparent)_transparent]">
            <div className="flex flex-col w-full max-w-[920px] mx-auto px-3 py-2 md:px-6 md:py-3">
                {hasMore && (
                    <button
                        type="button"
                        onClick={onLoadOlder}
                        className="self-center mt-1 mb-2 px-4 py-[7px] border border-[var(--line-soft)] rounded-full bg-[var(--glass)] text-[var(--ink)] font-semibold text-[12.5px] leading-none [font-family:var(--font-body)] backdrop-blur-md hover:bg-[var(--surface)] transition-colors"
                    >
                        Load earlier messages
                    </button>
                )}

                {items.map((item) => item.type === 'day'
                    ? (
                        <div key={item.key} className="self-center mt-4 mb-[6px] px-[14px] py-[6px] border border-[var(--line-soft)] rounded-full bg-[var(--glass-strong)] text-[var(--ink-2)] font-semibold text-[12.5px] leading-none [font-family:var(--font-body)] backdrop-blur-md">
                            {item.label}
                        </div>
                    )
                    : (
                        <MessageBubble
                            key={item.key}
                            message={item.message}
                            conversationId={conversationId}
                            isOwn={item.isOwn}
                            joinedPrev={item.joinedPrev}
                            joinedNext={item.joinedNext}
                            senderName={item.isOwn ? '' : senderNameFor(item.message)}
                            showSenderName={isGroup}
                        />
                    ))}
            </div>
        </div>
    );
}