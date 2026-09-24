import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { COLORS } from "../features/auth/components/sidepanel.jsx";
import { refreshAccessToken } from "../infrastructure/http/tokenRefresh.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function PublicGuard() {
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        let mounted = true;

        // Shared, de-duplicated refresh: AuthGuard and the HTTP client await the
        // same in-flight request instead of racing with the same cookie.
        // refreshAccessToken() already sets or clears authStore itself.
        refreshAccessToken()
            .then(() => { if (mounted) setIsAuthenticated(true); })
            .catch(() => { if (mounted) setIsAuthenticated(false); })
            .finally(() => { if (mounted) setLoading(false); });

        return () => { mounted = false; };
    }, []);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
                <Loader2
                    size={32}
                    style={{
                        color: COLORS?.signal || "#00f0ff",
                    }}
                    className="animate-spin"
                />
            </div>
        );
    }

    if (isAuthenticated) {
        return <Navigate to="/chat" replace />;
    }

    return <Outlet />;
}