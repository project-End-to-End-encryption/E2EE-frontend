import React, { useEffect, useState } from 'react';
import { Users, User } from 'lucide-react';
import { mediaService } from '../../features/media/mediaService.js';

const PALETTES = [
    ['#2b5ce6', '#1a3fbf'], ['#5b3fd6', '#3f27a8'],
    ['#0a7a96', '#075c73'], ['#7a3fc9', '#5a2a9c'],
    ['#1b64c9', '#0f4a9e'], ['#0f766e', '#0b5650']
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

export default function Avatar({ name = '', seed, src = null, profilePictureKey = null, size = 46, group = false, className = '', children }) {
    const [a1, a2] = PALETTES[hash(String(seed ?? name)) % PALETTES.length];
    const [imageUrl, setImageUrl] = useState(src);

    useEffect(() => {
        let cancelled = false;
        if (profilePictureKey && !src) {
            mediaService.getProfilePictureUrl(profilePictureKey)
                .then((url) => { if (!cancelled) setImageUrl(url); })
                .catch(() => { if (!cancelled) setImageUrl(null); });
        } else if (src) {
            setImageUrl(src);
        }
        return () => { cancelled = true; };
    }, [profilePictureKey, src]);

    return (
        <span
            className={`ec-avatar shrink-0 inline-flex items-center justify-center rounded-full relative overflow-hidden ${group ? 'is-group' : ''} ${className}`}
            style={{
                width: size,
                height: size,
                minWidth: size,
                minHeight: size,
                background: `linear-gradient(135deg, ${a1}, ${a2})`,
                color: '#fff',
                '--size': `${size}px`
            }}
            aria-hidden="true"
        >
            {group ? (
                <Users size={size * 0.5} />
            ) : imageUrl ? (
                <img
                    src={imageUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
            ) : (
                <span style={{ fontSize: size * 0.4, fontWeight: 500 }}>
                    {String(name).trim() ? initialsOf(name) : <User size={size * 0.5} />}
                </span>
            )}
            {children}
        </span>
    );
}