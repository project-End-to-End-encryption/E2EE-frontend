import React, { useEffect, useRef, useState } from 'react';
import { Phone, Video, PhoneOutgoing, VideoOff, Mic, MicOff, X, ShieldCheck, Clock } from 'lucide-react';

/**
 * CallModal
 *
 * The full-screen overlay shown for both incoming and outgoing
 * audio/video calls. It knows nothing about WebRTC signalling -
 * that is wired in through props so the modal stays UI-only:
 *
 *   state: 'incoming' | 'connecting' | 'active' | 'ended'
 *
 * Props:
 *   direction      - 'incoming' | 'outgoing'
 *   callType       - 'audio' | 'video'
 *   peerName       - display name
 *   peerAvatarSrc  - avatar URL (optional)
 *   onAccept       - user pressed Accept
 *   onReject       - user pressed Reject
 *   onEnd          - user pressed End Call (active state)
 *   onToggleMute   - user pressed mic toggle
 *   onToggleCamera - user pressed camera toggle (video)
 *   onClose        - dismissal (ended state)
 *   isMuted        - current mute state
 *   isCameraOff    - current camera state
 *   timerSeconds   - elapsed call time (active state)
 *   isVideoReady   - false while ICE/connection is being established
 */
export default function CallModal({
    direction = 'incoming',
    callType = 'audio',
    peerName = 'Unknown',
    peerAvatarSrc = null,
    isMuted = false,
    isCameraOff = false,
    timerSeconds = 0,
    state = 'incoming',
    isVideoReady = true,
    onAccept,
    onReject,
    onEnd,
    onToggleMute,
    onToggleCamera,
    onClose,
}) {
    const [showTimer, setShowTimer] = useState(false);

    useEffect(() => {
        if (state === 'active') {
            const t = setTimeout(() => setShowTimer(true), 2000);
            return () => clearTimeout(t);
        }
        setShowTimer(false);
    }, [state]);

    const formatTimer = (s) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    const isEnding = state === 'ended';
    const isActive = state === 'active';
    const isConnecting = state === 'connecting';

    return (
        <div className="ec-call-overlay" role="dialog" aria-label={`${callType} call with ${peerName}`}>
            {/* Mini timer that appears briefly at the start */}
            {showTimer && isActive && (
                <div className="ec-call-mini-timer">
                    <Clock size={12} className="inline mr-1" />
                    {formatTimer(timerSeconds)}
                </div>
            )}

            {/* Always-on connection status bar */}
            {!isEnding && !showTimer && (
                <div className="ec-call-mini-timer">
                    {isConnecting ? (
                        <span className="inline-flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                            Connecting...
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-2">
                            <ShieldCheck size={12} />
                            E2EE
                        </span>
                    )}
                </div>
            )}

            {/* Avatar */}
            <div className="ec-call-avatar">
                {peerAvatarSrc ? (
                    <img src={peerAvatarSrc} alt={peerName} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-5xl font-semibold">
                        {peerName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                )}
            </div>

            {/* Name */}
            <h2 className="ec-call-name">{peerName}</h2>

            {/* Status */}
            <p className="ec-call-status">
                {isEnding ? 'Call ended' :
                 isConnecting ? 'Establishing connection...' :
                 `${callType === 'video' ? 'Video' : 'Voice'} call`}
            </p>

            {showTimer && isActive && (
                <p className="ec-call-timer">{formatTimer(timerSeconds)}</p>
            )}

            {/* Call buttons */}
            <div className="ec-call-buttons">
                {direction === 'incoming' && !isConnecting && !isEnding && (
                    <>
                        <button
                            type="button"
                            className="ec-call-btn"
                            onClick={onReject}
                            aria-label="Decline call"
                        >
                            <span className="btn-circle" style={{ background: '#4a4a4a' }}>
                                <X size={28} />
                            </span>
                            <span className="btn-label">Decline</span>
                        </button>

                        <button
                            type="button"
                            className="ec-call-btn"
                            onClick={onAccept}
                            aria-label="Accept call"
                        >
                            <span className="btn-circle" style={{ background: 'var(--accent)' }}>
                                {callType === 'video' ? <Video size={28} /> : <Phone size={28} />}
                            </span>
                            <span className="btn-label">Accept</span>
                        </button>
                    </>
                )}

                {direction === 'outgoing' && isConnecting && (
                    <button
                        type="button"
                        className="ec-call-btn end-btn"
                        onClick={onReject}
                        aria-label="Cancel call"
                    >
                        <span className="btn-circle">
                            <X size={28} />
                        </span>
                        <span className="btn-label">Cancel</span>
                    </button>
                )}

                {(isActive || isEnding) && (
                    <>
                        {callType === 'video' && (
                            <button
                                type="button"
                                className={`ec-call-btn ${isCameraOff ? 'camera-off' : ''}`}
                                onClick={onToggleCamera}
                                aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
                            >
                                <span className="btn-circle" style={{ background: 'var(--call-button)' }}>
                                    {isCameraOff ? <VideoOff size={24} /> : <Video size={24} />}
                                </span>
                                <span className="btn-label">
                                    {isCameraOff ? 'Camera off' : 'Camera'}
                                </span>
                            </button>
                        )}

                        <button
                            type="button"
                            className={`ec-call-btn ${isMuted ? 'muted' : ''}`}
                            onClick={onToggleMute}
                            aria-label={isMuted ? 'Unmute' : 'Mute'}
                        >
                            <span className="btn-circle" style={{ background: 'var(--call-button)' }}>
                                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                            </span>
                            <span className="btn-label">
                                {isMuted ? 'Unmute' : 'Mute'}
                            </span>
                        </button>

                        <button
                            type="button"
                            className="ec-call-btn end-btn"
                            onClick={onEnd}
                            aria-label={isEnding ? 'Close' : 'End call'}
                        >
                            <span className="btn-circle">
                                {isEnding ? <PhoneOutgoing size={24} /> : <Phone size={24} />}
                            </span>
                            <span className="btn-label">{isEnding ? 'Close' : 'End'}</span>
                        </button>
                    </>
                )}
            </div>

            {isEnding && onClose && (
                <button
                    type="button"
                    className="mt-8 px-6 py-2 rounded-full border border-white/20 text-white/80 font-medium text-sm hover:bg-white/10 transition-colors"
                    onClick={onClose}
                >
                    Close
                </button>
            )}
        </div>
    );
}
