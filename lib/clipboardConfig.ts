/**
 * Centralized Configuration Limits for Free-Tier Cross-Device Clipboard Spaces.
 * Edit this file to adjust limits or prepare for future Pro tier expansion.
 */
export const CLIPBOARD_CONFIG = {
  // Maximum number of devices allowed in a single clipboard space concurrently
  MAX_DEVICES_PER_SPACE: 3,

  // Maximum number of active clipboard items per space
  MAX_ITEMS_PER_SPACE: 10,

  // Maximum text size per item in bytes (10KB = 10,240 bytes)
  MAX_ITEM_SIZE_BYTES: 10 * 1024,

  // Expiration TTL for clipboard spaces and items (24 hours in seconds)
  SPACE_TTL_SECONDS: 24 * 60 * 60,

  // Real-time synchronization polling interval in milliseconds (~2 seconds)
  POLL_INTERVAL_MS: 2000,

  // Friendly placeholder message when free limits are reached
  PRO_UPGRADE_MESSAGE:
    "Free Space Limit Reached: The free tier allows up to 3 devices, 10 items, and 10KB per item. Upgrade to ShaeIt Pro (Coming Soon) for unlimited devices, 100+ items, and 30-day clipboard retention!",
};
