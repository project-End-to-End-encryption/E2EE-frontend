import React from 'react';
import { useMessages } from '../../hooks/useMessages.js';
import { useCall } from '../../hooks/useCall.js';
import { Phone, Video } from 'lucide-react';
import ChatHeader from './ChatHeader.jsx';
import MessageList from './MessageList.jsx';
import Composer from './Composer.jsx';
import CallModal from '../calls/CallModal.jsx';

/**
 * ChatWindow
 *
 *      ChatWindow
 *        |- ChatHeader
 *        |- MessageList
 *        |- Composer
 *        `- CallModal (conditional)
 *
 * One hook call, three children. The window itself holds no message state and
 * makes no socket calls; useMessages owns both. The chat wall behind the
 * thread is the same one the welcome canvas uses, so the two views stay
 * visually continuous.
 */
export default function ChatWindow({ conversation, selfUserId, onBack }) {
    const conversationId = conversation?._id;

    const {
        messages, loading, hasMore, keyState,
        loadOlder, sendText, markRead, errorMessage
    } = useMessages(conversationId);

    const {
        callState,
        isMuted,
        isCameraOff,
        timerSeconds,
        isVideoReady,
        incomingCall,
        acceptCall,
        rejectCall,
        exitCall,
        toggleMute,
        toggleCamera
    } = useCall(conversationId);

    const handleAudioCall = () => {
        incomingCall({
            direction: 'outgoing',
            callType: 'audio',
            peerName: conversation?.displayName || 'Unknown',
            peerAvatarSrc: null
        });
    };

    const handleVideoCall = () => {
        incomingCall({
            direction: 'outgoing',
            callType: 'video',
            peerName: conversation?.displayName || 'Unknown',
            peerAvatarSrc: null
        });
    };

    const callActions = (
        <>
            <button
                type="button"
                className="call-action"
                onClick={handleAudioCall}
                aria-label="Voice call"
            >
                <Phone size={20} />
            </button>
            <button
                type="button"
                className="call-action"
                onClick={handleVideoCall}
                aria-label="Video call"
            >
                <Video size={20} />
            </button>
        </>
    );

    return (
        <>
            <main className="relative flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden border border-[var(--line)] max-md:order-2 [.ec-root[data-view=list]_&]:max-md:hidden shadow-[var(--shadow-card)] bg-[var(--canvas)] bg-[linear-gradient(var(--wall-wash),var(--wall-wash)),var(--wall-image)] bg-cover bg-center bg-no-repeat">
                <ChatHeader
                    conversation={conversation}
                    keyState={keyState}
                    actions={callActions}
                    onBack={onBack}
                />

                {errorMessage && (
                    <p className="flex-none px-5 py-2 bg-[var(--danger-soft)] text-[var(--danger)] font-medium text-[13px] leading-[1.35] [font-family:var(--font-body)]" role="alert">
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
                    state={timerSeconds > 0 ? 'active' : callState.direction === 'outgoing' ? 'connecting' : 'incoming'}
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
