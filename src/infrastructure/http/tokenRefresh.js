import { authStore } from "../../features/auth/storage/authStore.js";

const API_BASE_LINK = import.meta.env.VITE_API_BASE_URL;

// Shared in-flight request: every caller that asks for a refresh while one is
// already running (PublicGuard, AuthGuard, the HTTP client, React StrictMode's
// double effect) awaits the SAME promise instead of firing parallel requests.
// Parallel refreshes matter because a rotating refresh cookie can only be used once.
let refreshPromise = null;

export function refreshAccessToken() {
    if (!refreshPromise) {
        refreshPromise = fetch(
            `${API_BASE_LINK}/api/v1/auth/refresh`,
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            }
        )
            .then(async (res) => {
                const data = await res.json().catch(() => null);

                // Log only the status: the response body may carry tokens.
                console.log("[tokenRefresh] refresh:", res.status);

                if (!res.ok) {
                    // Only 401/403 mean "there is no valid session". A 5xx or a
                    // gateway error is transient, so keep the stored user id;
                    // clearing it would log people out whenever the server hiccups.
                    if (res.status === 401 || res.status === 403) {
                        authStore.clear();
                    }

                    const error = new Error(data?.message || "REFRESH_FAILED");
                    // Callers use this to tell "logged out" from "server down"
                    error.status = res.status;
                    throw error;
                }

                const userId = data?.data?.userId;

                if (!userId) {
                    // The server said OK but sent no identity, so we cannot trust
                    // this session. Treat it as logged out (401), not as offline,
                    // otherwise the guard would show a retry button forever.
                    authStore.clear();

                    const error = new Error("REFRESH_USER_ID_MISSING");
                    error.status = 401;
                    throw error;
                }

                authStore.setUserId(userId);

                console.log("[tokenRefresh] user restored:", userId);

                return data;
            })
            // A network failure (fetch itself rejects) reaches the caller unchanged,
            // with no `status` property. AuthGuard treats that as "offline", not
            // "logged out".
            .finally(() => {
                // Clear the slot so a LATER refresh (for example after a 401) can run;
                // only overlapping calls share a request.
                refreshPromise = null;
            });
    }

    return refreshPromise;
}