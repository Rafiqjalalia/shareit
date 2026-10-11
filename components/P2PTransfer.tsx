'use client';

import React, { useEffect, useState, useRef } from 'react';
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import {
  CHUNK_SIZE,
  formatBytes,
  triggerFileDownload,
  TransferMessage,
  PEER_ICE_CONFIG,
} from '@/lib/webrtc';
import { TransferProgress } from '@/lib/types';
import {
  Download,
  Send,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Zap,
  HardDriveDownload,
  Loader2,
  FileIcon,
} from 'lucide-react';

interface P2PTransferProps {
  roomId: string;
  onConnectionChange: (connected: boolean) => void;
}

export const P2PTransfer: React.FC<P2PTransferProps> = ({
  roomId,
  onConnectionChange,
}) => {
  const [mounted, setMounted] = useState(false);
  const [peerStatus, setPeerStatus] = useState<string>('Initializing WebRTC...');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [receivedFiles, setReceivedFiles] = useState<
    Array<{ name: string; size: number; time: string; blobUrl: string }>
  >([]);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  // Buffer accumulator for incoming file chunks
  const incomingHeaderRef = useRef<{
    name: string;
    size: number;
    mimeType: string;
  } | null>(null);
  const incomingChunksRef = useRef<ArrayBuffer[]>([]);
  const receivedBytesRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
    let peerInstance: Peer | null = null;

    const initPeer = async () => {
      if (typeof window === 'undefined') return;

      try {
        const { default: Peer } = await import('peerjs');
        const peerId = `shaeit-pc-${roomId}`;
        peerInstance = new Peer(peerId, PEER_ICE_CONFIG);

        peerRef.current = peerInstance;

        peerInstance.on('open', (id) => {
          setPeerStatus('Ready for mobile scan');
        });

        peerInstance.on('connection', (conn) => {
          connRef.current = conn;

          conn.on('open', () => {
            setIsConnected(true);
            onConnectionChange(true);
            setPeerStatus('Mobile Device Connected!');
          });

          conn.on('data', (rawMsg) => {
            handleIncomingData(rawMsg as TransferMessage);
          });

          conn.on('close', () => {
            setIsConnected(false);
            onConnectionChange(false);
            setPeerStatus('Mobile disconnected');
          });

          conn.on('error', (err) => {
            console.error('Peer connection error:', err);
            setPeerStatus('Connection error');
          });
        });

        peerInstance.on('error', (err) => {
          console.warn('Peer error (retrying with alternate server if needed):', err);
          if (err.type === 'unavailable-id') {
            setPeerStatus('Session code taken, refresh QR code');
          } else {
            setPeerStatus('Waiting for connection...');
          }
        });
      } catch (err) {
        console.error('Failed to initialize PeerJS:', err);
        setPeerStatus('WebRTC Initialization Failed');
      }
    };

    if (roomId) initPeer();

    return () => {
      if (connRef.current) connRef.current.close();
      if (peerInstance) peerInstance.destroy();
    };
  }, [roomId]);

  const handleIncomingData = (msg: TransferMessage) => {
    if (msg.type === 'header') {
      incomingHeaderRef.current = {
        name: msg.name,
        size: msg.size,
        mimeType: msg.mimeType,
      };
      incomingChunksRef.current = [];
      receivedBytesRef.current = 0;
      startTimeRef.current = Date.now();

      setProgress({
        fileName: msg.name,
        fileSize: msg.size,
        bytesTransferred: 0,
        percentage: 0,
        speedMBps: 0,
        status: 'transferring',
      });
    } else if (msg.type === 'chunk') {
      if (!incomingHeaderRef.current) return;
      incomingChunksRef.current.push(msg.data);
      receivedBytesRef.current += msg.data.byteLength;

      const totalSize = incomingHeaderRef.current.size;
      const pct = Math.min(100, Math.round((receivedBytesRef.current / totalSize) * 100));

      const elapsedTime = (Date.now() - startTimeRef.current) / 1000;
      const speedMBps =
        elapsedTime > 0
          ? Number((receivedBytesRef.current / (1024 * 1024 * elapsedTime)).toFixed(2))
          : 0;

      setProgress({
        fileName: incomingHeaderRef.current.name,
        fileSize: totalSize,
        bytesTransferred: receivedBytesRef.current,
        percentage: pct,
        speedMBps: speedMBps,
        status: 'transferring',
      });
    } else if (msg.type === 'end') {
      if (!incomingHeaderRef.current) return;

      const header = incomingHeaderRef.current;
      const blob = new Blob(incomingChunksRef.current, {
        type: header.mimeType || 'application/octet-stream',
      });

      let blobUrl = '';
      if (typeof window !== 'undefined' && window.URL) {
        blobUrl = URL.createObjectURL(blob);
      }

      // Auto trigger browser download
      triggerFileDownload(blob, header.name);

      setReceivedFiles((prev) => [
        {
          name: header.name,
          size: header.size,
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          blobUrl,
        },
        ...prev,
      ]);

      setProgress({
        fileName: header.name,
        fileSize: header.size,
        bytesTransferred: header.size,
        percentage: 100,
        speedMBps: 0,
        status: 'completed',
      });

      // Clear buffer
      incomingHeaderRef.current = null;
      incomingChunksRef.current = [];
    }
  };

  if (!mounted) {
    return (
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center min-h-[420px]">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-2" />
        <p className="text-xs text-slate-400">Loading Receiver Interface...</p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between min-h-[420px]">
      <div>
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Direct Local Receiver</h3>
              <p className="text-xs text-slate-400">P2P Wi-Fi transfer active (No server storage)</p>
            </div>
          </div>

          <span
            className={`px-3 py-1 text-xs font-semibold rounded-full border ${
              isConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800/80 border-slate-700 text-slate-400'
            }`}
          >
            {peerStatus}
          </span>
        </div>

        {/* Transfer Progress HUD */}
        {progress && progress.status === 'transferring' && (
          <div className="p-5 bg-slate-900/90 rounded-xl border border-indigo-500/30 mb-6 shadow-xl animate-pulse-fast">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 overflow-hidden max-w-[70%]">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                <span className="text-sm font-semibold text-white truncate">
                  {progress.fileName}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-400">
                {progress.percentage}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-150 ease-out"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>
                {formatBytes(progress.bytesTransferred)} / {formatBytes(progress.fileSize)}
              </span>
              <span className="text-emerald-400 font-bold">
                ⚡ {progress.speedMBps} MB/s
              </span>
            </div>
          </div>
        )}

        {progress && progress.status === 'completed' && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl mb-6 flex items-center justify-between text-emerald-300">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-bold">{progress.fileName} Received!</p>
                <p className="text-[11px] text-emerald-400/80">
                  Auto-download triggered on PC
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Received Files Log */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <HardDriveDownload className="w-4 h-4 text-indigo-400" />
            Transferred Files ({receivedFiles.length})
          </h4>

          {receivedFiles.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl">
              <FileIcon className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-slate-400">No files received yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Scan QR code with Mobile & select files to stream directly
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {receivedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 hover:border-indigo-500/30 transition-all"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <p className="text-xs font-semibold text-slate-200 truncate">
                        {file.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {formatBytes(file.size)} • {file.time}
                      </p>
                    </div>
                  </div>

                  {file.blobUrl && (
                    <a
                      href={file.blobUrl}
                      download={file.name}
                      className="p-2 text-indigo-400 hover:text-white hover:bg-indigo-600 rounded-lg transition-all"
                      title="Download again"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span>WebRTC Direct Transfer</span>
        <span className="font-semibold text-slate-300">Max Speed: Wi-Fi Bandwidth Limit</span>
      </div>
    </div>
  );
};
