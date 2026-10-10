export interface StoredTempFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  buffer: ArrayBuffer;
  createdAt: number;
  expiresAt: number;
  downloadCount: number;
}

// Global in-memory storage singleton for temporary files
const globalForStorage = globalThis as unknown as {
  tempFileStore: Map<string, StoredTempFile> | undefined;
};

export const tempFileStore =
  globalForStorage.tempFileStore ?? new Map<string, StoredTempFile>();

if (process.env.NODE_ENV !== 'production') {
  globalForStorage.tempFileStore = tempFileStore;
}
