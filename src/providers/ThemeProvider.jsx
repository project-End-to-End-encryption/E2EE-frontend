import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';

/**
 * The single theme source for the chat surface.
 *
 * Behaviour is lifted verbatim out of the old ChatPage: same localStorage key
 * ('e2ee_theme'), same 'light' default, same write-on-change. Nothing about
 * how the theme looks or persists has changed - it just no longer lives in a
 * component that also has to render a sidebar.
 *
 * The auth pages (login, signup, keys) are intentionally NOT themed: they have
 * their own fixed palette in features/auth/components/sidepanel.jsx and that
 * is a separate design system, not a second theme system.
 */

const STORAGE_KEY = 'e2ee_theme';

export const ThemeContext = createContext(null);

const readStoredTheme = () => {
    try {
        return localStorage.getItem(STORAGE_KEY) || 'light';
    } catch {
        // Private mode / storage disabled. Not fatal, just not remembered.
        return 'light';
    }
};

export default function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(readStoredTheme);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            /* ignore */
        }
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    const toggleTheme = useCallback(() => {
        setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
    }, []);

    const value = useMemo(() => ({
        theme,
        isDark: theme === 'dark',
        setTheme,
        toggleTheme
    }), [theme, toggleTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
