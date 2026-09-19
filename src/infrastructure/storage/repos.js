import { STORES, tx, get, put, del, getAll, openDb, wrap } from './db.js';

export const META_KEYS = {
    SIDEBAR_CURSOR: 'sidebar.cursor',             // epoch ms, from sidebar:sync
    SIDEBAR_SCHEMA: 'sidebar.schemaVersion',
    ARCHIVE_KEYS_CURSOR: 'archiveKeys.cursor',    // _id cursor for the CAK pull
    LAST_ENVELOPE_ID: 'sync.lastEnvelopeId',      // cursor into PendingEnvelope
    BOOTSTRAPPED_AT: 'session.bootstrappedAt'
};

export const metaRepo = {
    async get(key, fallback = null){
        const row = await get(STORES.META, key);
        return row ? row.value : fallback;
    },
    async set(key, value){
        return put(STORES.META, {key, value});
    },
    async setMany(entries) {
        return tx([STORES.META], 'readwrite', (stores) => {
            for(const [key, value] of Object.entries(entries)){
                stores[STORES.META].put({key, value});
            }
        });
    }
};

// conversations - the sidebar

export const conversationRepo = {

    async applySync({conversations = [], removed = [], cursor = null, schemaVersion = null}){
        return tx([STORES.CONVERSATIONS, STORES.META], 'readwrite', (stores, transaction) => {
            const store = stores[STORES.CONVERSATIONS];

            for(const row of conversations){
                const readRequest = store.get(row._id);
                readRequest.onsuccess = () => {
                    const existing = readRequest.result;
                    stores.put({
                        ...row,
                        preview: existing?.preview ?? null,       // decrypted last message
                        previewSeq: existing?.previewSeq ?? 0,
                        draft: existing?.draft ?? '',
                        typingUntil: 0
                    });
                };
            }
            for (const id of removed) store.delete(id);

            if (cursor !== null) {
                stores[STORES.META].put({ key: META_KEYS.SIDEBAR_CURSOR, value: cursor });
            }
            if (schemaVersion !== null) {
                stores[STORES.META].put({ key: META_KEYS.SIDEBAR_SCHEMA, value: schemaVersion });
            }

            void transaction;
        });
    },
    async list({ includeArchived = false } = {}) {
        const rows = await getAll(STORES.CONVERSATIONS);

        return rows
            .filter((r) => includeArchived || !r.isArchived)
            .sort((a, b) => {
                // pinned first, then most recent activity
                if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
                const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
                const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
                return bt - at;
            });
    },
    get(conversationId) {
        return get(STORES.CONVERSATIONS, conversationId);
    },
    async patch(conversationId, changes) {
        return tx([STORES.CONVERSATIONS], 'readwrite', (stores) => {
            const store = stores[STORES.CONVERSATIONS];
            const request = store.get(conversationId);
            request.onsuccess = () => {
                if (!request.result) return;      // row not synced yet - nothing to patch
                store.put({ ...request.result, ...changes });
            };
        });
    },
    async setPreview(conversationId, { seq, text, senderId, sentAt }) {
        return tx([STORES.CONVERSATIONS], 'readwrite', (stores) => {
            const store = stores[STORES.CONVERSATIONS];
            const request = store.get(conversationId);
            request.onsuccess = () => {
                const row = request.result;
                if (!row) return;
                if ((row.previewSeq ?? 0) >= seq) return;
                store.put({
                    ...row,
                    preview: { text, senderId, sentAt },
                    previewSeq: seq
                });
            };
        });
    }
};

// messages - decrypted, per conversation

