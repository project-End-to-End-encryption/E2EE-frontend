import React from "react";
import { Routes, Route } from "react-router-dom";
import Homepage from "../pages/Homepage";
import LoginPage from "../features/auth/pages/LoginPage";
import SignupPage from "../features/auth/pages/SignupPage";
import CheckUserName from "../features/auth/pages/CheckUserName";
import ProfileSetup from "../features/auth/pages/ProfileSetup";
import ChatPage from "../features/chats/pages/ChatPage.jsx";
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
                <Route path="/signup/profile" element={<ProfileSetup />} />
                <Route path="/chat" element={<ChatPage />} />
            </Route>
        </Routes>
    );
}