import React, { useEffect, useMemo, useState } from 'react';
import ThemeProvider from '../../../providers/ThemeProvider.jsx';
import { useTheme } from '../../../providers/useTheme.js';
import { useConversations } from '../hooks/useConversations.js';
import AppSidebar from '../components/layout/AppSidebar.jsx';
import ChatWindow from '../components/chat/ChatWindow.jsx';
import WelcomeCanvas from '../components/welcome/WelcomeCanvas.jsx';
import { bootstrapSession } from '../../../app/bootstrap.js';
import '../styles/chat.css';

// Naye filenames ke sath paths updated hain (Capital L aur D)
const lightBg = '/Light.png';
const darkBg = '/Dark.png';
const frontLightBg = '/Frontlight.png';
const frontDarkBg = '/Frontdark.png';

function ChatLayout() {
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState('chat');
  const [activeConversationId, setActiveConversationId] = useState(null);

  const { conversations, selfUserId } = useConversations();

  const activeConversation = useMemo(
      () => conversations.find((row) => row._id === activeConversationId) ?? null,
      [conversations, activeConversationId]
  );

  useEffect(() => {
    if (activeConversationId && !activeConversation && conversations.length) {
      setActiveConversationId(null);
    }
  }, [activeConversationId, activeConversation, conversations.length]);

  const showChat = activeTab === 'chat' && activeConversation;
  const view = showChat ? 'chat' : activeTab === 'chat' ? 'list' : 'panel';

  // Wallpaper logic based on active chat and theme
  const activeWallpaper = showChat 
    ? (theme === 'dark' ? darkBg : lightBg) 
    : (theme === 'dark' ? frontDarkBg : frontLightBg);

  return (
      <div
          className="ec-root flex max-md:flex-col md:flex-row w-full h-[100dvh] overflow-hidden bg-[var(--canvas)] text-[var(--ink)]"
          data-theme={theme}
          data-view={view}
      >
        <AppSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            activeConversationId={activeConversationId}
            onSelectConversation={(id) => { setActiveTab('chat'); setActiveConversationId(id); }}
        />

        {/* Dynamic Wallpaper Wrapper */}
        <div className="flex-1 h-full overflow-hidden flex flex-col relative">
          {showChat ? (
              <ChatWindow
                  conversation={activeConversation}
                  selfUserId={selfUserId}
                  onBack={() => setActiveConversationId(null)}
              />
          ) : (
              <WelcomeCanvas activeTab={activeTab} />
          )}
        </div>
      </div>
  );
}

export default function ChatPage() {
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