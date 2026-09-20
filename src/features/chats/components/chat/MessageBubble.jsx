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

    const rowClass = `ec-row ${isOwn ? 'is-own' : ''} ${joinedPrev ? '' : 'is-start'}`;
    const bubbleClass = [
        'ec-bubble',
        isOwn ? 'is-own' : '',
        joinedPrev ? 'is-joined-prev' : '',
        joinedNext ? 'is-joined-next' : '',
        joinedNext ? '' : 'is-end'
    ].filter(Boolean).join(' ');

    const lead = !isOwn && (
        joinedPrev
            ? <span className="ec-row__gutter" />
            : <Avatar name={senderName} seed={message.senderId} size={36} />
    );

    if (message.isRevoked || message.undecryptable) {
        return (
            <div className={rowClass}>
                {lead}
                <div className="ec-stack">
                    <div className={`${bubbleClass} is-note`}>
                        <AlertCircle aria-hidden="true" />
                        <p style={{ margin: 0 }}>
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

    return (
        <div className={rowClass}>
            {lead}

            <div className="ec-stack">
                {showSenderName && !isOwn && !joinedPrev && senderName && (
                    <p className="ec-sender">{senderName}</p>
                )}

                <div className={bubbleClass}>
                    {attachments.length > 0 && (
                        <div className="ec-bubble__attachments">
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

    return (
        <span className="ec-meta">
            {valid && <time dateTime={sentAt.toISOString()}>{time}</time>}
            {isOwn && <StateIcon state={message.state} />}
        </span>
    );
}

function StateIcon({ state }) {
    if (state === 'sending') return <Clock aria-label="Sending" />;
    if (state === 'failed') return <AlertCircle className="is-failed" aria-label="Not sent" />;
    if (state === 'read') return <CheckCheck className="is-read" aria-label="Read" />;
    return <Check aria-label="Sent" />;
}
