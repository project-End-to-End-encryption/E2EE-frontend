import React from 'react';
import { Lock, Phone, Bookmark } from 'lucide-react';

import E2ELogoSVG from '../../../../assets/E2EE.svg';

const PLACEHOLDERS = {
    calls: { Icon: Phone, title: 'Calls are coming soon', text: 'Voice and video calls will show up here.' },
    saved: { Icon: Bookmark, title: 'Saved is coming soon', text: 'Messages you save will show up here.' }
};

/**
 * WelcomeCanvas
 *
 * What the main pane shows when no conversation is open: the same four
 * hand-lettered callouts and logo block as before, on the shared chat wall.
 * The wall itself, and every colour here, come from chat.css - light and dark
 * are the same markup.
 */
export default function WelcomeCanvas({ activeTab = 'chat' }) {
    const mainClass = "relative flex flex-col items-center justify-center flex-1 min-w-0 min-h-0 overflow-hidden border border-[var(--line)] rounded-none max-md:order-2 [.ec-root[data-view=list]_&]:max-md:hidden shadow-[var(--shadow-card)] bg-[var(--canvas)] bg-[linear-gradient(var(--wall-wash),var(--wall-wash)),var(--wall-image)] bg-cover bg-center bg-no-repeat";
    if (activeTab !== 'chat') {
        const { Icon, title, text } = PLACEHOLDERS[activeTab] ?? {
            Icon: Lock, title: 'Nothing here yet', text: 'This section is not available yet.'
        };

        return (
            <main className={mainClass}>
                <div className="flex flex-col items-center justify-center gap-2 p-8 text-center select-none">
                    <span className="inline-grid place-items-center w-[64px] h-[64px] mb-[6px] rounded-full bg-[var(--surface-2)] text-[var(--ink-3)]">
                        <Icon className="w-8 h-8" />
                    </span>
                    <h2 className="m-0 font-semibold text-[17px] leading-[1.2] [font-family:var(--font-display)] text-[var(--ink)]">
                        {title}
                    </h2>
                    <p className="m-0 max-w-[240px] font-normal text-[14.5px] leading-[1.4] [font-family:var(--font-body)] text-[var(--ink-2)]">
                        {text}
                    </p>
                </div>
            </main>
        );
    }

    const calloutBase = "absolute max-md:hidden font-bold text-[12px] leading-[1.3] uppercase tracking-[0.2em] [font-family:var(--font-display)] text-[var(--ink-3)] opacity-40 select-none pointer-events-none";

    return (
        <main className={mainClass}>
            <p className={`${calloutBase} top-[18%] left-[12%] text-left`} aria-hidden="true">Good<br />Conversations<br />Better People</p>
            <p className={`${calloutBase} bottom-[18%] left-[12%] text-left`} aria-hidden="true">Private<br />Today<br />Safer<br />Tomorrow</p>
            <p className={`${calloutBase} top-[22%] right-[12%] text-right`} aria-hidden="true">Ideas<br />Connect<br />People</p>
            <p className={`${calloutBase} bottom-[25%] right-[15%] text-right`} aria-hidden="true">Chat<br />Securely</p>

            <div className="relative z-10 flex flex-col items-center max-w-[340px] p-6 text-center select-none">
                <img src={E2ELogoSVG} alt="" className="w-[88px] h-[88px] mb-5 object-contain drop-shadow-md" />

                <h1 className="m-0 font-bold text-[42px] leading-none tracking-tight [font-family:var(--font-display)] text-[var(--ink)]">
                    E<b className="text-[var(--accent)] font-extrabold not-italic">2</b>EE
                </h1>

                <h3 className="m-0 mt-3 font-bold text-[12px] leading-none tracking-[0.2em] uppercase [font-family:var(--font-body)] text-[var(--ink-2)]">
                    Chat Beyond Limits
                </h3>

                <p className="m-0 mt-5 font-normal text-[15.5px] leading-[1.5] [font-family:var(--font-body)] text-[var(--ink-2)]">
                    Start a new conversation and discover a more connected you.
                </p>

                <span className="inline-flex items-center gap-[8px] mt-8 px-4 py-2 border border-[var(--line-soft)] rounded-full bg-[var(--glass-strong)] font-medium text-[12px] leading-none [font-family:var(--font-body)] text-[var(--ink-3)] backdrop-blur-md">
                    <Lock className="w-[14px] h-[14px]" aria-hidden="true" />
                    Messages are end-to-end encrypted
                </span>
            </div>
        </main>
    );
}