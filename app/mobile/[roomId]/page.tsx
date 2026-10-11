'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { CHUNK_SIZE, formatBytes, TransferMessage, PEER_ICE_CONFIG } from '@/lib/webrtc';
import { FREE_TIER_LIMITS } from '@/lib/types';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Zap,
  Loader2,
  FileUp,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';

export default function MobileSenderPage() {
  const params = useParams();
  const roomId = params?.roomId as string;

  const [mounted, setMounted] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('Connecting to PC...');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendPercentage, setSendPercentage] = useState<number>(0);
  const [speedMBps, setSpeedMBps] = useState<number>(0);
  const [transferredFilesCount, setTransferredFilesCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!roomId) return;

    let peerInstance: Peer | null = null;
    let isCancelled = false;

    const connectToPC = async () => {
      if (typeof window === 'undefined') return;

      try {
        setStatus('Initializing WebRTC...');
        setErrorMessage(null);

        const { default: Peer } = await import('peerjs');
        if (isCancelled) return;

        const mobilePeerId = `shaeit-mob-${Math.floor(Math.random() * 1000000)}`;
        peerInstance = new Peer(mobilePeerId, PEER_ICE_CONFIG);
        peerRef.current = peerInstance;

        peerInstance.on('open', () => {
          if (isCancelled) return;
          setStatus('Searching for PC session...');
          const targetPcPeerId = `shaeit-pc-${roomId}`;
          const conn = peerInstance!.connect(targetPcPeerId, { reliable: true });

          connRef.current = conn;

          conn.on('open', () => {
            if (isCancelled) return;
            setIsConnected(true);
            setStatus('Connected to PC!');
            setErrorMessage(null);
          });

          conn.on('close', () => {
            if (isCancelled) return;
            setIsConnected(false);
            setStatus('Disconnected from PC');
          });

          conn.on('error', (err) => {
            console.error('Mobile connection error:', err);
            if (isCancelled) return;
            setErrorMessage('Could not connect to PC. Make sure PC has ShaeIt open on the same session code.');
          });
        });

        peerInstance.on('error', (err) => {
          console.error('Peer error on mobile:', err);
          if (isCancelled) return;
          setStatus('Connection Failed');
          setErrorMessage('Could not establish WebRTC link. Ensure PC screen shows code ' + roomId);
        });
      } catch (err: any) {
        console.error('Failed to initialize PeerJS on mobile:', err);
        if (isCancelled) return;
        setStatus('WebRTC Error');
        setErrorMessage(err?.message || 'Failed to initialize peer connection');
      }
    };

    connectToPC();

    return () => {
      isCancelled = true;
      if (connRef.current) connRef.current.close();
      if (peerInstance) peerInstance.destroy();
    };
  }, [roomId, retryCount]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const maxSizeBytes = FREE_TIER_LIMITS.maxP2PFileSizeMB * 1024 * 1024;

      if (file.size > maxSizeBytes) {
        setErrorMessage(
          `File size exceeds Free limit of ${FREE_TIER_LIMITS.maxP2PFileSizeMB}MB. Upgrade to Premium for larger files!`
        );
        setSelectedFile(null);
        return;
      }

      setErrorMessage(null);
      setSelectedFile(file);
    }
  };

  const startStreamingFile = async () => {
    if (!selectedFile || !connRef.current || !isConnected) return;

    setIsSending(true);
    setSendPercentage(0);

    const conn = connRef.current;
    const file = selectedFile;

    // 1. Send Header
    const headerMsg: TransferMessage = {
      type: 'header',
      name: file.name,
      size: file.size,
      mimeType: file.type,
    };
    conn.send(headerMsg);

    // 2. Stream Chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let sentBytes = 0;
    const startTime = Date.now();

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const slice = file.slice(start, end);
      const arrayBuffer = await slice.arrayBuffer();

      conn.send({
        type: 'chunk',
        data: arrayBuffer,
      });

      sentBytes += arrayBuffer.byteLength;
      const pct = Math.min(100, Math.round((sentBytes / file.size) * 100));
      setSendPercentage(pct);

      const elapsedTime = (Date.now() - startTime) / 1000;
      if (elapsedTime > 0) {
        const speed = Number((sentBytes / (1024 * 1024 * elapsedTime)).toFixed(2));
        setSpeedMBps(speed);
      }

      // Small tick delay to avoid WebRTC buffer overflow on low-end mobile CPUs
      if (i % 20 === 0) {
        await new Promise((r) => setTimeout(r, 5));
      }
    }

    // 3. Send End Signal
    conn.send({ type: 'end' });

    setIsSending(false);
    setTransferredFilesCount((prev) => prev + 1);
    setSelectedFile(null);
    setSendPercentage(100);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-2" />
        <p className="text-xs text-slate-400">Loading Mobile Receiver...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Mobile Receiver Error">
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4">
        {/* Mobile Top Header */}
        <header className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">ShaeIt Mobile</h1>
              <p className="text-[10px] text-slate-400">Direct PC Link</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isConnected && (
              <button
                onClick={() => setRetryCount((c) => c + 1)}
                title="Retry connecting to PC"
                className="px-2 py-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs flex items-center gap-1 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}
            <span
              className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                isConnected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
              }`}
            >
              {status}
            </span>
          </div>
        </header>

        {/* Main Action Area */}
        <main className="my-auto py-6 space-y-6">
          <div className="text-center">
            <Smartphone className="w-12 h-12 text-indigo-400 mx-auto mb-2" />
            <h2 className="text-xl font-extrabold text-white">
              Send File to PC
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Session Code: <span className="text-indigo-400 font-mono font-bold">{roomId}</span>
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between text-rose-400 text-xs">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                onClick={() => setRetryCount((c) => c + 1)}
                className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded text-[11px] font-bold text-rose-300 shrink-0 ml-2"
              >
                Retry Link
              </button>
            </div>
          )}

          {/* Large File Touch Dropzone */}
          <div className="relative">
            <input
              type="file"
              onChange={handleFileSelect}
              disabled={isSending}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
            />
            <div
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                selectedFile
                  ? 'border-emerald-500/50 bg-emerald-950/20'
                  : 'border-indigo-500/50 bg-indigo-950/20 hover:bg-indigo-950/30'
              }`}
            >
              <UploadCloud className="w-12 h-12 text-indigo-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-white">
                {selectedFile ? selectedFile.name : 'Tap to Select File'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {selectedFile
                  ? `${formatBytes(selectedFile.size)} selected`
                  : 'Photos, Videos, PDFs, Zip files up to 2GB'}
              </p>
            </div>
          </div>

          {/* Streaming Progress Bar */}
          {isSending && (
            <div className="p-4 bg-slate-900 border border-indigo-500/30 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                  Sending to PC...
                </span>
                <span className="font-mono text-indigo-400 font-bold">
                  {sendPercentage}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-150"
                  style={{ width: `${sendPercentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>Local Wi-Fi Stream</span>
                <span className="text-emerald-400 font-bold">⚡ {speedMBps} MB/s</span>
              </div>
            </div>
          )}

          {/* Send Button */}
          {selectedFile && !isSending && (
            <button
              onClick={startStreamingFile}
              disabled={!isConnected}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <FileUp className="w-5 h-5" />
              {isConnected
                ? `Send ${selectedFile.name} to PC Now`
                : `Waiting for PC (${roomId})...`}
            </button>
          )}
        </main>

        {/* Footer Info */}
        <footer className="pt-4 border-t border-slate-800 text-center text-[11px] text-slate-500">
          Direct WebRTC Local Transfer • Zero Cloud Storage Used
        </footer>
      </div>
    </ErrorBoundary>
  );
}
