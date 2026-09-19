import React from 'react';
import { Users, User } from 'lucide-react';
import { useTheme } from '../../../../providers/useTheme.js';

const formatTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();

    return sameDay
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

/**
 * One row in the sidebar. Presentational: it receives a decorated conversation
 * from useConversations and renders it. No repository access, no socket calls.
 */
export default function ConversationItem({ conversation, isActive, onSelect }) {
    const { isDark } = useTheme();

    const Icon = conversation.type === 'group' ? Users : User;
    const preview = conversation.preview?.text || '';
    const unread = conversation.unreadCount || 0;

    return (
        <button
            type="button"
            onClick={() => onSelect(conversation._id)}
            className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left transition-colors ${
                isActive
                    ? 'bg-[#0a1968] text-white shadow-md'
                    : isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#b2d1f8]/60 text-[#0a1968]'
            }`}
        >
            <span className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${
                isActive ? 'bg-white/15' : isDark ? 'bg-slate-800' : 'bg-[#b2d1f8]'
            }`}>
                <Icon className="w-4 h-4" />
            </span>

            <span className="flex-1 min-w-0">
                <span className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-bold truncate">{conversation.displayName}</span>
                    <span className={`text-[10px] shrink-0 ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                        {formatTime(conversation.lastMessageAt)}
                    </span>
                </span>

                <span className="flex items-center justify-between gap-2 mt-0.5">
                    <span className={`text-[11px] truncate ${isActive ? 'text-white/70' : isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {preview || 'No messages yet'}
                    </span>

                    {unread > 0 && (
                        <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[#00a8cc] text-white text-[10px] font-bold flex items-center justify-center">
                            {unread > 99 ? '99+' : unread}
                        </span>
                    )}
                </span>
            </span>
        </button>
    );
}
