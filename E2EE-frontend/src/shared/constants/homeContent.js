import { Lock, Zap, Users, ShieldCheck, EyeOff, Fingerprint, KeyRound, Database, Wifi, UserX, Timer } from "lucide-react";

export const CREDITS = [
    { name: "Suraj Roy", role: "Front-end" },
    { name: "SK Saqib", role: "UI/UX Designer" },
    { name: "Vivek Anand Shaw", role: "Back-end" },
    { name: "Suryaayan Ghosh", role: "Artificial Intelligence/GenAI" },
];

export const NAV_LINKS = [
    { name: "Features", href: "#features" },
    { name: "Security", href: "#security" },
    {
        name: "About us",
        href: "#about-us",
        dropdown: [
            {
                name: "Credits",
                href: "#credits",
                onClick: () => document.getElementById("credits")?.scrollIntoView({ behavior: "smooth" }),
            },
            {
                name: "Contact us / Report",
                href: "#contact-us",
                onClick: () => document.getElementById("contact-us")?.scrollIntoView({ behavior: "smooth" }),
            },
        ],
    },
];

export const FEATURES = [
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

export const SECURITY = [
    {
        icon: ShieldCheck,
        title: "End-to-end encryption",
        body: "Messages are encrypted on the sender's device and decrypted only on the recipient's device.",
    },
    {
        icon: EyeOff,
        title: "Zero-knowledge server",
        body: "The server handles encrypted data and never has access to plaintext messages or private encryption keys.",
    },
    {
        icon: Fingerprint,
        title: "Secure authentication",
        body: "Session-based device tracking pairs short-lived access tokens with secure refresh-token management.",
    },
    {
        icon: KeyRound,
        title: "Secure key management",
        body: "Private encryption keys stay on the user's device — only the public key needed to reach you is shared with the server.",
    },
    {
        icon: Database,
        title: "Encrypted storage",
        body: "Messages held for a recipient who is offline remain encrypted for the entire time they're waiting.",
    },
    {
        icon: Wifi,
        title: "Secure WebSocket communication",
        body: "Real-time messages travel over authenticated, encrypted WebSocket connections.",
    },
    {
        icon: UserX,
        title: "Minimal user data",
        body: "Signing up is designed to avoid requiring a phone number or an email address.",
    },
    {
        icon: Timer,
        title: "Temporary data protection",
        body: "Redis holds only short-lived WebSocket state and handshake data, with automatic expiration where appropriate.",
    },
];