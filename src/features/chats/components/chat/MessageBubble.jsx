import React from 'react';
import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { useTheme } from '../../../../providers/useTheme.js';
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
 */
export default function MessageBubble({ message, conversationId, isOwn }) {
    const { isDark } = useTheme();

    const body = message.body ?? {};
    const attachments = body.attachments ?? [];
    const text = body.text ?? '';

    const bubbleClass = isOwn
        ? 'bg-[#0a1968] text-white rounded-2xl rounded-br-md'
        : isDark
            ? 'bg-slate-800 text-slate-100 rounded-2xl rounded-bl-md'
            : 'bg-white text-slate-800 rounded-2xl rounded-bl-md';

    if (message.isRevoked) {
        return (
            <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} px-4 py-0.5`}>
                <div className={`px-3.5 py-2 max-w-[70%] italic opacity-60 ${bubbleClass}`}>
                    <p className="text-sm">This message was deleted</p>
                </div>
            </div>
        );
    }

    if (message.undecryptable) {
        return (
            <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} px-4 py-0.5`}>
                <div className={`px-3.5 py-2 max-w-[70%] flex items-center gap-2 ${bubbleClass}`}>
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <p className="text-xs opacity-70">
                        This message cannot be decrypted on this device.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} px-4 py-0.5`}>
            <div className={`px-3 py-2 max-w-[70%] shadow-sm ${bubbleClass}`}>

                {attachments.length > 0 && (
                    <div className="flex flex-col gap-1.5 mb-1">
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

                {text && <div className={attachments.length ? 'px-0.5' : ''}><TextMessage text={text} /></div>}

                <MessageMeta message={message} isOwn={isOwn} />
            </div>
        </div>
    );
}

function MessageMeta({ message, isOwn }) {
    const sentAt = message.sentAt ? new Date(message.sentAt) : null;
    const time = sentAt && !Number.isNaN(sentAt.getTime())
        ? sentAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

    return (
        <div className="flex items-center justify-end gap-1 mt-0.5 -mb-0.5">
            <span className="text-[10px] opacity-60">{time}</span>
            {isOwn && <StateIcon state={message.state} />}
        </div>
    );
}

function StateIcon({ state }) {
    if (state === 'sending') return <Clock className="w-3 h-3 opacity-60" />;
    if (state === 'failed') return <AlertCircle className="w-3 h-3 text-red-300" />;
    if (state === 'read') return <CheckCheck className="w-3 h-3 opacity-80" />;
    return <Check className="w-3 h-3 opacity-60" />;
}
