import React from 'react';
import { useTheme } from '../../../../providers/useTheme.js';
import { useMessages } from '../../hooks/useMessages.js';
import ChatHeader from './ChatHeader.jsx';
import MessageList from './MessageList.jsx';
import Composer from './Composer.jsx';

import chatBg from '../../../../assets/chat bg.png';
import chatBgDark from '../../../../assets/chatBgDark.png';

/**
 * ChatWindow
 *
 *      ChatWindow
 *        |- ChatHeader
 *        |- MessageList
 *        `- Composer
 *
 * One hook call, three children. The window itself holds no message state and
 * makes no socket calls; useMessages owns both, and the same background
 * treatment as the welcome canvas keeps the two views visually continuous.
 */
export default function ChatWindow({ conversation, selfUserId }) {
    const { isDark } = useTheme();
    const conversationId = conversation?._id;

    const {
        messages, loading, hasMore, keyState,
        loadOlder, sendText, markRead, errorMessage
    } = useMessages(conversationId);

    return (
        <main
            className={`flex-1 relative flex flex-col overflow-hidden bg-cover bg-center bg-no-repeat rounded-2xl shadow-sm transition-colors duration-300 ${
                isDark ? 'border border-slate-800' : 'border border-[#b2d1f8]/40'
            }`}
            style={{ backgroundImage: `url(${isDark ? chatBgDark : chatBg})` }}
        >
            <ChatHeader conversation={conversation} keyState={keyState} />

            {errorMessage && (
                <p className="text-[11px] font-medium text-red-500 px-4 py-1.5 bg-red-500/10">
                    {errorMessage}
                </p>
            )}

            <MessageList
                messages={messages}
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
