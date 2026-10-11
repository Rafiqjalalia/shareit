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
 * Dispatches real-time 'new-paste' event to the PC listener.
 */
export async function triggerQuickPasteRealtime(item: QuickPasteItem): Promise<boolean> {
  const pusher = getPusherServer();
  if (!pusher) return false;

  try {
    const channel = `quick-paste-${item.code.toUpperCase()}`;
    await pusher.trigger(channel, 'new-paste', item);
    return true;
  } catch (err) {
    console.warn('Pusher real-time trigger failed:', err);
    return false;
  }
}
