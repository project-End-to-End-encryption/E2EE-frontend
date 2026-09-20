import React from 'react';
import { Users, User } from 'lucide-react';

/**
 * Avatar
 *
 * A photo when there is one, otherwise the person's initials on a colour that
 * is always the same for the same name - so "Rehan" is the same blue in the
 * sidebar, the header and the message thread without anything storing it.
 *
 * Every gradient below keeps white text at 4.5:1 or better.
 *
 * Styles live in features/chats/styles/chat.css (.ec-avatar).
 */
const PALETTES = [
    ['#2b5ce6', '#1a3fbf'],   // sapphire
    ['#5b3fd6', '#3f27a8'],   // indigo
    ['#0a7a96', '#075c73'],   // teal
    ['#7a3fc9', '#5a2a9c'],   // violet
    ['#1b64c9', '#0f4a9e'],   // cobalt
    ['#0f766e', '#0b5650']    // pine
];

const hash = (value) => {
    let h = 0;
    for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
    return h;
};

export const initialsOf = (name = '') => {
    const words = String(name).replace(/^@/, '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

export default function Avatar({ name = '', seed, src = null, size = 46, group = false, className = '', children }) {
    const [a1, a2] = PALETTES[hash(String(seed ?? name)) % PALETTES.length];

    return (
        <span
            className={`ec-avatar ${group ? 'is-group' : ''} ${className}`}
            style={{ '--size': `${size}px`, '--a1': a1, '--a2': a2 }}
            aria-hidden="true"
        >
            {group
                ? <Users />
                : src
                    ? <img src={src} alt="" />
                    : String(name).trim()
                        ? initialsOf(name)
                        : <User />}
            {children}
        </span>
    );
}
