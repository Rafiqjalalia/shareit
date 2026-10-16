'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, QrCode, RefreshCw, Radio, Globe, Smartphone, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { getAppBaseUrl } from '@/lib/config';
import { DeviceInfo } from '@/lib/device';

interface QrCodeDisplayProps {
  roomId: string;
  isPeerConnected: boolean;
  connectedDevice?: DeviceInfo | null;
  onRefreshRoom: () => void;
}

export const QrCodeDisplay: React.FC<QrCodeDisplayProps> = ({
  roomId,
  isPeerConnected,
  connectedDevice,
  onRefreshRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hostOrigin, setHostOrigin] = useState<string>('');
  const [customIp, setCustomIp] = useState<string>('');
  const [showQrAnyway, setShowQrAnyway] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (typeof window !== 'undefined') {
      const immediateOrigin = window.location.origin || getAppBaseUrl();
      setHostOrigin(immediateOrigin);
      setCustomIp(immediateOrigin);

      const detectIp = async () => {
        const hostname = window.location.hostname;
        const port = window.location.port ? `:${window.location.port}` : '';
        const protocol = window.location.protocol;

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);
            const res = await fetch('/api/network-ip', { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
              const data = await res.json();
              if (data.ip && data.ip !== 'localhost') {
                const detected = `${protocol}//${data.ip}${port}`;
                setHostOrigin(detected);
                setCustomIp(detected);
              }
            }
          } catch {
            // Keep immediateOrigin fallback
          }
        }
      };

      detectIp();
    }
  }, []);

  const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : getAppBaseUrl();
  const pairUrl = `${hostOrigin || fallbackOrigin}/mobile/${roomId}`;

  const copyToClipboard = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard && pairUrl) {
      navigator.clipboard.writeText(pairUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
        <p className="text-xs text-slate-400 font-semibold">Readying QR Code...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 glass-panel rounded-2xl border border-slate-800 text-center relative overflow-hidden">
      {/* Background ambient light glow */}
      <div className="absolute -top-16 -left-16 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Connection Status Indicator */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className={`flex h-2.5 w-2.5 rounded-full ${
            isPeerConnected
              ? 'bg-emerald-500 animate-pulse'
              : 'bg-amber-400 animate-ping'
          }`}
        />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          {isPeerConnected ? 'Session Active (1-Time Scan Paired)' : 'Waiting for Mobile Scan...'}
        </span>
      </div>

      {/* When peer is connected and user hasn't explicitly clicked showQrAnyway: Show Locked 1-Time Scan Paired View */}
      {isPeerConnected && !showQrAnyway ? (
        <div className="w-full max-w-sm p-6 bg-slate-900/90 border border-emerald-500/30 rounded-2xl shadow-xl space-y-4 transition-all">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-emerald-300 text-[11px] font-bold mb-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              1-Time Scan Successful
            </div>
            <h3 className="text-base font-bold text-white">Mobile Device Paired</h3>
            <p className="text-xs text-slate-400 mt-1">
              QR code locked for this session. You do <span className="text-emerald-400 font-semibold">NOT</span> need to scan again!
            </p>
          </div>

          {/* Connected Device Card */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-left flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-white truncate">
                {connectedDevice?.deviceName || 'Mobile Device'}
              </p>
              <p className="text-[10px] text-slate-400">
                {connectedDevice ? `${connectedDevice.os} • ${connectedDevice.browser}` : 'Direct WebRTC Connected'}
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => setShowQrAnyway(true)}
              className="text-[11px] text-slate-400 hover:text-slate-200 underline decoration-slate-600 transition-all"
            >
              Show QR code again
            </button>
            <button
              onClick={onRefreshRoom}
              className="w-full py-2 px-3 text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Disconnect & Start New Session
            </button>
          </div>
        </div>
      ) : (
        /* Normal QR Code View */
        <div className="relative group p-4 bg-white rounded-2xl shadow-xl shadow-indigo-950/40 border border-slate-200/20 transition-all hover:scale-[1.01]">
          <QRCodeSVG
            value={pairUrl}
            size={210}
            level="H"
            includeMargin={false}
          />
        </div>
      )}

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

      <div className="mt-4 flex flex-col items-center gap-1 text-xs text-slate-400">
        <div className="flex items-center gap-1.5 text-indigo-300 font-semibold">
          <QrCode className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>One-Time Scan per Session</span>
        </div>
        <p className="text-[11px] text-slate-500 max-w-xs text-center">
          Scan once with your mobile camera. Both devices remain linked for multiple file transfers and clipboard sharing.
        </p>
      </div>
    </div>
  );
};
