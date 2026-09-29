// Unseen count for the Inbox tab badge: received recipes (key = recipe id) and classics adjusted
// by someone else (key = 'p:' + baseId, repo.receivedPatches) whose key is not in the setting
// `inbox.seenIds` (a string[] the Inbox screen maintains) — the same rows the Inbox lists.
// `startInboxBadge()` keeps the signal live through Dexie's liveQuery; `refreshInboxUnseen()` is
// a one-shot recount.
//
// Phase 3 (docs/phase-3-spec.md §3/§4): two more live signals for the Meer rows and the Home
// reminder cards. `unsentChanges` = recipes + adjusted classics changed since the OLDEST
// "share.lastSentTo" timestamp (0 when nothing was ever sent to anyone: then there is nobody to
// keep in step with). `backupStatus` mirrors repo.backupHealth() (overdue = > 30 days and
// changes exist). The Nav only shows the inbox badge (Nav.tsx is untouched).
import { signal } from '@preact/signals';
import { liveQuery } from 'dexie';
import { backupHealth, collectDeltaSince, getLastSentTo, getSetting, receivedPatches, userRecipes, type BackupHealth } from '@/db/repo';

export const INBOX_SEEN_KEY = 'inbox.seenIds';

export const inboxUnseen = signal(0);

/** Recipes + patches not yet sent to the partner who is furthest behind (0 = no partner known). */
export const unsentChanges = signal(0);

/** Last backup date, unbacked change count and the 30-day verdict; null until first read. */
export const backupStatus = signal<BackupHealth | null>(null);

async function countUnseen(): Promise<number> {
  const [list, patches, seen] = await Promise.all([userRecipes(), receivedPatches(), getSetting<unknown>(INBOX_SEEN_KEY, [])]);
  const seenIds = new Set(Array.isArray(seen) ? (seen as unknown[]).filter((v): v is string => typeof v === 'string') : []);
  let n = 0;
  for (const r of list) if (r.origin.kind === 'received' && !seenIds.has(r.id)) n++;
  for (const p of patches) if (!seenIds.has('p:' + p.baseId)) n++;
  return n;
}

async function countUnsent(): Promise<number> {
  const sent = await getLastSentTo();
  const stamps = Object.values(sent).sort();
  const oldest = stamps[0];
  if (!oldest) return 0;
  const delta = await collectDeltaSince(oldest);
  return delta.recipes.length + delta.patches.length;
}

export async function refreshInboxUnseen(): Promise<void> {
  try {
    inboxUnseen.value = await countUnseen();
  } catch {
    /* database unavailable: keep the last value */
  }
}

/** One-shot recount of the unsent-changes and backup-health signals (screens call it on mount). */
export async function refreshShareBadges(): Promise<void> {
  try {
    const [unsent, health] = await Promise.all([countUnsent(), backupHealth()]);
    unsentChanges.value = unsent;
    backupStatus.value = health;
  } catch {
    /* database unavailable: keep the last values */
  }
}

let subscribed = false;

/** Subscribes once; the badges then follow every change to the tables they read. */
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
  try {
    liveQuery(countUnsent).subscribe({
      next: (n) => {
        unsentChanges.value = n;
      },
      error: (e) => console.warn('unsent badge', e),
    });
    liveQuery(backupHealth).subscribe({
      next: (h) => {
        backupStatus.value = h;
      },
      error: (e) => console.warn('backup badge', e),
    });
  } catch (e) {
    console.warn('share badges', e);
    void refreshShareBadges();
  }
}
