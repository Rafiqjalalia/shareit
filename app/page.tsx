'use client';

import React, { useState, useEffect } from 'react';
import { Navbar, ExtendedMode } from '@/components/Navbar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { QrCodeDisplay } from '@/components/QrCodeDisplay';
import { P2PTransfer } from '@/components/P2PTransfer';
import { MobileConnectByCode } from '@/components/MobileConnectByCode';
import { TempUpload } from '@/components/TempUpload';
import { PremiumModal } from '@/components/PremiumModal';
import { generateRoomId } from '@/lib/webrtc';
import { Wifi, Globe, Shield, Sparkles, Loader2 } from 'lucide-react';

export default function HomePage() {
  const [activeMode, setActiveMode] = useState<ExtendedMode>('p2p');
  const [roomId, setRoomId] = useState<string>('');
  const [isPeerConnected, setIsPeerConnected] = useState<boolean>(false);
  const [isPremiumOpen, setIsPremiumOpen] = useState<boolean>(false);

  useEffect(() => {
    setRoomId(generateRoomId());

    // Auto detect if user opened site on mobile phone -> default to Send to PC Code input
    if (typeof window !== 'undefined') {
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
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100">
      {/* Navigation Header */}
      <Navbar
        activeMode={activeMode}
        onSelectMode={setActiveMode}
        onOpenPremium={() => setIsPremiumOpen(true)}
      />

      {/* Main Body */}
      <main className="max-w-6xl mx-auto px-4 py-8 w-full flex-grow space-y-8">
        {/* Hero Banner */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            100% Serverless & Zero VPS Required
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Instant Mobile to PC File Transfer
          </h1>
          <p className="text-sm md:text-base text-slate-400">
            Scan QR code or enter PC session code to stream files, or generate temporary expiring share links for remote devices.
          </p>
        </div>

        {/* Dynamic Mode Content Wrapped in ErrorBoundary */}
        <ErrorBoundary fallbackTitle="Module Loading Error">
          {activeMode === 'p2p' ? (
            <div className="space-y-6">
              <div className="grid lg:grid-cols-12 gap-6 items-stretch">
                {/* Left Column: QR Code Display */}
                <div className="lg:col-span-5">
                  {roomId ? (
                    <QrCodeDisplay
                      roomId={roomId}
                      isPeerConnected={isPeerConnected}
                      onRefreshRoom={handleRefreshRoom}
                    />
                  ) : (
                    <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center flex flex-col items-center justify-center min-h-[350px]">
                      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
                      <p className="text-xs text-slate-400">Generating Session ID...</p>
                    </div>
                  )}
                </div>

                {/* Right Column: WebRTC Data Receiver */}
                <div className="lg:col-span-7">
                  {roomId && (
                    <P2PTransfer
                      roomId={roomId}
                      onConnectionChange={setIsPeerConnected}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : activeMode === 'mobile-code' ? (
            <div className="max-w-md mx-auto">
              <MobileConnectByCode />
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <TempUpload onOpenPremium={() => setIsPremiumOpen(true)} />
            </div>
          )}
        </ErrorBoundary>

        {/* Feature Highlights Grid */}
        <div className="grid md:grid-cols-3 gap-4 pt-6 border-t border-slate-800/80">
          <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-start gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg shrink-0">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Direct P2P Stream</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Files stream browser-to-browser via QR scan or 6-digit session code at maximum Wi-Fi bandwidth speed.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-start gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Temporary Cloud Share</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Share files across remote locations using Serverless storage with auto-expiration timers.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-start gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Premium Monetization</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Ready to monetize with limits on free file size and retention, giving users reason to upgrade.
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
            <button
              onClick={() => setIsPremiumOpen(true)}
              className="text-amber-400 hover:underline font-semibold"
            >
              View Premium Features
            </button>
          </div>
        </div>
      </footer>

      {/* Premium Upgrade Modal */}
      <ErrorBoundary>
        <PremiumModal
          isOpen={isPremiumOpen}
          onClose={() => setIsPremiumOpen(false)}
        />
      </ErrorBoundary>
    </div>
  );
}
