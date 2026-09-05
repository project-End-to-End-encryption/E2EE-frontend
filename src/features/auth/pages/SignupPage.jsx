import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom"; // <-- Yeh import karo
import { Eye, EyeOff } from "lucide-react";
import {
    COLORS,
    DISPLAY_FONT,
    CAPTION_FONT,
    AuthPageShell,
    Field,
    Divider,
    OAuthButton,
    GoogleMark,
    GithubMark,
    inputStyle,
} from "../components/sidepanel";

/**
 * E2EE — sign-up page.
 *
 * Same shell, chrome, and OAuth row as login.jsx (both pull from
 * authKit.jsx) — this file only holds what's unique to signing up: the
 * email/password/confirm-password fields and their submit handler.
 */
export default function E2EESignup({
    onSignup,
    onGoogleSignup,
    onGithubSignup,
    onLoginClick,
}) {
    const navigate = useNavigate(); // <-- Hook call karo
    const location = useLocation(); // <-- Previous step (CheckUsername) se pass hua state read karne ke liye

    // CheckUsername page se pass hua username read karega:
    const passedUsername = location.state?.username || "";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [confirmTouched, setConfirmTouched] = useState(false);

    const handleGoogle =
        onGoogleSignup || (() => console.log("Continue with Google"));
    const handleGithub =
        onGithubSignup || (() => console.log("Continue with GitHub"));
    
    // "Log in" link par click karne se login route par bhejega:
    const handleLoginClick = onLoginClick || (() => navigate("/login"));

    const passwordsMismatch =
        confirmTouched &&
        confirmPassword.length > 0 &&
        confirmPassword !== password;

    const handleSubmit = (e) => {
        e.preventDefault();
        setConfirmTouched(true);
        if (confirmPassword !== password) return;

        if (onSignup) {
            onSignup(email, password, passedUsername);
        } else {
            console.log("Account Created:", { username: passedUsername, email, password });
            // Direct test redirection:
            // navigate("/dashboard");
        }
    };

    return (
        <AuthPageShell>
            <h1
                style={{
                    color: COLORS.obsidian,
                    fontFamily: DISPLAY_FONT,
                    fontSize: "clamp(28px, 4vw, 36px)",
                    letterSpacing: "-0.01em",
                }}
                className="font-medium"
            >
                Create your account
            </h1>
            <p
                style={{
                color: COLORS.obsidian, 
                fontFamily: DISPLAY_FONT,
                fontSize: 15,
                lineHeight: 1.5,
                }}
                className="mt-2"
>
                Sign up to start the conversation.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
                <Field label="Email">
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="e2ee-login-input rounded px-4 py-3 text-sm transition-colors duration-150"
                        style={inputStyle}
                    />
                </Field>

                <Field label="Password">
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="e2ee-login-input w-full rounded px-4 py-3 pr-11 text-sm transition-colors duration-150"
                            style={inputStyle}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            style={{ color: COLORS.midGray }}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                    </div>
                </Field>

                <Field label="Confirm password">
                    <div className="relative">
                        <input
                            type={showConfirmPassword ? "text" : "password"}
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            onBlur={() => setConfirmTouched(true)}
                            placeholder="••••••••"
                            className="e2ee-login-input w-full rounded px-4 py-3 pr-11 text-sm transition-colors duration-150"
                            style={inputStyle}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            aria-label={
                                showConfirmPassword ? "Hide password" : "Show password"
                            }
                            style={{ color: COLORS.midGray }}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                            {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                    </div>
                    {passwordsMismatch && (
                        <p
                            style={{ color: COLORS.otherText, fontFamily: CAPTION_FONT }}
                            className="text-xs"
                        >
                            Passwords don't match.
                        </p>
                    )}
                </Field>

                <button
                    type="submit"
                    className="mt-2 rounded px-6 py-3.5 text-base font-medium transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                        background: COLORS.signal,
                        color: COLORS.obsidian,
                        fontFamily: DISPLAY_FONT,
                    }}
                >
                    Create account
                </button>
            </form>

            <Divider>or</Divider>

            <div className="flex flex-col gap-3">
                <OAuthButton icon={<GoogleMark />} onClick={handleGoogle}>
                    Continue with Google
                </OAuthButton>
                <OAuthButton icon={<GithubMark size={18} />} onClick={handleGithub}>
                    Continue with GitHub
                </OAuthButton>
            </div>

            <p
                style={{
                color: COLORS.obsidian, 
                fontFamily: DISPLAY_FONT,
                fontSize: 14,
            }}
                className="mt-8 text-center"
>
                Already have an account?{" "}
            <button
                type="button"
                onClick={handleLoginClick}
                style={{
                color: COLORS.signal,
                fontFamily: DISPLAY_FONT,
            }}
                className="font-medium hover:underline"
    >
                Log in
            </button>
            </p>
        </AuthPageShell>
    );


}