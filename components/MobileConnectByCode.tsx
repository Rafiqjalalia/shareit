'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Smartphone, ArrowRight, Zap } from 'lucide-react';

export const MobileConnectByCode: React.FC = () => {
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();

    if (!cleanCode || cleanCode.length < 4) {
      setError('Please enter a valid 6-character PC Session Code.');
      return;
    }

    router.push(`/mobile/${cleanCode}`);
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 text-center space-y-5">
      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
        <Smartphone className="w-6 h-6" />
      </div>

      <div>
        <h3 className="text-lg font-bold text-white">Send Files to PC</h3>
        <p className="text-xs text-slate-400 mt-1">
          Enter the 6-character Session Code displayed on your PC screen
        </p>
      </div>

      <form onSubmit={handleConnect} className="space-y-4 max-w-sm mx-auto">
        <div>
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError(null);
            }}
            maxLength={8}
            placeholder="e.g. A9K3P2"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-xl font-mono font-bold tracking-widest text-indigo-400 focus:outline-none focus:border-indigo-500 uppercase placeholder:text-slate-600 placeholder:tracking-normal placeholder:font-sans placeholder:text-sm"
          />
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <button
          type="submit"
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all"
        >
          <span>Connect & Send Files to PC</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5 pt-2 border-t border-slate-800">
        <Zap className="w-3.5 h-3.5 text-indigo-400" />
        <span>Direct Browser-to-Browser Wi-Fi Transfer</span>
      </div>
    </div>
  );
};
