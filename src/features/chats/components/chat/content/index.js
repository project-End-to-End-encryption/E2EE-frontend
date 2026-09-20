import TextMessage from './TextMessage.jsx';
import ImageMessage from './ImageMessage.jsx';
import VideoMessage from './VideoMessage.jsx';
import FileMessage from './FileMessage.jsx';
import VoiceNoteContent from '../../audio/VoiceNoteContent.jsx';

/**
 * Attachment renderers, keyed by category.
 *
 * Adding a type later - a voice note, a location, a poll - is one entry here
 * plus one component. MessageBubble does not change, and neither does anything
 * above it.
 */
export const ATTACHMENT_RENDERERS = {
    image: ImageMessage,
    video: VideoMessage,
    audio: VoiceNoteContent,
    file: FileMessage
};

export const rendererFor = (category) => ATTACHMENT_RENDERERS[category] ?? FileMessage;

export { TextMessage, ImageMessage, VideoMessage, FileMessage, VoiceNoteContent };
