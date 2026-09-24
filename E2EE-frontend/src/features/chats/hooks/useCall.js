import { useCallback, useRef, useState } from 'react';
import { bus, TOPICS } from '../../../infrastructure/websocket/eventBus.js';

/**
 * useCall
 *
 * State machine for an active call. The modal's visibility
 * is driven separately - this hook owns: who is on the call,
 * mute/camera state, and the timer.
 *
 * Toasts and signalling are pushed through bus.emit so that
 * the modal stays UI-only - no socket calls here.
 */
export function useCall(conversationId) {
    const [callState, setCallState] = useState(null); // null | { direction, type, peerName, peerAvatarSrc }
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [isVideoReady, setIsVideoReady] = useState(true);
    const timerRef = useRef(null);
    const startedAt = useRef(null);

    const clearCallTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const startTimer = useCallback(() => {
        clearCallTimer();
        startedAt.current = Date.now();
        setTimerSeconds(0);
        setIsVideoReady(false);

        timerRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
            setTimerSeconds(elapsed);
            // After 2s we consider ICE connected
            if (elapsed >= 2) {
                setIsVideoReady(true);
            }
        }, 1000);
    }, []);

    const endCall = useCallback(() => {
        clearCallTimer();
        startedAt.current = null;
        setCallState(null);
        setIsMuted(false);
        setIsCameraOff(false);
        setTimerSeconds(0);
        setIsVideoReady(true);
        void conversationId;
    }, [conversationId]);

    const toggleMute = useCallback(() => {
        setIsMuted((m) => !m);
        // Emitter: UI toasts / backend signalling would hook here
        bus.emit(TOPICS.CALL_STATE, { conversationId, muted: !isMuted, type: 'mute' });
    }, [conversationId, isMuted]);

    const toggleCamera = useCallback(() => {
        setIsCameraOff((c) => !c);
        bus.emit(TOPICS.CALL_STATE, { conversationId, cameraOff: !isCameraOff, type: 'camera' });
    }, [conversationId, isCameraOff]);

    const incomingCall = useCallback(({ direction = 'incoming', callType = 'audio', peerName, peerAvatarSrc }) => {
        setCallState({ direction, type: callType, peerName, peerAvatarSrc });
        setIsMuted(false);
        setIsCameraOff(false);
        setTimerSeconds(0);
        setIsVideoReady(true);
        void direction;
    }, []);

    const acceptCall = useCallback(() => {
        if (!callState) return;
        startTimer();
        bus.emit(TOPICS.CALL_STATE, { conversationId, accepted: true, type: 'accept' });
    }, [callState, conversationId, startTimer]);

    const rejectCall = useCallback(() => {
        endCall();
        bus.emit(TOPICS.CALL_STATE, { conversationId, rejected: true, type: 'reject' });
    }, [conversationId, endCall]);

    const exitCall = useCallback(() => {
        endCall();
        bus.emit(TOPICS.CALL_STATE, { conversationId, ended: true, type: 'end' });
    }, [conversationId, endCall]);

    return {
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
        toggleCamera,
        endCall,
    };
}
