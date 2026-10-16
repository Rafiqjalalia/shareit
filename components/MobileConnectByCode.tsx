'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Smartphone, ArrowRight, Zap, History, Laptop } from 'lucide-react';

export const MobileConnectByCode: React.FC = () => {
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [savedSessionCode, setSavedSessionCode] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    try {
      const saved = localStorage.getItem('shaeit_mobile_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.roomId && Date.now() - parsed.timestamp < 1000 * 60 * 60 * 3) {
          setSavedSessionCode(parsed.roomId);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

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
        <h3 className="text-lg font-bold text-white">Connect & Share with PC</h3>
        <p className="text-xs text-slate-400 mt-1">
          Enter the 6-character Session Code displayed on your PC screen
        </p>
      </div>

      {/* Resume Previous Session Option if available */}
      {savedSessionCode && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-left flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-300">
            <History className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Resume Session <strong className="font-mono text-white">{savedSessionCode}</strong>
            </span>
          </div>
          <button
            onClick={() => router.push(`/mobile/${savedSessionCode}`)}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-all"
          >
            Connect
          </button>
        </div>
      )}

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
          <span>Connect to PC Now</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      <div className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5 pt-2 border-t border-slate-800">
        <Zap className="w-3.5 h-3.5 text-indigo-400" />
        <span>Direct Browser-to-Browser Wi-Fi Transfer & Live Clipboard</span>
      </div>
    </div>
  );
};
