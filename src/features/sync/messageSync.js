import {rpcWithRetry, rpc} from "../../infrastructure/websocket/socketRpc.js";
import {SOCKET_EVENTS} from "../../shared/constants/socketEvents.js";
import {conversationRepo, messageRepo} from "../../infrastructure/storage/repos.js";
import {bus, TOPICS} from "../../infrastructure/websocket/eventBus.js";
import {SessionManager} from "../conversation/service/session/SessionManager.js";
import {archiveCrypto} from "../conversation/service/archiveCrypto.js";

/**
 * MESSAGE SYNC
 */

const ENVELOPE_PAGE = 200;
const HISTORY_PAGE = 50;

export async function drainEnvelopes() {
    let cursor = null;
    let total = 0;

    for (;;) {
        const ack = await rpcWithRetry(SOCKET_EVENTS.SYNC_PULL, {
            afterId: cursor,
            limit: ENVELOPE_PAGE
        });

        if (!ack.envelopes?.length) break;

        const storedIds = [];
        const decrypted = [];

        for (const row of ack.envelopes) {
            try {
                const message = await handleEnvelope(row.envelop ?? row.envelope, { queued: true });
                if (message) decrypted.push(message);
                storedIds.push(row._id);
            } catch (error) {
                // Do NOT ack. Leave it queued; the TTL will eventually clear it
                // if it is genuinely undecryptable. Acking a failure is data loss.
                console.error('[messageSync] envelope decrypt failed, leaving queued:', error.message);
            }
        }

        if (decrypted.length) await messageRepo.putMany(decrypted);
        if (storedIds.length) await rpc(SOCKET_EVENTS.SYNC_ACK, { ids: storedIds });

        total += decrypted.length;
        bus.emit(TOPICS.SYNC_PROGRESS, { phase: 'envelopes', done: total });

        if (!ack.hasMore) break;
        cursor = ack.nextCursor;
    }

    return total;
}
export function registerMessageListeners(socket) {

    // A live transport envelope addressed to this device.
    socket.on(SOCKET_EVENTS.MESSAGE_ENVELOPE, async (envelope) => {
        try {
            const message = await handleEnvelope(envelope, { queued: false });
            if (!message) return;

            await messageRepo.put(message);
            await updatePreview(message);

            bus.emit(TOPICS.MESSAGE_ADDED, {
                conversationId: message.conversationId,
                message
            });
        } catch (error) {
            console.error('[messageSync] live envelope failed:', error);
        }
    });

    // Delivery / read receipts from other members.
    socket.on(SOCKET_EVENTS.MESSAGE_RECEIPT, ({ conversationId, userId, type, seq }) => {
        bus.emit(TOPICS.MESSAGE_UPDATED, { conversationId, userId, type, seq });
    });

    // Delete-for-everyone.
    socket.on(SOCKET_EVENTS.MESSAGE_REVOKE, async ({ conversationId, seq }) => {
        await messageRepo.markRevoked(conversationId, seq);
        bus.emit(TOPICS.MESSAGE_REVOKED, { conversationId, seq });
    });

    socket.on(SOCKET_EVENTS.MESSAGE_TYPING, (payload) => {
        bus.emit(TOPICS.TYPING, payload);
    });
}


async function handleEnvelope(envelope, { queued }) {
    if (!envelope) return null;

    const plaintext = await SessionManager.decryptDirectMessage(envelope);
    const body = JSON.parse(plaintext);

    switch (body.kind) {
        case 'text':
            return toMessageRow(envelope, body, 'text');

        // ---- v2 slots: already routed, just not implemented -----------------
        case 'voice':
            // body = { kind, durationMs, storageKey, mediaKeyBase64, mimeType }
            return toMessageRow(envelope, body, 'audio');

        case 'image':
        case 'video':
        case 'file':
            return toMessageRow(envelope, body, body.kind);

        // One message, zero or more attachments, optional caption. The media
        // keys are inside `body.attachments[]` - they arrived sealed under the
        // ratchet and are never persisted anywhere the server can reach.
        case 'media':
            return toMessageRow(envelope, body, 'media');

        // Conversation-level events (archive key established, membership
        // change). Stored so history stays contiguous; the UI filters them.
        case 'system':
            return toMessageRow(envelope, body, 'system');

        case 'callEvent':
            // body = { kind, callId, action: 'missed'|'ended', durationMs }
            return toMessageRow(envelope, body, 'call');

        // ---- control plane: not user-visible messages ------------------------
        case 'senderKeyDistribution':
            await handleSenderKeyDistribution(envelope, body);
            return null;

        case 'archiveKey':
            // Someone handed us the wrapped CAK for a conversation we just
            // joined, or a fresh one after a rekey.
            await archiveCrypto.acceptDistributedKey(envelope, body);
            return null;

        default:
            console.warn('[messageSync] unknown payload kind:', body.kind, { queued });
            return null;
    }
}

