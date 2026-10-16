import { DeviceInfo } from './device';
import { formatBytes } from './webrtc';

export interface TransferredFileInfo {
  name: string;
  size: number;
  mimeType?: string;
  status: 'completed' | 'failed';
}

export interface TransferRecord {
  id: string;
  timestamp: number;
  formattedTime: string;
  direction: 'sent' | 'received';
  senderDevice: DeviceInfo;
  receiverDevice?: DeviceInfo;
  type: 'files' | 'clipboard';
  files?: TransferredFileInfo[];
  totalBytes: number;
  clipboardSnippet?: string;
  roomId: string;
}

const STORAGE_KEY = 'shaeit_transfer_records_v1';
const MAX_RECORDS = 100;

/**
 * Retrieves all stored transfer history records.
 */
export function getTransferRecords(): TransferRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to parse transfer records:', err);
    return [];
  }
}

/**
 * Adds a new transfer record to localStorage.
 */
export function saveTransferRecord(record: Omit<TransferRecord, 'id' | 'timestamp' | 'formattedTime'>): TransferRecord {
  const timestamp = Date.now();
  const dateObj = new Date(timestamp);
  const formattedTime = `${dateObj.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  })}, ${dateObj.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  const newRecord: TransferRecord = {
    ...record,
    id: `rec-${Math.random().toString(36).substring(2, 9)}-${timestamp}`,
    timestamp,
    formattedTime,
  };

  if (typeof window !== 'undefined') {
    try {
      const existing = getTransferRecords();
      const updated = [newRecord, ...existing].slice(0, MAX_RECORDS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Could not save transfer record to localStorage:', err);
    }
  }

  return newRecord;
}

/**
 * Clears all transfer records from storage.
 */
export function clearTransferRecords(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Deletes a single transfer record by ID.
 */
export function deleteTransferRecord(id: string): void {
  if (typeof window !== 'undefined') {
    const existing = getTransferRecords();
    const updated = existing.filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
}

/**
 * Exports all transfer records as downloadable JSON file.
 */
export function exportTransferRecordsJSON(): void {
  if (typeof window === 'undefined') return;
  const records = getTransferRecords();
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(records, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `shaeit_sharing_records_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  document.body.removeChild(downloadAnchor);
}
