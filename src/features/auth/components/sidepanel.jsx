import React, { useState, useEffect, useRef, useMemo } from "react";
import E2EELogoSVG from "../../../assets/E2EE.svg";

/**
 * authKit — everything shared across the E2EE auth pages (log in, sign up,
 * username check, and whatever comes next).
 *
 * Nothing in this file changes any colour, font, spacing, or animation
 * value from the original login page — it's a straight extraction so
 * every auth page renders the exact same brand panel and form primitives
 * instead of redefining them. Page-specific files (login.jsx,
 * checkUsername.jsx, ...) should only contain the markup/logic unique to
 * that page and import everything else from here.
 */

/* ─── DESIGN TOKENS (unchanged — do not edit values here) ─── */

export const COLORS = {
  obsidian: "#6da7f7",
  paper: "#ffffff",
  otherText: "#191687",
  text: "#0276fa",
  hairline: "#e5e7eb",
  midGray: "#fcfcfc",
  ash: "#acaba6",
  signal: "#7eecfc",
  teal: "#17d9d4",
};

export const DISPLAY_FONT =
  "'Space Grotesk', ui-sans-serif, system-ui, -apple-system, sans-serif";
export const CAPTION_FONT =
  "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

/* ═══════════════════════════════════════════════════════════════════
   SIGNAL NETWORK — ambient background animation (unchanged)
   ═══════════════════════════════════════════════════════════════════ */

const SN = {
  gradientFrom: "#3d02b3",
  gradientVia: "#528cf7",
  gradientTo: "#5d35cc",

  nodeCount: 10,
  nodeMinSize: 28,
  nodeMaxSize: 70,
  nodeBaseOpacity: 0.35,
  nodeColors: ["#15bfb7", "#17d9d4", "#6366f1", "#a78bfa", "#38bdf8"],

  driftSpeed: 0.1,

  connectionDistance: 260,
  connectionInterval: [2500, 4500],
  particleDuration: 1800,
  lineColor: "rgba(6, 66, 55, 0.25)",
  particleColor: "#02a8a4",

  typingInterval: [5000, 8000],
  typingDuration: 2200,

  parallaxStrength: 12,
};

function createNodes(count) {
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + 0.3;
    const radius = 18 + (i % 3) * 12;
    nodes.push({
      id: i,
      x: 50 + Math.cos(angle) * radius + ((i * 7) % 11) - 5,
      y: 50 + Math.sin(angle) * radius + ((i * 13) % 9) - 4,
      size: SN.nodeMinSize + ((i * 17) % (SN.nodeMaxSize - SN.nodeMinSize)),
      color: SN.nodeColors[i % SN.nodeColors.length],
      driftAx: 0.3 + (i % 5) * 0.15,
      driftAy: 0.4 + (i % 4) * 0.12,
      driftPx: (i * 1.1) % 6.28,
      driftPy: (i * 1.7) % 6.28,
    });
  }
  return nodes;
}

