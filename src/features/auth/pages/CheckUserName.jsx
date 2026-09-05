import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import {
  COLORS,
  DISPLAY_FONT,
  CAPTION_FONT,
  AuthPageShell,
  Field,
  inputStyle,
} from "../components/sidepanel";

/**
 * E2EE — username availability check page.
 *
 * Flow: type a username → one button checks it against the backend.
 *   - taken       → shows "choose another one" and the button stays a
 *                   "Check username" button so they can retry after editing
 *   - available   → button turns into "Continue" and calls onContinue
 * Editing the username after a check always resets the result, so a
 * stale check can never be used to proceed.
 *
 * BACKEND HOOK-UP
 * ----------------
 * `checkUsername()` below is a placeholder — swap the URL for the real
 * endpoint, or skip editing this file entirely and pass your own
 * function in via the `onCheckUsername` prop:
 *
 *   <CheckUsername onCheckUsername={(username) => api.isUsernameFree(username)} />
 *
 * Either way, the function must return (or resolve to) a boolean:
 * true = available, false = taken.
 */

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

async function checkUsername(username) {
  const res = await fetch(
    `/api/users/check-username?username=${encodeURIComponent(username)}`
  );
  if (!res.ok) throw new Error("Username check failed");
  const data = await res.json();
  return data.available;
}

export default function CheckUsername({ onCheckUsername, onContinue }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  // Input change handler
  const handleChange = (e) => {
    setUsername(e.target.value);
    if (status !== "idle") {
      setStatus("idle");
      setMessage("");
    }
  };

  const handleNextStep = (validUsername) => {
    if (onContinue) {
      onContinue(validUsername);
    } else {
      navigate("/signup/details", { state: { username: validUsername } });
    }
  };

  const runCheck = onCheckUsername || checkUsername;

  const handleCheck = async () => {
    const trimmed = username.trim();
    if (!trimmed || status === "checking") return;

    if (!USERNAME_PATTERN.test(trimmed)) {
      setStatus("error");
      setMessage("3–20 characters. Letters, numbers, and underscores only.");
      return;
    }

    setStatus("checking");
    setMessage("");

    try {
      const isAvailable = await runCheck(trimmed);
      if (isAvailable) {
        setStatus("available");
        setMessage("Username is available.");
      } else {
        setStatus("taken");
        setMessage("That username is taken — choose another one.");
      }
    } catch (err) {
      setStatus("error");
      setMessage("Couldn't check right now. Try again.");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (status === "available") {
      handleNextStep(username.trim());
    } else {
      handleCheck();
    }
  };

  const isChecking = status === "checking";
  const isAvailable = status === "available";
  const isTaken = status === "taken";

  const statusColor = isAvailable
    ? COLORS.teal
    : isTaken || status === "error"
      ? COLORS.otherText
      : COLORS.ash;

  return (
    <AuthPageShell
      tagline="Start with a name that's yours"
      subtext="Pick something memorable — you can change it later in settings."
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
        Choose your username
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
        This is how people will find you on E2EE.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <Field label="Username">
          <div className="relative">
            <input
              type="text"
              value={username}
              onChange={handleChange}
              placeholder="yourname"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="E2EE-login-input w-full rounded px-4 py-3 pr-11 text-sm transition-colors duration-150"
              style={inputStyle}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {isChecking && (
                <Loader2
                  size={17}
                  style={{ color: COLORS.ash }}
                  className="animate-spin"
                />
              )}
              {isAvailable && (
                <CheckCircle2 size={17} style={{ color: COLORS.teal }} />
              )}
              {isTaken && (
                <XCircle size={17} style={{ color: COLORS.otherText }} />
              )}
            </span>
          </div>
          {message && (
            <p
              style={{ color: statusColor, fontFamily: CAPTION_FONT }}
              className="text-xs"
            >
              {message}
            </p>
          )}
        </Field>

        <button
          type="submit"
          disabled={!username.trim() || isChecking}
          className="mt-2 rounded px-6 py-3.5 text-base font-medium transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          style={{
            background: COLORS.signal,
            color: COLORS.obsidian,
            fontFamily: DISPLAY_FONT,
          }}
        >
          {isChecking
            ? "Checking…"
            : isAvailable
              ? "Continue"
              : "Check username"}
        </button>
      </form>
    </AuthPageShell>
  );
}