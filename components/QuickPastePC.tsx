'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generateRoomId } from '@/lib/webrtc';
import { getAppBaseUrl } from '@/lib/config';
import { getDictionary } from '@/lib/translations';
import { QuickPasteItem } from '@/lib/redis';
import {
  Clipboard,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  RefreshCw,
  Smartphone,
  Sparkles,
  ShieldCheck,
  Bell,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface QuickPastePCProps {
  initialCode?: string;
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text: string): boolean {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback copy failed:', err);
    return false;
  }
}

export const QuickPastePC: React.FC<QuickPastePCProps> = ({ initialCode }) => {
  const t = getDictionary('en').quickPaste;
  const [code, setCode] = useState<string>('');
  const [items, setItems] = useState<QuickPasteItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);

  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
    setCode(initialCode ? initialCode.toUpperCase() : generateRoomId());
  }, [initialCode]);

  const handleRefreshCode = () => {
    const newCode = generateRoomId();
    setCode(newCode);
    setItems([]);
    seenIdsRef.current.clear();
  };

  // Real-time listener: Pusher + Polling fallback
  useEffect(() => {
    if (!code) return;

    let isCancelled = false;
    let pusherClient: any = null;

    // 1. Pusher subscription if client key is configured
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1';

    if (pusherKey && typeof window !== 'undefined') {
      import('pusher-js').then(({ default: Pusher }) => {
        if (isCancelled) return;
        try {
          pusherClient = new Pusher(pusherKey, {
            cluster: pusherCluster,
          });

          const channel = pusherClient.subscribe(`quick-paste-${code}`);
          channel.bind('new-paste', (newItem: QuickPasteItem) => {
            if (!seenIdsRef.current.has(newItem.id)) {
              seenIdsRef.current.add(newItem.id);
              setItems((prev) => [newItem, ...prev.filter((x) => x.id !== newItem.id)].slice(0, 10));
              setToastMessage(t.receivedToast);
              setTimeout(() => setToastMessage(null), 3500);
            }
          });
        } catch (err) {
          console.warn('Pusher client setup error:', err);
        }
      });
    }

    // 2. Polling fallback every 2.5 seconds (ensures instant delivery even without Pusher)
    const pollInterval = setInterval(async () => {
      if (isCancelled) return;
      try {
        const res = await fetch(`/api/paste/${code}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.items)) {
            const fetchedItems: QuickPasteItem[] = json.items;
            let hasNew = false;

            fetchedItems.forEach((item) => {
              if (!seenIdsRef.current.has(item.id)) {
                seenIdsRef.current.add(item.id);
                hasNew = true;
              }
            });

            if (hasNew && fetchedItems.length > 0) {
              setItems(fetchedItems.slice(0, 10));
              setToastMessage(t.receivedToast);
              setTimeout(() => setToastMessage(null), 3500);
            }
          }
        }
      } catch {
        // Polling network skip
      }
    }, 2500);

    return () => {
      isCancelled = true;
      clearInterval(pollInterval);
      if (pusherClient) {
        pusherClient.unsubscribe(`quick-paste-${code}`);
        pusherClient.disconnect();
      }
    };
  }, [code, t.receivedToast]);

  const handleCopy = async (id: string, text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleClearHistory = async () => {
    setItems([]);
    seenIdsRef.current.clear();
    try {
      await fetch(`/api/paste/${code}`, { method: 'DELETE' });
    } catch {
      // Ignore
    }
  };

  const activeCode = code || (mounted ? (initialCode ? initialCode.toUpperCase() : generateRoomId()) : '');
  const effectiveOrigin = typeof window !== 'undefined' ? window.location.origin : getAppBaseUrl();
  const mobilePasteUrl = activeCode ? `${effectiveOrigin}/paste/${activeCode}` : '';
  const latestItem = items[0];

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce max-w-sm">
          <div className="bg-indigo-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-indigo-400">
            <div className="p-2 bg-indigo-700/80 rounded-xl">
              <Bell className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Quick Paste</p>
              <p className="text-xs text-indigo-100">{toastMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Left Pairing QR / Right Live Paste Card */}
      <div className="grid lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Pairing Code & QR Code */}
        <div className="lg:col-span-5 glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between text-center space-y-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-semibold">
              <Smartphone className="w-3.5 h-3.5" />
              <span>{t.pairingCode}</span>
            </div>
            <h2 className="text-xl font-extrabold text-white">{t.title}</h2>
            <p className="text-xs text-slate-400">{t.scanToPaste}</p>
          </div>

          {/* QR Code Container */}
          <div className="bg-white p-4 rounded-2xl inline-block mx-auto shadow-xl border-4 border-slate-800">
            {mobilePasteUrl ? (
              <QRCodeSVG
                value={mobilePasteUrl}
                size={180}
                level="M"
                includeMargin={false}
              />
            ) : (
              <div className="w-[180px] h-[180px] flex items-center justify-center text-slate-400">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* 6-Digit Code Display */}
          <div className="space-y-3">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between px-4">
              <span className="text-xs text-slate-400 font-semibold">{t.pairingCode}:</span>
              <span className="text-2xl font-mono font-black tracking-widest text-indigo-400">
                {activeCode || code || '......'}
              </span>
              <button
                onClick={handleRefreshCode}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
                title={t.newSession}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t.sessionExpiryNotice}</span>
            </p>
          </div>
        </div>

        {/* Right Column: Live Incoming Text Card */}
        <div className="lg:col-span-7 glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                  <Clipboard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{t.receivedText}</h3>
                  <p className="text-[11px] text-slate-400">Instant clipboard from your mobile phone</p>
                </div>
              </div>

              {items.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-rose-400 bg-slate-950 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-900/40 rounded-lg transition-all flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{t.clearHistory}</span>
                </button>
              )}
            </div>

            {/* Waiting state or Latest received card */}
            {!latestItem ? (
              <div className="py-14 text-center space-y-3 bg-slate-950/60 rounded-xl border border-slate-800/80 p-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400 animate-pulse">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-200">{t.waitingForText}</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {t.waitingSubtitle}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Highlighted Latest Text Card */}
                <div className="bg-slate-950 p-5 rounded-xl border-2 border-indigo-500/40 shadow-xl space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-2">
                    <span className="font-semibold text-indigo-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Latest Item
                    </span>
                    <span className="font-mono text-[11px]">
                      {new Date(latestItem.createdAt).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Text preview box */}
                  <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 max-h-56 overflow-y-auto font-mono text-sm text-slate-100 whitespace-pre-wrap break-words select-all">
                    {latestItem.text}
                  </div>

                  {/* Big Action Buttons */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => handleCopy(latestItem.id, latestItem.text)}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {copiedId === latestItem.id ? (
                        <>
                          <Check className="w-5 h-5" />
                          <span>{t.copiedText}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-5 h-5" />
                          <span>{t.copyText}</span>
                        </>
                      )}
                    </button>

                    {latestItem.isUrl && (
                      <a
                        href={latestItem.text}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-3 px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all shrink-0"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>{t.openUrl}</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Session History (last 10 items) */}
          {items.length > 1 && (
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300">
                  {t.historyTitle} ({items.length})
                </h4>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {items.slice(1).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-950/80 hover:bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs transition-all"
                  >
                    <p className="font-mono text-slate-200 truncate flex-1 select-all">
                      {item.text}
                    </p>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.isUrl && (
                        <a
                          href={item.text}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
                          title="Open URL"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}

                      <button
                        onClick={() => handleCopy(item.id, item.text)}
                        className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg transition-all"
                        title="Copy"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-800/80">
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              Real-time Ephemeral Stream
            </span>
            <span>Max 5,000 characters</span>
          </div>
        </div>
      </div>
    </div>
  );
};
