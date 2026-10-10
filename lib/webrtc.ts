import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';

export const CHUNK_SIZE = 64 * 1024; // 64KB per chunk for high throughput WebRTC

export interface TransferHeader {
  type: 'header';
  name: string;
  size: number;
  mimeType: string;
}

export interface TransferChunk {
  type: 'chunk';
  data: ArrayBuffer;
}

export interface TransferEnd {
  type: 'end';
}

export type TransferMessage = TransferHeader | TransferChunk | TransferEnd;

/**
 * Generates a user-friendly 6-character room code or random ID.
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
 * Triggers browser download for a Blob object.
 */
export function triggerFileDownload(blob: Blob, filename: string) {
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
