import { useEffect, useState } from 'react';

/**
 * Hold a value still for `delay` ms.
 *
 * 300ms is the middle of the 250-400ms window the brief asks for: long enough
 * that a normal typist produces one request per word rather than one per
 * keystroke, short enough that the results feel live.
 */
export function useDebouncedValue(value, delay = 300) {
    const [settled, setSettled] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setSettled(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return settled;
}

export default useDebouncedValue;
