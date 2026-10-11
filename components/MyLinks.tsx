'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { formatBytes } from '@/lib/webrtc';
import { getDictionary } from '@/lib/translations';
import { LinkStatsResponse } from '@/lib/redis';
import {
  Eye,
  Download,
  Clock,
  Copy,
  Check,
  Trash2,
  Bell,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  Crown,
} from 'lucide-react';

export interface StoredMyLink {
  id: string;
  ownerToken: string;
  name: string;
  size: number;
  expiresAt: number;
  createdAt: number;
  url: string;
}

export const STORAGE_KEY_MY_LINKS = 'shaeit_my_links';

export function saveCreatedLinkToStorage(link: StoredMyLink) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MY_LINKS);
    const existing: StoredMyLink[] = raw ? JSON.parse(raw) : [];
    // Filter out already expired and duplicates
    const now = Date.now();
    const updated = [
      link,
      ...existing.filter((item) => item.id !== link.id && item.expiresAt > now),
    ];
    localStorage.setItem(STORAGE_KEY_MY_LINKS, JSON.stringify(updated));
    // Dispatch custom event so MyLinks component updates immediately
    window.dispatchEvent(new Event('shaeit_links_updated'));
  } catch (err) {
    console.warn('Failed to save link to localStorage:', err);
  }
}

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp || timestamp <= 0) return 'No activity yet';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function formatTimeRemaining(expiresAt: number): string {
  const diffMs = expiresAt - Date.now();
  if (diffMs <= 0) return 'Expired';
  const mins = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(mins / 60);
  if (hours > 0) {
    return `${hours}h ${mins % 60}m left`;
  }
  return `${mins}m left`;
}

interface MyLinksProps {
  onOpenPremium?: () => void;
}

export const MyLinks: React.FC<MyLinksProps> = ({ onOpenPremium }) => {
  const t = getDictionary('en').myLinks;
  const [links, setLinks] = useState<StoredMyLink[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, LinkStatsResponse>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Keep ref of stats for comparison in polling
  const statsMapRef = useRef<Record<string, LinkStatsResponse>>({});
  statsMapRef.current = statsMap;

  const loadLinksFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_MY_LINKS);
      if (raw) {
        const parsed: StoredMyLink[] = JSON.parse(raw);
        const now = Date.now();
        // Remove expired links
        const active = parsed.filter((item) => item.expiresAt > now);
        setLinks(active);
        if (active.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY_MY_LINKS, JSON.stringify(active));
        }
      } else {
        setLinks([]);
      }
    } catch {
      setLinks([]);
    }
  }, []);

  useEffect(() => {
    loadLinksFromStorage();

    const handleUpdate = () => loadLinksFromStorage();
    window.addEventListener('shaeit_links_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('shaeit_links_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [loadLinksFromStorage]);

  // Poll statistics every 5 seconds for each active link
  useEffect(() => {
    if (links.length === 0) return;

    let isCancelled = false;

    const pollStats = async () => {
      const now = Date.now();
      const activeLinks = links.filter((l) => l.expiresAt > now);

      for (const link of activeLinks) {
        if (isCancelled) break;
        try {
          const res = await fetch(`/api/stats/${link.id}?token=${link.ownerToken}`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              const newStats: LinkStatsResponse = json.data;
              const prev = statsMapRef.current[link.id];

              // Check if opens count increased -> trigger in-page toast!
              if (prev && typeof prev.opens === 'number' && newStats.opens > prev.opens) {
                const toast = t.toastOpened.replace('{name}', link.name);
                setToastMessage(toast);
                setTimeout(() => setToastMessage(null), 4000);
              }

              if (!isCancelled) {
                setStatsMap((prevMap) => ({
                  ...prevMap,
                  [link.id]: newStats,
                }));
              }
            }
          }
        } catch {
          // Polling network skip
        }
      }
    };

    // Initial fetch immediately
    pollStats();

    // 5-second interval poll
    const interval = setInterval(pollStats, 5000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [links, t.toastOpened]);

  const handleCopy = (id: string, url: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleRemove = (id: string) => {
    const updated = links.filter((l) => l.id !== id);
    setLinks(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_MY_LINKS, JSON.stringify(updated));
    }
  };

  if (links.length === 0) {
    return null; // Keep view completely clean if user hasn't created any links yet
  }

  return (
    <div className="space-y-4 pt-2">
      {/* In-page Toast Notification for Link Activity */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce max-w-sm">
          <div className="bg-indigo-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-indigo-400">
            <div className="p-2 bg-indigo-700/80 rounded-xl">
              <Bell className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Live Activity Alert</p>
              <p className="text-xs text-indigo-100">{toastMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header Panel */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">{t.title}</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                  {links.length} Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">{t.subtitle}</p>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 self-start sm:self-auto bg-slate-950/70 px-3 py-1 rounded-lg border border-slate-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{t.privacyNotice}</span>
          </div>
        </div>

        {/* Links List */}
        <div className="space-y-3">
          {links.map((link) => {
            const stats = statsMap[link.id];
            const opensCount = stats?.opens ?? 0;
            const downloadsCount = stats?.downloads ?? 0;

            // Determine latest activity timestamp
            const latestTimestamp = Math.max(
              stats?.lastOpenedAt || 0,
              stats?.lastDownloadedAt || 0
            );
            const latestAction =
              stats?.lastDownloadedAt && stats.lastDownloadedAt >= (stats?.lastOpenedAt || 0)
                ? t.lastDownloaded
                : stats?.lastOpenedAt
                ? t.lastOpened
                : null;

            const isExpired = Date.now() > link.expiresAt;

            return (
              <div
                key={link.id}
                className="bg-slate-950/70 hover:bg-slate-950 border border-slate-800/80 rounded-xl p-4 transition-all space-y-3"
              >
                {/* Top Row: File Name & Quick Actions */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-white truncate max-w-[240px] sm:max-w-md">
                        {link.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {formatBytes(link.size)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                      <Clock className="w-3 h-3 text-indigo-400 shrink-0" />
                      <span>{formatTimeRemaining(link.expiresAt)}</span>
                    </div>
                  </div>

                  {/* Copy & Delete Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleCopy(link.id, link.url)}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                      title={t.copyLink}
                    >
                      {copiedId === link.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">{t.copied}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t.copyLink}</span>
                        </>
                      )}
                    </button>

                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 rounded-lg transition-all"
                      title="Open Link"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => handleRemove(link.id)}
                      className="p-1.5 bg-slate-900 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-900/50 rounded-lg transition-all"
                      title={t.remove}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Bottom Row: Metrics & Activity */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-900 text-xs">
                  <div className="flex items-center gap-3">
                    {/* Opens Metric */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-300 font-mono">
                      <Eye className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="font-bold">{opensCount}</span>
                      <span className="text-[10px] text-indigo-400 font-sans">{t.opens}</span>
                    </div>

                    {/* Downloads Metric */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 font-mono">
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-bold">{downloadsCount}</span>
                      <span className="text-[10px] text-emerald-400 font-sans">{t.downloads}</span>
                    </div>
                  </div>

                  {/* Relative Last Activity */}
                  <div className="text-[11px] text-slate-400">
                    <span className="text-slate-500">{t.lastActivity}: </span>
                    <span className="text-slate-300 font-medium">
                      {latestAction
                        ? `${latestAction} ${formatRelativeTime(latestTimestamp)}`
                        : t.never}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Notice */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1 text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Links auto-delete upon expiration</span>
          </span>
          <span className="text-slate-500">
            Real-time activity tracking active
          </span>
        </div>
      </div>
    </div>
  );
};
