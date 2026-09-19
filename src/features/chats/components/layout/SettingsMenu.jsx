import React from 'react';
import { Sun, Moon, ChevronRight, ArrowLeft, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../../providers/useTheme.js';

/**
 * The settings popover, lifted out of ChatPage with both of its views intact.
 * One addition: a route into the encryption-keys page. That is a real
 * destination, not a placeholder control.
 */
export default function SettingsMenu({ view, onViewChange, onClose }) {
    const { isDark, setTheme } = useTheme();
    const navigate = useNavigate();

    return (
        <div className={`absolute left-12 bottom-0 w-48 rounded-xl shadow-2xl p-2 z-50 border ${
            isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
        }`}>
            {view === 'main' ? (
                <div>
                    <p className="text-[10px] font-bold px-2 py-1 text-slate-400 uppercase tracking-wider">Settings</p>

                    <button
                        onClick={() => onViewChange('theme')}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                            isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            {isDark ? <Moon className="w-3.5 h-3.5 text-cyan-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
                            <span>Theme</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    <button
                        onClick={() => { onClose?.(); navigate('/keys'); }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                            isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Encryption keys</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                </div>
            ) : (
                <div>
                    <div className="flex items-center gap-1 px-1 pb-1 mb-1 border-b border-slate-700/50">
                        <button
                            onClick={() => onViewChange('main')}
                            className={`p-1 rounded-md hover:bg-slate-700/50 transition-colors ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Theme</p>
                    </div>

                    <button
                        onClick={() => { setTheme('light'); onClose?.(); }}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold ${
                            !isDark ? 'bg-[#b2d1f8]/40 text-[#0a1968]' : 'hover:bg-slate-700 text-slate-300'
                        }`}
                    >
                        <Sun className="w-3.5 h-3.5 text-amber-500" /> Light
                    </button>

                    <button
                        onClick={() => { setTheme('dark'); onClose?.(); }}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold ${
                            isDark ? 'bg-slate-700 text-cyan-400' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                    >
                        <Moon className="w-3.5 h-3.5 text-cyan-400" /> Dark
                    </button>
                </div>
            )}
        </div>
    );
}
