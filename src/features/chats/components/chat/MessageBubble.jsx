import React from 'react';
import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import Avatar from '../../../../components/common/Avatar.jsx';
import TextMessage from './content/TextMessage.jsx';
import { rendererFor } from './content/index.js';

/**
 * MessageBubble
 *
 * A bubble is a caption plus zero or more attachments. It does not know what
 * an image is, or a PDF, or a voice note - it looks the renderer up by
 * category:
 *
 *      MessageBubble
 *        |- TextMessage
 *        `- content/index.js -> ImageMessage | VideoMessage | FileMessage | ...
 *
 * That indirection is the whole point: a new content type is a new file and
 * one line in the registry, not a rewrite of this component.
 *
 * Layout: MessageList tells each bubble whether it joins the one above or
 * below it. A run of messages from one person reads as one block - the first
 * carries the avatar (and the name, in a group), the last carries the tail.
 */
export default function MessageBubble({
                                          message,
                                          conversationId,
                                          isOwn,
                                          joinedPrev = false,
                                          joinedNext = false,
                                          senderName = '',
                                          showSenderName = false
                                      }) {
    const body = message.body ?? {};
    const attachments = body.attachments ?? [];
    const text = body.text ?? '';

    const rowClass = `flex items-start gap-[10px] ${isOwn ? 'justify-end' : ''} ${joinedPrev ? 'mt-[2px]' : 'mt-[12px]'}`;
    const stackClass = `flex flex-col min-w-0 max-w-[min(74%,560px)] ${isOwn ? 'items-end' : 'items-start'}`;

    // Compute the dynamic border radii to connect joined bubbles
    let bubbleCorners = '';
    if (!isOwn) {
        bubbleCorners = `${joinedPrev ? 'rounded-tl-[6px]' : ''} ${joinedNext ? 'rounded-bl-[6px]' : 'rounded-bl-[4px]'}`.trim();
    } else {
        bubbleCorners = `${joinedPrev ? 'rounded-tr-[6px]' : ''} ${joinedNext ? 'rounded-br-[6px]' : 'rounded-br-[4px]'}`.trim();
    }

    const bubbleBase = `relative max-w-full px-[13px] pt-[9px] pb-2 rounded-[18px] [overflow-wrap:anywhere] clearfix ${bubbleCorners}`;

    const lead = !isOwn && (
        joinedPrev
            ? <span className="flex-none w-[36px]" />
            : <Avatar name={senderName} seed={message.senderId} size={36} />
    );

    if (message.isRevoked || message.undecryptable) {
        return (
            <div className={rowClass}>
                {lead}
                <div className={stackClass}>
                    <div className={`flex items-center gap-2 border border-dashed border-[var(--line)] bg-[var(--glass)] text-[var(--ink-2)] font-normal text-[13.5px] leading-[1.4] [font-family:var(--font-body)] italic ${bubbleBase}`}>
                        <AlertCircle className="flex-none w-[15px] h-[15px]" aria-hidden="true" />
                        <p className="m-0">
                            {message.isRevoked
                                ? 'This message was deleted'
                                : 'This message cannot be decrypted on this device.'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const meta = <MessageMeta message={message} isOwn={isOwn} />;

    const bubbleTheme = isOwn
        ? 'bg-[linear-gradient(160deg,var(--bubble-out-a),var(--bubble-out-b))] text-[var(--bubble-out-ink)]'
        : 'bg-[var(--bubble-in)] text-[var(--bubble-in-ink)]';

    return (
        <div className={rowClass}>
            {lead}

            <div className={stackClass}>
                {showSenderName && !isOwn && !joinedPrev && senderName && (
                    <p className="m-0 mb-[3px] ml-1 font-semibold text-[12.5px] leading-[1.2] [font-family:var(--font-display)] text-[var(--accent-text)]">
                        {senderName}
                    </p>
                )}

                <div className={`${bubbleBase} ${bubbleTheme} shadow-[var(--shadow-bubble)]`}>
                    {attachments.length > 0 && (
                        <div className="flex flex-col gap-[6px] mb-1">
                            {attachments.map((attachment) => {
                                const Renderer = rendererFor(attachment.category);
                                return (
                                    <Renderer
                                        key={attachment.attachmentId ?? attachment.storageKey}
                                        conversationId={conversationId}
                                        attachment={attachment}
                                    />
                                );
                            })}
                        </div>
                    )}

                    {text
                        ? <TextMessage text={text}>{meta}</TextMessage>
                        : meta}
                </div>
            </div>
        </div>
    );
}

function MessageMeta({ message, isOwn }) {
    const sentAt = message.sentAt ? new Date(message.sentAt) : null;
    const valid = sentAt && !Number.isNaN(sentAt.getTime());
    const time = valid
        ? sentAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

    const colorClass = isOwn ? 'text-[var(--bubble-out-meta)]' : 'text-[var(--bubble-in-meta)]';

    return (
        <span className={`float-right inline-flex items-center gap-1 mt-2 mb-[-3px] ml-3 font-medium text-[11px] leading-none [font-family:var(--font-body)] tabular-nums select-none ${colorClass}`}>
            {valid && <time dateTime={sentAt.toISOString()}>{time}</time>}
            {isOwn && <StateIcon state={message.state} />}
        </span>
    );
}

function StateIcon({ state }) {
    const baseClass = "w-[14px] h-[14px]";
    if (state === 'sending') return <Clock className={baseClass} aria-label="Sending" />;
    if (state === 'failed') return <AlertCircle className={`${baseClass} text-[#ffd6d2]`} aria-label="Not sent" />;
    if (state === 'read') return <CheckCheck className={`${baseClass} text-[var(--tick-read)]`} aria-label="Read" />;
    return <Check className={baseClass} aria-label="Sent" />;
}