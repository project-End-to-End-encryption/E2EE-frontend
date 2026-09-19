import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../../../../providers/useTheme.js';
import MessageBubble from './MessageBubble.jsx';

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
                                        conversationId,
                                        selfUserId,
                                        loading,
                                        hasMore,
                                        onLoadOlder,
                                        onVisible
                                    }) {
    const { isDark } = useTheme();
    const scroller = useRef(null);
    const atBottom = useRef(true);
    const previousCount = useRef(0);

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
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className={`w-5 h-5 animate-spin ${isDark ? 'text-slate-500' : 'text-[#0a1968]'}`} />
            </div>
        );
    }

    if (!messages.length) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <p className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                    No messages yet. Say something.
                </p>
            </div>
        );
    }

    return (
        <div
            ref={scroller}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto py-3 flex flex-col"
        >
            {hasMore && (
                <button
                    type="button"
                    onClick={onLoadOlder}
                    className={`self-center text-[11px] font-semibold mb-2 px-3 py-1 rounded-full ${
                        isDark ? 'bg-slate-800 text-slate-300' : 'bg-white/70 text-[#0a1968]'
                    }`}
                >
                    Load earlier messages
                </button>
            )}

            {messages.map((message) => (
                <MessageBubble
                    key={`${message.conversationId}:${message.seq}`}
                    message={message}
                    conversationId={conversationId}
                    isOwn={message.isOutgoing || String(message.senderId) === String(selfUserId)}
                />
            ))}
        </div>
    );
}
