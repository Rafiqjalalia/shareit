import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { DeviceInfo } from './device';

export const CHUNK_SIZE = 64 * 1024; // 64KB per chunk for high throughput WebRTC
const MAX_BUFFERED_AMOUNT = 1024 * 1024; // 1MB buffer watermark to avoid dropping chunks

export interface TransferHandshake {
  type: 'handshake';
  deviceInfo: DeviceInfo;
}

export interface TransferHeader {
  type: 'header';
  fileId: string;
  name: string;
  size: number;
  mimeType: string;
  fileIndex: number;
  totalFiles: number;
  sender: DeviceInfo;
}

export interface TransferChunk {
  type: 'chunk';
  fileId: string;
  data: ArrayBuffer;
}

export interface TransferEnd {
  type: 'end';
  fileId: string;
}

export interface TransferClipboard {
  type: 'clipboard';
  id: string;
  text: string;
  timestamp: number;
  sender: DeviceInfo;
}

export type TransferMessage =
  | TransferHandshake
  | TransferHeader
  | TransferChunk
  | TransferEnd
  | TransferClipboard;

export interface StreamBatchProgress {
  currentFileName: string;
  currentFileIndex: number;
  totalFiles: number;
  currentFileBytesTransferred: number;
  currentFileSize: number;
  currentFilePercentage: number;
  overallBytesTransferred: number;
  overallTotalBytes: number;
  overallPercentage: number;
  speedMBps: number;
  status: 'streaming' | 'completed' | 'error' | 'cancelled';
  errorMessage?: string;
}

/**
 * Generates a user-friendly 6-character room code.
 */
export function generateRoomId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Formats byte counts into human readable strings (KB, MB, GB).
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * High-reliability ICE server configuration:
 * Includes Google STUN, Cloudflare STUN, and OpenRelay TURN servers
 * to ensure WebRTC connections traverse mobile carrier CGNAT, mobile hotspots, and firewalls.
 */
export const PEER_ICE_CONFIG = {
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      {
        urls: 'turn:global.relay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:global.relay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:global.relay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
    iceCandidatePoolSize: 10,
  },
};

/**
 * Triggers browser download for a Blob object.
 */
export function triggerFileDownload(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Robust clipboard copy helper with fallback for non-HTTPS / restricted contexts.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

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
    console.error('Clipboard copy error:', err);
    return false;
  }
}

/**
 * Streams an array of files sequentially over a WebRTC DataConnection
 * with backpressure buffer monitoring and progress callback.
 */
export async function streamMultipleFiles(
  conn: DataConnection,
  files: File[],
  senderInfo: DeviceInfo,
  onProgress: (progress: StreamBatchProgress) => void,
  isCancelled: () => boolean
): Promise<void> {
  if (!conn || !conn.open || files.length === 0) return;

  const overallTotalBytes = files.reduce((acc, f) => acc + f.size, 0);
  let overallBytesTransferred = 0;
  const overallStartTime = Date.now();

  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    if (isCancelled()) {
      onProgress({
        currentFileName: '',
        currentFileIndex: fileIndex,
        totalFiles: files.length,
        currentFileBytesTransferred: 0,
        currentFileSize: 0,
        currentFilePercentage: 0,
        overallBytesTransferred,
        overallTotalBytes,
        overallPercentage: Math.round((overallBytesTransferred / (overallTotalBytes || 1)) * 100),
        speedMBps: 0,
        status: 'cancelled',
      });
      return;
    }

    const file = files[fileIndex];
    const fileId = `file-${fileIndex}-${Date.now()}`;

    // 1. Send Header
    const header: TransferHeader = {
      type: 'header',
      fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      fileIndex: fileIndex + 1,
      totalFiles: files.length,
      sender: senderInfo,
    };
    conn.send(header);

    // 2. Stream File in Chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let fileBytesSent = 0;
    const fileStartTime = Date.now();

    for (let c = 0; c < totalChunks; c++) {
      if (isCancelled()) return;

      // Handle backpressure if WebRTC buffer is congested
      const rawDataChannel = (conn as any).dataChannel as RTCDataChannel | undefined;
      if (rawDataChannel && rawDataChannel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      const start = c * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const slice = file.slice(start, end);
      const arrayBuffer = await slice.arrayBuffer();

      const chunk: TransferChunk = {
        type: 'chunk',
        fileId,
        data: arrayBuffer,
      };
      conn.send(chunk);

      fileBytesSent += arrayBuffer.byteLength;
      overallBytesTransferred += arrayBuffer.byteLength;

      const filePct = Math.min(100, Math.round((fileBytesSent / (file.size || 1)) * 100));
      const overallPct = Math.min(
        100,
        Math.round((overallBytesTransferred / (overallTotalBytes || 1)) * 100)
      );

      const elapsed = (Date.now() - overallStartTime) / 1000;
      const speed =
        elapsed > 0
          ? Number((overallBytesTransferred / (1024 * 1024 * elapsed)).toFixed(2))
          : 0;

      onProgress({
        currentFileName: file.name,
        currentFileIndex: fileIndex + 1,
        totalFiles: files.length,
        currentFileBytesTransferred: fileBytesSent,
        currentFileSize: file.size,
        currentFilePercentage: filePct,
        overallBytesTransferred,
        overallTotalBytes,
        overallPercentage: overallPct,
        speedMBps: speed,
        status: 'streaming',
      });

      // Small tick delay every 15 chunks to allow CPU/event loop breathing room
      if (c % 15 === 0) {
        await new Promise((r) => setTimeout(r, 4));
      }
    }

    // 3. Send End Marker for this file
    const endMsg: TransferEnd = {
      type: 'end',
      fileId,
    };
    conn.send(endMsg);

    // Brief delay between multiple files to ensure receiver buffers cleanly flush
    if (fileIndex < files.length - 1) {
      await new Promise((r) => setTimeout(r, 60));
    }
  }

  // Final completion event
  onProgress({
    currentFileName: files[files.length - 1].name,
    currentFileIndex: files.length,
    totalFiles: files.length,
    currentFileBytesTransferred: files[files.length - 1].size,
    currentFileSize: files[files.length - 1].size,
    currentFilePercentage: 100,
    overallBytesTransferred: overallTotalBytes,
    overallTotalBytes,
    overallPercentage: 100,
    speedMBps: 0,
    status: 'completed',
  });
}
