import { io } from "socket.io-client";

let socket = null;

export const connect = ()=> {
    if(socket?.connected) return Promise.resolve(socket);

    socket = io(import.meta.env.VITE_API_BASE_URL, {withCredentials: true});

    return new Promise((resolve,reject) => {
        socket.once('connect', ()=> resolve(socket));
        socket.once('connect_error', (err) => reject(err));
    });
}

export const getSocket = () => socket;

export default {connect, getSocket};