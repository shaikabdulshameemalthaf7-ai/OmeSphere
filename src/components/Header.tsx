import React from 'react';
import { ShieldCheck, Volume2, VolumeX, Sparkles, Sliders, Globe } from 'lucide-react';
import { soundEffects } from '../utils/soundEffects';

interface HeaderProps {
  onlineCount: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenE2EEModal: () => void;
  onOpenSettingsModal: () => void;
  isChatting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onlineCount,
  soundEnabled,
  onToggleSound,
  onOpenE2EEModal,
  onOpenSettingsModal,
  isChatting,
}) => {
  return (
    <header className="h-16 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 px-4 md:px-6 flex items-center justify-between select-none z-30 sticky top-0">
      {/* Brand & Status */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-neutral-200 to-indigo-300 bg-clip-text text-transparent">
                OmeSphere
              </span>
              <span className="hidden sm:inline-flex text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                WebRTC P2P
              </span>
            </div>
          </div>
        </div>

        {/* Live Users Counter */}
        <div className="hidden md:flex items-center space-x-2 pl-4 border-l border-neutral-800">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-medium text-neutral-300 flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-neutral-400" />
            <strong className="text-white font-semibold">{onlineCount.toLocaleString()}</strong> online now
          </span>
        </div>
      </div>

      {/* Right Action Icons */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* E2EE Security Badge */}
        <button
          onClick={onOpenE2EEModal}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-900/40 hover:border-emerald-500/50 transition-all cursor-pointer group shadow-sm"
          title="Click to view End-to-End Encryption verification & cryptographic fingerprints"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          <span className="hidden sm:inline">E2EE Secured</span>
          <span className="inline sm:hidden">E2EE</span>
        </button>

        {/* Audio Mute/Unmute */}
        <button
          onClick={() => {
            soundEffects.playClick();
            onToggleSound();
          }}
          className={`p-2 rounded-lg text-xs border transition-all cursor-pointer ${
            soundEnabled
              ? 'bg-neutral-800 text-neutral-200 border-neutral-700 hover:bg-neutral-700'
              : 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-300'
          }`}
          title={soundEnabled ? 'Sound Effects Enabled (Click to mute)' : 'Sound Effects Muted (Click to unmute)'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Settings / Diagnostics */}
        <button
          onClick={() => {
            soundEffects.playClick();
            onOpenSettingsModal();
          }}
          className="p-2 rounded-lg text-neutral-300 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 hover:text-white transition-all cursor-pointer"
          title="Settings & Diagnostics"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
