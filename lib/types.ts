export type TransferMode = 'p2p' | 'temp-cloud';

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified?: number;
}

export interface TransferProgress {
  fileName: string;
  fileSize: number;
  bytesTransferred: number;
  percentage: number;
  speedMBps: number;
  status: 'idle' | 'connecting' | 'transferring' | 'completed' | 'failed';
  errorMessage?: string;
}

export interface TempFileShare {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadDate: number;
  expiresAt: number;
  downloadUrl: string;
  downloadCount: number;
  isPremium?: boolean;
}

export interface TierLimits {
  name: 'free' | 'premium';
  maxP2PFileSizeMB: number; // e.g. 2000MB (2GB) for P2P, unlimited technically
  maxTempFileSizeMB: number; // e.g. 100MB free, 5000MB premium
  tempFileExpiryHours: number; // e.g. 1h free, 168h (7 days) premium
  maxDownloads: number;
}

export const FREE_TIER_LIMITS: TierLimits = {
  name: 'free',
  maxP2PFileSizeMB: 2000,
  maxTempFileSizeMB: 100,
  tempFileExpiryHours: 1,
  maxDownloads: 10,
};

export const PREMIUM_TIER_LIMITS: TierLimits = {
  name: 'premium',
  maxP2PFileSizeMB: 10000,
  maxTempFileSizeMB: 5000,
  tempFileExpiryHours: 168,
  maxDownloads: 500,
};
