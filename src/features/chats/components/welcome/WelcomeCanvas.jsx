import React from 'react';
import { Lock, Phone, Bookmark } from 'lucide-react';

const PLACEHOLDERS = {
    calls: { Icon: Phone, title: 'Calls are coming soon', text: 'Voice and video calls will show up here.' },
    saved: { Icon: Bookmark, title: 'Saved is coming soon', text: 'Messages you save will show up here.' }
};

export default function WelcomeCanvas({ activeTab = 'chat' }) {
    const forcedBgStyle = {
        backgroundImage: 'var(--wall-image)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
    };

    const mainClass = "relative flex flex-col items-center justify-center flex-1 min-w-0 min-h-0 overflow-hidden border-l border-[var(--line)] max-md:order-2 [.ec-root[data-view=list]_&]:max-md:hidden";

    if (activeTab !== 'chat') {
        const { Icon, title, text } = PLACEHOLDERS[activeTab] ?? {
            Icon: Lock, title: 'Nothing here yet', text: 'This section is not available yet.'
        };

        return (
            <main className={mainClass} style={forcedBgStyle}>
                {/* Box hata diya gaya hai, ab yeh direct background par render hoga */}
                <div className="flex flex-col items-center justify-center gap-3 p-8 text-center select-none bg-transparent">
                    <span className="inline-grid place-items-center w-[64px] h-[64px] mb-[6px] rounded-full bg-white/20 dark:bg-white/10 text-[var(--ink)] shadow-sm">
                        <Icon className="w-8 h-8" />
                    </span>
                    <h2 className="m-0 font-semibold text-[20px] leading-[1.2] [font-family:var(--font-display)] text-[var(--ink)]">
                        {title}
                    </h2>
                    <p className="m-0 max-w-[280px] font-normal text-[15px] leading-[1.4] [font-family:var(--font-body)] text-[var(--ink-2)]">
                        {text}
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className={mainClass} style={forcedBgStyle}>
            {/* Center Text/Logo */}
            <div className="relative z-10 flex flex-col items-center max-w-[340px] p-6 text-center select-none bg-transparent">
                <img 
                    src="/E2EE.svg" 
                    alt="E2EE Logo" 
                    className="w-[88px] h-[88px] mb-5 object-contain drop-shadow-md" 
                />
                <h1 className="m-0 font-bold text-[42px] leading-none tracking-tight [font-family:var(--font-display)] text-[var(--ink)]">
                    E<b className="text-[var(--accent)] font-extrabold not-italic">2</b>EE
                </h1>

                <h3 className="m-0 mt-3 font-bold text-[12px] leading-none tracking-[0.2em] uppercase [font-family:var(--font-body)] text-[var(--ink-2)]">
                    Chat Beyond Limits
                </h3>

                <p className="m-0 mt-5 font-normal text-[15.5px] leading-[1.5] [font-family:var(--font-body)] text-[var(--ink-2)]">
                    Start a new conversation and discover a more connected you.
                </p>

                <span className="inline-flex items-center gap-[8px] mt-8 px-4 py-2 border border-blue-300/40 rounded-full bg-white/30 dark:bg-black/20 font-medium text-[12px] leading-none [font-family:var(--font-body)] text-[var(--ink)] backdrop-blur-sm">
                    <Lock className="w-[14px] h-[14px]" aria-hidden="true" />
                    Messages are end-to-end encrypted
                </span>
            </div>
        </main>
    );
}