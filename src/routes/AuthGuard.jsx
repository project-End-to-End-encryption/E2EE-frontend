import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { COLORS } from "../features/auth/components/sidepanel.jsx";
import { refreshAccessToken } from "../infrastructure/http/tokenRefresh.js";
import { keyOwner, wipeLocalCryptoState } from "../features/auth/storage/keyOwner.js";

/**
 * AuthGuard
 *
 * Decides whether the protected routes may render. Statuses:
 *   checking        - refresh (or key reset) still in progress
 *   authenticated   - valid session AND the local keys belong to this account
 *   unauthenticated - the server says there is no valid session -> /login
 *   offline         - the check failed for a NON-auth reason (server down, no network).
 *                     We must NOT log the user out for that, so we offer a retry instead.
 *   blocked         - local key cleanup could not finish (another tab holds the database)
 */
export default function AuthGuard() {
    const [status, setStatus] = useState("checking");
    // Bumping this re-runs the check (used by the Retry buttons)
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let mounted = true;
        setStatus("checking");

        async function checkAuth() {
            try {
                // Shared refresh: PublicGuard, this guard and the HTTP client all await
                // the SAME in-flight request, so React StrictMode's double effect
                // and parallel guards can't race on the refresh cookie.
                // It also stores the user id in authStore on success.
                const body = await refreshAccessToken();
                const userId = body?.data?.userId;

                if (!mounted) return;

                if (!userId) {
                    setStatus("unauthenticated");
                    return;
                }

                // SAFETY: the keys stored in this browser (master key, identity key,
                // archive keys) must belong to the account the cookie says we are.
                // If they belong to someone else, using them would fail to unwrap
                // conversation keys and corrupt state, so wipe them and restore.
                if (keyOwner.mismatch(userId)) {
                    console.warn("[AuthGuard] local keys belong to another account, resetting");
                    const wiped = await wipeLocalCryptoState();

                    if (!mounted) return;

                    if (!wiped) {
                        setStatus("blocked");
                        return;
                    }

                    // A hard navigation drops every in-memory key (MBK, sessions) and
                    // every open database handle. The user then re-imports their
                    // recovery key on /restore, which is also under this guard.
                    window.location.replace("/restore");
                    return; // stay on the spinner until the page reloads
                }

                setStatus("authenticated");
            } catch (error) {
                if (!mounted) return;

                console.error("[AuthGuard] auth check failed:", error);

                // Only 401/403 mean "no valid session". Anything else (5xx, network
                // failure) is transient and must not end the user's session.
                if (error?.status === 401 || error?.status === 403) {
                    setStatus("unauthenticated");
                } else {
                    setStatus("offline");
                }
            }
        }

        checkAuth();

        return () => {
            mounted = false;
        };
    }, [attempt]);

    if (status === "checking") {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
                <Loader2
                    size={32}
                    style={{ color: COLORS?.signal || "#00f0ff" }}
                    className="animate-spin"
                />
            </div>
        );
    }

    if (status === "offline" || status === "blocked") {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-300">
                <p>
                    {status === "blocked"
                        ? "Close your other tabs for this app, then try again."
                        : "Can't reach the server right now."}
                </p>
                <button
                    onClick={() => setAttempt((n) => n + 1)}
                    className="rounded-md border border-zinc-700 px-4 py-2 hover:bg-zinc-800"
                >
                    Try again
                </button>
            </div>
        );
    }

    if (status === "unauthenticated") {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}