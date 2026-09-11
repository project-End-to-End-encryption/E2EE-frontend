import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import {login} from "../service/authService.js";
import {loginUser} from "../api/auth.api.js";

export default function E2EELogin({
                                      onLogin,
                                      onGoogleLogin,
                                      onGithubLogin,
                                      onSignupClick,
                                  }) {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const handleGoogle =
        onGoogleLogin || (() => console.log("Continue with Google"));
    const handleGithub =
        onGithubLogin || (() => console.log("Continue with GitHub"));

    const handleSignup = onSignupClick || (() => navigate("/signup/username"));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg("");
        setLoading(true);

        try {
            // If a custom onLogin handler is passed, call it first
            if (onLogin) {
                await onLogin(email, password);
                return;
            } else {
                await login({email, password});
            }
            navigate("/chat");
        } catch (err) {
            console.error("Login request error:", err);
            setErrorMsg(err.message || "Unable to connect to the server. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthPageShell
            tagline="Welcome back"
            subtext="Your conversations are waiting."
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
                Welcome back
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
                Log in to keep the conversation going.
            </p>

            {/* Error Message Display */}
            {errorMsg && (
                <div className="mt-4 rounded bg-red-100 p-3 text-sm text-red-600">
                    {errorMsg}
                </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
                <Field label="Email">
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="E2EE-login-input rounded px-4 py-3 text-sm transition-colors duration-150"
                        style={inputStyle}
                        disabled={loading}
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
                            className="E2EE-login-input w-full rounded px-4 py-3 pr-11 text-sm transition-colors duration-150"
                            style={inputStyle}
                            disabled={loading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            style={{ color: COLORS.midGray }}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                            disabled={loading}
                        >
                            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                    </div>
                    <div className="mt-1 flex justify-end">
                        <a
                            href="#"
                            style={{
                                color: COLORS.midGray,
                                fontFamily: CAPTION_FONT,
                            }}
                            className="text-xs hover:underline"
                        >
                            Forgot password?
                        </a>
                    </div>
                </Field>

                <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 rounded px-6 py-3.5 text-base font-medium transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
                    style={{
                        background: COLORS.signal,
                        color: COLORS.obsidian,
                        fontFamily: DISPLAY_FONT,
                    }}
                >
                    {loading ? "Logging in..." : "Log in"}
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
                Don't have an account?{" "}
                <button
                    type="button"
                    onClick={handleSignup}
                    style={{
                        color: COLORS.signal,
                        fontFamily: DISPLAY_FONT,
                    }}
                    className="font-medium hover:underline"
                >
                    Create one
                </button>
            </p>
        </AuthPageShell>
    );
}