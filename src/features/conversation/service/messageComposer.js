import {rpc} from "../../../infrastructure/websocket/socketRpc.js";
import {SOCKET_EVENTS} from "../../../shared/constants/socketEvents.js";
import {SessionManager} from "./session/SessionManager.js";
import {archiveCrypto} from "./archiveCrypto .js";
import {conversationRepo, messageRepo, outboxRepo} from "../../../infrastructure/storage/repos.js";
import {bus, TOPICS} from "../../../infrastructure/websocket/eventBus.js";
import {authStore} from "../../auth/storage/authStore.js";
import {getDeviceId} from "../../../shared/utils/deviceId.js";
import {messageSync} from "../../sync/messageSync.js";

const uuid = () => crypto.randomUUID();


export async function send(conversationId, body, contentType = 'text'){

    const conversation = await conversationRepo.get(conversationId);
    if (!conversation) throw new Error('CONVERSATION_NOT_CACHED');

    const clientMessageId = uuid();
    const selfUserId = authStore.getUserId();
    const selfDeviceId = getDeviceId();
    const sentAt = new Date().toISOString();

    const fullBody = { ...body, sentAt };

    const pendingSeq = -Date.now();

    const optimistic = {
        conversationId,
        seq: pendingSeq,
        clientMessageId,
        senderId: selfUserId,
        senderDeviceId: selfDeviceId,
        contentType,
        body: fullBody,
        sentAt,
        receivedAt: Date.now(),
        isRevoked: false,
        isOutgoing: true,
        state: 'sending'
    };

    await messageRepo.put(optimistic);
    await outboxRepo.add({ clientMessageId, conversationId, body: fullBody, contentType });
    bus.emit(TOPICS.MESSAGE_ADDED, { conversationId, message: optimistic });

    try{
        const result = await deliver({ conversation, clientMessageId, fullBody, contentType, sentAt });

        const confirmed = { ...optimistic, seq: result.seq, messageId: result.messageId, state: 'sent' };

        await messageRepo.put(confirmed);
        await deleteByKey(conversationId, pendingSeq);
        await outboxRepo.remove(clientMessageId);

        await conversationRepo.setPreview(conversationId, {
            seq: result.seq,
            text: messageSync.previewTextFor(confirmed),
            senderId: selfUserId,
            sentAt
        });

        await conversationRepo.patch(conversationId, {
            lastSeq: result.seq,
            lastMessageAt: sentAt,
            lastReadSeq: result.seq,
            unreadCount: 0
        });

        bus.emit(TOPICS.MESSAGE_UPDATED, { conversationId, message: confirmed });
        bus.emit(TOPICS.SIDEBAR_CHANGED, { conversationId, mode: 'sent' });

        return confirmed;

    } catch (error){
        // Stays in the outbox. flushOutbox() will retry on the next connect.
        await messageRepo.put({ ...optimistic, state: 'failed', error: error.code });
        bus.emit(TOPICS.MESSAGE_UPDATED, { conversationId, clientMessageId, state: 'failed' });
        throw error;
    }
}

async function deliver({conversation, clientMessageId, fullBody, contentType, sentAt}){

    const conversationId = conversation._id;
    const epoch = conversation.keyEpoch ?? 1;

    const archive = await archiveCrypto.encryptArchive(conversationId, epoch, fullBody);

    const { devices } = await rpc(SOCKET_EVENTS.CONVERSATION_MEMBER_DEVICES, {
        conversationId,
        includeOwnOtherDevices: true
    });

    const plaintext = JSON.stringify(fullBody);

    const envelopes = [];

    for (const device of devices) {
        try {
            const envelope = await SessionManager.encryptDirectMessage({
                toUserId: device.userId,
                toDeviceId: device.deviceId,
                plaintext
            });
            envelopes.push({ ...envelope, toUserId: device.userId, toDeviceId: device.deviceId });
        } catch (error) {
            // One unreachable device (no prekeys left, bundle missing) must not
            // stop the message reaching the other twelve.
            console.warn('[composer] could not seal for device', device.deviceId, error.message);
        }
    }

    const ack = await rpc(SOCKET_EVENTS.MESSAGE_SEND, {
        conversationId,
        clientMessageId,
        contentType,
        archive,
        envelopes,
        sentAt
    });

    return { seq: ack.seq, messageId: ack.messageId, queued: ack.queued };
}


async function deleteByKey(conversationId, seq) {
    const { STORES, tx } = await import('../../../infrastructure/storage/db.js');
    await tx([STORES.MESSAGES], 'readwrite', (stores) => {
        stores[STORES.MESSAGES].delete([conversationId, seq]);
    });
}

export async function flushOutbox(){

    const pending = await outboxRepo.all();
    if (!pending.length) return 0;

    let sent = 0;

    for (const entry of pending) {
        const row = await outboxRepo.bumpAttempt(entry.clientMessageId);

        // Give up after a while rather than retrying forever on every connect.
        if (row && row.attempts > 10) {
            await outboxRepo.remove(entry.clientMessageId);
            continue;
        }

        try {
            const conversation = await conversationRepo.get(entry.conversationId);
            if (!conversation) { await outboxRepo.remove(entry.clientMessageId); continue; }

            await deliver({
                conversation,
                clientMessageId: entry.clientMessageId,
                fullBody: entry.body,
                contentType: entry.contentType,
                sentAt: entry.body.sentAt
            });

            await outboxRepo.remove(entry.clientMessageId);
            sent += 1;
        } catch (error) {
            console.debug('[composer] outbox retry failed:', entry.clientMessageId, error.code);
        }
    }

    return sent;
}

export const sendText = (conversationId, text) =>
    send(conversationId, { kind: 'text', text }, 'text');

export const sendMedia = (conversationId, { kind, storageKey, mediaKeyBase64, ivBase64, mimeType, byteSize, durationMs, filename, width, height }) =>
    send(conversationId, {
        kind,                       // 'voice' | 'image' | 'video' | 'file'
        storageKey,
        mediaKeyBase64,
        ivBase64,
        mimeType,
        byteSize,
        durationMs,                 // voice / video
        filename,                   // file
        width, height               // image / video thumbnails
    }, kind === 'voice' ? 'audio' : kind);

export const sendCallEvent = (conversationId, { callId, action, media, durationMs }) =>
    send(conversationId, { kind: 'callEvent', callId, action, media, durationMs }, 'call');

export const messageComposer = { send, sendText, sendMedia, sendCallEvent, flushOutbox };

