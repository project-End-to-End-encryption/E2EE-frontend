import { refreshAccessToken } from './tokenRefresh.js'

const API_BASE_LINK = import.meta.env.VITE_API_BASE_URL;

export async function request(path, body = null, {skipRefresh = false, method = 'POST'} = {}){
    const options = {
        method,
        headers: {'Content-Type': 'application/json'},
        credentials: 'include',
    };
    if(body){
        options.body = JSON.stringify(body);
    }

    const res = await fetch(`${API_BASE_LINK}${path}`, options);

    if(res.status === 401 && !skipRefresh){
        await refreshAccessToken();
        return request(path, body, {skipRefresh: true, method});
    }

    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.message || 'Request Failed');
    }
    return data.data;
}