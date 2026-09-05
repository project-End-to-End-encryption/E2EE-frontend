import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; 
import { Lock, Zap, Users, ChevronDown, Menu, X } from "lucide-react";
import E2EELogoSVG from "../assets/E2EE.svg";


const COLORS = {
  obsidian: "#3d02b3",
  paper: "#ffffff",
  hairline: "#e5e7eb",
  midGray: "#fcfcfc",
  warmBone: "#f2f1e9",
  ash: "#acaba6",
  signal: "#a5cbfa",
  mint: "#c7f5d8",
  teal: "#EFEEEA",
};

const DISPLAY_FONT =
  "'Space Grotesk', ui-sans-serif, system-ui, -apple-system, sans-serif";
const CAPTION_FONT =
  "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

const NAV_LINKS = [
  { name: "Features", href: "#features" },
  { name: "Security", href: "#security" },
  {
    name: "About us",
    href: "#about-us",
    dropdown: [
      {
        name: "Credits",
        href: "#credits",
        onClick: () => {
          const el = document.getElementById("credits");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        },
      },
      {
        name: "Contact us / Report",
        href: "#contact-us",
        onClick: () => {
          const el = document.getElementById("contact-us");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        },
      },
    ],
  },
];

const FEATURES = [
  {
    icon: Lock,
    title: "End-to-end encrypted",
    body: "Every conversation is locked with keys only your devices hold — not even E2EE can read them.",
  },
  {
    icon: Zap,
    title: "Instant everywhere",
    body: "Messages land in real time across phone, desktop, and web, always in sync.",
  },
  {
    icon: Users,
    title: "Group channels",
    body: "Bring a crew together in channels built for real conversation, not noise.",
  },
];

function useParticles(count) {
  return useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: 6 + Math.random() * 9,
        delay: Math.random() * 5,
        duration: 2.6 + Math.random() * 3,
        teal: Math.random() > 0.85,
      })),
    [count],
  );
}

function StarCross({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z"
        fill={color}
      />
    </svg>
  );
}

function ConstellationField({ count = 60 }) {
  const particles = useParticles(count);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {particles.map((p) => {
        const glowColor = p.teal ? COLORS.teal : COLORS.signal;
        return (
          <div
            key={p.id}
            className="E2EE-twinkle"
            style={{
              position: "absolute",
              top: `${p.top}%`,
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              // Multiple drop-shadows layering for intense glow effect
              filter: `drop-shadow(0 0 4px ${glowColor}) drop-shadow(0 0 12px ${glowColor}) drop-shadow(0 0 20px #ffffff)`,
            }}
          >
            <StarCross size={p.size} color={glowColor} />
          </div>
        );
      })}
    </div>
  );
}


function baseBtnClasses(size) {
  return `inline-flex items-center justify-center gap-2 rounded font-medium transition-all duration-200 hover:-translate-y-0.5 ${
    size === "sm" ? "px-5 py-2.5 text-sm" : "px-6 py-4 text-base"
  }`;
}


function InversePrimaryButton({ children, size = "md", ...props }) {
  return (
    <button
      {...props}
      className={baseBtnClasses(size)}
      style={{
        background: COLORS.paper,
        color: COLORS.obsidian,
        fontFamily: DISPLAY_FONT,
      }}
    >
      {children}
    </button>
  );
}

function GhostOutlineButton({ children, size = "md", ...props }) {
  return (
    <button
      {...props}
      className={baseBtnClasses(size)}
      style={{
        background: "transparent",
        color: COLORS.paper,
        border: `1px solid ${COLORS.paper}`,
        fontFamily: DISPLAY_FONT,
      }}
    >
      {children}
    </button>
  );
}

