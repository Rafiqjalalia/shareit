import { Redis } from '@upstash/redis';

/**
 * Serverless store for Temporary Cloud Share links activity tracking.
 * Uses Upstash Redis (HTTP REST) on Vercel, with an automatic in-memory fallback
 * for seamless zero-config local development and testing.
 */

export interface LinkStatsData {
  [key: string]: unknown;
  ownerToken: string;
  opens: number;
  downloads: number;
  createdAt: number;
  expiresAt: number;
  lastOpenedAt: number;
  lastDownloadedAt: number;
  fileName: string;
  fileSize: number;
}

export interface LinkStatsResponse {
  fileId: string;
  opens: number;
  downloads: number;
  lastOpenedAt: number | null;
  lastDownloadedAt: number | null;
  createdAt: number;
  expiresAt: number;
  fileName: string;
  fileSize: number;
  isPremium: boolean;
  // Hook for future premium detailed history log
  history?: Array<{ timestamp: number; type: 'open' | 'download' }>;
}

// Check for Upstash or Vercel KV environment variables
const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL;

const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_TOKEN;

const redisClient: Redis | null =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

// In-memory fallback singleton for local development or when Redis env vars are absent
interface MemoryStoreItem {
  data: LinkStatsData;
  expiresAt: number;
}

interface MemoryPasteItem {
  items: QuickPasteItem[];
  expiresAt: number;
}

const globalForRedis = globalThis as unknown as {
  memoryStatsStore: Map<string, MemoryStoreItem> | undefined;
  memoryPasteStore: Map<string, MemoryPasteItem> | undefined;
};

if (!globalForRedis.memoryStatsStore) {
  globalForRedis.memoryStatsStore = new Map<string, MemoryStoreItem>();
}
if (!globalForRedis.memoryPasteStore) {
  globalForRedis.memoryPasteStore = new Map<string, MemoryPasteItem>();
}

const memoryStatsStore = globalForRedis.memoryStatsStore;
const memoryPasteStore = globalForRedis.memoryPasteStore;

function cleanExpiredMemoryStats() {
  const now = Date.now();
  for (const [key, item] of memoryStatsStore.entries()) {
    if (now > item.expiresAt) {
      memoryStatsStore.delete(key);
    }
  }
  for (const [key, item] of memoryPasteStore.entries()) {
    if (now > item.expiresAt) {
      memoryPasteStore.delete(key);
    }
  }
}

/**
 * FEATURE FLAG: Detailed Activity History
 * Free tier displays total opens and downloads only.
 * Premium tier hook allows enabling granular historical activity timeline.
 */
export const FEATURE_FLAG_ENABLE_DETAILED_HISTORY = false;

/**
 * Initializes tracking stats and owner token for a newly generated share link.
 * Sets the exact TTL so Redis automatically expires and deletes the key with the share link.
 */
export async function initLinkStats(params: {
  fileId: string;
  ownerToken: string;
  expiresAt: number;
  fileName?: string;
  fileSize?: number;
}): Promise<void> {
  const { fileId, ownerToken, expiresAt, fileName = '', fileSize = 0 } = params;
  const now = Date.now();
  const ttlSeconds = Math.max(1, Math.floor((expiresAt - now) / 1000));

  const statsRecord: LinkStatsData = {
    ownerToken,
    opens: 0,
    downloads: 0,
    createdAt: now,
    expiresAt,
    lastOpenedAt: 0,
    lastDownloadedAt: 0,
    fileName,
    fileSize,
  };

  if (redisClient) {
    try {
      const key = `stats:${fileId}`;
      await redisClient.hset(key, statsRecord);
      await redisClient.expire(key, ttlSeconds);
      return;
    } catch (err) {
      console.warn('Upstash Redis initLinkStats failed, falling back to memory store:', err);
    }
  }

  // Memory fallback
  cleanExpiredMemoryStats();
  memoryStatsStore.set(`stats:${fileId}`, {
    data: statsRecord,
    expiresAt,
  });
}

/**
 * Atomically records an open or download event.
 * PRIVACY: Stores strictly count increments and timestamps. No IP or user agent data is stored.
 */
