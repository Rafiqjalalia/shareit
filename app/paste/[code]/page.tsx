'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { CrossDeviceClipboard } from '@/components/CrossDeviceClipboard';
import { Zap, ShieldCheck } from 'lucide-react';

export default function MobilePastePage() {
  const params = useParams();
  const code = (params?.code as string) || '';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-3 sm:p-4">
      {/* Top Header */}
      <header className="max-w-xl mx-auto w-full flex items-center justify-between py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <span className="text-base sm:text-lg font-extrabold text-white">ShaeIt Clipboard</span>
        </div>
        <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20 font-mono font-bold">
          {code.toUpperCase()}
        </span>
      </header>

      {/* Main Sender Box */}
      <main className="max-w-xl mx-auto w-full my-auto py-4">
        <CrossDeviceClipboard initialCode={code} isStandaloneMobile={true} />
      </main>

      {/* Footer */}
      <footer className="max-w-xl mx-auto w-full text-center text-xs text-slate-500 py-3 border-t border-slate-800 flex items-center justify-between">
        <span>Powered by ShaeIt</span>
        <span className="flex items-center gap-1 text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          Zero VPS • Auto-Expiring
        </span>
      </footer>
    </div>
  );
}
