'use client';

import React, { useState, useEffect } from 'react';
import { formatBytes } from '@/lib/webrtc';
import { FREE_TIER_LIMITS } from '@/lib/types';
import { getAppBaseUrl } from '@/lib/config';
import {
  Globe,
  Clock,
  Upload,
  Copy,
  Check,
  Share2,
  FileCheck,
  AlertTriangle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

interface TempUploadProps {
  onOpenPremium: () => void;
}

export const TempUpload: React.FC<TempUploadProps> = ({ onOpenPremium }) => {
  const [mounted, setMounted] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expiryHours, setExpiryHours] = useState<number>(1);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const maxSizeBytes = FREE_TIER_LIMITS.maxTempFileSizeMB * 1024 * 1024;

      if (file.size > maxSizeBytes) {
        setErrorMessage(
          `File exceeds Free Cloud limit of ${FREE_TIER_LIMITS.maxTempFileSizeMB}MB. Use Same Wi-Fi P2P mode for large files or upgrade to Premium!`
        );
        setSelectedFile(null);
        return;
      }

      setErrorMessage(null);
      setSelectedFile(file);
      setShareUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('expiryHours', expiryHours.toString());

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      const base = getAppBaseUrl();
      const generatedUrl = `${base}/share/${data.fileId}`;
      setShareUrl(generatedUrl);
    } catch (err: any) {
      setErrorMessage(err.message || 'Upload error occurred');
    } finally {
      setIsUploading(false);
    }
  };

  const copyUrl = () => {
    if (!shareUrl) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!mounted) {
    return (
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center min-h-[420px]">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-2" />
        <p className="text-xs text-slate-400">Loading Cloud Uploader...</p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between min-h-[420px]">
      <div>
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Temporary Cloud Share</h3>
              <p className="text-xs text-slate-400">Share files via temporary link (Any Location)</p>
            </div>
          </div>

          <span className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            Auto-Expiring Link
          </span>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl mb-4 text-xs text-rose-400 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={onOpenPremium}
              className="text-amber-400 font-bold underline shrink-0 ml-2"
            >
              Upgrade
            </button>
          </div>
        )}

        {/* Dropzone */}
        <div className="relative mb-4">
          <input
            type="file"
            onChange={handleFileChange}
            disabled={isUploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 text-center bg-slate-900/40 hover:bg-slate-900/70 transition-all">
            <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-white">
              {selectedFile ? selectedFile.name : 'Choose File for Temporary Share'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {selectedFile
                ? `${formatBytes(selectedFile.size)} ready`
                : 'Free tier limit: 100MB • Any file type'}
            </p>
          </div>
        </div>

        {/* Expiration Time Selector */}
        <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800 mb-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>Link Expiration:</span>
          </div>

          <div className="flex gap-1">
            {[1, 6, 24].map((hours) => (
              <button
                key={hours}
                onClick={() => setExpiryHours(hours)}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                  expiryHours === hours
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                {hours}h
              </button>
            ))}
          </div>
        </div>

        {/* Upload Action / Generated Share URL */}
        {selectedFile && !shareUrl && (
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Uploading File...
              </>
            ) : (
              <>
                <Share2 className="w-5 h-5" />
                Generate Temporary Share Link ({expiryHours}h)
              </>
            )}
          </button>
        )}

        {shareUrl && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs text-emerald-300 font-bold">
              <span className="flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                Temporary Link Created!
              </span>
              <span>Expires in {expiryHours} Hour(s)</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-indigo-300 focus:outline-none"
              />
              <button
                onClick={copyUrl}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Serverless Auto-Cleanup
        </span>
        <button
          onClick={onOpenPremium}
          className="text-amber-400 hover:underline font-semibold"
        >
          Need up to 5GB & 7-Day Storage?
        </button>
      </div>
    </div>
  );
};