export async function recordLinkActivity(
  fileId: string,
  event: 'open' | 'download'
): Promise<{ success: boolean; opens?: number; downloads?: number }> {
  const now = Date.now();
  const key = `stats:${fileId}`;

  if (redisClient) {
    try {
      // Check if key exists
      const exists = await redisClient.exists(key);
      if (!exists) {
        // Attempt to auto-initialize if fileId is self-contained token
        try {
          const raw = Buffer.from(fileId, 'base64url').toString('utf8');
          const parsed = JSON.parse(raw);
          if (parsed.e && parsed.e > now) {
            const ttlSeconds = Math.max(1, Math.floor((parsed.e - now) / 1000));
            const newRecord: LinkStatsData = {
              ownerToken: '',
              opens: event === 'open' ? 1 : 0,
              downloads: event === 'download' ? 1 : 0,
              createdAt: parsed.c || now,
              expiresAt: parsed.e,
              lastOpenedAt: event === 'open' ? now : 0,
              lastDownloadedAt: event === 'download' ? now : 0,
              fileName: parsed.n || '',
              fileSize: parsed.s || 0,
            };
            await redisClient.hset(key, newRecord);
            await redisClient.expire(key, ttlSeconds);
            return { success: true, opens: newRecord.opens, downloads: newRecord.downloads };
          }
        } catch {
          // invalid token
        }
        return { success: false };
      }

      // Key exists: increment count and update timestamp
      const fieldToIncr = event === 'open' ? 'opens' : 'downloads';
      const timestampField = event === 'open' ? 'lastOpenedAt' : 'lastDownloadedAt';

      const newCount = await redisClient.hincrby(key, fieldToIncr, 1);
      await redisClient.hset(key, { [timestampField]: now });

      return {
        success: true,
        opens: event === 'open' ? newCount : undefined,
        downloads: event === 'download' ? newCount : undefined,
      };
    } catch (err) {
      console.warn('Upstash Redis recordLinkActivity error, checking memory store:', err);
    }
  }

  // Memory fallback
  cleanExpiredMemoryStats();
  const item = memoryStatsStore.get(key);
  if (!item) {
    // Attempt auto-recovery from fileId token
    try {
      const raw = Buffer.from(fileId, 'base64url').toString('utf8');
      const parsed = JSON.parse(raw);
      if (parsed.e && parsed.e > now) {
        const newRecord: LinkStatsData = {
          ownerToken: '',
          opens: event === 'open' ? 1 : 0,
          downloads: event === 'download' ? 1 : 0,
          createdAt: parsed.c || now,
          expiresAt: parsed.e,
          lastOpenedAt: event === 'open' ? now : 0,
          lastDownloadedAt: event === 'download' ? now : 0,
          fileName: parsed.n || '',
          fileSize: parsed.s || 0,
        };
        memoryStatsStore.set(key, { data: newRecord, expiresAt: parsed.e });
        return { success: true, opens: newRecord.opens, downloads: newRecord.downloads };
      }
    } catch {
      // invalid token
    }
    return { success: false };
  }

  if (now > item.expiresAt) {
    memoryStatsStore.delete(key);
    return { success: false };
  }

  if (event === 'open') {
    item.data.opens += 1;
    item.data.lastOpenedAt = now;
  } else {
    item.data.downloads += 1;
    item.data.lastDownloadedAt = now;
  }

  return {
    success: true,
    opens: item.data.opens,
    downloads: item.data.downloads,
  };
}

/**
 * Retrieves link activity stats.
 * Enforces ownerToken authorization: only the creator possessing the owner token can view stats.
 */
export async function getLinkStats(
  fileId: string,
  providedOwnerToken: string
): Promise<{ status: 'ok'; stats: LinkStatsResponse } | { status: 'not_found' } | { status: 'unauthorized' }> {
  const now = Date.now();
  const key = `stats:${fileId}`;

  let data: LinkStatsData | null = null;

  if (redisClient) {
    try {
      const redisData = (await redisClient.hgetall(key)) as Record<string, any> | null;
      if (redisData && Object.keys(redisData).length > 0) {
        data = {
          ownerToken: String(redisData.ownerToken || ''),
          opens: Number(redisData.opens || 0),
          downloads: Number(redisData.downloads || 0),
          createdAt: Number(redisData.createdAt || 0),
          expiresAt: Number(redisData.expiresAt || 0),
          lastOpenedAt: Number(redisData.lastOpenedAt || 0),
          lastDownloadedAt: Number(redisData.lastDownloadedAt || 0),
          fileName: String(redisData.fileName || ''),
          fileSize: Number(redisData.fileSize || 0),
        };
      }
    } catch (err) {
      console.warn('Upstash Redis getLinkStats error:', err);
    }
  }

  // Memory fallback
  if (!data) {
    cleanExpiredMemoryStats();
    const item = memoryStatsStore.get(key);
    if (item) {
      if (now > item.expiresAt) {
        memoryStatsStore.delete(key);
        return { status: 'not_found' };
      }
      data = item.data;
    }
  }

  if (!data) {
    return { status: 'not_found' };
  }

  // Check expiration
  if (data.expiresAt && now > data.expiresAt) {
    return { status: 'not_found' };
  }

  // Authorization check
  if (!providedOwnerToken || providedOwnerToken !== data.ownerToken) {
    return { status: 'unauthorized' };
  }

  const response: LinkStatsResponse = {
    fileId,
    opens: data.opens,
    downloads: data.downloads,
    lastOpenedAt: data.lastOpenedAt > 0 ? data.lastOpenedAt : null,
    lastDownloadedAt: data.lastDownloadedAt > 0 ? data.lastDownloadedAt : null,
    createdAt: data.createdAt,
    expiresAt: data.expiresAt,
    fileName: data.fileName,
    fileSize: data.fileSize,
    isPremium: FEATURE_FLAG_ENABLE_DETAILED_HISTORY,
  };

  // Premium hook
  if (FEATURE_FLAG_ENABLE_DETAILED_HISTORY) {
    response.history = [];
  }

  return { status: 'ok', stats: response };
}

