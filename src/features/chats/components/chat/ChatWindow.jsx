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
        <main className="ec-chat">
            <ChatHeader conversation={conversation} keyState={keyState} onBack={onBack} />

            {errorMessage && <p className="ec-banner" role="alert">{errorMessage}</p>}

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
