import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { COLORS } from "../features/auth/components/sidepanel.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AuthGuard() {
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        let isMounted = true;

        async function checkAuth() {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                });

                if (isMounted) {
                    if (res.ok) {
                        setIsAuthenticated(true);
                    } else {
                        console.warn("Auth Guard: Refresh endpoint returned non-200 status", res.status);
                        setIsAuthenticated(false);
                    }
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
                <Loader2 size={32} style={{ color: COLORS?.signal || "#00f0ff" }} className="animate-spin" />
            </div>
        );
    }

    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}