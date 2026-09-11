import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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

import {register} from "../service/authService.js";

export default function E2EESignup({
                                       onSignup,
                                       onGoogleSignup,
                                       onGithubSignup,
                                       onLoginClick,
                                   }) {
    const navigate = useNavigate();
    const location = useLocation();

    // Read reservationId and username passed from CheckUsername screen
    const reservationId = location.state?.reservationId || "";
    const username = location.state?.username || "";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [confirmTouched, setConfirmTouched] = useState(false);

    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState("");

    const handleGoogle =
        onGoogleSignup || (() => console.log("Continue with Google"));
    const handleGithub =
        onGithubSignup || (() => console.log("Continue with GitHub"));

    const handleLoginClick = onLoginClick || (() => navigate("/login"));

    const passwordsMismatch =
        confirmTouched &&
        confirmPassword.length > 0 &&
        confirmPassword !== password;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setConfirmTouched(true);
        setApiError("");

        if (confirmPassword !== password) return;

        if (!reservationId) {
            setApiError("Session expired. Please choose your username again.");
            return;
        }

        setLoading(true);

        try {
           if(onSignup){
               await onSignup({email, password, reservationId, username})
           } else {
               await register({email, password, reservationId});
           }
            navigate("/signup/profile");
        } catch (err) {
            console.error("Signup error:", err);
            setApiError(err.message ||"Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthPageShell
            tagline="Your space. Your conversations."
            subtext="Create an account and connect without giving up your privacy."
        >
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
                {username ? (
                    <>
                        Signing up as <span className="font-semibold">{username}</span>
                    </>
                ) : (
                    "Sign up to start the conversation."
                )}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
                {apiError && (
                    <div
                        style={{ color: COLORS.otherText, fontFamily: CAPTION_FONT }}
                        className="rounded border border-red-200 bg-red-50 p-3 text-xs"
                    >
                        {apiError}
                    </div>
                )}

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
                            className="text-xs mt-1"
                        >
                            Passwords don't match.
                        </p>
                    )}
                </Field>

                <button
                    type="submit"
                    disabled={loading || passwordsMismatch}
                    className="mt-2 flex items-center justify-center rounded px-6 py-3.5 text-base font-medium transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                    style={{
                        background: COLORS.signal,
                        color: COLORS.obsidian,
                        fontFamily: DISPLAY_FONT,
                    }}
                >
                    {loading ? (
                        <span className="flex items-center gap-2">
                            <Loader2 size={18} className="animate-spin" /> Creating account…
                        </span>
                    ) : (
                        "Create account"
                    )}
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