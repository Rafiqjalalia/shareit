export interface StoredTempFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  buffer?: string; // Base64 buffer for local memory fallback
  remoteUrl?: string; // Persistent remote temporary storage URL
  createdAt: number;
  expiresAt: number;
  downloadCount: number;
}

// Global in-memory storage singleton for local dev and warm container caching
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

/**
 * Resolves direct file download stream URL from cloud storage providers (handling any redirects or landing pages).
 */
export async function getDirectDownloadUrl(remoteUrl: string): Promise<string> {
  if (remoteUrl.includes('tmpfiles.org/')) {
    try {
      const dlPageUrl = remoteUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
      const res = await fetch(dlPageUrl, { redirect: 'follow' });
      const html = await res.text();
      const match = html.match(/href="(https:\/\/tmpfiles\.org\/dl\/[^"]+)"/);
      if (match && match[1]) {
        return match[1];
      }
    } catch (err) {
      console.warn('Failed to resolve tmpfiles direct link:', err);
    }
  }
  return remoteUrl;
}

/**
 * Saves a file reference from a direct client upload to the persistent serverless store.
 */
export function saveRemoteTempFile(params: {
  remoteUrl: string;
  name: string;
  size: number;
  mimeType: string;
  expiryHours: number;
}): { fileId: string; fileInfo: StoredTempFile } {
  cleanupExpiredFiles();

  const now = Date.now();
  const expiresAt = now + params.expiryHours * 60 * 60 * 1000;

  const tokenPayload = {
    u: params.remoteUrl,
    n: params.name,
    s: params.size,
    m: params.mimeType || 'application/octet-stream',
    e: expiresAt,
    c: now,
  };

  const fileId = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');

  const storedItem: StoredTempFile = {
    id: fileId,
    name: params.name,
    size: params.size,
    mimeType: params.mimeType,
    remoteUrl: params.remoteUrl,
    createdAt: now,
    expiresAt,
    downloadCount: 0,
  };

  tempFileStore.set(fileId, storedItem);

  return { fileId, fileInfo: storedItem };
}

/**
 * Uploads a file to temporary serverless storage and returns a self-contained persistent fileId.
 */
export async function saveTempFile(
  file: File,
  expiryHours: number
): Promise<{ fileId: string; fileInfo: StoredTempFile }> {
  cleanupExpiredFiles();

  const now = Date.now();
  const expiresAt = now + expiryHours * 60 * 60 * 1000;
  let remoteUrl: string | undefined = undefined;

  // 1. Try uploading to high-speed temporary storage (Uguu)
  try {
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' });
    const formData = new FormData();
    formData.append('files[]', blob, file.name);

    const uploadRes = await fetch('https://uguu.se/upload', {
      method: 'POST',
      body: formData,
    });

    if (uploadRes.ok) {
      const data = await uploadRes.json();
      if (data.success && data.files && data.files.length > 0 && data.files[0].url) {
        remoteUrl = data.files[0].url;
      }
    }
  } catch (err) {
    console.warn('Temporary cloud backend upload failed, falling back to memory store:', err);
  }

  // 2. Fallback to tmpfiles if Uguu fails
  if (!remoteUrl) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' });
      const formData = new FormData();
      formData.append('file', blob, file.name);
      formData.append('expire', (expiryHours * 3600).toString());

      const uploadRes = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: formData,
      });

      if (uploadRes.ok) {
        const data = await uploadRes.json();
        if (data.status === 'success' && data.data?.url) {
          remoteUrl = data.data.url;
        }
      }
    } catch (err) {
      console.warn('tmpfiles fallback upload failed:', err);
    }
  }

  // 3. Generate fileId
  let fileId = '';
  if (remoteUrl) {
    const tokenPayload = {
      u: remoteUrl,
      n: file.name,
      s: file.size,
      m: file.type || 'application/octet-stream',
      e: expiresAt,
      c: now,
    };
    fileId = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
  } else {
    // Fallback: Random ID with in-memory buffer
    fileId = Math.random().toString(36).substring(2, 10);
  }

  const storedItem: StoredTempFile = {
    id: fileId,
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    remoteUrl,
    createdAt: now,
    expiresAt,
    downloadCount: 0,
  };

  // If no remote URL, store buffer in local memory
  if (!remoteUrl) {
    try {
      const arrayBuf = await file.arrayBuffer();
      storedItem.buffer = Buffer.from(arrayBuf).toString('base64');
    } catch {
      // Ignore
    }
  }

  tempFileStore.set(fileId, storedItem);

  return { fileId, fileInfo: storedItem };
}

/**
 * Resolves a stored file from either the in-memory cache or by decoding the serverless persistent token.
 */
export async function resolveStoredFile(fileId: string): Promise<StoredTempFile | null> {
  cleanupExpiredFiles();

  // 1. Check in-memory store
  const cached = tempFileStore.get(fileId);
  if (cached) {
    if (Date.now() > cached.expiresAt) {
      tempFileStore.delete(fileId);
      return null;
    }
    return cached;
  }

  // 2. Try decoding token from fileId
  try {
    const raw = Buffer.from(fileId, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);

    if (parsed.u && parsed.n && parsed.e) {
      if (Date.now() > parsed.e) {
        return null; // Expired by user timer!
      }

      const item: StoredTempFile = {
        id: fileId,
        name: parsed.n,
        size: parsed.s || 0,
        mimeType: parsed.m || 'application/octet-stream',
        remoteUrl: parsed.u,
        createdAt: parsed.c || Date.now(),
        expiresAt: parsed.e,
        downloadCount: 0,
      };

      // Cache in memory for subsequent requests in this container
      tempFileStore.set(fileId, item);
      return item;
    }
  } catch {
    // Not a valid token, continue
  }

  return null;
}
