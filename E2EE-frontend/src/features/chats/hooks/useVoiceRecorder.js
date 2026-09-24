import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useVoiceRecorder
 *
 * Wraps MediaRecorder + an AnalyserNode. Exposes:
 *   - recording: boolean
 *   - duration: seconds elapsed while recording
 *   - waveform: 24 amplitude peaks sampled during recording
 *   - audioUrl: object URL of the recorded blob (after stop)
 *   - error: MediaRecorder permission / inactivity errors
 *
 * The recorded blob is never auto-stored anywhere - the caller passes it
 * through the same media upload pipeline as images and files.
 */
export function useVoiceRecorder() {
    const [recording, setRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [waveform, setWaveform] = useState([]);
    const [audioUrl, setAudioUrl] = useState(null);
    const [error, setError] = useState(null);

    const mediaRecorderRef = useRef(null);
    const analyserRef = useRef(null);
    const audioContextRef = useRef(null);
    const chunksRef = useRef([]);
    const durationTimerRef = useRef(null);
    const waveformSamplerRef = useRef(null);
    const streamRef = useRef(null);

    const stopTimer = () => {
        if (durationTimerRef.current) {
            clearInterval(durationTimerRef.current);
            durationTimerRef.current = null;
        }
    };

    const stopWaveformSampler = () => {
        if (waveformSamplerRef.current) {
            cancelAnimationFrame(waveformSamplerRef.current);
            waveformSamplerRef.current = null;
        }
    };

    const cleanup = useCallback(() => {
        stopTimer();
        stopWaveformSampler();

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.onstop = null;
            mediaRecorderRef.current.onerror = null;
            try { mediaRecorderRef.current.stop(); } catch { /* already stopped */ }
        }
        mediaRecorderRef.current = null;

        if (audioContextRef.current) {
            try { audioContextRef.current.close(); } catch { /* already closed */ }
            audioContextRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }

        chunksRef.current = [];
        setDuration(0);
        setWaveform([]);
    }, []);

    const start = useCallback(async () => {
        try {
            cleanup();
            setError(null);

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 64;
            analyser.smoothingTimeConstant = 0.8;
            source.connect(analyser);
            analyserRef.current = analyser;

            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
                chunksRef.current = [];
            };

            mediaRecorder.onerror = (event) => {
                setError(new Error('Voice recording failed'));
            };

            mediaRecorder.start(100);
            setRecording(true);
            setDuration(0);

            // Duration tick (10 Hz)
            durationTimerRef.current = setInterval(() => {
                setDuration((d) => d + 0.1);
            }, 100);

            // Waveform sampler (~24 peaks)
            const sample = () => {
                const data = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(data);
                // Downsample to ~24 bars
                const target = 24;
                const bucket = Math.max(1, Math.floor(data.length / target));
                const peaks = [];
                for (let i = 0; i < target; i++) {
                    let peak = 0;
                    for (let j = 0; j < bucket; j++) {
                        const idx = i * bucket + j;
                        if (idx < data.length) peak = Math.max(peak, data[idx]);
                    }
                    peaks.push(peak / 255);
                }
                setWaveform(peaks);
                waveformSamplerRef.current = requestAnimationFrame(sample);
            };
            waveformSamplerRef.current = requestAnimationFrame(sample);
        } catch (err) {
            setError(err);
        }
    }, [cleanup]);

    const stop = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setRecording(false);
        stopTimer();
        stopWaveformSampler();
    }, []);

    const reset = useCallback(() => {
        setAudioUrl(null);
        setDuration(0);
        setWaveform([]);
        setError(null);
    }, []);

    useEffect(() => {
        return () => {
            cleanup();
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [cleanup, audioUrl]);

    return { recording, duration, waveform, audioUrl, error, start, stop, reset, cleanup };
}

export default useVoiceRecorder;
