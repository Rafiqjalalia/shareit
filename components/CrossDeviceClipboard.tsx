'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generateRoomId } from '@/lib/webrtc';
import { getAppBaseUrl } from '@/lib/config';
import { getDeviceInfo, DeviceInfo } from '@/lib/device';
import { ClipboardItem, SpaceDevice } from '@/lib/redis';
import { CLIPBOARD_CONFIG } from '@/lib/clipboardConfig';
import {
  Clipboard,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  RefreshCw,
  Smartphone,
  Laptop,
  Tablet,
  Pin,
  PinOff,
  Sparkles,
  ShieldCheck,
  Bell,
  Clock,
  ArrowRight,
  Send,
  Plus,
  LogOut,
  QrCode,
  AlertCircle,
  X,
  Crown,
} from 'lucide-react';

interface CrossDeviceClipboardProps {
  initialCode?: string;
  isStandaloneMobile?: boolean;
}

const STORAGE_KEY_SPACE = 'shaeit_clipboard_space';

export function copyText(text: string): Promise<boolean> {
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

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export const CrossDeviceClipboard: React.FC<CrossDeviceClipboardProps> = ({
  initialCode,
  isStandaloneMobile = false,
}) => {
  const [mounted, setMounted] = useState<boolean>(false);
  const [code, setCode] = useState<string>('');
  const [joinInputCode, setJoinInputCode] = useState<string>('');
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [devices, setDevices] = useState<SpaceDevice[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showProModal, setShowProModal] = useState<boolean>(false);
  const [proModalReason, setProModalReason] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const deviceInfoRef = useRef<DeviceInfo | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 1. Initialize device & check saved space in localStorage
  useEffect(() => {
    setMounted(true);
    const myDevice = getDeviceInfo();
    deviceInfoRef.current = myDevice;

    if (initialCode) {
      const clean = initialCode.trim().toUpperCase();
      setCode(clean);
      saveSpaceToLocal(clean);
      return;
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY_SPACE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.code && Date.now() - parsed.timestamp < CLIPBOARD_CONFIG.SPACE_TTL_SECONDS * 1000) {
          setCode(parsed.code);
          return;
        }
      }
    } catch {
      // Ignore localStorage error
    }
  }, [initialCode]);

  const saveSpaceToLocal = (spaceCode: string) => {
    try {
      localStorage.setItem(
        STORAGE_KEY_SPACE,
        JSON.stringify({
          code: spaceCode.toUpperCase(),
          timestamp: Date.now(),
        })
      );
    } catch {
      // Ignore
    }
  };

  const clearSpaceFromLocal = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_SPACE);
    } catch {
      // Ignore
    }
  };

  // 2. Fetch clipboard space data
  const fetchSpace = useCallback(
    async (spaceCode: string, isSilent = false) => {
      if (!spaceCode) return;
      const myDevice = deviceInfoRef.current || getDeviceInfo();

      try {
        const query = new URLSearchParams({
          deviceId: myDevice.deviceId,
          deviceName: myDevice.deviceName,
          deviceType: myDevice.deviceType,
        });

        const res = await fetch(`/api/paste/${spaceCode}?${query.toString()}`);
        const data = await res.json();

        if (res.status === 403 && data.error === 'device_limit_reached') {
          if (!isSilent) {
            setProModalReason(data.message || CLIPBOARD_CONFIG.PRO_UPGRADE_MESSAGE);
            setShowProModal(true);
          }
          if (data.items) setItems(data.items);
          return;
        }

        if (res.ok && data.success) {
          const fetchedItems: ClipboardItem[] = data.items || [];
          setDevices(data.devices || []);

          // Check if any brand new item arrived
          let hasNew = false;
          fetchedItems.forEach((item) => {
            if (!seenIdsRef.current.has(item.id)) {
              seenIdsRef.current.add(item.id);
              hasNew = true;
            }
          });

          setItems(fetchedItems);

          if (hasNew && isSilent && fetchedItems.length > 0) {
            const newest = fetchedItems[0];
            if (newest && newest.deviceId !== myDevice.deviceId) {
              setToastMessage(`New item received from ${newest.deviceName}!`);
              setTimeout(() => setToastMessage(null), 3500);
            }
          }
        }
      } catch (err) {
        if (!isSilent) {
          console.warn('Fetch space error:', err);
        }
      }
    },
    []
  );

  // 3. Two-Way Sync: Polling (every 2s) + Pusher WebSocket push
  useEffect(() => {
    if (!code) return;

    fetchSpace(code, false);

    let isCancelled = false;
    let pusherClient: any = null;

    // A. Real-time Pusher listener
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1';

    if (pusherKey && typeof window !== 'undefined') {
      import('pusher-js').then(({ default: Pusher }) => {
        if (isCancelled) return;
        try {
          pusherClient = new Pusher(pusherKey, { cluster: pusherCluster });
          const channel = pusherClient.subscribe(`clipboard-space-${code}`);

          channel.bind('new-item', (newItem: ClipboardItem) => {
            fetchSpace(code, true);
          });

          channel.bind('item-action', () => {
            fetchSpace(code, true);
          });

          channel.bind('space-cleared', () => {
            setItems([]);
            seenIdsRef.current.clear();
          });

          channel.bind('device-joined', () => {
            fetchSpace(code, true);
          });

          channel.bind('device-left', () => {
            fetchSpace(code, true);
          });
        } catch (err) {
          console.warn('Pusher client setup error:', err);
        }
      });
    }

    // B. Polling sync every 2 seconds (~2s sync requirement)
    const interval = setInterval(() => {
      if (!isCancelled) {
        fetchSpace(code, true);
      }
    }, CLIPBOARD_CONFIG.POLL_INTERVAL_MS);

    return () => {
      isCancelled = true;
      clearInterval(interval);
      if (pusherClient) {
        pusherClient.unsubscribe(`clipboard-space-${code}`);
        pusherClient.disconnect();
      }
    };
  }, [code, fetchSpace]);

  // 4. Create new space
  const handleCreateSpace = () => {
    const newCode = generateRoomId();
    setCode(newCode);
    saveSpaceToLocal(newCode);
    setItems([]);
    seenIdsRef.current.clear();
    setErrorMessage(null);
  };

  // 5. Join existing space
  const handleJoinSpace = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = joinInputCode.trim().toUpperCase();
    if (!clean || clean.length < 4) {
      setErrorMessage('Please enter a valid 6-character code.');
      return;
    }
    setCode(clean);
    saveSpaceToLocal(clean);
    setJoinInputCode('');
    setErrorMessage(null);
  };

  // 6. Leave space
  const handleLeaveSpace = async () => {
    const myDevice = deviceInfoRef.current || getDeviceInfo();
    try {
      await fetch(`/api/paste/${code}?action=leave&deviceId=${myDevice.deviceId}`, {
        method: 'DELETE',
      });
    } catch {
      // Ignore
    }
    clearSpaceFromLocal();
    setCode('');
    setItems([]);
    setDevices([]);
    seenIdsRef.current.clear();
    setErrorMessage(null);
  };

  // 7. Clear all items
  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all items from this clipboard space?')) {
      return;
    }
    try {
      await fetch(`/api/paste/${code}?action=clear`, {
        method: 'DELETE',
      });
      setItems([]);
      seenIdsRef.current.clear();
      setToastMessage('Clipboard space cleared');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.warn('Clear error:', err);
    }
  };

  // 8. Send text or link into space
  const handleSendItem = async (textToSend?: string) => {
    const raw = textToSend !== undefined ? textToSend : inputText;
    const text = raw.trim();
    if (!text || !code) return;

    const byteLen = new Blob([text]).size;
    if (byteLen > CLIPBOARD_CONFIG.MAX_ITEM_SIZE_BYTES) {
      setProModalReason(
        `Item is ${(byteLen / 1024).toFixed(1)}KB. Free tier limit is 10KB per item. Upgrade to ShaeIt Pro for large payloads!`
      );
      setShowProModal(true);
      return;
    }

    if (items.length >= CLIPBOARD_CONFIG.MAX_ITEMS_PER_SPACE) {
      setProModalReason(CLIPBOARD_CONFIG.PRO_UPGRADE_MESSAGE);
      setShowProModal(true);
      return;
    }

    setIsSending(true);
    setErrorMessage(null);
    const myDevice = deviceInfoRef.current || getDeviceInfo();

    try {
      const res = await fetch('/api/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          text,
          deviceId: myDevice.deviceId,
          deviceName: myDevice.deviceName,
          deviceType: myDevice.deviceType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'item_limit_reached' || data.error === 'size_limit_reached') {
          setProModalReason(data.message || CLIPBOARD_CONFIG.PRO_UPGRADE_MESSAGE);
          setShowProModal(true);
        } else {
          setErrorMessage(data.message || 'Failed to send item');
        }
        return;
      }

      setInputText('');
      if (data.item) {
        seenIdsRef.current.add(data.item.id);
        setItems((prev) => [data.item, ...prev.filter((i) => i.id !== data.item.id)]);
      }
      setToastMessage('Sent to clipboard space!');
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error occurred');
    } finally {
      setIsSending(false);
    }
  };

  // 9. Paste from System Clipboard button
  const handlePasteFromSystemClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim()) {
          setInputText(clipText);
          setErrorMessage(null);
          return;
        }
      }
      setErrorMessage('Clipboard is empty or permission denied. Please paste with Ctrl+V.');
    } catch {
      setErrorMessage('Browser permission needed. Please paste manually with Ctrl+V.');
    }
  };

  // 10. Copy item to clipboard
  const handleCopyItem = async (id: string, text: string) => {
    const success = await copyText(text);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // 11. Pin / Unpin item
  const handleTogglePin = async (id: string, currentlyPinned: boolean) => {
    const action = currentlyPinned ? 'unpin' : 'pin';
    try {
      const res = await fetch(`/api/paste/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, itemId: id }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, pinned: !currentlyPinned } : item))
        );
      }
    } catch (err) {
      console.warn('Pin toggle error:', err);
    }
  };

  // 12. Delete item
  const handleDeleteItem = async (id: string) => {
    try {
      const res = await fetch(`/api/paste/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', itemId: id }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.warn('Delete item error:', err);
    }
  };

  // 13. Keyboard Shortcuts (Ctrl+Enter to send, Ctrl+V support)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendItem();
    }
  };

  if (!mounted) {
    return (
      <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center min-h-[350px] flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-semibold">Connecting to Clipboard Space...</p>
      </div>
    );
  }

  const effectiveOrigin = typeof window !== 'undefined' ? window.location.origin : getAppBaseUrl();
  const inviteUrl = code ? `${effectiveOrigin}/paste/${code}` : '';
  const currentBytes = new Blob([inputText]).size;
  const isNearLimit = currentBytes > CLIPBOARD_CONFIG.MAX_ITEM_SIZE_BYTES * 0.9;

  // VIEW 1: NOT PAIRED YET -> CREATE OR JOIN
  if (!code) {
    return (
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 max-w-xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
            <Clipboard className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-white">Cross-Device Clipboard</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Instant 2-way text and link sync between your PC, phones, and tablets.
            No login required • Auto-expires in 24 hours.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4 pt-2">
          {/* Option A: Create New Space */}
          <div className="p-5 bg-slate-900/70 border border-slate-800 hover:border-indigo-500/40 rounded-xl flex flex-col justify-between space-y-4 transition-all">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                Start New
              </span>
              <h3 className="text-sm font-bold text-white pt-1">Create Clipboard Space</h3>
              <p className="text-[11px] text-slate-400">
                Generates a fresh 6-character room & QR code for up to 3 devices.
              </p>
            </div>

            <button
              onClick={handleCreateSpace}
              className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Space</span>
            </button>
          </div>

          {/* Option B: Join Existing Space */}
          <div className="p-5 bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 rounded-xl flex flex-col justify-between space-y-4 transition-all">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Join
              </span>
              <h3 className="text-sm font-bold text-white pt-1">Join with 6-Character Code</h3>
              <p className="text-[11px] text-slate-400">
                Enter the code shown on your other device screen.
              </p>
            </div>

            <form onSubmit={handleJoinSpace} className="space-y-2">
              <input
                type="text"
                value={joinInputCode}
                onChange={(e) => {
                  setJoinInputCode(e.target.value.toUpperCase());
                  setErrorMessage(null);
                }}
                maxLength={8}
                placeholder="e.g. A9K3P2"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-center font-mono font-bold tracking-widest text-indigo-400 focus:outline-none focus:border-indigo-500 uppercase text-xs"
              />
              <button
                type="submit"
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Join Space</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            Zero Server Persistence
          </span>
          <span>Max 3 devices • 10 items free</span>
        </div>
      </div>
    );
  }

  // VIEW 2: ACTIVE PAIRED CLIPBOARD SPACE
  return (
    <div className="space-y-4">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce max-w-sm">
          <div className="bg-indigo-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-indigo-400">
            <div className="p-2 bg-indigo-700/80 rounded-xl">
              <Bell className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Live Clipboard</p>
              <p className="text-xs text-indigo-100">{toastMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* PRO TIER PLACEHOLDER MODAL */}
      {showProModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-amber-500/40 max-w-md w-full space-y-4 shadow-2xl shadow-amber-950/40 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <Crown className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Free Space Limit Reached</h3>
              </div>
              <button
                onClick={() => setShowProModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {proModalReason || CLIPBOARD_CONFIG.PRO_UPGRADE_MESSAGE}
            </p>

            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1.5 text-xs text-slate-400">
              <div className="font-semibold text-slate-200">ShaeIt Pro Plan (Coming Soon):</div>
              <ul className="space-y-1 text-[11px] text-slate-300">
                <li>✨ Unlimited concurrent devices per space</li>
                <li>✨ 100+ clipboard items history with search</li>
                <li>✨ Up to 1MB per clipboard item</li>
                <li>✨ 30-day extended expiration</li>
              </ul>
            </div>

            <button
              onClick={() => setShowProModal(false)}
              className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
            >
              Got it, Continue Free
            </button>
          </div>
        </div>
      )}

      {/* QR CODE INVITE MODAL */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 max-w-sm w-full space-y-4 text-center">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-indigo-400" />
                <span>Scan to Join Space</span>
              </h3>
              <button
                onClick={() => setShowQrModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl inline-block mx-auto shadow-xl border-4 border-slate-800">
              <QRCodeSVG value={inviteUrl} size={190} level="M" />
            </div>

            <div>
              <p className="text-xs text-slate-400">Session Code:</p>
              <p className="text-2xl font-mono font-black tracking-widest text-indigo-400">
                {code}
              </p>
            </div>

            <button
              onClick={async () => {
                await copyText(inviteUrl);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-all"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
            </button>
          </div>
        </div>
      )}

      {/* SPACE HEADER BAR */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400 shrink-0">
            <Clipboard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Clipboard Space:</h3>
              <span className="font-mono text-base font-black text-indigo-400 tracking-wider bg-slate-950 px-2.5 py-0.5 rounded-lg border border-slate-800">
                {code}
              </span>
              <button
                onClick={async () => {
                  await copyText(code);
                  setToastMessage('Space code copied!');
                  setTimeout(() => setToastMessage(null), 2000);
                }}
                className="p-1 text-slate-400 hover:text-white"
                title="Copy space code"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
              <Clock className="w-3 h-3 text-indigo-400" />
              <span>Auto-expires after 24h</span>
              <span>•</span>
              <span className="text-emerald-400 font-medium">2-Way Live Sync</span>
            </div>
          </div>
        </div>

        {/* Connected Devices & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Devices Count Badge */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs">
            <span className="text-[10px] text-slate-400 font-semibold">Devices:</span>
            <span className="font-mono font-bold text-indigo-400">
              {devices.length}/{CLIPBOARD_CONFIG.MAX_DEVICES_PER_SPACE}
            </span>
            <div className="flex items-center gap-1 pl-1">
              {devices.map((d, i) => (
                <span
                  key={d.deviceId || i}
                  title={`${d.deviceName} (${d.deviceType})`}
                  className="text-slate-400 hover:text-white"
                >
                  {d.deviceType === 'mobile' ? (
                    <Smartphone className="w-3 h-3 text-emerald-400" />
                  ) : d.deviceType === 'tablet' ? (
                    <Tablet className="w-3 h-3 text-amber-400" />
                  ) : (
                    <Laptop className="w-3 h-3 text-indigo-400" />
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* QR Invite button */}
          <button
            onClick={() => setShowQrModal(true)}
            className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl flex items-center gap-1.5 transition-all"
            title="Show QR Code to pair another device"
          >
            <QrCode className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Invite / QR</span>
          </button>

          {/* Clear All button */}
          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-2.5 py-1 text-xs font-semibold text-slate-400 hover:text-rose-400 bg-slate-950 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-900/40 rounded-xl flex items-center gap-1 transition-all"
              title="Clear all items in space"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear All</span>
            </button>
          )}

          {/* Leave Space button */}
          <button
            onClick={handleLeaveSpace}
            className="px-2.5 py-1 text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl flex items-center gap-1 transition-all"
            title="Leave this clipboard space"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave Space</span>
          </button>
        </div>
      </div>

      {/* INPUT AREA: TYPE OR PASTE TEXT */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Send Text or Link to All Paired Devices
          </span>
          <button
            type="button"
            onClick={handlePasteFromSystemClipboard}
            className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer text-xs"
          >
            <Clipboard className="w-3.5 h-3.5 text-indigo-400" />
            <span>Paste from Clipboard</span>
          </button>
        </div>

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              setErrorMessage(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type or paste links, passwords, text, or notes here... (Press Ctrl+Enter to send)"
            rows={3}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500 resize-none leading-relaxed placeholder:text-slate-600"
          />
        </div>

        <div className="flex items-center justify-between">
          <span
            className={`text-[11px] font-mono ${
              isNearLimit ? 'text-rose-400 font-bold' : 'text-slate-500'
            }`}
          >
            {currentBytes} / {CLIPBOARD_CONFIG.MAX_ITEM_SIZE_BYTES} bytes
          </span>

          <button
            onClick={() => handleSendItem()}
            disabled={isSending || !inputText.trim()}
            className="py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSending ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>Send to Space</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* CLIPBOARD HISTORY LIST (NEWEST FIRST) */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Space History ({items.length}/{CLIPBOARD_CONFIG.MAX_ITEMS_PER_SPACE})
            </h4>
          </div>
          <span className="text-[11px] text-slate-500">
            {items.some((i) => i.pinned) ? 'Pinned items prioritized' : 'Newest items first'}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl space-y-2">
            <Clipboard className="w-8 h-8 text-slate-600 mx-auto opacity-50" />
            <p className="text-xs font-semibold text-slate-400">No clipboard items in space yet</p>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
              Type above, press Ctrl+V, or send from any connected device to see it appear here instantly.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const isUrl = item.isUrl;
              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                    item.pinned
                      ? 'bg-slate-900/90 border-amber-500/40 shadow-md shadow-amber-950/20'
                      : 'bg-slate-950/70 border-slate-800 hover:border-indigo-500/30'
                  }`}
                >
                  {/* Top Meta Header */}
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Pinned Tag */}
                      {item.pinned && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Pin className="w-3 h-3 fill-amber-300" />
                          Pinned
                        </span>
                      )}

                      {/* Source Device */}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1">
                        {item.deviceType === 'mobile' ? (
                          <Smartphone className="w-3 h-3 text-emerald-400" />
                        ) : item.deviceType === 'tablet' ? (
                          <Tablet className="w-3 h-3 text-amber-400" />
                        ) : (
                          <Laptop className="w-3 h-3 text-indigo-400" />
                        )}
                        <span>{item.deviceName}</span>
                      </span>

                      {/* Time */}
                      <span className="text-[10px] text-slate-500">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>

                    {/* Action Buttons: Pin, Copy, Open URL, Delete */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Pin/Unpin */}
                      <button
                        onClick={() => handleTogglePin(item.id, item.pinned)}
                        className={`p-1.5 rounded-lg transition-all ${
                          item.pinned
                            ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                        title={item.pinned ? 'Unpin item' : 'Pin to top'}
                      >
                        {item.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                      </button>

                      {/* Open URL Button if detected */}
                      {isUrl && (
                        <a
                          href={item.text}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/40 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                          title="Open URL in new tab"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Open</span>
                        </a>
                      )}

                      {/* Copy Button */}
                      <button
                        onClick={() => handleCopyItem(item.id, item.text)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                        title="Copy to clipboard"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-all"
                        title="Delete item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Text Content */}
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 font-mono text-xs text-slate-200 whitespace-pre-wrap break-words select-all max-h-48 overflow-y-auto">
                    {item.text}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
