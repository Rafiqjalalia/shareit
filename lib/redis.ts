import { Redis } from '@upstash/redis';
import { CLIPBOARD_CONFIG } from './clipboardConfig';

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
  items: ClipboardItem[];
  expiresAt: number;
}

interface MemorySpaceItem {
  space: ClipboardSpaceData;
  expiresAt: number;
}

const globalForRedis = globalThis as unknown as {
  memoryStatsStore: Map<string, MemoryStoreItem> | undefined;
  memoryPasteStore: Map<string, MemoryPasteItem> | undefined;
  memorySpaceStore: Map<string, MemorySpaceItem> | undefined;
};

if (!globalForRedis.memoryStatsStore) {
  globalForRedis.memoryStatsStore = new Map<string, MemoryStoreItem>();
}
if (!globalForRedis.memoryPasteStore) {
  globalForRedis.memoryPasteStore = new Map<string, MemoryPasteItem>();
}
if (!globalForRedis.memorySpaceStore) {
  globalForRedis.memorySpaceStore = new Map<string, MemorySpaceItem>();
}

const memoryStatsStore = globalForRedis.memoryStatsStore;
const memoryPasteStore = globalForRedis.memoryPasteStore;
const memorySpaceStore = globalForRedis.memorySpaceStore;

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
  for (const [key, item] of memorySpaceStore.entries()) {
    if (now > item.expiresAt) {
      memorySpaceStore.delete(key);
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
 * FEATURE 2: Cross-Device Clipboard Spaces Store
 * Persistent across sessions without login.
 * Automatic TTL: 24 hours of inactivity.
 * Text only: Stored in Upstash Redis or in-memory fallback.
 * =========================================================
 */

export interface ClipboardItem {
  id: string;
  code: string;
  text: string;
  createdAt: number;
  isUrl: boolean;
  pinned: boolean;
  deviceId?: string;
  deviceName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

export type QuickPasteItem = ClipboardItem;

export interface SpaceDevice {
  deviceId: string;
  deviceName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  lastSeen: number;
}

export interface ClipboardSpaceData {
  code: string;
  createdAt: number;
  lastUpdated: number;
  devices: SpaceDevice[];
  items: ClipboardItem[];
}

export const PASTE_SESSION_INACTIVITY_TTL_SEC = CLIPBOARD_CONFIG.SPACE_TTL_SECONDS;

/**
 * Normalizes and sorts items (pinned first descending by time, then unpinned descending by time).
 */
export function sortClipboardItems(items: ClipboardItem[]): ClipboardItem[] {
  const pinned = items.filter((i) => i.pinned).sort((a, b) => b.createdAt - a.createdAt);
  const unpinned = items.filter((i) => !i.pinned).sort((a, b) => b.createdAt - a.createdAt);
  return [...pinned, ...unpinned];
}

/**
 * Retrieves or initializes a clipboard space, optionally registering/updating the requesting device.
 */
export async function getClipboardSpace(
  code: string,
  device?: SpaceDevice
): Promise<
  | { status: 'ok'; space: ClipboardSpaceData }
  | { status: 'device_limit_reached'; message: string; space?: ClipboardSpaceData }
  | { status: 'not_found' }
> {
  const cleanCode = code.trim().toUpperCase();
  const key = `space:${cleanCode}`;
  const now = Date.now();

  let space: ClipboardSpaceData | null = null;

  // 1. Fetch from Upstash Redis if configured
  if (redisClient) {
    try {
      const raw = await redisClient.get<string | ClipboardSpaceData>(key);
      if (raw) {
        space = typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
    } catch (err) {
      console.warn('Upstash Redis getClipboardSpace error, falling back to memory store:', err);
    }
  }

  // 2. Fetch from in-memory fallback if not found in Redis
  if (!space) {
    cleanExpiredMemoryStats();
    const existing = memorySpaceStore.get(key);
    if (existing) {
      if (now > existing.expiresAt) {
        memorySpaceStore.delete(key);
      } else {
        space = existing.space;
      }
    }
  }

  // 3. If space does not exist yet: create a new one
  if (!space) {
    space = {
      code: cleanCode,
      createdAt: now,
      lastUpdated: now,
      devices: device ? [device] : [],
      items: [],
    };
  }

  // 4. Register or update the requesting device (if provided)
  if (device) {
    // Filter out stale devices inactive for > 24 hours
    const activeDevices = space.devices.filter(
      (d) => d.deviceId === device.deviceId || now - d.lastSeen < 24 * 60 * 60 * 1000
    );

    const existingIdx = activeDevices.findIndex((d) => d.deviceId === device.deviceId);
    if (existingIdx >= 0) {
      activeDevices[existingIdx] = {
        ...device,
        lastSeen: now,
      };
      space.devices = activeDevices;
    } else {
      if (activeDevices.length >= CLIPBOARD_CONFIG.MAX_DEVICES_PER_SPACE) {
        return {
          status: 'device_limit_reached',
          message: CLIPBOARD_CONFIG.PRO_UPGRADE_MESSAGE,
          space: {
            ...space,
            items: sortClipboardItems(space.items),
          },
        };
      }
      activeDevices.push({
        ...device,
        lastSeen: now,
      });
      space.devices = activeDevices;
    }
  }

  space.items = sortClipboardItems(space.items);

  // 5. Persist back to storage with 24h TTL
  if (redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(space), { ex: CLIPBOARD_CONFIG.SPACE_TTL_SECONDS });
    } catch (err) {
      console.warn('Upstash Redis set error in getClipboardSpace:', err);
    }
  }

  cleanExpiredMemoryStats();
  memorySpaceStore.set(key, {
    space,
    expiresAt: now + CLIPBOARD_CONFIG.SPACE_TTL_SECONDS * 1000,
  });

  return { status: 'ok', space };
}

/**
 * Saves a new clipboard item into the specified space.
 * Enforces max 10KB per item and max 10 items per space.
 */
export async function saveClipboardItem(
  code: string,
  params: {
    text: string;
    deviceId?: string;
    deviceName?: string;
    deviceType?: 'mobile' | 'tablet' | 'desktop';
  }
): Promise<
  | { success: true; item: ClipboardItem; space: ClipboardSpaceData }
  | { success: false; error: 'item_limit_reached' | 'size_limit_reached' | 'empty_text'; message: string }
> {
  const cleanCode = code.trim().toUpperCase();
  const text = params.text.trim();
  const now = Date.now();

  if (!text) {
    return { success: false, error: 'empty_text', message: 'Text cannot be empty.' };
  }

  const byteLength = new Blob([text]).size;
  if (byteLength > CLIPBOARD_CONFIG.MAX_ITEM_SIZE_BYTES) {
    return {
      success: false,
      error: 'size_limit_reached',
      message: `Item exceeds the 10KB size limit (${(byteLength / 1024).toFixed(1)}KB). Free tier allows up to 10KB per item.`,
    };
  }

  // Retrieve current space
  const res = await getClipboardSpace(cleanCode);
  let space: ClipboardSpaceData;
  if (res.status === 'ok') {
    space = res.space;
  } else if (res.status === 'device_limit_reached' && res.space) {
    space = res.space;
  } else {
    space = {
      code: cleanCode,
      createdAt: now,
      lastUpdated: now,
      devices: [],
      items: [],
    };
  }

  if (space.items.length >= CLIPBOARD_CONFIG.MAX_ITEMS_PER_SPACE) {
    return {
      success: false,
      error: 'item_limit_reached',
      message: CLIPBOARD_CONFIG.PRO_UPGRADE_MESSAGE,
    };
  }

  const isUrl = /^(https?:\/\/[^\s]+)$/i.test(text);

  const newItem: ClipboardItem = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10),
    code: cleanCode,
    text,
    createdAt: now,
    isUrl,
    pinned: false,
    deviceId: params.deviceId,
    deviceName: params.deviceName || 'Device',
    deviceType: params.deviceType || 'desktop',
  };

  space.items = [newItem, ...space.items];
  space.items = sortClipboardItems(space.items);
  space.lastUpdated = now;

  const key = `space:${cleanCode}`;

  if (redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(space), { ex: CLIPBOARD_CONFIG.SPACE_TTL_SECONDS });
    } catch (err) {
      console.warn('Upstash Redis set error in saveClipboardItem:', err);
    }
  }

  cleanExpiredMemoryStats();
  memorySpaceStore.set(key, {
    space,
    expiresAt: now + CLIPBOARD_CONFIG.SPACE_TTL_SECONDS * 1000,
  });

  return { success: true, item: newItem, space };
}

