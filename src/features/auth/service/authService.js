import {signupUser, loginUser} from "../api/auth.api.js";
import webSocketClient from "../../../infrastructure/websocket/WebSocketClient.js";
import {generateAndRegisterKeys} from "./keyBundle.js";

export const register = async ({email, password, reservationId }) => {
    const result = await signupUser({email,password,reservationId});
    const socket = await webSocketClient.connect();
    await generateAndRegisterKeys(socket);
    return result;
};

export const login = async ({email, password}) => {
    const result = await loginUser({email,password});
    const socket = await webSocketClient.connect();
    await generateAndRegisterKeys(socket);
    return result;
}

export {refreshAccessToken} from '../../../infrastructure/http/tokenRefresh.js'