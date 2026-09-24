import React from 'react';
import VoicePlayer from './VoicePlayer.jsx';

/**
 * VoiceNoteContent
 *
 * The renderer for audio attachments - drops into the
 * existing renderer registry in content/index.js:
 *
 *   audio: VoiceNoteContent
 *
 * Takes a bodyAttachment exactly like FileMessage. If the attachment
 * has a `voiceNote` block (blobUrl + waveform), it renders the
 * player; otherwise falls back to the plain FileMessage-style
 * download card.
 */
export default function VoiceNoteContent({ attachment }) {
    const voiceNote = attachment?.voiceNote;

    if (!voiceNote?.audioUrl) {
        // Fall back to the file-style card
        return null; // parent should fall through to FileMessage
    }

    return (
        <div className="ec-voice-in-bubble">
            <VoicePlayer
                audioUrl={voiceNote.audioUrl}
                waveform={voiceNote.waveform}
                duration={voiceNote.duration}
            />
        </div>
    );
}
