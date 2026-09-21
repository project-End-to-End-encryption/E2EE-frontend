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
            // DEBUG: Decryption failed
            console.error('[DECRYPT FAILED]', error);
        }
    });

    // Delivery / read receipts from other members.
    // type: 'delivered' or 'read'
    socket.on(SOCKET_EVENTS.MESSAGE_RECEIPT, async ({ conversationId, userId, type, seq }) => {
        // Update messages up to and including seq as delivered/read
        await messageRepo.markAllStatus(conversationId, seq, type);

        // Also update conversation's tracking seq
        if (type === 'read') {
            await conversationRepo.patch(conversationId, { lastReadSeq: seq });
        } else if (type === 'delivered') {
            await conversationRepo.patch(conversationId, { lastDeliveredSeq: seq });
        }

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

        case 'voice':
            return toMessageRow(envelope, body, 'audio');

        case 'image':
        case 'video':
        case 'file':
            return toMessageRow(envelope, body, body.kind);

        case 'media':
            return toMessageRow(envelope, body, 'media');

        case 'system':
            return toMessageRow(envelope, body, 'system');

        case 'callEvent':
            return toMessageRow(envelope, body, 'call');

        case 'senderKeyDistribution':
            await handleSenderKeyDistribution(envelope, body);
            return null;

        case 'archiveKey':
            await archiveCrypto.acceptDistributedKey(envelope, body);
            return null;

        default:
            console.warn('[messageSync] unknown payload kind:', body.kind, { queued });
            return null;
    }
}

function toMessageRow(envelope, body, contentType) {
    return {
        conversationId: envelope.conversationId,
        seq: envelope.seq,
        messageId: envelope.messageId,
        clientMessageId: envelope.clientMessageId,
        senderId: envelope.from?.userId,
        senderDeviceId: envelope.from?.deviceId,
        contentType,
        body,
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