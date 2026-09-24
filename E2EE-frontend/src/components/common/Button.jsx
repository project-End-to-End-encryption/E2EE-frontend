import React from "react";
import { COLORS, DISPLAY_FONT } from "../../shared/constants/theme";

export function baseBtnClasses(size) {
    return `inline-flex items-center justify-center gap-2 rounded font-medium transition-all duration-200 hover:-translate-y-0.5 ${
        size === "sm" ? "px-5 py-2.5 text-sm" : "px-6 py-4 text-base"
    }`;
}

export function InversePrimaryButton({ children, size = "md", ...props }) {
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

export function GhostOutlineButton({ children, size = "md", ...props }) {
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