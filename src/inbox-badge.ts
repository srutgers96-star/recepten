// Unseen count for the Inbox tab badge: received recipes whose id is not in the setting
// `inbox.seenIds` (a string[] the Inbox screen maintains). `startInboxBadge()` keeps the signal
// live through Dexie's liveQuery; `refreshInboxUnseen()` is a one-shot recount.
import { signal } from '@preact/signals';
import { liveQuery } from 'dexie';
import { getSetting, userRecipes } from '@/db/repo';

export const INBOX_SEEN_KEY = 'inbox.seenIds';

export const inboxUnseen = signal(0);

async function countUnseen(): Promise<number> {
  const [list, seen] = await Promise.all([userRecipes(), getSetting<unknown>(INBOX_SEEN_KEY, [])]);
  const seenIds = new Set(Array.isArray(seen) ? (seen as unknown[]).filter((v): v is string => typeof v === 'string') : []);
  let n = 0;
  for (const r of list) if (r.origin.kind === 'received' && !seenIds.has(r.id)) n++;
  return n;
}

export async function refreshInboxUnseen(): Promise<void> {
  try {
    inboxUnseen.value = await countUnseen();
  } catch {
    /* database unavailable: keep the last value */
  }
}

let subscribed = false;

/** Subscribes once; the badge then follows every change to userRecipes / settings. */
export function startInboxBadge(): void {
  if (subscribed) return;
  subscribed = true;
  try {
    liveQuery(countUnseen).subscribe({
      next: (n) => {
        inboxUnseen.value = n;
      },
      error: (e) => console.warn('inbox badge', e),
    });
  } catch (e) {
    console.warn('inbox badge', e);
    void refreshInboxUnseen();
  }
}
