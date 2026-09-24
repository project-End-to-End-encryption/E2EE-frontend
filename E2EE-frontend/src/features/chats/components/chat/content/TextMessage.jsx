import React from 'react';

/**
 * Plain text body. Whitespace preserved, links left alone for now.
 *
 * `children` is the timestamp: it sits inside the paragraph so it can float to
 * the end of the last line instead of taking a line of its own.
 */
export default function TextMessage({ text, children = null }) {
    if (!text) return null;
    return (
        <p className="m-0 whitespace-pre-wrap break-words font-normal text-[15px] leading-[1.4] [font-family:var(--font-body)]">
            {text}
            {children}
        </p>
    );
}