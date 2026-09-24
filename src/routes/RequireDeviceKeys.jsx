import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { authStore } from "../features/auth/storage/authStore.js";
import { getDeviceState } from "../features/recovery/deviceState.js";

export default function RequireDeviceKeys() {
    const [state, setState] = useState("checking");

    useEffect(() => {
        let cancelled = false;

        async function checkDeviceKeys() {
            try {
                const userId = authStore.getUserId();

                console.log(
                    "[RequireDeviceKeys] checking device state for:",
                    userId
                );

                const result = await getDeviceState(userId);

                if (!cancelled) {
                    console.log(
                        "[RequireDeviceKeys] device state:",
                        result
                    );

                    setState(result);
                }
            } catch (error) {
                console.error(
                    "[RequireDeviceKeys] device check failed:",
                    error
                );

                if (!cancelled) {
                    setState("restore-needed");
                }
            }
        }

        checkDeviceKeys();

        return () => {
            cancelled = true;
        };
    }, []);

    if (state === "checking") {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
                Checking device...
            </div>
        );
    }

    if (state === "ok") {
        return <Outlet />;
    }

    return <Navigate to="/restore" replace />;
}