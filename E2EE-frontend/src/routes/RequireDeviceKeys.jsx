import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { authStore } from '../features/auth/storage/authStore.js';
import { getDeviceState } from '../features/recovery/deviceState.js';

/**
 * RequireDeviceKeys
 *
 * A layout route that wraps ONLY the pages that need this device to hold the
 * account's keys (/chat, /keys). If the device is missing them, the user is
 * sent to /restore to upload their recovery key file once.
 *
 * Do NOT wrap /signup/* or /restore with it: during sign-up the keys are not
 * fully set up yet, and /restore would redirect to itself forever.
 *
 * Put this file next to AuthGuard.jsx.
 */
export default function RequireDeviceKeys() {
    const [state, setState] = useState('checking');

    useEffect(() => {
        let cancelled = false;

        getDeviceState(authStore.getUserId())
            .then((result) => { if (!cancelled) setState(result); })
            // If even the local check fails (e.g. storage blocked), /restore is safer than a broken chat.
            .catch(() => { if (!cancelled) setState('restore-needed'); });

        return () => { cancelled = true; };
    }, []);

    if (state === 'checking') return null;      // brief; swap in a spinner if you like
    return state === 'ok' ? <Outlet /> : <Navigate to="/restore" replace />;
}