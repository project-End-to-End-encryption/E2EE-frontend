const listeners = new Map();   // topic -> Set<fn>

export const bus = {

    on(topic, handler) {
        if (!listeners.has(topic)) listeners.set(topic, new Set());
        listeners.get(topic).add(handler);
        return () => bus.off(topic, handler);
    },

    off(topic, handler){
        listeners.get(topic)?.delete(handler);
    },

    emit(topic, payload){
        const set = listeners.get(topic);
        if(!set) return;

        for(const handler of [...set]){
            try{
                handler(payload);
            } catch (error){
                console.error(`[bus] handler for "${topic}" threw:`, error);
            }
        }
    },
    clear() {listeners.clear();}
};

export const TOPICS = {
    // sync lifecycle
    SYNC_STARTED: 'sync:started',
    SYNC_PROGRESS: 'sync:progress',     // { phase, done, total }
    SYNC_COMPLETE: 'sync:complete',
    SYNC_FAILED: 'sync:failed',

    // sidebar
    SIDEBAR_CHANGED: 'sidebar:changed',         // re-read conversationRepo.list()
    CONVERSATION_REMOVED: 'sidebar:removed',    // { conversationId }

    // chat view
    MESSAGE_ADDED: 'message:added',             // { conversationId, message }
    MESSAGE_UPDATED: 'message:updated',         // delivery / read state changed
    MESSAGE_REVOKED: 'message:revoked',
    TYPING: 'message:typing',

    // connection
    CONNECTION_STATE: 'connection:state',       // 'connecting' | 'online' | 'offline'

    // v2 - reserved so the UI can already listen for them
    CALL_INCOMING: 'call:incoming',
    CALL_STATE: 'call:state',
    MEDIA_UPLOAD_PROGRESS: 'media:uploadProgress',

    MBK_STATE: 'mbk:state',
};