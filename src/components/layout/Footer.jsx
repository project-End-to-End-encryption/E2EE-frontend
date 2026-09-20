import React from "react";
import E2EELogoSVG from "../../assets/E2EE.svg";
import { COLORS, DISPLAY_FONT, CAPTION_FONT } from "../../shared/constants/theme";

export default function Footer() {
    const links = [
        { name: "Features", href: "#features" },
        { name: "Security", href: "#security" },
        { name: "About", href: "#about-us" },
    ];

    const handleScroll = (e, href) => {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
            target.scrollIntoView({ behavior: "smooth" });
        }
    };

    return (
        <footer style={{ background: COLORS.obsidian, position: "relative", overflow: "hidden" }} className="pb-10 pt-16">
            <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative" }} className="px-6">
                <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <img src={E2EELogoSVG} alt="E2EE Logo" className="h-16 w-16" />
                            <span style={{ color: COLORS.paper, fontFamily: DISPLAY_FONT }} className="text-lg font-medium">E2EE</span>
                        </div>
                        <p style={{ color: COLORS.midGray, fontFamily: DISPLAY_FONT }} className="mt-4 max-w-xs text-sm">
                            Private messaging, built for real conversation.
                        </p>
                    </div>

                    <ul className="flex items-center gap-8">
                        {links.map((link) => (
                            <li key={link.name}>
                                <a
                                    href={link.href}
                                    onClick={(e) => handleScroll(e, link.href)}
                                    style={{ color: COLORS.midGray, fontFamily: DISPLAY_FONT }}
                                    className="text-sm hover:text-white transition-colors cursor-pointer"
                                >
                                    {link.name}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>

                <div style={{ borderTop: "1px solid #1f1f1f" }} className="mt-12 flex flex-col gap-4 pt-6 md:flex-row md:justify-between">
                    <span style={{ color: COLORS.midGray, fontFamily: CAPTION_FONT }} className="text-xs">
                        © 2026 E2EE. All rights reserved.
                    </span>
                </div>
            </div>
        </footer>
    );
}