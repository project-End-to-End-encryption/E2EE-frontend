import React, { useEffect, useMemo, useState } from 'react';
import ThemeProvider from '../../../providers/ThemeProvider.jsx';
import { useTheme } from '../../../providers/useTheme.js';
import { useConversations } from '../hooks/useConversations.js';
import AppSidebar from '../components/layout/AppSidebar.jsx';
import ChatWindow from '../components/chat/ChatWindow.jsx';
import WelcomeCanvas from '../components/welcome/WelcomeCanvas.jsx';
import { bootstrapSession } from '../../../app/bootstrap.js';

/**
 * ChatPage
 *
 *      ChatPage
 *        |- AppSidebar
 *        |    |- SidebarNav -> SettingsMenu
 *        |    |- SearchBar
 *        |    `- ConversationList | UserSearchResults
 *        `- main
 *             |- ChatWindow -> ChatHeader | MessageList | Composer
 *             `- WelcomeCanvas
 *
 * What is left in this file: which tab is open, which conversation is
 * selected, and the outer flex container. That is the whole job.
 *
 * No WebSocket handler, no repository call, no crypto and no media code lives
 * here - every one of those sits behind a hook or a service, which is what
 * makes the voice/video work later an addition rather than another rewrite.
 */
function ChatLayout() {
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState('chat');
  const [activeConversationId, setActiveConversationId] = useState(null);

  const { conversations, selfUserId } = useConversations();

  const activeConversation = useMemo(
      () => conversations.find((row) => row._id === activeConversationId) ?? null,
      [conversations, activeConversationId]
  );

  // A conversation that disappears (left a group, cleared) must not leave the
  // window pointing at nothing.
  useEffect(() => {
    if (activeConversationId && !activeConversation && conversations.length) {
      setActiveConversationId(null);
    }
  }, [activeConversationId, activeConversation, conversations.length]);

  const showChat = activeTab === 'chat' && activeConversation;

  return (
      <div className={`flex h-screen w-full font-sans select-none p-3 gap-3 transition-colors duration-300 ${
          isDark ? 'bg-[#060913] text-slate-100' : 'bg-[#dbe8fc] text-slate-800'
      }`}>
        <AppSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            activeConversationId={activeConversationId}
            onSelectConversation={(id) => { setActiveTab('chat'); setActiveConversationId(id); }}
        />

        {showChat
            ? <ChatWindow conversation={activeConversation} selfUserId={selfUserId} />
            : <WelcomeCanvas activeTab={activeTab} />}
      </div>
  );
}

export default function ChatPage() {
  // The socket, the listeners and the catch-up sync are started once, here,
  // rather than inside a component that re-renders. bootstrapSession is
  // idempotent, so StrictMode's double-invoke is harmless.
  useEffect(() => {
    void bootstrapSession().catch((error) => {
      console.error('[ChatPage] session bootstrap failed:', error);
    });
  }, []);

  return (
      <ThemeProvider>
        <ChatLayout />
      </ThemeProvider>
  );
}
