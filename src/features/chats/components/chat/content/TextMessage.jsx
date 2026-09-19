import React from 'react';

/** Plain text body. Whitespace preserved, links left alone for now. */
export default function TextMessage({ text }) {
    if (!text) return null;
    return <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{text}</p>;
}