export const messageRepo = {
    async putMany(messages) {
        if (!messages.length) return;
        return tx([STORES.MESSAGES], 'readwrite', (stores) => {
            for (const message of messages) stores[STORES.MESSAGES].put(message);
        });
    },

    put(message) {
        return put(STORES.MESSAGES, message);
    },

    async page(conversationId, { beforeSeq = Infinity, limit = 50 } = {}){
        const db = await openDb();
        const store = db.transaction(STORES.MESSAGES, 'readonly').objectStore(STORES.MESSAGES);

        const range = IDBKeyRange.bound(
            [conversationId, -Infinity],
            [conversationId, beforeSeq],
            false,
            true                     // exclusive upper bound: strictly before
        );

        return new Promise((resolve,reject) => {
            const out = [];
            const request = store.openCursor(range, 'prev');
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor || out.length >= limit) return resolve(out.reverse());
                out.push(cursor.value);
                cursor.continue();
            };
            request.onerror = () => reject(request.error);
        });
    },
    async seqList(conversationId){
        const db = await openDb();
        const store = db.transaction(STORES.MESSAGES, 'readonly').objectStore(STORES.MESSAGES);
        const range = IDBKeyRange.bound([conversationId, -Infinity], [conversationId, Infinity]);

        return new Promise((resolve, reject) => {
            const seqs = [];
            // openKeyCursor only reads keys - never deserialises message bodies.
            const request = store.openKeyCursor(range);
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) return resolve(seqs);
                seqs.push(cursor.key[1]);
                cursor.continue();
            };
            request.onerror = () => reject(request.error);
        });
    },
    get(conversationId, seq) {
        return get(STORES.MESSAGES, [conversationId, seq]);
    },
    async markRevoked(conversationId, seq) {
        const existing = await this.get(conversationId, seq);
        if (!existing) return;
        return put(STORES.MESSAGES, { ...existing, isRevoked: true, body: null, media: null });
    },
    async clearBefore(conversationId, seq) {
        const db = await openDb();
        const transaction = db.transaction(STORES.MESSAGES, 'readwrite');
        const store = transaction.objectStore(STORES.MESSAGES);
        const range = IDBKeyRange.bound([conversationId, -Infinity], [conversationId, seq]);

        return new Promise((resolve, reject) => {
            const request = store.openCursor(range);
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) return;
                cursor.delete();
                cursor.continue();
            };
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
        });
    }
};

export const outboxRepo = {
    add(entry) {
        return put(STORES.OUTBOX, { ...entry, attempts: 0, queuedAt: Date.now() });
    },
    remove(clientMessageId) {
        return del(STORES.OUTBOX, clientMessageId);
    },
    all() {
        return getAll(STORES.OUTBOX);
    },
    async bumpAttempt(clientMessageId) {
        const row = await get(STORES.OUTBOX, clientMessageId);
        if (!row) return null;
        const updated = { ...row, attempts: (row.attempts || 0) + 1, lastAttemptAt: Date.now() };
        await put(STORES.OUTBOX, updated);
        return updated;
    }
};

export const archiveKeyRepo = {
    put({ conversationId, epoch, key }) {
        return put(STORES.ARCHIVE_KEYS, { conversationId, epoch: Number(epoch), key });
    },
    async putMany(rows) {
        if (!rows.length) return;
        return tx([STORES.ARCHIVE_KEYS], 'readwrite', (stores) => {
            for (const row of rows) stores[STORES.ARCHIVE_KEYS].put(row);
        });
    },
    get(conversationId, epoch) {
        return get(STORES.ARCHIVE_KEYS, [conversationId, Number(epoch)]);
    },
    async listForConversation(conversationId) {
        const db = await openDb();
        const store = db.transaction(STORES.ARCHIVE_KEYS, 'readonly').objectStore(STORES.ARCHIVE_KEYS);
        const range = IDBKeyRange.bound([conversationId, -Infinity], [conversationId, Infinity]);
        return wrap(store.getAll(range));
    }
};

export const mediaRepo = {
    // id is the storageKey for remote media, or a local uuid while uploading
    put(entry) { return put(STORES.MEDIA, entry); },
    get(id) { return get(STORES.MEDIA, id); },
    remove(id) { return del(STORES.MEDIA, id); }
};

export const callLogRepo = {
    put(entry) { return put(STORES.CALL_LOGS, entry); },
    all() { return getAll(STORES.CALL_LOGS); }
};
