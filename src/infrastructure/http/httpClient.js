import { refreshAccessToken } from "./tokenRefresh.js";

const API_BASE_LINK = import.meta.env.VITE_API_BASE_URL;

const NO_REFRESH_PATHS = [
    "/api/v1/auth/login",
    "/api/v1/auth/signup",
    "/api/v1/auth/refresh",
    "/api/v1/auth/logout",
];

export async function request(
    path,
    body = null,
    { skipRefresh = false, method = "POST" } = {}
) {
    const options = {
        method,
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const res = await fetch(`${API_BASE_LINK}${path}`, options);

    const shouldSkipRefresh =
        skipRefresh ||
        NO_REFRESH_PATHS.includes(path);

    if (res.status === 401 && !shouldSkipRefresh) {
        await refreshAccessToken();

        return request(path, body, {
            skipRefresh: true,
            method,
        });
    }

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
        throw new Error(
            data?.message || "Request Failed"
        );
    }

    return data.data;
}