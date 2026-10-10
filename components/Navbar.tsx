'use client';

import React from 'react';
import { Zap, ShieldCheck, Crown, Smartphone, Globe, Send } from 'lucide-react';
import { TransferMode } from '@/lib/types';

export type ExtendedMode = TransferMode | 'mobile-code';

interface NavbarProps {
  activeMode: ExtendedMode;
  onSelectMode: (mode: ExtendedMode) => void;
  onOpenPremium: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeMode,
  onSelectMode,
  onOpenPremium,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              ShaeIt
            </span>
            <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
              P2P & Cloud
            </span>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex flex-wrap items-center justify-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 gap-1">
          <button
            onClick={() => onSelectMode('p2p')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeMode === 'p2p'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            PC (QR View)
          </button>

          <button
            onClick={() => onSelectMode('mobile-code')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeMode === 'mobile-code'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-emerald-400" />
            Send to PC (Code)
          </button>

          <button
            onClick={() => onSelectMode('temp-cloud')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeMode === 'temp-cloud'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Temp URL Share
          </button>
        </div>

        {/* Action Controls & Premium */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenPremium}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-all shadow-sm"
          >
            <Crown className="w-4 h-4 text-amber-400" />
            Upgrade Premium
          </button>
        </div>
      </div>
    </header>
  );
};
