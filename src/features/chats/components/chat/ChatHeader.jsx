import React from 'react';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import Avatar from '../../../../components/common/Avatar.jsx';

/**
 * ChatHeader
 *
 *      ChatHeader
 *        |- BackButton (small screens only)
 *        |- ConversationInfo
 *        `- actions   <- voice / video call buttons drop in here in v2
 *
 * The call slot is a real, empty region rather than a pair of disabled
 * buttons. A greyed-out phone icon is a promise the app cannot keep yet. When
 * call signalling lands, the components pass in through `actions` and nothing
 * else in the header moves.
 */
export default function ChatHeader({ conversation, keyState, actions = null, onBack }) {
    const isGroup = conversation?.type === 'group';
    const memberCount = conversation?.memberIds?.length ?? 0;
    const name = conversation?.displayName || 'Conversation';

    return (
        <header className="flex flex-none items-center gap-3 px-[14px] py-[10px] md:px-5 md:py-3 bg-[var(--glass-strong)] border-b border-[var(--line)] backdrop-blur-[14px]">
            {onBack && (
                <button
                    type="button"
                    className="inline-flex md:hidden items-center justify-center w-10 h-10 -ml-2 p-0 border-0 rounded-[14px] bg-transparent text-[var(--ink)] hover:bg-[var(--surface-3)] transition-colors"
                    onClick={onBack}
                    aria-label="Back to conversations"
                >
                    <ChevronLeft className="w-[22px] h-[22px]" />
                </button>
            )}

            <Avatar name={name} seed={conversation?._id} group={isGroup} size={44} />

            <div className="flex-auto min-w-0">
                <h3 className="m-0 truncate font-semibold text-[17px] leading-[1.2] text-[var(--ink)] [font-family:var(--font-display)]">
                    {name}
                </h3>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-[2px] mt-[3px] font-medium text-[12.5px] leading-[1.2] text-[var(--ink-2)]">
                    <span className="inline-flex items-center gap-[5px]">
                        <ShieldCheck className="w-[13px] h-[13px] text-[var(--ok)]" aria-hidden="true" />
                        {keyState === 'awaitingKey'
                            ? 'Waiting for the conversation key'
                            : 'End-to-end encrypted'}
                    </span>
                    {isGroup && keyState !== 'awaitingKey' && (
                        <span className="inline-flex items-center gap-[5px]">
                            {memberCount} {memberCount === 1 ? 'member' : 'members'}
                        </span>
                    )}
                </p>
            </div>

            {actions && <div className="flex items-center gap-1">{actions}</div>}
        </header>
    );
}