function toMessageRow(envelope, body, contentType) {
    return {
        // compound primary key
        conversationId: envelope.conversationId,
        seq: envelope.seq,

        messageId: envelope.messageId,
        clientMessageId: envelope.clientMessageId,
        senderId: envelope.from?.userId,
        senderDeviceId: envelope.from?.deviceId,
        contentType,
        body,                       // the decrypted payload, kind and all
        sentAt: body.sentAt ?? null,
        receivedAt: Date.now(),
        isRevoked: false,
        isOutgoing: false,
        state: 'received'
    };
}

async function handleSenderKeyDistribution(envelope, body) {
    const { GroupSessionManager } = await import('../conversation/group/GroupSessionManager.js');
    await GroupSessionManager.receiveSenderKeyDistribution({
        fromUserId: envelope.from.userId,
        fromDeviceId: envelope.from.deviceId,
        ...body
    });
}

async function updatePreview(message) {
    await conversationRepo.setPreview(message.conversationId, {
        seq: message.seq,
        text: previewTextFor(message),
        senderId: message.senderId,
        sentAt: message.sentAt
    });
    bus.emit(TOPICS.SIDEBAR_CHANGED, { conversationId: message.conversationId, mode: 'preview' });
}

/** One place to decide what a chat row shows under the name. */
export function previewTextFor(message) {
    if (message.isRevoked) return 'This message was deleted';
    switch (message.contentType) {
        case 'text': return message.body?.text ?? '';
        case 'audio': return 'Voice message';
        case 'image': return 'Photo';
        case 'video': return 'Video';
        case 'file': return message.body?.filename ?? 'File';
        case 'media': return previewForAttachments(message);
        case 'system': return '';
        case 'call': return message.body?.action === 'missed' ? 'Missed call' : 'Call';
        default: return '';
    }
}


/** "Photo", "3 attachments", or the caption if the sender wrote one. */
function previewForAttachments(message) {
    const caption = message.body?.text?.trim();
    if (caption) return caption;

    const attachments = message.body?.attachments ?? [];
    if (attachments.length > 1) return `${attachments.length} attachments`;

    switch (attachments[0]?.category) {
        case 'image': return 'Photo';
        case 'video': return 'Video';
        case 'audio': return 'Audio';
        default: return attachments[0]?.originalFileName ?? 'File';
    }
}

export async function findGaps(conversationId) {
    const row = await conversationRepo.get(conversationId);
    if (!row) return [];

    const floor = Math.max(1, (row.clearedBeforeSeq ?? 0) + 1);
    const ceiling = row.lastSeq ?? 0;
    if (ceiling < floor) return [];

    const held = new Set(await messageRepo.seqList(conversationId));

    const gaps = [];
    let start = null;

    for (let seq = floor; seq <= ceiling; seq++) {
        if (held.has(seq)) {
            if (start !== null) { gaps.push([start, seq - 1]); start = null; }
        } else if (start === null) {
            start = seq;
        }
    }
    if (start !== null) gaps.push([start, ceiling]);

    return gaps;
}


export async function backfill(conversationId, { maxRows = 300 } = {}) {
    const gaps = await findGaps(conversationId);
    if (!gaps.length) return 0;

    let fetched = 0;

    // Newest gaps first: the user is looking at the bottom of the chat.
    for (const [from, to] of gaps.reverse()) {
        if (fetched >= maxRows) break;

        const span = to - from;
        const ack = span <= 500
            ? await rpc(SOCKET_EVENTS.HISTORY_RANGE, { conversationId, fromSeq: from, toSeq: to })
            : await rpc(SOCKET_EVENTS.HISTORY_PAGE, {
                conversationId, afterSeq: to - HISTORY_PAGE, limit: HISTORY_PAGE
            });

        const rows = ack.messages ?? [];
        const decrypted = await archiveCrypto.decryptMany(conversationId, rows);

        await messageRepo.putMany(decrypted);
        fetched += decrypted.length;

        bus.emit(TOPICS.SYNC_PROGRESS, { phase: 'history', conversationId, done: fetched });
    }

    if (fetched) bus.emit(TOPICS.MESSAGE_ADDED, { conversationId, backfilled: fetched });
    return fetched;
}


export async function loadOlder(conversationId, { beforeSeq, limit = HISTORY_PAGE } = {}) {
    const local = await messageRepo.page(conversationId, { beforeSeq, limit });
    if (local.length >= limit) return local;

    const ack = await rpc(SOCKET_EVENTS.HISTORY_PAGE, {
        conversationId,
        beforeSeq: local.length ? local[0].seq : beforeSeq,
        limit
    });

    const decrypted = await archiveCrypto.decryptMany(conversationId, ack.messages ?? []);
    await messageRepo.putMany(decrypted);

    return messageRepo.page(conversationId, { beforeSeq, limit });
}

export const messageSync = {
    drainEnvelopes,
    registerMessageListeners,
    findGaps,
    backfill,
    loadOlder,
    previewTextFor
};