import React from 'react';
import { useTheme } from '../../../../providers/useTheme.js';

import E2ELogoSVG from '../../../../assets/E2EE.svg';
import chatBg from '../../../../assets/chat bg.png';
import chatBgDark from '../../../../assets/chatBgDark.png';

/**
 * WelcomeCanvas
 *
 * Moved out of ChatPage unchanged. Same Caveat hero, same four rotated
 * callouts at the same percentages and rotations, same background images,
 * same logo block, same placeholder branch for the non-chat tabs.
 *
 * This is a structural extraction, not a redesign - the only edit is that
 * `isDark` now comes from useTheme() instead of living in a 283-line
 * component that also had to render a sidebar.
 */
export default function WelcomeCanvas({ activeTab = 'chat' }) {
    const { isDark } = useTheme();

    return (
        <main
            className={`flex-1 relative flex flex-col items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat rounded-2xl shadow-sm transition-colors duration-300 ${
                isDark ? 'border border-slate-800' : 'border border-[#b2d1f8]/40'
            }`}
            style={{ backgroundImage: `url(${isDark ? chatBgDark : chatBg})` }}
        >
            <style>
                {`@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap');`}
            </style>

            {activeTab === 'chat' ? (
                <>
                    <div className={`absolute top-[7%] left-[5%] -rotate-12 text-center z-20 flex flex-col items-center`} style={{ fontFamily: "'Caveat', cursive" }}>
                        <p className={`text-3xl font-bold leading-none drop-shadow-sm ${isDark ? 'text-indigo-300 opacity-80' : 'text-[#3d02b3]'}`}>
                            Good<br />Conversations<br />Better People
                        </p>
                        <div className={`w-16 h-1 mt-1.5 rounded-full opacity-80 ${isDark ? 'bg-indigo-400' : 'bg-[#3d02b3]'}`} />
                    </div>

                    <div className={`absolute bottom-[8%] left-[14%] -rotate-12 text-center z-20 flex flex-col items-center`} style={{ fontFamily: "'Caveat', cursive" }}>
                        <p className={`text-3xl font-bold leading-none drop-shadow-sm ${isDark ? 'text-indigo-300 opacity-80' : 'text-[#3d02b3]'}`}>
                            Private<br />Today<br />Safer<br />Tomorrow
                        </p>
                        <div className={`w-20 h-1 mt-1.5 rounded-full opacity-90 ${isDark ? 'bg-indigo-400' : 'bg-[#3d02b3]'}`} />
                    </div>

                    <div className={`absolute top-[10%] right-[6%] rotate-6 text-center z-20`} style={{ fontFamily: "'Caveat', cursive" }}>
                        <p className={`text-3xl font-bold leading-none drop-shadow-sm ${isDark ? 'text-indigo-300 opacity-80' : 'text-[#3d02b3]'}`}>
                            Ideas<br />Connect<br />People
                        </p>
                        <div className={`w-16 h-1 mx-auto mt-1 rounded-full opacity-80 ${isDark ? 'bg-indigo-400' : 'bg-[#3d02b3]'}`} />
                    </div>

                    <div className={`absolute bottom-[10%] right-[14%] rotate-[10deg] text-center z-20 flex flex-col items-center`} style={{ fontFamily: "'Caveat', cursive" }}>
                        <p className={`text-3xl font-bold leading-none drop-shadow-sm ${isDark ? 'text-indigo-300 opacity-80' : 'text-[#3d02b3]'}`}>
                            Chat<br />Securely
                        </p>
                        <div className={`w-16 h-1 mt-1.5 rounded-full opacity-80 ${isDark ? 'bg-indigo-400' : 'bg-[#3d02b3]'}`} />
                    </div>

                    <div className="text-center z-20 flex flex-col items-center max-w-sm px-4">
                        <img src={E2ELogoSVG} alt="E2EE Main Logo" className="w-36 h-36 object-contain" />
                        <h1 className="text-6xl font-black tracking-wide leading-none -mt-6 drop-shadow-sm flex items-center justify-center">
                            <span className={isDark ? 'text-white' : 'text-[#0a1968]'}>E</span>
                            <span className="text-[#00a8cc]">2</span>
                            <span className={isDark ? 'text-white' : 'text-[#0a1968]'}>EE</span>
                        </h1>
                        <h3 className={`text-xl font-bold mt-3 mb-1.5 tracking-wide ${isDark ? 'text-slate-200' : 'text-[#0a1968]'}`}>
                            Chat Beyond Limits
                        </h3>
                        <p className={`text-sm max-w-[280px] leading-relaxed font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Start a new conversation and discover a more connected you.
                        </p>
                    </div>
                </>
            ) : (
                <div className="text-center z-20">
                    <h1 className="text-4xl font-bold capitalize">{activeTab} Section</h1>
                    <p className={`text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Content for {activeTab} will appear here.
                    </p>
                </div>
            )}
        </main>
    );
}
