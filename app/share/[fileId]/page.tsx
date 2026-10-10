'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { formatBytes } from '@/lib/webrtc';
import {
  Download,
  FileCheck,
  Clock,
  Zap,
  AlertTriangle,
  Loader2,
  HardDriveDownload,
} from 'lucide-react';

export default function ShareDownloadPage() {
  const params = useParams();
  const fileId = params?.fileId as string;

  const [loading, setLoading] = useState<boolean>(true);
  const [fileInfo, setFileInfo] = useState<{
    name?: string;
    size?: number;
    error?: string;
  }>({});

  useEffect(() => {
    // Perform pre-flight check if link exists
    const checkFile = async () => {
      try {
        const res = await fetch(`/api/share/${fileId}`, { method: 'HEAD' });
        if (res.ok) {
          const disposition = res.headers.get('Content-Disposition') || '';
          const length = res.headers.get('Content-Length') || '0';
          let fileName = 'shared-file';
          const match = disposition.match(/filename="(.+?)"/);
          if (match && match[1]) {
            fileName = decodeURIComponent(match[1]);
          }

          setFileInfo({
            name: fileName,
            size: parseInt(length, 10),
          });
        } else {
          setFileInfo({ error: 'This temporary file link has expired or was deleted.' });
        }
      } catch (err) {
        setFileInfo({ error: 'Failed to verify file status' });
      } finally {
        setLoading(false);
      }
    };

    if (fileId) checkFile();
  }, [fileId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4">
      {/* Top Header */}
      <header className="max-w-xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <span className="text-lg font-extrabold text-white">ShaeIt Share</span>
        </div>
        <span className="text-xs text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
          Temporary Share Link
        </span>
      </header>

      {/* Main Download Card */}
      <main className="max-w-xl mx-auto w-full my-auto py-8">
        <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center space-y-6">
          {loading ? (
            <div className="py-12 space-y-3">
              <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-300">
                Verifying temporary file link...
              </p>
            </div>
          ) : fileInfo.error ? (
            <div className="py-8 space-y-4">
              <AlertTriangle className="w-14 h-14 text-rose-400 mx-auto" />
              <h2 className="text-xl font-bold text-white">Link Expired or Not Found</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {fileInfo.error}
              </p>
              <a
                href="/"
                className="inline-block mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
              >
                Go to ShaeIt Home
              </a>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
                <FileCheck className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-white truncate max-w-md mx-auto">
                  {fileInfo.name}
                </h2>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Size: {formatBytes(fileInfo.size || 0)}
                </p>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Temporary link with auto-deletion protection</span>
              </div>

              <a
                href={`/api/share/${fileId}`}
                download
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
              >
                <HardDriveDownload className="w-5 h-5" />
                Download File Now ({formatBytes(fileInfo.size || 0)})
              </a>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-xl mx-auto w-full text-center text-xs text-slate-500 py-4 border-t border-slate-800">
        Powered by ShaeIt • Serverless Cloud Share
      </footer>
    </div>
  );
}
