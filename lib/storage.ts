export interface StoredTempFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  buffer: string; // Base64 or Data String for serverless persistence across invocations
  createdAt: number;
  expiresAt: number;
  downloadCount: number;
}

// Global in-memory storage singleton for serverless container reuse
const globalForStorage = globalThis as unknown as {
  tempFileStore: Map<string, StoredTempFile> | undefined;
};

if (!globalForStorage.tempFileStore) {
  globalForStorage.tempFileStore = new Map<string, StoredTempFile>();
}

export const tempFileStore = globalForStorage.tempFileStore;

export function cleanupExpiredFiles() {
  const now = Date.now();
  for (const [id, item] of tempFileStore.entries()) {
    if (now > item.expiresAt) {
      tempFileStore.delete(id);
    }
  }
}
