import { io } from "socket.io-client";
import { refreshAccessToken } from '../http/tokenRefresh.js'
import {getDeviceId} from "../../shared/utils/deviceId.js";

let socket = null;
let refreshing  = false;
let connectionPromise = null;
const TERMINAL_ERRORS = new Set(['INVALID_TOKEN', 'TOKEN_REQUIRED']);

export const connect = ()=> {

    if (socket?.connected) {
        return Promise.resolve(socket);
    }
    if (connectionPromise) {
        return connectionPromise;
    }

    if (!socket) {
        socket = io(import.meta.env.VITE_API_BASE_URL, {
            withCredentials: true,
            autoConnect: false,
            auth: {
                deviceId: getDeviceId()
            }
        });
    }

    connectionPromise = new Promise((resolve,reject) => {
        const cleanup = () => {
            socket.off('connect', onConnect);
            socket.off('connect_error', onError);
            connectionPromise = null;
        };

        const onConnect = () => {
            cleanup();
            resolve(socket);
        };

        const onError = async (err) =>{
            if(err.message === 'TOKEN_EXPIRED' && !refreshing){
                refreshing = true
                try{
                    await refreshAccessToken();
                    socket.connect();
                    return;
                } catch {
                    socket.disconnect();
                    window.dispatchEvent(new Event('auth:logout'));
                    reject(err);
                } finally {
                    refreshing = false;
                }
                return;
            }
            cleanup();
            if (TERMINAL_ERRORS.has(err.message)) {
                socket.disconnect();
                window.dispatchEvent(new Event('auth:logout'));
            }
            reject(err);
        }
        socket.on('connect', onConnect);
        socket.on('connect_error', onError);

        socket.connect();
    });
    return connectionPromise;
}

export const getSocket = () => socket;

export default {connect, getSocket};