/**
 * =========================================================
 * FEATURE 2: Quick Paste (Phone -> PC Text & Links) Store
 * Messages expire after 30 minutes of session inactivity.
 * Capped at last 10 items for the session.
 * =========================================================
 */

export interface QuickPasteItem {
  id: string;
  code: string;
  text: string;
  createdAt: number;
  isUrl: boolean;
}

export const PASTE_SESSION_INACTIVITY_TTL_SEC = 30 * 60; // 30 minutes

/**
 * Saves a quick text/link paste to the session and refreshes the 30-minute inactivity TTL.
 */
export async function saveQuickPaste(
  code: string,
  text: string
): Promise<QuickPasteItem> {
  const cleanCode = code.trim().toUpperCase();
  const trimmedText = text.slice(0, 5000);
  const now = Date.now();
  const isUrl = /^(https?:\/\/[^\s]+)$/i.test(trimmedText.trim());

  const item: QuickPasteItem = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10),
    code: cleanCode,
    text: trimmedText,
    createdAt: now,
    isUrl,
  };

  const key = `paste:${cleanCode}`;

  if (redisClient) {
    try {
      const raw = await redisClient.get<string | QuickPasteItem[]>(key);
      let list: QuickPasteItem[] = [];
      if (raw) {
        list = typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
      list = [item, ...list].slice(0, 10);
      await redisClient.set(key, JSON.stringify(list), { ex: PASTE_SESSION_INACTIVITY_TTL_SEC });
      return item;
    } catch (err) {
      console.warn('Upstash Redis saveQuickPaste error, falling back to memory store:', err);
    }
  }

  // Memory fallback
  cleanExpiredMemoryStats();
  const existing = memoryPasteStore.get(key);
  let list: QuickPasteItem[] = existing ? existing.items : [];
  list = [item, ...list].slice(0, 10);
  memoryPasteStore.set(key, {
    items: list,
    expiresAt: now + PASTE_SESSION_INACTIVITY_TTL_SEC * 1000,
  });

  return item;
}

/**
 * Retrieves the session history of items (up to 10) and refreshes the 30-minute inactivity TTL.
 */
export async function getQuickPastes(code: string): Promise<QuickPasteItem[]> {
  const cleanCode = code.trim().toUpperCase();
  const key = `paste:${cleanCode}`;
  const now = Date.now();

  if (redisClient) {
    try {
      const raw = await redisClient.get<string | QuickPasteItem[]>(key);
      if (raw) {
        const list: QuickPasteItem[] = typeof raw === 'string' ? JSON.parse(raw) : raw;
        await redisClient.expire(key, PASTE_SESSION_INACTIVITY_TTL_SEC);
        return list;
      }
      return [];
    } catch (err) {
      console.warn('Upstash Redis getQuickPastes error, falling back to memory store:', err);
    }
  }

  // Memory fallback
  cleanExpiredMemoryStats();
  const existing = memoryPasteStore.get(key);
  if (existing) {
    if (now > existing.expiresAt) {
      memoryPasteStore.delete(key);
      return [];
    }
    existing.expiresAt = now + PASTE_SESSION_INACTIVITY_TTL_SEC * 1000;
    return existing.items;
  }

  return [];
}

/**
 * Clears the session history for this pairing code.
 */
export async function clearQuickPastes(code: string): Promise<void> {
  const cleanCode = code.trim().toUpperCase();
  const key = `paste:${cleanCode}`;

  if (redisClient) {
    try {
      await redisClient.del(key);
    } catch (err) {
      console.warn('Upstash Redis clearQuickPastes error:', err);
    }
  }

  memoryPasteStore.delete(key);
}
