'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar, ExtendedMode } from '@/components/Navbar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { QrCodeDisplay } from '@/components/QrCodeDisplay';
import { P2PTransfer } from '@/components/P2PTransfer';
import { MobileConnectByCode } from '@/components/MobileConnectByCode';
import { TempUpload } from '@/components/TempUpload';
import { QuickPastePC } from '@/components/QuickPastePC';
import { generateRoomId } from '@/lib/webrtc';
import { DeviceInfo } from '@/lib/device';
import { Wifi, Globe, Shield, Sparkles, Smartphone, ArrowRight, Clipboard, History } from 'lucide-react';

export default function HomePage() {
  const [activeMode, setActiveMode] = useState<ExtendedMode>('p2p');
  const [roomId, setRoomId] = useState<string>('');
  const [isPeerConnected, setIsPeerConnected] = useState<boolean>(false);
  const [connectedDevice, setConnectedDevice] = useState<DeviceInfo | null>(null);
  const [savedSessionCode, setSavedSessionCode] = useState<string | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    setRoomId((prev) => prev || generateRoomId());

    if (typeof window !== 'undefined') {
      // Check for previous mobile session to resume without re-scanning
      try {
        const saved = localStorage.getItem('shaeit_mobile_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.roomId && Date.now() - parsed.timestamp < 1000 * 60 * 60 * 3) {
            setSavedSessionCode(parsed.roomId);
          }
        }
      } catch {
        // Ignore localStorage error
      }

      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode');

      if (modeParam === 'quick-paste') {
        setActiveMode('quick-paste');
        return;
      }
      if (modeParam === 'temp-cloud') {
        setActiveMode('temp-cloud');
        return;
      }
      if (modeParam === 'p2p') {
        setActiveMode('p2p');
        return;
      }

      // Auto detect if user opened site on mobile phone -> default to Send to PC Code input
      const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        ) || window.innerWidth < 768;

      if (isMobile) {
        setActiveMode('mobile-code');
      }
    }
  }, []);

  const handleRefreshRoom = () => {
    setRoomId(generateRoomId());
    setIsPeerConnected(false);
    setConnectedDevice(null);
  };

  const activeRoomId = roomId || (mounted ? generateRoomId() : '');

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100">
      {/* Navigation Header */}
      <Navbar
        activeMode={activeMode}
        onSelectMode={setActiveMode}
      />

      {/* Main Body */}
      <main className="max-w-6xl mx-auto px-4 py-8 w-full flex-grow space-y-8">
        {/* Previous Session Resume Banner if on mobile */}
        {savedSessionCode && (
          <div className="max-w-2xl mx-auto p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-between text-xs text-indigo-300">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-400" />
              <span>
                Active Session Detected: <strong className="font-mono text-white">{savedSessionCode}</strong>
              </span>
            </div>
            <Link
              href={`/mobile/${savedSessionCode}`}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg flex items-center gap-1 transition-all"
            >
              <span>Resume Session</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Hero Banner */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Two-Way Multi-File Streaming & Live Clipboard Sync
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Instant PC &lt;&gt; Mobile File Sharing
          </h1>
          <p className="text-sm md:text-base text-slate-400">
            Scan QR code once to link devices. Send multiple files in both directions, share clipboard instantly, and track sharing records with zero server storage.
          </p>
        </div>

        {/* Dynamic Mode Content Wrapped in ErrorBoundary */}
        <ErrorBoundary fallbackTitle="Module Loading Error">
          {activeMode === 'p2p' ? (
            <div className="space-y-6">
              <div className="grid lg:grid-cols-12 gap-6 items-stretch">
                {/* Left Column: QR Code Display */}
                <div className="lg:col-span-5">
                  <QrCodeDisplay
                    roomId={activeRoomId}
                    isPeerConnected={isPeerConnected}
                    connectedDevice={connectedDevice}
                    onRefreshRoom={handleRefreshRoom}
                  />
                </div>

                {/* Right Column: WebRTC Data Transfer & Records Station */}
                <div className="lg:col-span-7">
                  {activeRoomId && (
                    <P2PTransfer
                      roomId={activeRoomId}
                      onConnectionChange={(connected, device) => {
                        setIsPeerConnected(connected);
                        setConnectedDevice(device || null);
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : activeMode === 'mobile-code' ? (
            <div className="max-w-md mx-auto">
              <MobileConnectByCode />
            </div>
          ) : activeMode === 'quick-paste' ? (
            <div className="max-w-5xl mx-auto">
              <QuickPastePC />
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <TempUpload onOpenPremium={() => {}} />
            </div>
          )}
        </ErrorBoundary>

        {/* Feature Highlights Grid */}
        <div className="grid md:grid-cols-4 gap-4 pt-6 border-t border-slate-800/80">
          <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-start gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg shrink-0">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Multi-File Streaming</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Select and send multiple files at once in both directions (PC to Mobile & Mobile to PC) at full Wi-Fi speed.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-start gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">1-Time Scan Session</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Scan once per session. Devices stay paired so you can transfer unlimited files without ever re-scanning.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-start gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg shrink-0">
              <Clipboard className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Live Clipboard Sync</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Copy text, links, or notes on PC and send directly to your phone&apos;s clipboard with 1-click copy.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-start gap-3">
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Sharing Audit Records</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Know exactly who is sharing: device names, OS, timestamps, and files with exportable history.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} ShaeIt — Easy File Transfer Tool</p>
          <div className="flex items-center gap-4">
            <span className="text-emerald-400 font-semibold">Zero VPS Server Requirement</span>
            <span>•</span>
            <span className="text-slate-400">100% Free & Open</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
