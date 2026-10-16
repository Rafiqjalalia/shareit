import PusherServer from 'pusher';
import { QuickPasteItem } from './redis';

let pusherServerInstance: PusherServer | null = null;

/**
 * Returns a configured Pusher server instance if environment variables are provided.
 */
export function getPusherServer(): PusherServer | null {
  if (pusherServerInstance) return pusherServerInstance;

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1';

  if (appId && key && secret) {
    pusherServerInstance = new PusherServer({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });
    return pusherServerInstance;
  }

  return null;
}

/**
 * Dispatches real-time event to the clipboard space channel.
 */
export async function triggerClipboardEvent(
  code: string,
  event: 'new-item' | 'item-action' | 'space-cleared' | 'device-joined' | 'device-left' | 'new-paste',
  data: any
): Promise<boolean> {
  const pusher = getPusherServer();
  if (!pusher) return false;

  try {
    const cleanCode = code.toUpperCase();
    await pusher.trigger(`clipboard-space-${cleanCode}`, event, data);
    // Also trigger legacy event name on legacy channel for backward compatibility
    await pusher.trigger(`quick-paste-${cleanCode}`, event === 'new-item' ? 'new-paste' : event, data);
    return true;
  } catch (err) {
    console.warn('Pusher real-time trigger failed:', err);
    return false;
  }
}

/**
 * Dispatches real-time 'new-paste' event to the PC listener.
 */
export async function triggerQuickPasteRealtime(item: QuickPasteItem): Promise<boolean> {
  return triggerClipboardEvent(item.code, 'new-item', item);
}
