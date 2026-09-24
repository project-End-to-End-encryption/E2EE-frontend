import React, { useMemo } from "react";
import { COLORS, DISPLAY_FONT, CAPTION_FONT } from "../../shared/constants/theme";
import { FEATURES, SECURITY, CREDITS } from "../../shared/constants/homeContent";
import { InversePrimaryButton, baseBtnClasses } from "../../components/common/Button";

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
        [count]
    );
}

function StarCross({ size, color }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z" fill={color} />
        </svg>
    );
}

function ConstellationField({ count = 60 }) {
    const particles = useParticles(count);
    return (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
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

export function Hero({ onSignup }) {
    return (
        <section style={{ background: COLORS.obsidian, position: "relative", overflow: "hidden", minHeight: "86vh" }} className="flex items-center">
            <ConstellationField count={60} />
            <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative" }} className="flex w-full flex-col items-center px-6 py-24 text-center">
                <span style={{ color: COLORS.paper, border: `1px solid ${COLORS.midGray}`, fontFamily: CAPTION_FONT, letterSpacing: "0.08em" }} className="mb-6 rounded px-3 py-1 text-xs font-semibold uppercase">
                    End-to-end encrypted
                </span>
                <h1 style={{ color: COLORS.paper, fontFamily: DISPLAY_FONT, fontSize: "clamp(40px, 7vw, 80px)", lineHeight: 1, letterSpacing: "-0.02em" }} className="max-w-4xl font-medium">
                    Every message finds its way
                </h1>
                <p style={{ color: COLORS.midGray, fontFamily: DISPLAY_FONT, fontSize: 16, lineHeight: 1.5 }} className="mt-6 max-w-xl">
                    E2EE keeps conversations private, instant, and yours alone — across every device, every time.
                </p>
                <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
                    <InversePrimaryButton onClick={onSignup}>Start chatting - Its free!</InversePrimaryButton>
                </div>
            </div>
        </section>
    );
}

export function VisionBand() {
    return (
        <section style={{ background: "#FFFFFF" }} className="py-24">
            <div style={{ maxWidth: 1200, margin: "0 auto" }} className="px-6">
                <h2 style={{ color: "#0F172A", fontFamily: DISPLAY_FONT, fontSize: "clamp(32px, 5vw, 64px)", lineHeight: 1.09 }} className="max-w-2xl font-medium">
                    Our vision for conversation
                </h2>
                <p style={{ color: "#0F172A", fontFamily: DISPLAY_FONT, fontSize: 16, lineHeight: 1.5, maxWidth: 700 }} className="mt-6">
                    We think messaging should feel like talking, not filing paperwork. No ads reading your chats, no data brokers, no dark patterns built to keep you scrolling — just a fast, private line to the people who matter, encrypted from the very first message.
                </p>
            </div>
        </section>
    );
}

export function FeatureBlock() {
    return (
        <section style={{ background: COLORS.obsidian }} className="py-24">
            <div style={{ maxWidth: 1200, margin: "0 auto" }} className="flex flex-col items-center gap-16 px-6 md:flex-row">
                <div className="w-full md:w-3/5">
                    <h2 style={{ color: COLORS.paper, fontFamily: DISPLAY_FONT, fontSize: "clamp(28px, 4vw, 44px)", lineHeight: 1.09 }} className="font-medium">
                        What is E2EE?
                    </h2>
                    <p style={{ color: COLORS.paper, fontFamily: DISPLAY_FONT, fontSize: 16, lineHeight: 1.5 }} className="mt-6 max-w-xl">
                        E2EE is a messaging app built end-to-end encrypted by default. Every text, call, and file transfer is locked before it leaves your device — only the people in the conversation hold the keys to read it. No exceptions, no backdoors.
                    </p>
                </div>
            </div>
        </section>
    );
}

export function FeatureCards() {
    return (
        <section id="features" style={{ background: COLORS.paper }} className="py-24">
            <div style={{ maxWidth: 1200, margin: "0 auto" }} className="px-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {FEATURES.map(({ icon: Icon, title, body }) => (
                        <div key={title} style={{ border: `1px solid ${COLORS.hairline}` }} className="rounded p-8">
                            <Icon size={22} color={COLORS.obsidian} />
                            <h3 style={{ color: COLORS.obsidian, fontFamily: DISPLAY_FONT }} className="mt-4 text-2xl font-medium">
                                {title}
                            </h3>
                            <p style={{ color: "#0F172A", fontFamily: DISPLAY_FONT, lineHeight: 1.5 }} className="mt-2 text-base">
                                {body}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function SecuritySection() {
    return (
        <section id="security" style={{ background: COLORS.obsidian }} className="py-24">
            <div style={{ maxWidth: 1200, margin: "0 auto" }} className="px-6">
                <h2 style={{ color: COLORS.paper, fontFamily: DISPLAY_FONT, fontSize: "clamp(28px, 4vw, 44px)", lineHeight: 1.09 }} className="max-w-2xl font-medium">
                    Security
                </h2>
                <p style={{ color: COLORS.midGray, fontFamily: DISPLAY_FONT, fontSize: 16, lineHeight: 1.5 }} className="mt-6 max-w-xl">
                    Privacy isn't a setting you turn on — it's how E2EE is built, from the moment a message leaves your device to the moment it lands.
                </p>
                <div className="mt-14 grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2">
                    {SECURITY.map(({ icon: Icon, title, body }) => (
                        <div key={title} style={{ borderTop: "1px solid rgba(255, 255, 255, 0.15)" }} className="pt-6">
                            <Icon size={20} color={COLORS.mint} />
                            <h3 style={{ color: COLORS.paper, fontFamily: DISPLAY_FONT }} className="mt-3 text-xl font-medium">
                                {title}
                            </h3>
                            <p style={{ color: COLORS.midGray, fontFamily: DISPLAY_FONT, lineHeight: 1.5 }} className="mt-2 text-base">
                                {body}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function AboutSection() {
    return (
        <section id="about-us" style={{ background: COLORS.paper }} className="py-24">
            <div style={{ maxWidth: 1200, margin: "0 auto" }} className="px-6">
                <h2 style={{ color: COLORS.obsidian, fontFamily: DISPLAY_FONT, fontSize: "clamp(28px, 4vw, 44px)", lineHeight: 1.09 }} className="max-w-2xl font-medium">
                    About us
                </h2>
                <p style={{ color: COLORS.obsidian, fontFamily: DISPLAY_FONT, fontSize: 16, lineHeight: 1.5 }} className="mt-6 max-w-xl">
                    We're a small team building private, honest messaging. Here's who's behind it, and how to reach us.
                </p>
                <div id="credits" className="mt-16 scroll-mt-24">
                    <h3 style={{ color: COLORS.obsidian, fontFamily: DISPLAY_FONT }} className="text-2xl font-medium">Credits</h3>
                    <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
                        {CREDITS.map((person) => (
                            <div key={person.name} style={{ borderTop: `1px solid ${COLORS.hairline}` }} className="pt-4 text-center">
                                <p style={{ color: COLORS.obsidian, fontFamily: DISPLAY_FONT }} className="text-base font-medium">{person.name}</p>
                                <p style={{ color: COLORS.obsidian, fontFamily: DISPLAY_FONT }} className="mt-1 text-sm opacity-80">{person.role}</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div id="contact-us" className="mt-20 scroll-mt-24">
                    <h3 style={{ color: COLORS.obsidian, fontFamily: DISPLAY_FONT }} className="text-2xl font-medium">Contact us / Report</h3>
                    <p style={{ color: COLORS.obsidian, fontFamily: DISPLAY_FONT, lineHeight: 1.5 }} className="mt-4 max-w-xl text-base">
                        Questions, feedback, or something that needs flagging — pick whichever fits.
                    </p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <a href="mailto:hello@e2ee.example" className={baseBtnClasses("sm")} style={{ background: COLORS.obsidian, color: COLORS.paper, fontFamily: DISPLAY_FONT }}>
                            Email us
                        </a>
                        <a href="https://docs.google.com/forms/d/e/1FAIpQLScwLv87RbjTl6-zsoK7Rijp4abEjoEjYOcD0I_rIunUTLK0LQ/viewform" target="_blank" rel="noopener noreferrer" className={baseBtnClasses("sm")} style={{ background: "transparent", color: COLORS.obsidian, border: `1px solid ${COLORS.obsidian}`, fontFamily: DISPLAY_FONT }}>
                            Report an issue
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}