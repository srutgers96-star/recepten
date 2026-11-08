// Lazy loader of the handbook data (docs/specs/handbook.md §3). The topic files
// data/handbook/<nn>-<id>.json are separate chunks, fetched only when the Handbook screen opens, so
// the main bundle does not grow; the Safari landing never imports this module.
import { normalizeHandbook, type HandbookSection } from '@/domain/handbook';

const files = import.meta.glob<unknown>('../data/handbook/*.json', { import: 'default' });

let cached: Promise<HandbookSection[]> | null = null;

/** All topics, sorted by `order` (tolerant: a broken file is skipped, never fatal). Cached. */
export function loadHandbook(): Promise<HandbookSection[]> {
  if (!cached) {
    cached = Promise.all(
      Object.values(files).map((load) =>
        load().catch((e: unknown) => {
          console.error('handbook', e);
          return null;
        }),
      ),
    ).then((raw) => normalizeHandbook(raw));
    // A failed load (offline before the chunks were cached) may be retried on the next visit.
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}
