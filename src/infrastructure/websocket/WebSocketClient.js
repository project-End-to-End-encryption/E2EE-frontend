import { io } from "socket.io-client";
import { refreshAccessToken } from '../http/tokenRefresh.js'

let socket = null;
let refreshing  = false;

const TERMINAL_ERRORS = new Set(['INVALID_TOKEN', 'TOKEN_REQUIRED']);

export const connect = ()=> {

    if(socket){
        if(socket?.connected) return Promise.resolve(socket);
        socket.connect();
    }
    else {
        socket = io(import.meta.env.VITE_API_BASE_URL, { withCredentials: true });
    }

    return new Promise((resolve,reject) => {
        let settled = false;
        const onConnect = () => {
            if(!settled){
                settled = true
                resolve(socket);
            }
        }

        const onError = async (err) =>{
            if(err.message === 'TOKEN_EXPIRED' && !refreshing){
                refreshing = true
                try{
                    await refreshAccessToken();
                    socket.connect();
                } catch {
                    socket.disconnect();
                    window.dispatchEvent(new Event('auth:logout'));
                    if(!settled){
                        settled = true;
                        reject(err);
                    }
                } finally {
                    refreshing = false;
                }
                return;
            }
            if (TERMINAL_ERRORS.has(err.message)) {
                socket.disconnect();
                window.dispatchEvent(new Event('auth:logout'));
            }


            if (!settled) { settled = true; reject(err);

            }
        }
        socket.on('connect', onConnect);
        socket.on('connect_error', onError);
    })
}

export const getSocket = () => socket;

export default {connect, getSocket};