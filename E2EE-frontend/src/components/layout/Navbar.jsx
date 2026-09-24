import React, { useState, useEffect } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import E2EELogoSVG from "../../assets/E2EE.svg";
import { COLORS, DISPLAY_FONT } from "../../shared/constants/theme";
import { NAV_LINKS } from "../../shared/constants/homeContent";
import { InversePrimaryButton, GhostOutlineButton } from "../common/Button";

export default function Navbar({ onSignup, onLogin }) {
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const authButtons = (
        <>
            <GhostOutlineButton size="sm" onClick={onLogin}>Log in</GhostOutlineButton>
            <InversePrimaryButton size="sm" onClick={onSignup}>Sign up</InversePrimaryButton>
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
                borderBottom: scrolled ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid transparent",
                transition: "all 0.3s ease",
            }}
        >
            <div style={{ maxWidth: 1200, margin: "0 auto" }} className="flex h-20 items-center justify-between px-6">
                <div
                    onClick={() => {
                        document.body.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="flex items-center gap-2 cursor-pointer"
                >
                    <img src={E2EELogoSVG} alt="E2EE Logo" className="h-22" />
                    <span style={{ color: COLORS.paper, fontFamily: DISPLAY_FONT }} className="text-lg font-medium">E2EE</span>
                </div>

                <nav className="hidden items-center gap-8 md:flex">
                    {NAV_LINKS.map((item) => (
                        <div
                            key={item.name}
                            className="relative group"
                            onMouseEnter={() => setActiveDropdown(item.name)}
                            onMouseLeave={() => setActiveDropdown(null)}
                        >
                            <a href={item.href} style={{ color: COLORS.paper, fontFamily: DISPLAY_FONT }} className="flex items-center gap-1 text-base hover:opacity-80 py-2">
                                {item.name} <ChevronDown size={14} />
                            </a>
                            {item.dropdown && activeDropdown === item.name && (
                                <div
                                    className="absolute left-0 top-full rounded py-2 shadow-lg min-w-[180px]"
                                    style={{ backgroundColor: COLORS.obsidian, border: "1px solid rgba(255, 255, 255, 0.15)" }}
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
                <div className="hidden items-center gap-3 md:flex">{authButtons}</div>

                <button aria-label="Toggle menu" onClick={() => setOpen(!open)} style={{ color: COLORS.paper }} className="md:hidden">
                    {open ? <X size={22} /> : <Menu size={22} />}
                </button>
            </div>

            {open && (
                <div className="flex flex-col gap-4 px-6 pb-6 md:hidden" style={{ background: COLORS.obsidian }}>
                    {NAV_LINKS.map((item) => (
                        <div key={item.name} className="flex flex-col gap-2">
                            <a href={item.href} onClick={() => !item.dropdown && setOpen(false)} style={{ color: COLORS.paper, fontFamily: DISPLAY_FONT }} className="text-base font-medium">
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