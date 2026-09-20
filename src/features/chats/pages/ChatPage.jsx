import React, { useEffect, useMemo, useState } from 'react';
import ThemeProvider from '../../../providers/ThemeProvider.jsx';
import { useTheme } from '../../../providers/useTheme.js';
import { useConversations } from '../hooks/useConversations.js';
import AppSidebar from '../components/layout/AppSidebar.jsx';
import ChatWindow from '../components/chat/ChatWindow.jsx';
import WelcomeCanvas from '../components/welcome/WelcomeCanvas.jsx';
import { bootstrapSession } from '../../../app/bootstrap.js';
import '../styles/chat.css';

/**
 * ChatPage
 *
 *      ChatPage
 *        |- AppSidebar
 *        |    |- SidebarNav (icon rail) -> SettingsMenu
 *        |    `- conversation panel: SearchBar, filters, ConversationList | UserSearchResults
 *        `- main
 *             |- ChatWindow -> ChatHeader | MessageList | Composer
 *             `- WelcomeCanvas
 *
 * What is left in this file: which tab is open, which conversation is
 * selected, and the outer container. That is the whole job.
 *
 * No WebSocket handler, no repository call, no crypto and no media code lives
 * here - every one of those sits behind a hook or a service, which is what
 * makes the voice/video work later an addition rather than another rewrite.
 *
 * Colours: everything is a CSS variable on .ec-root (see styles/chat.css).
 * The theme only flips data-theme; no component branches on it.
 *
 * Small screens: data-view tells the stylesheet which single pane to show -
 * 'list' (conversations), 'chat' (an open conversation) or 'panel' (the
 * calls / saved placeholders).
 */
function ChatLayout() {
  const { theme } = useTheme();

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
  const view = showChat ? 'chat' : activeTab === 'chat' ? 'list' : 'panel';

  return (
      <div className="ec-root" data-theme={theme} data-view={view}>
        <AppSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            activeConversationId={activeConversationId}
            onSelectConversation={(id) => { setActiveTab('chat'); setActiveConversationId(id); }}
        />

        {showChat
            ? (
                <ChatWindow
                    conversation={activeConversation}
                    selfUserId={selfUserId}
                    onBack={() => setActiveConversationId(null)}
                />
            )
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
