'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { QuickPasteMobile } from '@/components/QuickPasteMobile';
import { Zap, ShieldCheck } from 'lucide-react';

export default function MobilePastePage() {
  const params = useParams();
  const code = (params?.code as string) || '';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4">
      {/* Top Header */}
      <header className="max-w-xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <span className="text-lg font-extrabold text-white">ShaeIt Quick Paste</span>
        </div>
        <span className="text-xs text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800 font-mono">
          {code}
        </span>
      </header>

      {/* Main Sender Box */}
      <main className="max-w-xl mx-auto w-full my-auto py-6">
        <QuickPasteMobile initialCode={code} />
      </main>

      {/* Footer */}
      <footer className="max-w-xl mx-auto w-full text-center text-xs text-slate-500 py-4 border-t border-slate-800 flex items-center justify-between">
        <span>Powered by ShaeIt</span>
        <span className="flex items-center gap-1 text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          Zero VPS • Auto-Expiring
        </span>
      </footer>
    </div>
  );
}
