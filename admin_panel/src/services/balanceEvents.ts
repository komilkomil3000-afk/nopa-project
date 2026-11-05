import { invalidateRankings } from './ranking';

/**
 * Someone's holdings (or a caravan's banners) changed: the cached rankings are dropped, and shortly after —
 * once the transaction that moved the balance has committed — every open app is told with the socket event
 * `assets` ({ userIds }), so the balances, «برترین‌ها» and the profiles' ranks reload instead of waiting for a poll.
 * Changes close together are sent as one event.
 */

const EMIT_DELAY_MS = 1_200;
const pending = new Set<string>();
let timer: NodeJS.Timeout | null = null;

export function noteBalanceChanged(userId?: string): void {
  invalidateRankings();
  if (userId) pending.add(userId);
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    const userIds = Array.from(pending);
    pending.clear();
    // again: a ranking read while the transaction was still open may have cached the old numbers
    invalidateRankings();
    try {
      // Loaded on use: the chat module leads back to the services that call this
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const realtime = require('../modules/chat/realtime') as typeof import('../modules/chat/realtime');
      realtime.emitToAll('assets', { userIds });
    } catch (e) {
      console.error('assets event error:', e);
    }
  }, EMIT_DELAY_MS);
  timer.unref?.();
}
