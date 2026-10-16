'use client';

import React, { useEffect, useState, useRef } from 'react';
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import {
  CHUNK_SIZE,
  formatBytes,
  triggerFileDownload,
  copyTextToClipboard,
  streamMultipleFiles,
  StreamBatchProgress,
  TransferMessage,
  PEER_ICE_CONFIG,
} from '@/lib/webrtc';
import { DeviceInfo, getDeviceInfo } from '@/lib/device';
import {
  TransferRecord,
  saveTransferRecord,
  getTransferRecords,
  clearTransferRecords,
  exportTransferRecordsJSON,
} from '@/lib/records';
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
  UploadCloud,
  X,
  Clipboard,
  Copy,
  Check,
  Smartphone,
  Laptop,
  History,
  Trash2,
  Share2,
  FileText,
  Plus,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface P2PTransferProps {
  roomId: string;
  onConnectionChange: (connected: boolean, device?: DeviceInfo | null) => void;
}

type ActiveTab = 'files' | 'clipboard' | 'records';

export const P2PTransfer: React.FC<P2PTransferProps> = ({
  roomId,
  onConnectionChange,
}) => {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('files');
  const [peerStatus, setPeerStatus] = useState<string>('Initializing WebRTC...');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectedMobile, setConnectedMobile] = useState<DeviceInfo | null>(null);

  // Send files state (PC to Mobile)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendProgress, setSendProgress] = useState<StreamBatchProgress | null>(null);
  const cancelSendingRef = useRef<boolean>(false);

  // Receive files state (Mobile to PC)
  const [receiveProgress, setReceiveProgress] = useState<{
    fileName: string;
    fileIndex: number;
    totalFiles: number;
    fileSize: number;
    bytesReceived: number;
    percentage: number;
    speedMBps: number;
    status: 'receiving' | 'completed';
    sender?: DeviceInfo;
  } | null>(null);

  const [receivedFiles, setReceivedFiles] = useState<
    Array<{
      id: string;
      name: string;
      size: number;
      time: string;
      blobUrl: string;
      senderName: string;
    }>
  >([]);

  // Clipboard sync state
  const [clipboardText, setClipboardText] = useState<string>('');
  const [clipboardHistory, setClipboardHistory] = useState<
    Array<{
      id: string;
      text: string;
      senderName: string;
      direction: 'sent' | 'received';
      time: string;
    }>
  >([]);
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);

  // Transfer Records state
  const [records, setRecords] = useState<TransferRecord[]>([]);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  // Buffer accumulator for incoming files
  const incomingHeaderRef = useRef<{
    fileId: string;
    name: string;
    size: number;
    mimeType: string;
    fileIndex: number;
    totalFiles: number;
    sender: DeviceInfo;
  } | null>(null);
  const incomingChunksRef = useRef<ArrayBuffer[]>([]);
  const receivedBytesRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  // Refresh records from storage
  const loadRecords = () => {
    setRecords(getTransferRecords());
  };

  useEffect(() => {
    setMounted(true);
    loadRecords();
    let peerInstance: Peer | null = null;

    const initPeer = async () => {
      if (typeof window === 'undefined') return;

      try {
        const { default: Peer } = await import('peerjs');
        const peerId = `shaeit-pc-${roomId}`;
        peerInstance = new Peer(peerId, PEER_ICE_CONFIG);
        peerRef.current = peerInstance;

        const fallbackTimer = setTimeout(() => {
          setPeerStatus((current) =>
            current === 'Initializing WebRTC...' ? 'Ready for mobile scan' : current
          );
        }, 2500);

        peerInstance.on('open', () => {
          clearTimeout(fallbackTimer);
          setPeerStatus('Ready for mobile scan');
        });

        peerInstance.on('connection', (conn) => {
          connRef.current = conn;

          conn.on('open', () => {
            setIsConnected(true);
            setPeerStatus('Mobile Device Connected!');

            // Send host device handshake to mobile
            const pcInfo = getDeviceInfo();
            conn.send({
              type: 'handshake',
              deviceInfo: pcInfo,
            });
          });

          conn.on('data', (rawMsg) => {
            handleIncomingMessage(rawMsg as TransferMessage);
          });

          conn.on('close', () => {
            setIsConnected(false);
            setConnectedMobile(null);
            onConnectionChange(false, null);
            setPeerStatus('Mobile disconnected');
          });

          conn.on('error', (err) => {
            console.error('Peer connection error on PC:', err);
            setPeerStatus('Connection error');
          });
        });

        peerInstance.on('error', (err) => {
          console.warn('Peer error on PC:', err);
          if (err.type === 'unavailable-id') {
            setPeerStatus('Session code taken, refresh QR code');
          } else {
            setPeerStatus('Waiting for mobile connection...');
          }
        });
      } catch (err) {
        console.error('Failed to initialize PeerJS on PC:', err);
        setPeerStatus('WebRTC Initialization Failed');
      }
    };

    if (roomId) initPeer();

    return () => {
      if (connRef.current) connRef.current.close();
      if (peerInstance) peerInstance.destroy();
    };
  }, [roomId]);

  // Handle all incoming messages from Mobile (Handshake, Header, Chunk, End, Clipboard)
  const handleIncomingMessage = (msg: TransferMessage) => {
    if (msg.type === 'handshake') {
      setConnectedMobile(msg.deviceInfo);
      onConnectionChange(true, msg.deviceInfo);
      return;
    }

    if (msg.type === 'clipboard') {
      const timeStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      setClipboardHistory((prev) => [
        {
          id: msg.id,
          text: msg.text,
          senderName: msg.sender?.deviceName || 'Mobile Device',
          direction: 'received',
          time: timeStr,
        },
        ...prev,
      ]);

      setClipboardNotice(`Clipboard received from ${msg.sender?.deviceName || 'Mobile'}!`);
      setTimeout(() => setClipboardNotice(null), 4000);

      // Save to transfer records
      saveTransferRecord({
        direction: 'received',
        senderDevice: msg.sender || {
          deviceId: 'mob',
          deviceName: 'Mobile Device',
          deviceType: 'mobile',
          browser: 'Browser',
          os: 'Mobile OS',
        },
        receiverDevice: getDeviceInfo(),
        type: 'clipboard',
        totalBytes: new Blob([msg.text]).size,
        clipboardSnippet: msg.text.substring(0, 80),
        roomId,
      });
      loadRecords();
      return;
    }

    if (msg.type === 'header') {
      incomingHeaderRef.current = {
        fileId: msg.fileId || `file-${Date.now()}`,
        name: msg.name,
        size: msg.size,
        mimeType: msg.mimeType,
        fileIndex: msg.fileIndex || 1,
        totalFiles: msg.totalFiles || 1,
        sender: msg.sender || connectedMobile || {
          deviceId: 'mob',
          deviceName: 'Mobile Device',
          deviceType: 'mobile',
          browser: 'Browser',
          os: 'Mobile OS',
        },
      };
      incomingChunksRef.current = [];
      receivedBytesRef.current = 0;
      startTimeRef.current = Date.now();

      setReceiveProgress({
        fileName: msg.name,
        fileIndex: msg.fileIndex || 1,
        totalFiles: msg.totalFiles || 1,
        fileSize: msg.size,
        bytesReceived: 0,
        percentage: 0,
        speedMBps: 0,
        status: 'receiving',
        sender: msg.sender || connectedMobile || undefined,
      });
    } else if (msg.type === 'chunk') {
      if (!incomingHeaderRef.current) return;
      incomingChunksRef.current.push(msg.data);
      receivedBytesRef.current += msg.data.byteLength;

      const totalSize = incomingHeaderRef.current.size;
      const pct = Math.min(100, Math.round((receivedBytesRef.current / (totalSize || 1)) * 100));

      const elapsedTime = (Date.now() - startTimeRef.current) / 1000;
      const speedMBps =
        elapsedTime > 0
          ? Number((receivedBytesRef.current / (1024 * 1024 * elapsedTime)).toFixed(2))
          : 0;

      setReceiveProgress({
        fileName: incomingHeaderRef.current.name,
        fileIndex: incomingHeaderRef.current.fileIndex,
        totalFiles: incomingHeaderRef.current.totalFiles,
        fileSize: totalSize,
        bytesReceived: receivedBytesRef.current,
        percentage: pct,
        speedMBps: speedMBps,
        status: 'receiving',
        sender: incomingHeaderRef.current.sender,
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

      // Auto trigger browser download on PC
      triggerFileDownload(blob, header.name);

      const timeStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      setReceivedFiles((prev) => [
        {
          id: header.fileId,
          name: header.name,
          size: header.size,
          time: timeStr,
          blobUrl,
          senderName: header.sender.deviceName,
        },
        ...prev,
      ]);

      setReceiveProgress({
        fileName: header.name,
        fileIndex: header.fileIndex,
        totalFiles: header.totalFiles,
        fileSize: header.size,
        bytesReceived: header.size,
        percentage: 100,
        speedMBps: 0,
        status: 'completed',
        sender: header.sender,
      });

      // Save to records
      saveTransferRecord({
        direction: 'received',
        senderDevice: header.sender,
        receiverDevice: getDeviceInfo(),
        type: 'files',
        files: [
          {
            name: header.name,
            size: header.size,
            mimeType: header.mimeType,
            status: 'completed',
          },
        ],
        totalBytes: header.size,
        roomId,
      });
      loadRecords();

      // Clear buffer
      incomingHeaderRef.current = null;
      incomingChunksRef.current = [];
    }
  };

  // PC to Mobile: Multiple Files Selection
  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // PC to Mobile: Start streaming multiple files
  const handleSendMultipleFiles = async () => {
    if (!connRef.current || !isConnected || selectedFiles.length === 0) return;

    setIsSending(true);
    cancelSendingRef.current = false;
    const pcInfo = getDeviceInfo();
    const filesToSend = [...selectedFiles];

    try {
      await streamMultipleFiles(
        connRef.current,
        filesToSend,
        pcInfo,
        (prog) => {
          setSendProgress(prog);
        },
        () => cancelSendingRef.current
      );

      // Save to records
      saveTransferRecord({
        direction: 'sent',
        senderDevice: pcInfo,
        receiverDevice: connectedMobile || undefined,
        type: 'files',
        files: filesToSend.map((f) => ({
          name: f.name,
          size: f.size,
          mimeType: f.type,
          status: 'completed',
        })),
        totalBytes: filesToSend.reduce((acc, f) => acc + f.size, 0),
        roomId,
      });
      loadRecords();

      setSelectedFiles([]);
    } catch (err) {
      console.error('Error sending files from PC to Mobile:', err);
    } finally {
      setIsSending(false);
    }
  };

  // PC to Mobile: Send Clipboard text
  const handleSendClipboard = (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : clipboardText).trim();
    if (!text || !connRef.current || !isConnected) return;

    const pcInfo = getDeviceInfo();
    const clipMsg: TransferMessage = {
      type: 'clipboard',
      id: `clip-${Date.now()}`,
      text,
      timestamp: Date.now(),
      sender: pcInfo,
    };

    connRef.current.send(clipMsg);

    const timeStr = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    setClipboardHistory((prev) => [
      {
        id: clipMsg.id,
        text,
        senderName: pcInfo.deviceName,
        direction: 'sent',
        time: timeStr,
      },
      ...prev,
    ]);

    saveTransferRecord({
      direction: 'sent',
      senderDevice: pcInfo,
      receiverDevice: connectedMobile || undefined,
      type: 'clipboard',
      totalBytes: new Blob([text]).size,
      clipboardSnippet: text.substring(0, 80),
      roomId,
    });
    loadRecords();

    setClipboardText('');
    setClipboardNotice('Clipboard successfully sent to Mobile!');
    setTimeout(() => setClipboardNotice(null), 3000);
  };

  // Read system clipboard from PC and send directly to mobile
  const handlePasteFromPcClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setClipboardText(text);
          handleSendClipboard(text);
          return;
        }
      }
      setClipboardNotice('Please type or paste text in the box below');
      setTimeout(() => setClipboardNotice(null), 3000);
    } catch (err) {
      setClipboardNotice('Clipboard read permission denied. Paste manually below.');
      setTimeout(() => setClipboardNotice(null), 3000);
    }
  };

  const handleCopySnippet = async (id: string, text: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedItemId(id);
      setTimeout(() => setCopiedItemId(null), 2000);
    }
  };

  const handleClearRecords = () => {
    clearTransferRecords();
    setRecords([]);
  };

  const handleExportRecords = () => {
    exportTransferRecordsJSON();
  };

  if (!mounted) {
    return (
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center min-h-[460px]">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-2" />
        <p className="text-xs text-slate-400">Loading Receiver Interface...</p>
      </div>
    );
  }

  const totalSelectedBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between min-h-[460px]">
      <div>
        {/* Header & Status */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-4 mb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                PC Transfer Station
                {connectedMobile && (
                  <span className="text-[11px] font-normal text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Smartphone className="w-3 h-3" />
                    {connectedMobile.deviceName}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Bidirectional P2P Wi-Fi transfer & live clipboard sync
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 mb-4">
          <button
            onClick={() => setActiveTab('files')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'files'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Files Transfer (Send & Receive)</span>
            {selectedFiles.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-indigo-400 text-slate-950 font-bold rounded-full text-[10px]">
                {selectedFiles.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('clipboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'clipboard'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>Share Clipboard</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('records');
              loadRecords();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'records'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Sharing Records ({records.length})</span>
          </button>
        </div>

        {/* TAB 1: FILES TRANSFER (SEND PC->MOBILE & RECEIVE MOBILE->PC) */}
        {activeTab === 'files' && (
          <div className="space-y-6">
            {/* SECTION A: SEND TO MOBILE (FEATURE 1 & FEATURE 4) */}
            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Send Files from PC to Mobile
                  </h4>
                </div>
                {isConnected && (
                  <span className="text-[11px] text-emerald-400 font-semibold">
                    Linked to {connectedMobile?.deviceName || 'Mobile'}
                  </span>
                )}
              </div>

              {/* Multi-file Dropzone */}
              <div className="relative border-2 border-dashed border-slate-700/80 hover:border-indigo-500/50 rounded-xl p-4 text-center transition-all bg-slate-950/40">
                <input
                  type="file"
                  multiple
                  disabled={!isConnected || isSending}
                  onChange={handleSelectFiles}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                />
                <UploadCloud className="w-8 h-8 text-indigo-400 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-200">
                  {isConnected
                    ? 'Click or Drag & Drop Multiple Files to Send to Mobile'
                    : 'Scan QR code with Mobile to enable file sending'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Send multiple documents, videos, photos, or folders seamlessly
                </p>
              </div>

              {/* Selected Files Queue Preview */}
              {selectedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} queued ({formatBytes(totalSelectedBytes)})
                    </span>
                    <button
                      onClick={() => setSelectedFiles([])}
                      disabled={isSending}
                      className="text-rose-400 hover:text-rose-300 text-[11px] transition-all"
                    >
                      Clear Queue
                    </button>
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-slate-950/70 rounded-lg border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate max-w-[80%]">
                          <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span className="truncate text-slate-200">{file.name}</span>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            ({formatBytes(file.size)})
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(idx)}
                          disabled={isSending}
                          className="text-slate-500 hover:text-rose-400 p-1 transition-all"
                          title="Remove file"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Send Action Button */}
                  <button
                    onClick={handleSendMultipleFiles}
                    disabled={!isConnected || isSending}
                    className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Streaming to Mobile...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send {selectedFiles.length} File{selectedFiles.length > 1 ? 's' : ''} to Mobile Now
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Streaming Progress Bar (PC -> Mobile) */}
              {isSending && sendProgress && (
                <div className="mt-3 p-3 bg-slate-950 border border-indigo-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white truncate max-w-[70%]">
                      File {sendProgress.currentFileIndex} of {sendProgress.totalFiles}: {sendProgress.currentFileName}
                    </span>
                    <span className="font-mono text-indigo-400 font-bold">
                      {sendProgress.overallPercentage}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-150"
                      style={{ width: `${sendProgress.overallPercentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>
                      {formatBytes(sendProgress.overallBytesTransferred)} / {formatBytes(sendProgress.overallTotalBytes)}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      ⚡ {sendProgress.speedMBps} MB/s
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION B: RECEIVE FROM MOBILE (INCOMING PROGRESS + LOG) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <HardDriveDownload className="w-4 h-4 text-indigo-400" />
                  Received from Mobile ({receivedFiles.length})
                </h4>
              </div>

              {/* Incoming Transfer HUD */}
              {receiveProgress && receiveProgress.status === 'receiving' && (
                <div className="p-4 bg-slate-900/90 rounded-xl border border-indigo-500/30 mb-4 shadow-xl animate-pulse-fast">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 overflow-hidden max-w-[70%]">
                      <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                      <span className="text-xs font-semibold text-white truncate">
                        Receiving ({receiveProgress.fileIndex}/{receiveProgress.totalFiles}): {receiveProgress.fileName}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-indigo-400">
                      {receiveProgress.percentage}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-150"
                      style={{ width: `${receiveProgress.percentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>
                      {formatBytes(receiveProgress.bytesReceived)} / {formatBytes(receiveProgress.fileSize)}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      ⚡ {receiveProgress.speedMBps} MB/s
                    </span>
                  </div>
                </div>
              )}

              {/* Received Files List */}
              {receivedFiles.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl">
                  <FileIcon className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-medium text-slate-400">No files received from mobile yet</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Select files on your mobile device to stream directly to PC
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {receivedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 hover:border-indigo-500/30 transition-all"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-semibold text-slate-200 truncate">
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {formatBytes(file.size)} • {file.time} • From: {file.senderName}
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
        )}

        {/* TAB 2: CLIPBOARD SYNC (FEATURE 5) */}
        {activeTab === 'clipboard' && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clipboard className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    PC ➔ Mobile Clipboard Sharing
                  </h4>
                </div>
                <button
                  onClick={handlePasteFromPcClipboard}
                  disabled={!isConnected}
                  className="px-2.5 py-1 text-xs font-semibold bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
                  title="Read system clipboard and send to mobile"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sync PC Clipboard Now</span>
                </button>
              </div>

              {clipboardNotice && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{clipboardNotice}</span>
                </div>
              )}

              {/* Text Input to Send */}
              <div>
                <textarea
                  value={clipboardText}
                  onChange={(e) => setClipboardText(e.target.value)}
                  placeholder="Type or paste links, passwords, text, or notes here to send directly to your phone's clipboard..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none font-sans"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => handleSendClipboard()}
                  disabled={!isConnected || !clipboardText.trim()}
                  className="py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Text to Mobile</span>
                </button>
              </div>
            </div>

            {/* Clipboard Exchange Log */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Clipboard Exchange History
              </h4>
              {clipboardHistory.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl">
                  <Clipboard className="w-6 h-6 text-slate-600 mx-auto mb-1.5 opacity-50" />
                  <p className="text-xs text-slate-400">No clipboard items exchanged yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {clipboardHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs flex items-start justify-between gap-3"
                    >
                      <div className="truncate flex-grow">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.direction === 'sent'
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {item.direction === 'sent' ? 'Sent to Mobile' : 'From Mobile'}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {item.senderName} • {item.time}
                          </span>
                        </div>
                        <p className="text-slate-200 font-mono text-[11px] break-all whitespace-pre-wrap select-all">
                          {item.text}
                        </p>
                      </div>

                      <button
                        onClick={() => handleCopySnippet(item.id, item.text)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg shrink-0 transition-all"
                        title="Copy text"
                      >
                        {copiedItemId === item.id ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SHARING RECORDS & HISTORY (FEATURE 2) */}
        {activeTab === 'records' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Transfer Audit & Sharing Records
                </h4>
                <p className="text-[11px] text-slate-400">
                  Comprehensive audit trail of who shared files or clipboard items in this browser
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportRecords}
                  disabled={records.length === 0}
                  className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
                  title="Export history as JSON"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
                <button
                  onClick={handleClearRecords}
                  disabled={records.length === 0}
                  className="px-2.5 py-1 text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
                  title="Clear all stored records"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            {records.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
                <History className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-slate-400 font-semibold">No sharing records logged yet</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Every transferred file or clipboard item will be recorded here with device details
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {records.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rec.direction === 'received'
                              ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                              : 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300'
                          }`}
                        >
                          {rec.direction === 'received' ? 'Received from' : 'Sent to'}
                        </span>
                        <span className="font-bold text-white flex items-center gap-1">
                          {rec.senderDevice.deviceType === 'mobile' ? (
                            <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                          ) : (
                            <Laptop className="w-3.5 h-3.5 text-indigo-400" />
                          )}
                          {rec.senderDevice.deviceName}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">{rec.formattedTime}</span>
                    </div>

                    <div className="text-[11px] text-slate-300 pl-2 border-l-2 border-indigo-500/30">
                      {rec.type === 'files' ? (
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-200">
                            {rec.files?.length || 1} File(s) • Total: {formatBytes(rec.totalBytes)}
                          </p>
                          <ul className="text-[10px] text-slate-400 space-y-0.5">
                            {rec.files?.map((f, i) => (
                              <li key={i} className="truncate">
                                • {f.name} ({formatBytes(f.size)})
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold text-amber-300">Clipboard Sync</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            &quot;{rec.clipboardSnippet}&quot;
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                      <span>
                        Sender OS: {rec.senderDevice.os} • Browser: {rec.senderDevice.browser}
                      </span>
                      <span>Session Code: {rec.roomId}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span>WebRTC Direct Transfer</span>
        <span className="font-semibold text-slate-300">Max Speed: Wi-Fi Bandwidth Limit</span>
      </div>
    </div>
  );
};
