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

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

const API_USERNAME_URL = import.meta.env.VITE_API_CHEK_USERNAME;

async function checkUsername(username) {
  const res = await fetch(`${API_USERNAME_URL}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });

  const data = await res.json();

  return {
    ok: res.ok && data.success,
    message: data.message,
    reservationId: data.data?.reservationId ?? null,
  };
}

export default function CheckUsername({ onCheckUsername, onContinue }) {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [reservationId, setReservationId] = useState(null);

  const runCheck = onCheckUsername || checkUsername;

  const handleChange = (e) => {
    // Strip '@' if the user manually pastes or types it in the input box
    setUsername(e.target.value);
    if (status !== "idle") {
      setStatus("idle");
      setMessage("");
    }
  };

  const handleNextStep = (validUsername) => {
    if (onContinue) {
      onContinue(validUsername, reservationId);
    } else {
      navigate("/signup/details", { state: { username: validUsername, reservationId } });
    }
  };

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

    // Concatenate '@' at the beginning of the username
    const formattedUsername = `${trimmed}`;

    try {
      const result = await runCheck(formattedUsername);
      setMessage(result.message);
      setReservationId(result.reservationId);
      setStatus(result.ok ? "available" : "taken");
    } catch (err) {
      console.error("Fetch error details:", err);
      setStatus("error");
      setMessage("Couldn't check right now. Try again.");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formattedUsername = `@${username.trim()}`;
    if (status === "available") {
      handleNextStep(formattedUsername);
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
            <div className="relative flex items-center">
              {/* Visual '@' prefix inside input */}
              <span
                  className="absolute left-4 pointer-events-none select-none text-sm font-medium"
                  style={{ color: COLORS.ash }}
              >
              @
            </span>
              <input
                  type="text"
                  value={username}
                  onChange={handleChange}
                  placeholder="yourname"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="E2EE-login-input w-full rounded pl-8 pr-11 py-3 text-sm transition-colors duration-150"
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
                    className="text-xs mt-1"
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