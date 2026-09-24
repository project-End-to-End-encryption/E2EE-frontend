import webSocketClient from "./WebSocketClient.js";

const DEFAULT_TIMEOUT_MS = 15000;

export class RpcError extends Error {
    constructor(code, message, extra = {}) {
        super(message || code);
        this.name = 'RpcError';
        this.code = code;
        Object.assign(this, extra);
    }
}

export async function rpc(event, payload = {}, {timeout = DEFAULT_TIMEOUT_MS} = {}){
    const socket = await webSocketClient.connect();

    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if(settled) return;
            settled = true;
            reject(new RpcError('TIMEOUT', `No ack for "${event}" after ${timeout}ms`));
        }, timeout);

        socket.emit(event, payload, (ack) => {
            if(settled) return;
            settled = true;
            clearTimeout(timer);

            if(!ack){
                return reject(new RpcError('EMPTY_ACK', `Server acked "${event}" with nothing`));
            }
            if(ack.ok === false){
                return reject(new RpcError(ack.error || 'UNKNOWN', ack.message, {
                    retryAfter: ack.retryAfter
                }));
            }
            resolve(ack);
        })
    })
}

export async function rpcWithRetry(event, payload, { attempts = 3, timeout } = {}) {
    let lastError;

    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            return await rpc(event, payload, { timeout });
        } catch (error) {
            lastError = error;
            const retryable = ['TIMEOUT', 'RATE_LIMIT', 'INTERNAL_ERROR', 'EMPTY_ACK'];
            if (!retryable.includes(error.code)) throw error;
            const waitMs = error.code === 'RATE_LIMIT' && error.retryAfter
                ? error.retryAfter * 1000
                : Math.min(1000 * 2 ** attempt, 8000);
            await new Promise((r) => setTimeout(r, waitMs));
        }
    }
    throw lastError;
}