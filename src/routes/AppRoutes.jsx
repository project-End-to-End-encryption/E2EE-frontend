import React from "react";
import { Routes, Route } from "react-router-dom";

import Homepage from "../pages/Homepage";
import LoginPage from "../features/auth/pages/LoginPage";
import SignupPage from "../features/auth/pages/SignupPage";
import CheckUserName from "../features/auth/pages/CheckUserName";
import ProfileSetup from "../features/auth/pages/profileSetup.jsx";

import ChatPage from "../features/chats/pages/ChatPage.jsx";

import KeysPage from "../features/recovery/pages/KeysPage.jsx";
import KeysSetupPage from "../features/recovery/pages/KeysSetupPage.jsx";
import RestoreKeysPage from "../features/recovery/pages/Restorekeyspage.jsx";

import RequireDeviceKeys from "./RequireDeviceKeys.jsx";
import AuthGuard from "./AuthGuard.jsx";

export default function AppRoutes() {
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Homepage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup/username" element={<CheckUserName />} />
            <Route path="/signup/details" element={<SignupPage />} />

            {/* Authenticated Routes */}
            <Route element={<AuthGuard />}>
                {/* Sign-up flow */}
                <Route path="/signup/profile" element={<ProfileSetup />} />
                <Route path="/signup/keys" element={<KeysSetupPage />} />

                {/* Recovery flow */}
                <Route path="/restore" element={<RestoreKeysPage />} />

                {/* Device-key protected pages */}
                <Route element={<RequireDeviceKeys />}>
                    <Route path="/chat" element={<ChatPage />} />
                    <Route path="/keys" element={<KeysPage />} />
                </Route>
            </Route>
        </Routes>
    );
}