/**
 * Pins, unpins, or deletes an item in a clipboard space.
 */
export async function updateClipboardItem(
  code: string,
  itemId: string,
  action: 'pin' | 'unpin' | 'delete'
): Promise<{ success: boolean; space?: ClipboardSpaceData }> {
  const cleanCode = code.trim().toUpperCase();
  const res = await getClipboardSpace(cleanCode);
  if (res.status !== 'ok') return { success: false };

  const space = res.space;
  const now = Date.now();

  if (action === 'delete') {
    space.items = space.items.filter((i) => i.id !== itemId);
  } else if (action === 'pin') {
    const item = space.items.find((i) => i.id !== itemId ? false : true);
    const target = space.items.find((i) => i.id === itemId);
    if (target) target.pinned = true;
  } else if (action === 'unpin') {
    const target = space.items.find((i) => i.id === itemId);
    if (target) target.pinned = false;
  }

  space.items = sortClipboardItems(space.items);
  space.lastUpdated = now;

  const key = `space:${cleanCode}`;
  if (redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(space), { ex: CLIPBOARD_CONFIG.SPACE_TTL_SECONDS });
    } catch (err) {
      console.warn('Upstash Redis set error in updateClipboardItem:', err);
    }
  }

  cleanExpiredMemoryStats();
  memorySpaceStore.set(key, {
    space,
    expiresAt: now + CLIPBOARD_CONFIG.SPACE_TTL_SECONDS * 1000,
  });

  return { success: true, space };
}