function TilePattern({ opacity = 1, small = false }) {
  const cols = 10;
  const rows = small ? 2 : 3;
  const cells = Array.from({ length: cols * rows });
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, opacity }}
    >
      {cells.map((_, i) => {
        const row = Math.floor(i / cols);
        const isGreen = (row + i) % 2 === 0;
        return (
          <div
            key={i}
            className="E2EE-tile flex items-center justify-center py-4 md:py-6"
            style={{
              color: isGreen ? COLORS.signal : COLORS.paper,
              fontFamily: DISPLAY_FONT,
              fontSize: small
                ? "clamp(14px, 2vw, 20px)"
                : "clamp(20px, 3vw, 34px)",
            }}
          >
            HI
          </div>
        );
      })}
    </div>
  );
}

function Nav({ onSignup, onLogin }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const authButtons = (
    <>
      <GhostOutlineButton size="sm" onClick={onLogin}>
        Log in
      </GhostOutlineButton>
      <InversePrimaryButton size="sm" onClick={onSignup}>
        Sign up
      </InversePrimaryButton>
    </>
  );

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: scrolled ? "rgba(0, 0, 0, 0.7)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled
          ? "1px solid rgba(255, 255, 255, 0.08)"
          : "1px solid transparent",
        transition: "all 0.3s ease",
      }}
    >
      <div
        style={{ maxWidth: 1200, margin: "0 auto" }}
        className="flex h-16 items-center justify-between px-6"
      >
        {/* Scroll function */}
        <div
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-2 cursor-pointer"
        >
          <img src={E2EELogoSVG} alt="E2EE Logo" className="h-22" />
          <span
            style={{ color: COLORS.paper, fontFamily: DISPLAY_FONT }}
            className="text-lg font-medium"
          >
            E2EE
          </span>
        </div>

        {/* Desktop Links */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((item) => (
            <div
              key={item.name}
              className="relative group"
              onMouseEnter={() => setActiveDropdown(item.name)}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <a
                href={item.href}
                style={{ color: COLORS.paper, fontFamily: DISPLAY_FONT }}
                className="flex items-center gap-1 text-base hover:opacity-80 py-2"
              >
                {item.name}
                <ChevronDown size={14} />
              </a>

              {/* Dropdown Menu */}
              {item.dropdown && activeDropdown === item.name && (
                <div
                  className="absolute left-0 top-full rounded py-2 shadow-lg min-w-[180px]"
                  style={{
                    backgroundColor: COLORS.obsidian,
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                  }}
                >
                  {item.dropdown.map((subItem) => (
                    <a
                      key={subItem.name}
                      href={subItem.href}
                      onClick={(e) => {
                        if (subItem.onClick) {
                          e.preventDefault();
                          subItem.onClick();
                        }
                      }}
                      style={{ color: COLORS.paper, fontFamily: DISPLAY_FONT }}
                      className="block px-4 py-2 text-sm hover:bg-white/10 transition-colors"
                    >
                      {subItem.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        {/* Desktop Auth */}
        <div className="hidden items-center gap-3 md:flex">{authButtons}</div>

        {/* Mobile Toggle */}
        <button
          aria-label="Toggle menu"
          onClick={() => setOpen((o) => !o)}
          style={{ color: COLORS.paper }}
          className="md:hidden"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {open && (
        <div
          className="flex flex-col gap-4 px-6 pb-6 md:hidden"
          style={{ background: COLORS.obsidian }}
        >
          {NAV_LINKS.map((item) => (
            <div key={item.name} className="flex flex-col gap-2">
              <a
                href={item.href}
                onClick={() => !item.dropdown && setOpen(false)}
                style={{ color: COLORS.paper, fontFamily: DISPLAY_FONT }}
                className="text-base font-medium"
              >
                {item.name}
              </a>
              {item.dropdown && (
                <div className="pl-4 flex flex-col gap-2 border-l border-white/20">
                  {item.dropdown.map((subItem) => (
                    <a
                      key={subItem.name}
                      href={subItem.href}
                      onClick={(e) => {
                        setOpen(false);
                        if (subItem.onClick) {
                          e.preventDefault();
                          subItem.onClick();
                        }
                      }}
                      style={{ color: COLORS.midGray, fontFamily: DISPLAY_FONT }}
                      className="text-sm"
                    >
                      {subItem.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="mt-2 flex gap-3">{authButtons}</div>
        </div>
      )}
    </header>
  );
}
function Hero({ onSignup, onLogin }) {
  return (
    <section
      style={{
        background: COLORS.obsidian,
        position: "relative",
        overflow: "hidden",
        minHeight: "86vh",
      }}
      className="flex items-center"
    >
      <ConstellationField count={60} />
      <div
        style={{ maxWidth: 1200, margin: "0 auto", position: "relative" }}
        className="flex w-full flex-col items-center px-6 py-24 text-center"
      >
        <span
          style={{
            color: COLORS.paper,
            border: `1px solid ${COLORS.midGray}`,
            fontFamily: CAPTION_FONT,
            letterSpacing: "0.08em",
          }}
          className="mb-6 rounded px-3 py-1 text-xs font-semibold uppercase"
        >
          End-to-end encrypted
        </span>
        <h1
          style={{
            color: COLORS.paper,
            fontFamily: DISPLAY_FONT,
            fontSize: "clamp(40px, 7vw, 80px)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
          className="max-w-4xl font-medium"
        >
          Every message finds its way
        </h1>
        <p
          style={{
            color: COLORS.midGray,
            fontFamily: DISPLAY_FONT,
            fontSize: 16,
            lineHeight: 1.5,
          }}
          className="mt-6 max-w-xl"
        >
          E2EE keeps conversations private, instant, and yours alone — across
          every device, every time.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
          <InversePrimaryButton onClick={onSignup}>
            Start chatting - Its free!
          </InversePrimaryButton>
        </div>
      </div>
    </section>
  );
}

function VisionBand() {
  return (
    <section style={{ background: "#FFFFFF" }} className="py-24">
      <div style={{ maxWidth: 1200, margin: "0 auto" }} className="px-6">
        <h2
          style={{
            color: "#0F172A",
            fontFamily: DISPLAY_FONT,
            fontSize: "clamp(32px, 5vw, 64px)",
            lineHeight: 1.09,
          }}
          className="max-w-2xl font-medium"
        >
          Our vision for conversation
        </h2>
        <p
          style={{
            color: "#0F172A",
            fontFamily: DISPLAY_FONT,
            fontSize: 16,
            lineHeight: 1.5,
            maxWidth: 700,
          }}
          className="mt-6"
        >
          We think messaging should feel like talking, not filing paperwork. No
          ads reading your chats, no data brokers, no dark patterns built to
          keep you scrolling — just a fast, private line to the people who
          matter, encrypted from the very first message.
        </p>
      </div>
    </section>
  );
}

function FeatureBlock() {
  return (
    <section style={{ background: COLORS.obsidian }} className="py-24">
      <div
        style={{ maxWidth: 1200, margin: "0 auto" }}
        className="flex flex-col items-center gap-16 px-6 md:flex-row"
      >
        <div className="w-full md:w-3/5">
          <h2
            style={{
              color: COLORS.paper,
              fontFamily: DISPLAY_FONT,
              fontSize: "clamp(28px, 4vw, 44px)",
              lineHeight: 1.09,
            }}
            className="font-medium"
          >
            What is E2EE?
          </h2>
          <p
            style={{
              color: COLORS.paper,
              fontFamily: DISPLAY_FONT,
              fontSize: 16,
              lineHeight: 1.5,
            }}
            className="mt-6 max-w-xl"
          >
            E2EE is a messaging app built end-to-end encrypted by default. Every
            text, call, and file transfer is locked before it leaves your device
            — only the people in the conversation hold the keys to read it. No
            exceptions, no backdoors.
          </p>
        </div>
      </div>
    </section>
  );
}

function FeatureCards({ onSignup }) {
  return (
    <section
      id="features"
      style={{ background: COLORS.paper }}
      className="py-24"
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }} className="px-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              style={{ border: `1px solid ${COLORS.hairline}` }}
              className="rounded p-8"
            >
              <Icon size={22} color={COLORS.obsidian} />
              <h3
                style={{ color: COLORS.obsidian, fontFamily: DISPLAY_FONT }}
                className="mt-4 text-2xl font-medium"
              >
                {title}
              </h3>
              <p
                style={{
                  color: "#0F172A",
                  fontFamily: DISPLAY_FONT,
                  lineHeight: 1.5,
                }}
                className="mt-2 text-base"
              >
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
function TextTileBand() {
  return (
    <section
      style={{ background: COLORS.obsidian }}
      className="overflow-hidden py-16"
    >
      <TilePattern />
    </section>
  );
}

function Footer() {
  const links = [
    { name: "Features", href: "#features" },
    { name: "Security", href: "#security" },
    { name: "About", href: "#about" },
  ];

  const handleScroll = (e, href) => {
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer
      style={{
        background: COLORS.obsidian,
        position: "relative",
        overflow: "hidden",
      }}
      className="pb-10 pt-16"
    >
      <div style={{ position: "absolute", inset: 0, opacity: 0.05 }}>
        <TilePattern small />
      </div>
      <div
        style={{ maxWidth: 1200, margin: "0 auto", position: "relative" }}
        className="px-6"
      >
        <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <img src={E2EELogoSVG} alt="E2EE Logo" className="h-16 w-16" />
              <span
                style={{ color: COLORS.paper, fontFamily: DISPLAY_FONT }}
                className="text-lg font-medium"
              >
                E2EE
              </span>
            </div>
            <p
              style={{ color: COLORS.midGray, fontFamily: DISPLAY_FONT }}
              className="mt-4 max-w-xs text-sm"
            >
              Private messaging, built for real conversation.
            </p>
          </div>

          {/* Direct Horizontal Links */}
          <ul className="flex items-center gap-8">
            {links.map((link) => (
              <li key={link.name}>
                <a
                  href={link.href}
                  onClick={(e) => handleScroll(e, link.href)}
                  style={{
                    color: COLORS.midGray,
                    fontFamily: DISPLAY_FONT,
                  }}
                  className="text-sm hover:text-white transition-colors cursor-pointer"
                >
                  {link.name}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div
          style={{ borderTop: "1px solid #1f1f1f" }}
          className="mt-12 flex flex-col gap-4 pt-6 md:flex-row md:justify-between"
        >
          <span
            style={{ color: COLORS.midGray, fontFamily: CAPTION_FONT }}
            className="text-xs"
          >
            © 2026 E2EE. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}

export default function E2EEHomepage() {
  const navigate = useNavigate(); // <-- Hook call karo

  // Eraser planning ke exact routes:
  const handleSignup = () => navigate("/signup/username");
  const handleLogin = () => navigate("/login");

  return (
    <div style={{ fontFamily: DISPLAY_FONT }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Inter:wght@400;500;600&display=swap');

        html {
          scroll-behavior: smooth;
        }

        @keyframes E2EE-twinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.75) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.15) rotate(8deg); }
        }
        @keyframes E2EE-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-14px) rotate(3deg); }
        }
        .E2EE-twinkle {
          animation-name: E2EE-twinkle;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
        }
        .E2EE-tile { transition: transform 0.2s ease; }
        .E2EE-tile:hover { transform: scale(1.18); }

        @media (prefers-reduced-motion: reduce) {
          .E2EE-twinkle, [style*="wisp-float"] { animation: none !important; }
        }
      `}</style>
      <Nav onSignup={handleSignup} onLogin={handleLogin} />
      <Hero onSignup={handleSignup} onLogin={handleLogin} />
      <VisionBand />
      <FeatureBlock />
      <FeatureCards onSignup={handleSignup} />
      <TextTileBand />
      <Footer />
    </div>
  );
}