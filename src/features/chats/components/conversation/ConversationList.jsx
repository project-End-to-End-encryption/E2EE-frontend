import React from 'react';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../../../../providers/useTheme.js';
import ConversationItem from './ConversationItem.jsx';

/**
 * The conversation list, plus the empty state that used to be hard-coded at
 * the bottom of ChatPage. The illustration and copy are unchanged - it just
 * renders when there genuinely are no conversations instead of always.
 */
export default function ConversationList({ conversations, loading, activeConversationId, onSelect }) {
    const { isDark } = useTheme();

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className={`w-5 h-5 animate-spin ${isDark ? 'text-slate-500' : 'text-[#0a1968]'}`} />
            </div>
        );
    }

    if (!conversations.length) {
        return (
            <div className="text-center px-2 flex flex-col items-center">
                <div className={`w-12 h-12 mb-2 flex items-center justify-center ${isDark ? 'text-cyan-400' : 'text-[#0a1968]'}`}>
                    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v3M7.5 3.5l1.5 2.5M16.5 3.5l-1.5 2.5" />
                        <path d="M4 11h16v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6z" />
                        <path d="M4 14h4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2h4" />
                    </svg>
                </div>
                <h4 className={`text-sm font-black ${isDark ? 'text-white' : 'text-[#0a1968]'}`}>No conversations yet</h4>
                <p className={`text-[11px] font-medium leading-relaxed mt-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                    Search for someone above to<br />start your first chat.
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto flex flex-col gap-1 -mx-1 px-1">
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
