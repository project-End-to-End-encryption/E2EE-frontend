import React from 'react';
import { Users, User, ShieldCheck } from 'lucide-react';
import { useTheme } from '../../../../providers/useTheme.js';

/**
 * ChatHeader
 *
 *      ChatHeader
 *        |- ConversationInfo
 *        |- [VoiceCallButton]   <- v2
 *        `- [VideoCallButton]   <- v2
 *
 * The call slot is a real, empty region with a comment on it rather than two
 * disabled buttons. A greyed-out phone icon is a promise the app cannot keep
 * yet, and the brief is explicit about not shipping misleading controls.
 * When call signalling lands, the components drop into `actions` and nothing
 * else in the header moves.
 */
export default function ChatHeader({ conversation, keyState, actions = null }) {
    const { isDark } = useTheme();

    const Icon = conversation?.type === 'group' ? Users : User;
    const memberCount = conversation?.memberIds?.length ?? 0;

    return (
        <header className={`flex items-center gap-3 px-4 py-3 border-b shrink-0 ${
            isDark ? 'border-slate-800 bg-[#0f172a]/80' : 'border-[#b2d1f8]/60 bg-white/70'
        } backdrop-blur-sm rounded-t-2xl`}>

            <span className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${
                isDark ? 'bg-slate-800 text-slate-200' : 'bg-[#b2d1f8] text-[#0a1968]'
            }`}>
                <Icon className="w-4 h-4" />
            </span>

            <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-bold truncate ${isDark ? 'text-slate-100' : 'text-[#0a1968]'}`}>
                    {conversation?.displayName || 'Conversation'}
                </h3>
                <p className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <ShieldCheck className="w-3 h-3" />
                    {keyState === 'awaitingKey'
                        ? 'Waiting for the conversation key'
                        : conversation?.type === 'group'
                            ? `End-to-end encrypted \u00b7 ${memberCount} members`
                            : 'End-to-end encrypted'}
                </p>
            </div>

            {/* Call actions land here. Empty until there is something real. */}
            {actions && <div className="flex items-center gap-1">{actions}</div>}
        </header>
    );
}
