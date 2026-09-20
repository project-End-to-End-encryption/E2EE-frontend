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
        <header className="ec-header">
            {onBack && (
                <button type="button" className="ec-back" onClick={onBack} aria-label="Back to conversations">
                    <ChevronLeft />
                </button>
            )}

            <Avatar name={name} seed={conversation?._id} group={isGroup} size={44} />

            <div className="ec-header__info">
                <h3 className="ec-header__name">{name}</h3>
                <p className="ec-header__sub">
                    <span>
                        <ShieldCheck aria-hidden="true" />
                        {keyState === 'awaitingKey'
                            ? 'Waiting for the conversation key'
                            : 'End-to-end encrypted'}
                    </span>
                    {isGroup && keyState !== 'awaitingKey' && (
                        <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
                    )}
                </p>
            </div>

            {actions && <div className="ec-header__actions">{actions}</div>}
        </header>
    );
}