export function SignalNetwork() {
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const timeRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const parallaxRef = useRef({ x: 0, y: 0 });

  const nodes = useMemo(() => createNodes(SN.nodeCount), []);

  const positionsRef = useRef(nodes.map((n) => ({ x: n.x, y: n.y })));

  const nodeElsRef = useRef([]);
  const sceneRef = useRef(null);

  const [connection, setConnection] = useState(null);
  const [receivePulse, setReceivePulse] = useState(null);

  const [typingNode, setTypingNode] = useState(null);

  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (isTouch) return;

    const onMove = (e) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      mouseRef.current = {
        x: (e.clientX - cx) / (rect.width / 2),
        y: (e.clientY - cy) / (rect.height / 2),
        active: true,
      };
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;

    const animate = () => {
      timeRef.current += 1;
      const t = timeRef.current;

      nodes.forEach((node, i) => {
        const dx = Math.sin(t * 0.008 * node.driftAx + node.driftPx) * 14;
        const dy = Math.cos(t * 0.006 * node.driftAy + node.driftPy) * 10;

        const newX = node.x + dx * SN.driftSpeed;
        const newY = node.y + dy * SN.driftSpeed;

        positionsRef.current[i] = { x: newX, y: newY };

        const el = nodeElsRef.current[i];
        if (el) {
          el.style.transform = `translate(${dx * SN.driftSpeed * 3}px, ${dy * SN.driftSpeed * 3}px)`;
        }
      });

      const m = mouseRef.current;
      if (m.active && sceneRef.current) {
        const targetX = -m.x * SN.parallaxStrength;
        const targetY = -m.y * SN.parallaxStrength;
        parallaxRef.current.x += (targetX - parallaxRef.current.x) * 0.04;
        parallaxRef.current.y += (targetY - parallaxRef.current.y) * 0.04;
        sceneRef.current.style.transform = `translate(${parallaxRef.current.x}px, ${parallaxRef.current.y}px)`;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [nodes, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;

    const scheduleConnection = () => {
      const delay =
        SN.connectionInterval[0] +
        Math.random() * (SN.connectionInterval[1] - SN.connectionInterval[0]);

      const timerId = setTimeout(() => {
        const positions = positionsRef.current;
        let bestPair = null;
        let bestDist = Infinity;

        for (let i = 0; i < positions.length; i++) {
          for (let j = i + 1; j < positions.length; j++) {
            const dx = positions[i].x - positions[j].x;
            const dy = positions[i].y - positions[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy) * 5;
            if (
              dist < SN.connectionDistance / 5 &&
              dist < bestDist &&
              dist > 3
            ) {
              bestDist = dist;
              bestPair = [i, j];
            }
          }
        }

        if (!bestPair) {
          const a = Math.floor(Math.random() * nodes.length);
          let b =
            (a + 1 + Math.floor(Math.random() * (nodes.length - 1))) %
            nodes.length;
          bestPair = [a, b];
        }

        const [from, to] = bestPair;
        const startTime = performance.now();

        setConnection({ from, to, startTime });

        setTimeout(() => {
          setReceivePulse(to);
          setTimeout(() => setReceivePulse(null), 600);
        }, SN.particleDuration);

        setTimeout(() => {
          setConnection(null);
        }, SN.particleDuration + 500);

        scheduleConnection();
      }, delay);

      return timerId;
    };

    const id = scheduleConnection();
    return () => clearTimeout(id);
  }, [nodes, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;

    const scheduleTyping = () => {
      const delay =
        SN.typingInterval[0] +
        Math.random() * (SN.typingInterval[1] - SN.typingInterval[0]);

      const timerId = setTimeout(() => {
        const nodeIdx = Math.floor(Math.random() * nodes.length);
        setTypingNode(nodeIdx);

        setTimeout(() => setTypingNode(null), SN.typingDuration);

        scheduleTyping();
      }, delay);

      return timerId;
    };

    const id = scheduleTyping();
    return () => clearTimeout(id);
  }, [nodes, reducedMotion]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        background: `linear-gradient(135deg, ${SN.gradientFrom} 0%, ${SN.gradientVia} 50%, ${SN.gradientTo} 100%)`,
      }}
    >
      <style>{`
        @keyframes sn-pulse {
          0% { transform: scale(1); opacity: ${SN.nodeBaseOpacity}; }
          50% { transform: scale(1.5); opacity: ${SN.nodeBaseOpacity + 0.25}; }
          100% { transform: scale(1); opacity: ${SN.nodeBaseOpacity}; }
        }
        @keyframes sn-receive {
          0% { transform: scale(1); box-shadow: 0 0 0 0 currentColor; }
          50% { transform: scale(1.35); box-shadow: 0 0 20px 6px currentColor; }
          100% { transform: scale(1); box-shadow: 0 0 0 0 transparent; }
        }
        @keyframes sn-typing-dot {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.7); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes sn-particle-glow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes sn-line-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes sn-typing-appear {
          from { opacity: 0; transform: translateY(6px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes sn-typing-vanish {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(-4px) scale(0.9); }
        }
      `}</style>

      <div
        ref={sceneRef}
        style={{
          position: "absolute",
          inset: -SN.parallaxStrength * 2,
          willChange: "transform",
        }}
      >
        {connection && (
          <ConnectionLine
            connection={connection}
            positionsRef={positionsRef}
            containerRef={containerRef}
          />
        )}

        {nodes.map((node, i) => (
          <div
            key={node.id}
            ref={(el) => (nodeElsRef.current[i] = el)}
            style={{
              position: "absolute",
              left: `${node.x}%`,
              top: `${node.y}%`,
              width: node.size,
              height: node.size,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${node.color}88 0%, ${node.color}22 60%, transparent 100%)`,
              opacity: SN.nodeBaseOpacity,
              filter: `blur(${node.size * 0.15}px)`,
              willChange: "transform",
              transform: "translate(0, 0)",
              animation:
                receivePulse === i ? `sn-receive 0.6s ease-out` : undefined,
              color: node.color,
            }}
          />
        ))}

        {typingNode !== null && (
          <TypingPill
            nodeX={nodes[typingNode].x}
            nodeY={nodes[typingNode].y}
            nodeSize={nodes[typingNode].size}
          />
        )}
      </div>
    </div>
  );
}

function ConnectionLine({ connection, positionsRef, containerRef }) {
  const { from, to, startTime } = connection;
  const svgRef = useRef(null);
  const particleRef = useRef(null);
  const lineRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const animate = () => {
      const now = performance.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / SN.particleDuration, 1);

      const pFrom = positionsRef.current[from];
      const pTo = positionsRef.current[to];

      const container = containerRef.current;
      if (!container || !svgRef.current) return;

      const rect = container.getBoundingClientRect();
      const x1 = (pFrom.x / 100) * rect.width;
      const y1 = (pFrom.y / 100) * rect.height;
      const x2 = (pTo.x / 100) * rect.width;
      const y2 = (pTo.y / 100) * rect.height;

      if (lineRef.current) {
        lineRef.current.setAttribute("x1", x1);
        lineRef.current.setAttribute("y1", y1);
        lineRef.current.setAttribute("x2", x2);
        lineRef.current.setAttribute("y2", y2);
        const lineOpacity = progress > 0.8 ? (1 - progress) / 0.2 : 1;
        lineRef.current.setAttribute("opacity", lineOpacity);
      }

      if (particleRef.current) {
        const px = x1 + (x2 - x1) * progress;
        const py = y1 + (y2 - y1) * progress;
        particleRef.current.setAttribute("cx", px);
        particleRef.current.setAttribute("cy", py);
        const pOpacity =
          progress < 0.1
            ? progress / 0.1
            : progress > 0.85
              ? (1 - progress) / 0.15
              : 1;
        particleRef.current.setAttribute("opacity", pOpacity);
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [connection, from, to, startTime, positionsRef, containerRef]);

  return (
    <svg
      ref={svgRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "visible",
      }}
    >
      <defs>
        <filter id="sn-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <line
        ref={lineRef}
        stroke={SN.lineColor}
        strokeWidth="1.2"
        style={{ animation: "sn-line-fade-in 0.3s ease-out" }}
      />
      <circle
        ref={particleRef}
        r="4"
        fill={SN.particleColor}
        filter="url(#sn-glow)"
        opacity="0"
        style={{ animation: "sn-particle-glow 0.8s ease-in-out infinite" }}
      />
    </svg>
  );
}

function TypingPill({ nodeX, nodeY, nodeSize }) {
  const pillLeft = nodeX + nodeSize * 0.05;
  const pillTop = nodeY - 4;

  return (
    <div
      style={{
        position: "absolute",
        left: `${pillLeft}%`,
        top: `${pillTop}%`,
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: "rgba(255,255,255,0.08)",
        backdropFilter: "blur(8px)",
        borderRadius: 12,
        padding: "5px 12px",
        animation: "sn-typing-appear 0.35s ease-out",
        willChange: "transform, opacity",
      }}
    >
      {[0, 1, 2].map((d) => (
        <span
          key={d}
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: COLORS.signal,
            display: "block",
            animation: `sn-typing-dot 1.4s ease-in-out ${d * 0.18}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SHARED CHROME — brand panel, page shell, form primitives
   ═══════════════════════════════════════════════════════════════════ */

// Echoes the homepage's tile-pattern signature at reduced scale, for continuity.
function TileStrip() {
  const cells = Array.from({ length: 10 });
  const GREETINGS = [
    "HI",
    "HOLA",
    "BONJOUR",
    "CIAO",
    "OLÁ",
    "你好",
    "ПРИВЕТ",
    "नमस्ते",
    "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ",
    "নমস্কার",
  ];
  return (
    <div
      className="grid grid-cols-5"
      style={{ opacity: 0.5, position: "relative" }}
    >
      {cells.map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-center py-3"
          style={{
            color: i % 2 === 0 ? COLORS.signal : COLORS.otherText,
            fontFamily: DISPLAY_FONT,
            fontSize: "clamp(12px, 1.4vw, 16px)",
          }}
        >
          {GREETINGS[i]}
        </div>
      ))}
    </div>
  );
}

export function GoogleMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.4 0 6.4 1.2 8.8 3.5l6.5-6.5C35.2 2.7 30 0.5 24 0.5 14.9 0.5 7.1 5.7 3.3 13.3l7.6 5.9C12.7 13.4 17.9 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 2.9-2.2 5.4-4.7 7l7.4 5.7c4.3-4 6.8-9.9 6.8-17.2z"
      />
      <path
        fill="#FBBC05"
        d="M10.9 28.6a13.9 13.9 0 0 1 0-9.2l-7.6-5.9a23.9 23.9 0 0 0 0 21l7.6-5.9z"
      />
      <path
        fill="#34A853"
        d="M24 47.5c6 0 11.1-2 14.8-5.3l-7.4-5.7c-2 1.4-4.6 2.2-7.4 2.2-6.1 0-11.3-4-13.1-9.6l-7.6 5.9C7.1 42.3 14.9 47.5 24 47.5z"
      />
    </svg>
  );
}

export function GithubMark({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={COLORS.obsidian}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
      />
    </svg>
  );
}

export function OAuthButton({ icon, children, ...props }) {
  return (
    <button
      {...props}
      className="flex w-full items-center justify-center gap-3 rounded px-5 py-3 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: COLORS.paper,
        color: COLORS.obsidian,
        border: `1px solid ${COLORS.hairline}`,
        fontFamily: DISPLAY_FONT,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export function Divider({ children }) {
  return (
    <div className="my-6 flex items-center gap-4">
      <div
        style={{ height: 1, background: COLORS.hairline }}
        className="flex-1"
      />
      <span
        style={{ color: COLORS.ash, fontFamily: CAPTION_FONT }}
        className="text-xs uppercase tracking-wider"
      >
        {children}
      </span>
      <div
        style={{ height: 1, background: COLORS.hairline }}
        className="flex-1"
      />
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-2">
      <span
        style={{ color: COLORS.obsidian, fontFamily: CAPTION_FONT }}
        className="text-xs font-semibold uppercase tracking-wider"
      >
        {label}
      </span>
      {children}
    </div>
  );
}

export const inputStyle = {
  background: COLORS.paper,
  color: COLORS.obsidian,
  border: `1px solid ${COLORS.hairline}`,
  fontFamily: DISPLAY_FONT,
};

// Fonts + shared input focus state. Rendered once by AuthPageShell.
function GlobalAuthStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Inter:wght@400;500;600&display=swap');

      .e2ee-login-input:focus {
        outline: none;
        border-color: ${COLORS.signal} !important;
      }
    `}</style>
  );
}

// Small logo shown at the top of the form column on mobile, where the
// full brand panel is hidden.
function MobileBrandBadge({ label = "E" }) {
  return (
    <div className="mb-8 flex items-center gap-2 md:hidden">
      <div
        style={{
          background: COLORS.signal,
          color: COLORS.obsidian,
          fontFamily: DISPLAY_FONT,
        }}
        className="flex h-8 w-8 items-center justify-center rounded text-sm font-bold"
      >
        {label}
      </div>
      <span
        style={{
          color: COLORS.obsidian,
          fontFamily: DISPLAY_FONT,
        }}
        className="text-lg font-medium"
      >
        E2EE
      </span>
    </div>
  );
}

// The left-hand brand panel: Signal Network animation + logo + tagline +
// tile strip. Tagline/subtext are overridable per page; login's original
// copy is the default so login.jsx needs no props to render unchanged.
export function AuthBrandPanel({
  tagline = "Every message finds its way",
  subtext = "Private, end-to-end encrypted conversations — across every device, every time.",
}) {
  return (
    <div
      style={{
        background: COLORS.obsidian,
        position: "relative",
        overflow: "hidden",
      }}
      className="hidden w-2/5 flex-col justify-between px-12 py-12 md:flex"
    >
      <SignalNetwork />

      <div
        className="flex items-center gap-2"
        style={{ position: "relative" }}
      >
        <img src={E2EELogoSVG} alt="E2EE Logo" className="h-22" />
        <span
          style={{
            color: COLORS.paper,
            fontFamily: DISPLAY_FONT,
          }}
          className="text-lg font-medium"
        >
          E2EE
        </span>
      </div>

      <div
        style={{ position: "relative" }}
        className="flex flex-col items-start gap-6"
      >
        <div>
          <p
            style={{
              color: COLORS.paper,
              fontFamily: DISPLAY_FONT,
              fontSize: "clamp(22px, 2.4vw, 30px)",
              lineHeight: 1.15,
            }}
            className="max-w-sm font-medium"
          >
            {tagline}
          </p>
          <p
            style={{
              color: COLORS.midGray,
              fontFamily: DISPLAY_FONT,
              fontSize: 14,
              lineHeight: 1.5,
            }}
            className="mt-3 max-w-xs"
          >
            {subtext}
          </p>
        </div>
      </div>

      <TileStrip />
    </div>
  );
}

/**
 * The full two-column auth page shell: brand panel on the left (desktop),
 * form column on the right. Every auth page (login, signup, username
 * check, ...) should render its unique content as `children` inside this.
 *
 * `tagline` / `subtext` pass through to AuthBrandPanel so each page can
 * customise the left-panel copy without touching any layout or colour.
 * `mobileLogoLabel` passes through to the small mobile-only badge.
 */
export function AuthPageShell({
  tagline,
  subtext,
  mobileLogoLabel,
  children,
}) {
  return (
    <div style={{ fontFamily: DISPLAY_FONT }} className="flex min-h-screen w-full">
      <GlobalAuthStyles />

      <AuthBrandPanel tagline={tagline} subtext={subtext} />

      {/* Replaced fixed w-3/5 with flex-1 and added fallback text colors */}
      <div
        style={{ background: COLORS.paper || "#ffffff" }}
        className="flex flex-1 flex-col justify-center px-6 py-16 md:px-20 text-slate-900"
      >
        <div className="mx-auto w-full max-w-sm">
          <MobileBrandBadge label={mobileLogoLabel} />
          {children}
        </div>
      </div>
    </div>
  );
}