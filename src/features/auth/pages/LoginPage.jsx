import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // <-- Yeh add karo
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
 * E2EE — log-in page.
 *
 * All shared chrome (Signal Network animation, brand panel, page shell,
 * form primitives) now lives in authKit.jsx. This file only holds the
 * things unique to logging in: the form fields, submit handler, and
 * OAuth/footer actions. Visuals are unchanged from the original.
 */
export default function E2EELogin({
  onLogin,
  onGoogleLogin,
  onGithubLogin,
  onSignupClick,
}) {
  const navigate = useNavigate(); // <-- Hook call karo
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleGoogle =
    onGoogleLogin || (() => console.log("Continue with Google"));
  const handleGithub =
    onGithubLogin || (() => console.log("Continue with GitHub"));
  
  // "Create one" par click karne se Username flow par bhejega:
  const handleSignup = onSignupClick || (() => navigate("/signup/username"));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onLogin) {
      onLogin(email, password);
    } else {
      // Backend integration ke baad dashboard/app route par redicrect karega:
      console.log("Logging in with:", email, password);
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
          className="mt-2 rounded px-6 py-3.5 text-base font-medium transition-all duration-200 hover:-translate-y-0.5"
          style={{
            background: COLORS.signal,
            color: COLORS.obsidian,
            fontFamily: DISPLAY_FONT,
          }}
        >
          Log in
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