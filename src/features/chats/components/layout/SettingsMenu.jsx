import React from 'react';
import { Sun, Moon, ChevronRight, ArrowLeft, KeyRound, User, Camera, FileText, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../../providers/useTheme.js';
import { useSelf } from '../../hooks/useSelf.js';
import {useLogout} from "../../hooks/useLogout.js";

export default function SettingsMenu({ view, onViewChange, onClose }) {
    const { isDark, setTheme } = useTheme();
    const navigate = useNavigate();
    const { profile } = useSelf();

    if (view === 'theme') {
        return (
            <div className="absolute left-[calc(100%+8px)] bottom-3 z-50 w-[260px] p-[6px] border border-[var(--line)] rounded-[18px] bg-[var(--surface)] shadow-[var(--shadow-menu)]">
                <div className="flex items-center gap-2 px-2 pt-1 pb-2 mb-1 border-b border-[var(--line)]">
                    <button type="button" onClick={() => onViewChange('main')} className="w-[28px] h-[28px] rounded-full bg-transparent"><ArrowLeft className="w-4 h-4" /></button>
                    <p className="font-semibold text-[13.5px]">Theme</p>
                </div>
                <button type="button" className={`flex items-center gap-[10px] w-full p-[10px] rounded-[12px] ${!isDark ? 'bg-[var(--surface-3)]' : ''}`} onClick={() => { setTheme('light'); onClose?.(); }}>
                    <Sun className="w-[17px] h-[17px]" />Light
                </button>
                <button type="button" className={`flex items-center gap-[10px] w-full p-[10px] rounded-[12px] ${isDark ? 'bg-[var(--surface-3)]' : ''}`} onClick={() => { setTheme('dark'); onClose?.(); }}>
                    <Moon className="w-[17px] h-[17px]" />Dark
                </button>
            </div>
        );
    }

    if (view === 'profile') {
        return (
            <div className="absolute left-[calc(100%+8px)] bottom-3 z-50 w-[280px] p-[6px] border border-[var(--line)] rounded-[18px] bg-[var(--surface)] shadow-[var(--shadow-menu)]">
                <div className="flex items-center gap-2 px-2 pt-1 pb-2 mb-1 border-b border-[var(--line)]">
                    <button type="button" onClick={() => onViewChange('main')}><ArrowLeft className="w-4 h-4" /></button>
                    <p className="font-semibold text-[13.5px]">Profile</p>
                </div>
                <div className="flex flex-col items-center gap-3 p-4 border-b border-[var(--line)]">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-full bg-[var(--surface-3)] flex items-center justify-center"><User className="w-10 h-10" /></div>
                        <button type="button" className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center border-2 border-[var(--surface)]"><Camera className="w-4 h-4" /></button>
                    </div>
                    <div className="text-center">
                        <p className="font-semibold text-[15px]">{profile?.fullName || 'Your Name'}</p>
                        <p className="text-[13px] text-[var(--ink-2)]">@{profile?.username || 'username'}</p>
                    </div>
                </div>
                <button type="button" className="flex items-center gap-[10px] w-full p-[10px] rounded-[12px] hover:bg-[var(--surface-2)]"><FileText className="w-[17px] h-[17px]" />Change bio</button>
                <button type="button" className="flex items-center gap-[10px] w-full p-[10px] rounded-[12px] hover:bg-[var(--surface-2)]"><Camera className="w-[17px] h-[17px]" />Change profile picture</button>
            </div>
        );
    }

    return (
        <div className="absolute left-[calc(100%+8px)] bottom-3 z-50 w-[240px] p-[6px] border border-[var(--line)] rounded-[18px] bg-[var(--surface)] shadow-[var(--shadow-menu)]">
            <div className="flex items-center gap-3 px-3 py-3 mb-1 border-b border-[var(--line)]">
                <div className="w-10 h-10 rounded-full bg-[var(--surface-3)] flex items-center justify-center"><User className="w-5 h-5" /></div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[14px] truncate">{profile?.fullName || 'Your Name'}</p>
                    <p className="text-[12px] text-[var(--ink-2)] truncate">@{profile?.username || 'username'}</p>
                </div>
            </div>
            <button type="button" className="flex items-center justify-between w-full p-[10px] rounded-[12px] hover:bg-[var(--surface-2)]" onClick={() => onViewChange('profile')}>
                <span className="flex items-center gap-[10px]"><User className="w-[17px] h-[17px]" />Profile</span><ChevronRight className="w-[16px] h-[16px]" />
            </button>
            <button type="button" className="flex items-center justify-between w-full p-[10px] rounded-[12px] hover:bg-[var(--surface-2)]" onClick={() => onViewChange('theme')}>
                <span className="flex items-center gap-[10px]">{isDark ? <Moon /> : <Sun />}Theme</span><ChevronRight className="w-[16px] h-[16px]" />
            </button>
            <button type="button" className="flex items-center justify-between w-full p-[10px] rounded-[12px] hover:bg-[var(--surface-2)]" onClick={() => { onClose?.(); navigate('/keys'); }}>
                <span className="flex items-center gap-[10px]"><KeyRound className="w-[17px] h-[17px]" />Encryption keys</span><ChevronRight className="w-[16px] h-[16px]" />
            </button>
            <button
                type="button"
                className="flex items-center justify-between w-full p-[10px] rounded-[12px] hover:bg-[var(--surface-2)] text-red-500"
                onClick={useLogout}>
                <span className="flex items-center gap-[10px]">
                    <LogOut className="w-[17px] h-[17px]" />
                        Logout
                </span>
                <ChevronRight className="w-[16px] h-[16px]" />
            </button>
        </div>
    );
}