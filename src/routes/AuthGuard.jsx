import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { COLORS } from "../features/auth/components/sidepanel.jsx";

const API_REFRESH_URL =
    import.meta.env.VITE_API_REFRESH_URL || "http://localhost:3000/api/v1/auth/refresh";

export default function AuthGuard() {
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        let isMounted = true;

        async function checkAuth() {
            try {
                const res = await fetch(API_REFRESH_URL, {
                    method: "POST", // Change to "GET" if your refresh endpoint uses GET
                    credentials: "include", // Essential: sends HTTP-only cookies automatically
                    headers: { "Content-Type": "application/json" },
                });

                if (isMounted) {
                    // If 200 OK, cookie is valid -> user is authenticated
                    setIsAuthenticated(res.ok);
                }
            } catch (err) {
                console.error("Auth check failed:", err);
                if (isMounted) {
                    setIsAuthenticated(false);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        checkAuth();

        return () => {
            isMounted = false;
        };
    }, []);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
                <Loader2 size={32} style={{ color: COLORS.signal }} className="animate-spin" />
            </div>
        );
    }

    // If valid cookie exists, render protected route (<Outlet />), otherwise redirect to /login
    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}