'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Laptop,
  Zap,
  Loader2,
  FileUp,
  ShieldAlert,
  RefreshCw,
  HardDriveDownload,
  Download,
  Clipboard,
  Copy,
  Check,
  ExternalLink,
  History,
  X,
  FileText,
  Send,
  Trash2,
  ShieldCheck,
} from 'lucide-react';

type MobileTab = 'send' | 'receive' | 'clipboard' | 'records';

export default function MobileSenderPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params?.roomId as string)?.toUpperCase();

  const [mounted, setMounted] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<MobileTab>('send');
  const [status, setStatus] = useState<string>('Connecting to PC...');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectedPc, setConnectedPc] = useState<DeviceInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  // Send files state (Mobile to PC) - Multi-file support
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendProgress, setSendProgress] = useState<StreamBatchProgress | null>(null);
  const cancelSendingRef = useRef<boolean>(false);

  // Receive files state (PC to Mobile)
  const [receiveProgress, setReceiveProgress] = useState<{
    fileName: string;
    fileIndex: number;
    totalFiles: number;
    fileSize: number;
    bytesReceived: number;
    percentage: number;
    speedMBps: number;
    status: 'receiving' | 'completed';
  } | null>(null);

  const [receivedFromPcFiles, setReceivedFromPcFiles] = useState<
    Array<{
      id: string;
      name: string;
      size: number;
      time: string;
      blobUrl: string;
    }>
  >([]);

  // Clipboard state
  const [clipboardText, setClipboardText] = useState<string>('');
  const [clipboardItems, setClipboardItems] = useState<
    Array<{
      id: string;
      text: string;
      senderName: string;
      direction: 'sent' | 'received';
      time: string;
    }>
  >([]);
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Transfer Records state
  const [records, setRecords] = useState<TransferRecord[]>([]);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  // Accumulator for files received from PC
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

  const loadRecords = () => {
    setRecords(getTransferRecords());
  };

  useEffect(() => {
    setMounted(true);
    loadRecords();
    if (!roomId) return;

    // Feature 3: One-time scan session persistence
    // Store active session in localStorage so mobile page refreshes maintain connection
    try {
      localStorage.setItem(
        'shaeit_mobile_session',
        JSON.stringify({
          roomId,
          timestamp: Date.now(),
        })
      );
    } catch {
      // Ignore quota errors
    }

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

          const searchTimeout = setTimeout(() => {
            if (!conn.open && !isCancelled) {
              setErrorMessage(
                `Taking longer to link. Ensure PC screen displays code ${roomId}.`
              );
            }
          }, 7000);

          conn.on('open', () => {
            clearTimeout(searchTimeout);
            if (isCancelled) return;
            setIsConnected(true);
            setStatus('Connected to PC!');
            setErrorMessage(null);

            // Send Mobile device handshake to PC
            const mobileInfo = getDeviceInfo();
            conn.send({
              type: 'handshake',
              deviceInfo: mobileInfo,
            });
          });

          conn.on('data', (rawMsg) => {
            handleIncomingMessage(rawMsg as TransferMessage);
          });

          conn.on('close', () => {
            if (isCancelled) return;
            setIsConnected(false);
            setConnectedPc(null);
            setStatus('Disconnected from PC');
          });

          conn.on('error', (err) => {
            console.error('Mobile connection error:', err);
            if (isCancelled) return;
            setErrorMessage(
              'Could not connect to PC. Make sure PC has ShaeIt open on the same session code.'
            );
          });
        });

        peerInstance.on('error', (err) => {
          console.error('Peer error on mobile:', err);
          if (isCancelled) return;
          setStatus('Connection Failed');
          setErrorMessage(
            'Could not establish WebRTC link. Ensure PC screen shows code ' + roomId
          );
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

  // Handle incoming data from PC (Handshake, Header, Chunk, End, Clipboard)
  const handleIncomingMessage = (msg: TransferMessage) => {
    if (msg.type === 'handshake') {
      setConnectedPc(msg.deviceInfo);
      return;
    }

    // Feature 5: Receive Clipboard from PC
    if (msg.type === 'clipboard') {
      const timeStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      setClipboardItems((prev) => [
        {
          id: msg.id,
          text: msg.text,
          senderName: msg.sender?.deviceName || 'PC',
          direction: 'received',
          time: timeStr,
        },
        ...prev,
      ]);

      // Switch to clipboard tab to show user immediately
      setActiveTab('clipboard');
      setClipboardNotice('New Clipboard received from PC!');
      setTimeout(() => setClipboardNotice(null), 4000);

      // Save to records
      saveTransferRecord({
        direction: 'received',
        senderDevice: msg.sender || {
          deviceId: 'pc',
          deviceName: 'Windows PC',
          deviceType: 'desktop',
          browser: 'Browser',
          os: 'Windows',
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

    // Feature 4: Receive Files sent from PC
    if (msg.type === 'header') {
      incomingHeaderRef.current = {
        fileId: msg.fileId || `file-${Date.now()}`,
        name: msg.name,
        size: msg.size,
        mimeType: msg.mimeType,
        fileIndex: msg.fileIndex || 1,
        totalFiles: msg.totalFiles || 1,
        sender: msg.sender || connectedPc || {
          deviceId: 'pc',
          deviceName: 'PC',
          deviceType: 'desktop',
          browser: 'Browser',
          os: 'PC',
        },
      };
      incomingChunksRef.current = [];
      receivedBytesRef.current = 0;
      startTimeRef.current = Date.now();

      // Switch tab to receive so user sees live progress
      setActiveTab('receive');

      setReceiveProgress({
        fileName: msg.name,
        fileIndex: msg.fileIndex || 1,
        totalFiles: msg.totalFiles || 1,
        fileSize: msg.size,
        bytesReceived: 0,
        percentage: 0,
        speedMBps: 0,
        status: 'receiving',
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

      // Automatically trigger download or let user click download
      triggerFileDownload(blob, header.name);

      const timeStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      setReceivedFromPcFiles((prev) => [
        {
          id: header.fileId,
          name: header.name,
          size: header.size,
          time: timeStr,
          blobUrl,
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

      incomingHeaderRef.current = null;
      incomingChunksRef.current = [];
    }
  };

  // Feature 1: Multiple file selection from mobile
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...files]);
      setErrorMessage(null);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Feature 1: Stream multiple files to PC
  const startStreamingMultipleFiles = async () => {
    if (!connRef.current || !isConnected || selectedFiles.length === 0) return;

    setIsSending(true);
    cancelSendingRef.current = false;
    const mobileInfo = getDeviceInfo();
    const filesToSend = [...selectedFiles];

    try {
      await streamMultipleFiles(
        connRef.current,
        filesToSend,
        mobileInfo,
        (prog) => {
          setSendProgress(prog);
        },
        () => cancelSendingRef.current
      );

      // Save to records
      saveTransferRecord({
        direction: 'sent',
        senderDevice: mobileInfo,
        receiverDevice: connectedPc || undefined,
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
      console.error('Error sending files from mobile to PC:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Feature 5: Send Mobile Clipboard to PC
  const handleSendClipboardToPC = () => {
    const text = clipboardText.trim();
    if (!text || !connRef.current || !isConnected) return;

    const mobileInfo = getDeviceInfo();
    const clipMsg: TransferMessage = {
      type: 'clipboard',
      id: `clip-mob-${Date.now()}`,
      text,
      timestamp: Date.now(),
      sender: mobileInfo,
    };

    connRef.current.send(clipMsg);

    const timeStr = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    setClipboardItems((prev) => [
      {
        id: clipMsg.id,
        text,
        senderName: 'You (Mobile)',
        direction: 'sent',
        time: timeStr,
      },
      ...prev,
    ]);

    saveTransferRecord({
      direction: 'sent',
      senderDevice: mobileInfo,
      receiverDevice: connectedPc || undefined,
      type: 'clipboard',
      totalBytes: new Blob([text]).size,
      clipboardSnippet: text.substring(0, 80),
      roomId,
    });
    loadRecords();

    setClipboardText('');
    setClipboardNotice('Clipboard sent to PC!');
    setTimeout(() => setClipboardNotice(null), 3000);
  };

  const handleCopyClipboardItem = async (id: string, text: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-2" />
        <p className="text-xs text-slate-400">Loading Mobile Station...</p>
      </div>
    );
  }

  const totalSelectedBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <ErrorBoundary fallbackTitle="Mobile Receiver Error">
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 max-w-lg mx-auto">
        {/* Mobile Header */}
        <header className="pb-3 border-b border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white">ShaeIt Mobile</h1>
                <p className="text-[10px] text-slate-400">
                  Session: <span className="font-mono text-indigo-400 font-bold">{roomId}</span>
                </p>
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
          </div>

          {/* Connected Device & Single-Scan Banner */}
          {isConnected && (
            <div className="flex items-center justify-between p-2 bg-slate-900/80 border border-emerald-500/30 rounded-xl text-xs">
              <div className="flex items-center gap-2 truncate">
                <Laptop className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-200 font-medium truncate">
                  Linked to {connectedPc?.deviceName || 'PC'}
                </span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full shrink-0 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                1-Scan Paired
              </span>
            </div>
          )}
        </header>

        {/* Mobile Tab Navigation */}
        <div className="grid grid-cols-4 gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 my-3">
          <button
            onClick={() => setActiveTab('send')}
            className={`py-2 text-[11px] font-bold rounded-lg transition-all flex flex-col items-center gap-1 ${
              activeTab === 'send'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Send</span>
          </button>

          <button
            onClick={() => setActiveTab('receive')}
            className={`py-2 text-[11px] font-bold rounded-lg transition-all flex flex-col items-center gap-1 relative ${
              activeTab === 'receive'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <HardDriveDownload className="w-4 h-4" />
            <span>Receive</span>
            {receivedFromPcFiles.length > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('clipboard')}
            className={`py-2 text-[11px] font-bold rounded-lg transition-all flex flex-col items-center gap-1 relative ${
              activeTab === 'clipboard'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clipboard className="w-4 h-4" />
            <span>Clipboard</span>
            {clipboardItems.length > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('records');
              loadRecords();
            }}
            className={`py-2 text-[11px] font-bold rounded-lg transition-all flex flex-col items-center gap-1 ${
              activeTab === 'records'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>History</span>
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between text-rose-400 text-xs mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setRetryCount((c) => c + 1)}
              className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded text-[11px] font-bold text-rose-300 shrink-0 ml-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* MAIN BODY AREA */}
        <main className="flex-grow space-y-4">
          {/* TAB 1: SEND MULTIPLE FILES TO PC */}
          {activeTab === 'send' && (
            <div className="space-y-4">
              <div className="text-center">
                <Smartphone className="w-10 h-10 text-indigo-400 mx-auto mb-1" />
                <h2 className="text-lg font-extrabold text-white">Send Files to PC</h2>
                <p className="text-xs text-slate-400">
                  Select multiple photos, videos, or documents to stream
                </p>
              </div>

              {/* Multi-file input dropzone */}
              <div className="relative">
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  disabled={isSending}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                />
                <div
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                    selectedFiles.length > 0
                      ? 'border-emerald-500/50 bg-emerald-950/20'
                      : 'border-indigo-500/50 bg-indigo-950/20 hover:bg-indigo-950/30'
                  }`}
                >
                  <UploadCloud className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-white">
                    {selectedFiles.length > 0
                      ? `Tap to Add More Files (${selectedFiles.length} selected)`
                      : 'Tap to Select Multiple Files'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Select photos, videos, PDFs, or any files
                  </p>
                </div>
              </div>

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} ({formatBytes(totalSelectedBytes)})
                    </span>
                    <button
                      onClick={() => setSelectedFiles([])}
                      disabled={isSending}
                      className="text-rose-400 text-[11px]"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-slate-900 rounded-lg border border-slate-800 text-xs"
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
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Streaming Progress Bar */}
                  {isSending && sendProgress && (
                    <div className="p-3 bg-slate-900 border border-indigo-500/30 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white truncate max-w-[70%]">
                          Sending {sendProgress.currentFileIndex}/{sendProgress.totalFiles}: {sendProgress.currentFileName}
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

                  {/* Send Button */}
                  {!isSending && (
                    <button
                      onClick={startStreamingMultipleFiles}
                      disabled={!isConnected}
                      className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      <FileUp className="w-5 h-5" />
                      {isConnected
                        ? `Send ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''} to PC Now`
                        : `Waiting for PC (${roomId})...`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RECEIVE FROM PC (FEATURE 4) */}
          {activeTab === 'receive' && (
            <div className="space-y-4">
              <div className="text-center">
                <Laptop className="w-10 h-10 text-emerald-400 mx-auto mb-1" />
                <h2 className="text-lg font-extrabold text-white">Receive from PC</h2>
                <p className="text-xs text-slate-400">
                  Files sent from your PC will download here directly
                </p>
              </div>

              {/* Incoming Progress Bar */}
              {receiveProgress && receiveProgress.status === 'receiving' && (
                <div className="p-4 bg-slate-900 border border-indigo-500/30 rounded-xl space-y-2 shadow-xl animate-pulse-fast">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white truncate max-w-[70%]">
                      Receiving ({receiveProgress.fileIndex}/{receiveProgress.totalFiles}): {receiveProgress.fileName}
                    </span>
                    <span className="font-mono text-indigo-400 font-bold">
                      {receiveProgress.percentage}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-150"
                      style={{ width: `${receiveProgress.percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
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
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Downloaded Files ({receivedFromPcFiles.length})
                </h4>

                {receivedFromPcFiles.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl">
                    <HardDriveDownload className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-slate-400">No files received from PC yet</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      On your PC screen, select files to send to this phone
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {receivedFromPcFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2.5 truncate max-w-[75%]">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="truncate">
                            <p className="font-semibold text-slate-200 truncate">{file.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {formatBytes(file.size)} • {file.time}
                            </p>
                          </div>
                        </div>

                        {file.blobUrl && (
                          <a
                            href={file.blobUrl}
                            download={file.name}
                            className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all"
                            title="Save / Download"
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

          {/* TAB 3: CLIPBOARD SYNC (FEATURE 5) */}
          {activeTab === 'clipboard' && (
            <div className="space-y-4">
              <div className="text-center">
                <Clipboard className="w-10 h-10 text-amber-400 mx-auto mb-1" />
                <h2 className="text-lg font-extrabold text-white">Live Clipboard Sync</h2>
                <p className="text-xs text-slate-400">
                  Exchange text, links, and notes instantly with PC
                </p>
              </div>

              {clipboardNotice && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{clipboardNotice}</span>
                </div>
              )}

              {/* Send Clipboard from Mobile to PC */}
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-300">Send Text to PC Clipboard</label>
                <textarea
                  value={clipboardText}
                  onChange={(e) => setClipboardText(e.target.value)}
                  placeholder="Paste or type text, link, or note to send to PC..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none font-sans"
                />
                <button
                  onClick={handleSendClipboardToPC}
                  disabled={!isConnected || !clipboardText.trim()}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send to PC</span>
                </button>
              </div>

              {/* Received Clipboard list */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Clipboard History
                </h4>

                {clipboardItems.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl">
                    <Clipboard className="w-6 h-6 text-slate-600 mx-auto mb-1.5 opacity-50" />
                    <p className="text-xs text-slate-400">No clipboard items yet</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Click &quot;Sync PC Clipboard&quot; on your PC to send text here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {clipboardItems.map((item) => {
                      const isUrl = /^https?:\/\//i.test(item.text.trim());
                      return (
                        <div
                          key={item.id}
                          className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold ${
                                item.direction === 'sent'
                                  ? 'bg-indigo-500/20 text-indigo-300'
                                  : 'bg-emerald-500/20 text-emerald-300'
                              }`}
                            >
                              {item.direction === 'sent' ? 'Sent to PC' : 'From PC'}
                            </span>
                            <span className="text-slate-500">{item.time}</span>
                          </div>

                          <p className="text-xs text-slate-200 font-mono break-all whitespace-pre-wrap select-all">
                            {item.text}
                          </p>

                          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                            <button
                              onClick={() => handleCopyClipboardItem(item.id, item.text)}
                              className="flex-1 py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all"
                            >
                              {copiedId === item.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy to Clipboard</span>
                                </>
                              )}
                            </button>

                            {isUrl && (
                              <a
                                href={item.text.trim()}
                                target="_blank"
                                rel="noreferrer"
                                className="py-1 px-2.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 font-bold text-xs rounded-lg flex items-center gap-1 transition-all"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Open</span>
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SHARING RECORDS (FEATURE 2) */}
          {activeTab === 'records' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Transfer History ({records.length})
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => exportTransferRecordsJSON()}
                    disabled={records.length === 0}
                    className="px-2 py-0.5 text-[11px] bg-slate-800 text-slate-300 rounded-lg disabled:opacity-50"
                  >
                    Export
                  </button>
                  <button
                    onClick={() => {
                      clearTransferRecords();
                      setRecords([]);
                    }}
                    disabled={records.length === 0}
                    className="px-2 py-0.5 text-[11px] bg-rose-500/10 text-rose-300 rounded-lg disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {records.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl">
                  <History className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-slate-400">No transfers recorded yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {records.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            rec.direction === 'received'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-indigo-500/20 text-indigo-300'
                          }`}
                        >
                          {rec.direction === 'received' ? 'From' : 'To'}: {rec.senderDevice.deviceName}
                        </span>
                        <span className="text-[10px] text-slate-500">{rec.formattedTime}</span>
                      </div>

                      {rec.type === 'files' ? (
                        <p className="text-slate-300 font-medium">
                          {rec.files?.length || 1} file(s) • {formatBytes(rec.totalBytes)}
                        </p>
                      ) : (
                        <p className="text-amber-300 font-mono text-[11px] truncate">
                          &quot;{rec.clipboardSnippet}&quot;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="pt-3 border-t border-slate-800 text-center text-[10px] text-slate-500">
          Direct WebRTC Local Transfer • Zero Cloud Storage Used
        </footer>
      </div>
    </ErrorBoundary>
  );
}
