import React, { useEffect, useRef, useState } from 'react';

const SPEEDS = [1, 1.25, 1.5, 2];

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * VoicePlayer
 *
 * A self-contained audio player with:
 *   - Play / Pause toggle
 *   - Live progress bar (driven by the audio element's timeupdate)
 *   - Speed toggle (1x, 1.25x, 1.5x, 2x)
 *
 * When `recorded` is set (a blob URL from the recorder), it also
 * renders a static waveform preview of the recorded peaks.
 */
export default function VoicePlayer({ audioUrl, waveform = [], duration: declaredDuration }) {
    const audioRef = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [speed, setSpeed] = useState(1);

    const duration = declaredDuration ?? 0;

    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;

        const onTime = () => setCurrentTime(el.currentTime);
        const onEnded = () => setPlaying(false);
        const onLoaded = () => setLoaded(true);
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);

        el.addEventListener('timeupdate', onTime);
        el.addEventListener('ended', onEnded);
        el.addEventListener('loadedmetadata', onLoaded);
        el.addEventListener('play', onPlay);
        el.addEventListener('pause', onPause);
        el.playbackRate = speed;

        return () => {
            el.removeEventListener('timeupdate', onTime);
            el.removeEventListener('ended', onEnded);
            el.removeEventListener('loadedmetadata', onLoaded);
            el.removeEventListener('play', onPlay);
            el.removeEventListener('pause', onPause);
        };
    }, [speed, audioUrl]);

    useEffect(() => {
        if (audioRef.current) audioRef.current.playbackRate = speed;
    }, [speed]);

    const togglePlay = () => {
        const el = audioRef.current;
        if (!el) return;
        if (el.paused) el.play().catch(() => {});
        else el.pause();
    };

    const progress = duration > 0 ? (currentTime / duration) : 0;

    // Build 40 evenly spaced peak bars from recorded waveform data
    const bars = [];
    if (waveform.length > 0) {
        const total = 40;
        const bucketSize = Math.max(1, Math.floor(waveform.length / total));
        for (let i = 0; i < total; i++) {
            let peak = 0;
            for (let j = 0; j < bucketSize; j++) {
                const idx = i * bucketSize + j;
                if (idx < waveform.length) peak = Math.max(peak, waveform[idx]);
            }
            bars.push(peak);
        }
    } else if (duration > 0) {
        // No waveform data: render a flat placeholder
        for (let i = 0; i < 40; i++) bars.push(0.2);
    }

    const playedCount = Math.floor(progress * bars.length);

    return (
        <div className={`ec-voice-player ${playing ? 'playing' : ''}`}>
            <audio ref={audioRef} src={audioUrl} preload="metadata" />

            <button
                type="button"
                className="play-btn"
                onClick={togglePlay}
                aria-label={playing ? 'Pause' : 'Play'}
            >
                {/* Play icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="icon-play">
                    <path d="M8 5v14l11-7z" />
                </svg>
                {/* Pause icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="icon-pause">
                    <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                </svg>
            </button>

            <div className="player-info">
                <div className="flex items-center justify-between gap-2">
                    <span className="player-timer">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                </div>

                {bars.length > 0 && (
                    <div className="player-waveform">
                        {bars.map((peak, i) => (
                            <div
                                key={i}
                                className={`player-waveform-bar ${i < playedCount ? 'played' : ''}`}
                                style={{ height: `${Math.max(15, peak * 100)}%` }}
                            />
                        ))}
                    </div>
                )}
            </div>

            <button
                type="button"
                className="speed-btn"
                onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])}
                aria-label={`Playback speed ${speed}x`}
                title="Speed"
            >
                {speed}x
            </button>
        </div>
    );
}
