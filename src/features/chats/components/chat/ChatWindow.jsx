import React from 'react';
import { useMessages } from '../../hooks/useMessages.js';
import { useCall } from '../../hooks/useCall.js';
import ChatHeader from './ChatHeader.jsx';
import MessageList from './MessageList.jsx';
import Composer from './Composer.jsx';
import CallModal from '../calls/CallModal.jsx';

export default function ChatWindow({ conversation, selfUserId, onBack }) {
    const conversationId = conversation?._id;

    const {
        messages, loading, hasMore, keyState,
        loadOlder, sendText, markRead, errorMessage
    } = useMessages(conversationId);

    const {
        callState, isMuted, isCameraOff, timerSeconds, isVideoReady,
        acceptCall, rejectCall, exitCall, toggleMute, toggleCamera
    } = useCall(conversationId);

    return (
        <>
            <main
                className="chat-open relative flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden border border-[var(--line)] max-md:order-2 [.ec-root[data-view=list]_&]:max-md:hidden shadow-[var(--shadow-card)]"
                style={{
                    backgroundImage: 'var(--chat-wall-image)',
                    backgroundSize: 'contain',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    backgroundColor: 'var(--canvas)'
                }}
            >
                <ChatHeader
                    conversation={conversation}
                    keyState={keyState}
                    actions={null}
                    onBack={onBack}
                />

                {errorMessage && (
                    <p
                        className="flex-none px-5 py-2 bg-[var(--danger-soft)] text-[var(--danger)] font-medium text-[13px] leading-[1.35] [font-family:var(--font-body)]"
                        role="alert"
                    >
                        {errorMessage}
                    </p>
                )}

                <MessageList
                    messages={messages}
                    conversation={conversation}
                    conversationId={conversationId}
                    selfUserId={selfUserId}
                    loading={loading}
                    hasMore={hasMore}
                    onLoadOlder={loadOlder}
                    onVisible={markRead}
                />

                <Composer
                    conversationId={conversationId}
                    onSendText={sendText}
                    disabled={keyState === 'awaitingKey'}
                />
            </main>

            {callState && (
                <CallModal
                    direction={callState.direction}
                    callType={callState.type}
                    peerName={callState.peerName}
                    peerAvatarSrc={callState.peerAvatarSrc}
                    state={
                        timerSeconds > 0
                            ? 'active'
                            : callState.direction === 'outgoing'
                                ? 'connecting'
                                : 'incoming'
                    }
                    isMuted={isMuted}
                    isCameraOff={isCameraOff}
                    timerSeconds={timerSeconds}
                    isVideoReady={isVideoReady}
                    onAccept={acceptCall}
                    onReject={rejectCall}
                    onEnd={exitCall}
                    onToggleMute={toggleMute}
                    onToggleCamera={toggleCamera}
                />
            )}
        </>
    );
}
