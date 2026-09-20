import React from 'react';
import { useMessages } from '../../hooks/useMessages.js';
import ChatHeader from './ChatHeader.jsx';
import MessageList from './MessageList.jsx';
import Composer from './Composer.jsx';

/**
 * ChatWindow
 *
 *      ChatWindow
 *        |- ChatHeader
 *        |- MessageList
 *        `- Composer
 *
 * One hook call, three children. The window itself holds no message state and
 * makes no socket calls; useMessages owns both. The chat wall behind the
 * thread is the same one the welcome canvas uses, so the two views stay
 * visually continuous.
 */
export default function ChatWindow({ conversation, selfUserId, onBack }) {
    const conversationId = conversation?._id;

    const {
        messages, loading, hasMore, keyState,
        loadOlder, sendText, markRead, errorMessage
    } = useMessages(conversationId);

    return (
        <main className="relative flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden border border-[var(--line)] max-md:order-2 [.ec-root[data-view=list]_&]:max-md:hidden shadow-[var(--shadow-card)] bg-[var(--canvas)] bg-[linear-gradient(var(--wall-wash),var(--wall-wash)),var(--wall-image)] bg-cover bg-center bg-no-repeat">
            <ChatHeader conversation={conversation} keyState={keyState} onBack={onBack} />

            {errorMessage && (
                <p className="flex-none px-5 py-2 bg-[var(--danger-soft)] text-[var(--danger)] font-medium text-[13px] leading-[1.35] [font-family:var(--font-body)]" role="alert">
                    {errorMessage}
                </p>
            )}

            <MessageList
                messages={messages}
                conversation={conversation}
                conversationId={conversationId}
                selfUserId={selfUserId}
                loading={loading}
                hasMore={hasMore}
                onLoadOlder={loadOlder}
                onVisible={markRead}
            />

            <Composer
                conversationId={conversationId}
                onSendText={sendText}
                disabled={keyState === 'awaitingKey'}
            />
        </main>
    );
}