/**
 * Clears all items in a clipboard space.
 */
export async function clearClipboardSpace(code: string): Promise<boolean> {
  const cleanCode = code.trim().toUpperCase();
  const res = await getClipboardSpace(cleanCode);
  if (res.status !== 'ok') return false;

  const space = res.space;
  space.items = [];
  space.lastUpdated = Date.now();

  const key = `space:${cleanCode}`;
  if (redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(space), { ex: CLIPBOARD_CONFIG.SPACE_TTL_SECONDS });
    } catch (err) {
      console.warn('Upstash Redis set error in clearClipboardSpace:', err);
    }
  }

  cleanExpiredMemoryStats();
  memorySpaceStore.set(key, {
    space,
    expiresAt: Date.now() + CLIPBOARD_CONFIG.SPACE_TTL_SECONDS * 1000,
  });

  return true;
}

/**
 * Removes a device from a clipboard space.
 */
export async function leaveClipboardSpace(code: string, deviceId: string): Promise<boolean> {
  const cleanCode = code.trim().toUpperCase();
  const res = await getClipboardSpace(cleanCode);
  if (res.status !== 'ok') return false;

  const space = res.space;
  space.devices = space.devices.filter((d) => d.deviceId !== deviceId);
  space.lastUpdated = Date.now();

  const key = `space:${cleanCode}`;
  if (redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(space), { ex: CLIPBOARD_CONFIG.SPACE_TTL_SECONDS });
    } catch (err) {
      console.warn('Upstash Redis set error in leaveClipboardSpace:', err);
    }
  }

  cleanExpiredMemoryStats();
  memorySpaceStore.set(key, {
    space,
    expiresAt: Date.now() + CLIPBOARD_CONFIG.SPACE_TTL_SECONDS * 1000,
  });

  return true;
}

/**
 * BACKWARD COMPATIBILITY HELPERS:
 */
export async function saveQuickPaste(code: string, text: string): Promise<QuickPasteItem> {
  const res = await saveClipboardItem(code, { text });
  if (res.success) {
    return res.item;
  }
  throw new Error(res.message);
}

export async function getQuickPastes(code: string): Promise<QuickPasteItem[]> {
  const res = await getClipboardSpace(code);
  if (res.status === 'ok') {
    return res.space.items;
  }
  if (res.status === 'device_limit_reached' && res.space) {
    return res.space.items;
  }
  return [];
}

export async function clearQuickPastes(code: string): Promise<void> {
  await clearClipboardSpace(code);
}
