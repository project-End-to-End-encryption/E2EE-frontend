import React, { useState, useEffect } from 'react';
import { 
  Search, 
  MessageSquare, 
  Phone, 
  Bookmark, 
  Settings,
  Sun,
  Moon,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';

import E2ELogoSVG from "../../../assets/E2EE.svg";
import chatBg from "../../../assets/chat bg.png";
import chatBgDark from "../../../assets/chatBgDark.png";

const ChatPage = () => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('e2ee_theme') || 'light';
  });

  const [activeTab, setActiveTab] = useState('chat');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [settingsView, setSettingsView] = useState('main'); // 'main' ya 'theme'

  useEffect(() => {
    localStorage.setItem('e2ee_theme', theme);
  }, [theme]);

  const isDark = theme === 'dark';

  return (
    <div className={`flex h-screen w-full font-sans select-none p-3 gap-3 transition-colors duration-300 ${
      isDark ? 'bg-[#060913] text-slate-100' : 'bg-[#dbe8fc] text-slate-800'
    }`}>
      
      {/* ================= LEFT SIDEBAR ================= */}
      <aside className={`w-[280px] rounded-2xl flex flex-col p-4 shrink-0 shadow-md relative transition-colors duration-300 overflow-visible ${
        isDark 
          ? 'bg-[#0f172a] border border-slate-800 text-slate-100' 
          : 'bg-[#9cc2f5] border border-[#b2d1f8]/60 text-slate-800'
      }`}>
        
        {/* Top Header Logo & Text */}
        <div className="flex items-center gap-3 mb-5 pl-1">
          <img src={E2ELogoSVG} alt="E2EE Logo" className="w-10 h-10 object-contain" />
          <div className="flex flex-col">
            <h2 className="text-2xl font-black leading-none tracking-wide flex items-center">
              <span className={isDark ? 'text-white' : 'text-[#0a1968]'}>E</span>
              <span className="text-[#00a8cc]">2</span>
              <span className={isDark ? 'text-white' : 'text-[#0a1968]'}>EE</span>
            </h2>
            <span className={`text-[11px] font-bold tracking-tight mt-1 ${isDark ? 'text-slate-400' : 'text-[#0a1968]'}`}>
              Chat Beyond Limits
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-5">
          <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 ${isDark ? 'text-slate-400' : 'text-[#0a1968]'}`} />
          <input 
            type="text" 
            placeholder="Search conversations..." 
            className={`w-full pl-10 pr-3 py-2.5 rounded-xl text-xs outline-none transition-colors font-medium ${
              isDark 
                ? 'bg-[#1e293b] border border-slate-700 text-white placeholder:text-slate-500 focus:border-[#00a8cc]' 
                : 'bg-[#b2d1f8] border border-[#c5ddfa] text-[#0a1968] placeholder:text-slate-600 focus:border-[#00a8cc]'
            }`}
          />
        </div>

        {/* Sidebar Nav Buttons */}
        <nav className="flex flex-col gap-2 mb-4">
          <button 
            onClick={() => {
              setActiveTab('chat');
              setShowSettingsMenu(false);
              setSettingsView('main');
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all cursor-pointer ${
              activeTab === 'chat' 
                ? 'bg-[#0a1968] text-white shadow-md' 
                : isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-[#0a1968] hover:bg-[#b2d1f8]/60'
            }`}
          >
            <MessageSquare className={`w-4.5 h-4.5 ${activeTab === 'chat' ? 'fill-current stroke-none' : ''}`} />
          </button>

          <button 
            onClick={() => {
              setActiveTab('calls');
              setShowSettingsMenu(false);
              setSettingsView('main');
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all cursor-pointer ${
              activeTab === 'calls' 
                ? 'bg-[#0a1968] text-white shadow-md' 
                : isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-[#0a1968] hover:bg-[#b2d1f8]/60'
            }`}
          >
            <Phone className={`w-4.5 h-4.5 ${activeTab === 'calls' ? 'fill-current stroke-none' : ''}`} />
          </button>

          <button 
            onClick={() => {
              setActiveTab('saved');
              setShowSettingsMenu(false);
              setSettingsView('main');
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all cursor-pointer ${
              activeTab === 'saved' 
                ? 'bg-[#0a1968] text-white shadow-md' 
                : isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-[#0a1968] hover:bg-[#b2d1f8]/60'
            }`}
          >
            <Bookmark className={`w-4.5 h-4.5 ${activeTab === 'saved' ? 'fill-current stroke-none' : ''}`} />
          </button>
          
          {/* Settings Button & Popover Menu */}
          <div className="relative">
            <button 
              onClick={() => {
                setActiveTab('settings');
                setShowSettingsMenu(prev => !prev);
                setSettingsView('main'); // Jab bhi dobara khole toh main menu dikhe
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all cursor-pointer ${
                activeTab === 'settings' 
                  ? 'bg-[#0a1968] text-white shadow-md' 
                  : isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-[#0a1968] hover:bg-[#b2d1f8]/60'
              }`}
            >
              <Settings className="w-4.5 h-4.5" />
            </button>

            {/* Settings Popover Window */}
            {showSettingsMenu && activeTab === 'settings' && (
              <div className={`absolute left-12 bottom-0 w-48 rounded-xl shadow-2xl p-2 z-50 border ${
                isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
              }`}>
                {settingsView === 'main' ? (
                  // --- SETTINGS MAIN MENU ---
                  <div>
                    <p className="text-[10px] font-bold px-2 py-1 text-slate-400 uppercase tracking-wider">Settings</p>
                    <button 
                      onClick={() => setSettingsView('theme')}
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
                  </div>
                ) : (
                  // --- THEME SUB-MENU ---
                  <div>
                    <div className="flex items-center gap-1 px-1 pb-1 mb-1 border-b border-slate-700/50">
                      <button 
                        onClick={() => setSettingsView('main')}
                        className={`p-1 rounded-md hover:bg-slate-700/50 transition-colors ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Theme</p>
                    </div>

                    <button 
                      onClick={() => { setTheme('light'); setShowSettingsMenu(false); }}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold ${
                        !isDark ? 'bg-[#b2d1f8]/40 text-[#0a1968]' : 'hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5 text-amber-500" /> Light
                    </button>

                    <button 
                      onClick={() => { setTheme('dark'); setShowSettingsMenu(false); }}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold ${
                        isDark ? 'bg-slate-700 text-cyan-400' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5 text-cyan-400" /> Dark
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>

        <div className={`w-full h-[1px] mb-6 ${isDark ? 'bg-slate-800' : 'bg-[#b2d1f8]'}`} />

        <div className="text-center px-2 flex flex-col items-center">
          <div className={`w-12 h-12 mb-2 flex items-center justify-center ${isDark ? 'text-cyan-400' : 'text-[#0a1968]'}`}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v3M7.5 3.5l1.5 2.5M16.5 3.5l-1.5 2.5" />
              <path d="M4 11h16v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6z" />
              <path d="M4 14h4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2h4" />
            </svg>
          </div>
          <h4 className={`text-sm font-black ${isDark ? 'text-white' : 'text-[#0a1968]'}`}>No conversations yet</h4>
          <p className={`text-[11px] font-medium leading-relaxed mt-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
            Start a new chat and<br />make some connections!
          </p>
        </div>
      </aside>

      {/* ================= MAIN HERO CANVAS ================= */}
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

    </div>
  );
};

export default ChatPage;