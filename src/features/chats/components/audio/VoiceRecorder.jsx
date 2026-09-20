import React from 'react';
import { Mic, X, Loader2, Check, Send } from 'lucide-react';

/**
 * VoiceRecorder
 *
 * A live voice-note recorder with:
 *   - Record / Stop buttons (driven by useVoiceRecorder)
 *   - A live timer counting up
 *   - A real waveform sampled from an AnalyserNode
 *
 * Placed inside Composer's trailing slot, or anywhere the designer wants it.
 */
export default function VoiceRecorder({ recorder }) {
    const { recording, duration, waveform } = recorder;

    const seconds = String(Math.floor(duration / 60)).padStart(2, '0');
    const centis = String(Math.floor((duration % 60) * 100 / 60)).padStart(2, '0');

    return (
        <div className="ec-voice-recorder">
            <button
                type="button"
                className={`voice-record-button ${recording ? 'recording' : ''}`}
                aria-label={recording ? 'Recording - tap to stop' : 'Record voice note'}
                aria-pressed={recording}
            >
                {recording ? <X size={20} /> : <Mic size={20} />}
            </button>

            <span className="timer">{seconds}:{centis}</span>

            <div className="waveform" aria-hidden="true">
                {waveform.length ? waveform.map((peak, i) => (
                    <div
                        key={i}
                        className="waveform-bar"
                        style={{ height: `${Math.max(8, peak * 100)}%` }}
                    />
                )) : (
                    <div className="waveform-bar" style={{ height: '12%' }} />
                )}
            </div>

            {recording && (
                <span className="flex-none inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--danger)]">
                    <span className="w-[6px] h-[6px] rounded-full bg-[var(--danger)] animate-pulse" />
                    LIVE
                </span>
            )}
        </div>
    );
}
