'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, QrCode, RefreshCw, Radio, Globe } from 'lucide-react';

interface QrCodeDisplayProps {
  roomId: string;
  isPeerConnected: boolean;
  onRefreshRoom: () => void;
}

export const QrCodeDisplay: React.FC<QrCodeDisplayProps> = ({
  roomId,
  isPeerConnected,
  onRefreshRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hostOrigin, setHostOrigin] = useState<string>('http://localhost:3000');
  const [customIp, setCustomIp] = useState<string>('http://localhost:3000');

  useEffect(() => {
    setMounted(true);

    const detectIp = async () => {
      if (typeof window === 'undefined') return;

      const hostname = window.location.hostname;
      const port = window.location.port ? `:${window.location.port}` : '';
      const protocol = window.location.protocol;

      // If running on local dev, try to auto detect LAN IP
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        try {
          const res = await fetch('/api/network-ip');
          const data = await res.json();
          if (data.ip && data.ip !== 'localhost') {
            const detected = `${protocol}//${data.ip}${port}`;
            setHostOrigin(detected);
            setCustomIp(detected);
            return;
          }
        } catch (err) {
          console.warn('Could not auto-detect network IP:', err);
        }
      }

      // Default to dynamic window origin (Works on Vercel, Netlify & Custom domains)
      setHostOrigin(window.location.origin);
      setCustomIp(window.location.origin);
    };

    detectIp();
  }, []);

  const pairUrl = `${hostOrigin}/mobile/${roomId}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pairUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUrlChange = (newUrl: string) => {
    setCustomIp(newUrl);
    let formatted = newUrl.trim();
    if (formatted && !formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = `http://${formatted}`;
    }
    setHostOrigin(formatted);
  };

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center p-8 glass-panel rounded-2xl border border-slate-800 text-center min-h-[350px]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-semibold">Generating QR Code...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 glass-panel rounded-2xl border border-slate-800 text-center relative overflow-hidden">
      {/* Background ambient light glow */}
      <div className="absolute -top-16 -left-16 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center gap-2 mb-4">
        <span
          className={`flex h-2.5 w-2.5 rounded-full ${
            isPeerConnected
              ? 'bg-emerald-500 animate-pulse'
              : 'bg-amber-400 animate-ping'
          }`}
        />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          {isPeerConnected ? 'Mobile Device Connected!' : 'Waiting for Mobile...'}
        </span>
      </div>

      {/* QR Box Container */}
      <div className="relative group p-4 bg-white rounded-2xl shadow-xl shadow-indigo-950/40 border border-slate-200/20 transition-all hover:scale-[1.02]">
        <QRCodeSVG
          value={pairUrl}
          size={210}
          level="H"
          includeMargin={false}
        />

        {isPeerConnected && (
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-4">
            <Radio className="w-12 h-12 text-emerald-400 animate-bounce mb-2" />
            <p className="text-sm font-bold text-white">Direct WebRTC Link Active</p>
            <p className="text-xs text-slate-400 mt-1">Ready to receive files from Mobile</p>
          </div>
        )}
      </div>

      {/* Room Details & Actions */}
      <div className="mt-5 w-full max-w-xs space-y-3">
        <div className="flex items-center justify-between bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-800">
          <div className="text-left">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              Session Code
            </p>
            <p className="text-lg font-mono font-bold text-indigo-400 tracking-wider">
              {roomId}
            </p>
          </div>
          <button
            onClick={onRefreshRoom}
            title="Generate new Room Code"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Target Host URL Box */}
        <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-left text-xs space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-300">
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              Target Host URL / IP:
            </span>
          </div>
          <input
            type="text"
            value={customIp}
            onChange={(e) => handleUrlChange(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-indigo-400 text-xs focus:outline-none truncate"
          />
        </div>

        <button
          onClick={copyToClipboard}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl transition-all"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              Link Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-slate-400" />
              Copy Pairing Link
            </>
          )}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        <QrCode className="w-4 h-4 text-indigo-400 shrink-0" />
        <span>Scan with Mobile Camera</span>
      </div>
    </div>
  );
};
