# ADR-0003 — Storage: IndexedDB via Dexie, database name from `BASE_URL`, backups mandatory

**Status:** Accepted · **Date:** 2026-09-24

## Context

All data lives on the phone (ADR-0005): 196 built-in recipes, own recipes with raw ingredient lines,
favourites per profile, notes, cook log, photos (Blobs), plans, shopping lists, inbox, import
snapshots for undo, settings. It must survive updates, schema changes and years of use on two
platforms with different eviction rules: Safari's 7-day ITP cleanup (Home Screen apps are exempt),
"Clear website data", removing the icon; Chromium evicts only best-effort origins under pressure.
On Android the WebAPK shares Chrome's profile storage, and **all** GitHub project sites of one user
share the origin `srutgers96-star.github.io`, so `/recepten/` and `/recepten/next/` would see the same
IndexedDB unless the database name differs.

## Decision

- **Dexie 4** over IndexedDB: declarative schema, **numbered upgrade functions** with fixture tests,
  `liveQuery` for the screens, one repository module (`src/db/`). No localStorage for records, no OPFS.
- **Database name derived from `import.meta.env.BASE_URL`**: `recepten` on `/recepten/`,
  `recepten-next` on `/recepten/next/`. A half-finished migration on `/next/` can never touch the real
  database. (On iOS the NEXT icon is a separate bucket anyway and starts empty.)
- **v1 (phase 1):** `builtins`, `userRecipes` (raw-only lines), `favorites`, `settings`, `imports`.
  **v2 (phase 2):** re-parses every own line from `raw` with the new parser at upgrade time (`raw`
  stays); `builtins` are simply replaced on a new `dataVersion`, never edited.
- `navigator.storage.persist()` on **every** start; Settings → Storage shows standalone yes/no,
  persisted yes/no, recipe count, last backup, and a red line when there are > 30 days of un-backed-up
  changes. **"> 30 days of un-backed-up changes" means (2026-09-29, phase 3): the OLDEST change that
  is in no backup yet is more than 30 days old** (`repo.backupHealth`: `min(updatedAt) < now − 30 d`
  over rows newer than `backup.lastAt`). A change made yesterday is never overdue however old the
  last backup is, and a fresh install becomes overdue 30 days after its first change — not on day one.
  The same verdict drives the Meer badge and the Home reminder card.
- **Backups are mandatory and the only real guarantee:** one tap creates `recepten-YYYY-MM-DD.json`
  via `navigator.share({files})` (or the same bytes as `.txt` when `.json` is refused) to
  Files/Drive/WhatsApp; restore reads the file back, validated on content.

## Consequences

- Schema changes are migrations with tests, not ad-hoc code; `raw` lines are never lost (CLAUDE.md
  invariant 2).
- Built-in recipes always come back after a wipe (they are in the precache); own data only through
  backups, hence the 30-day badge and the WhatsApp history as a second copy.
- iOS 16.4-17 has no `persist()` (panel shows "unknown"); below that the app is not supported.
- Adds the dependency `dexie` (frozen list in PLAN.md §4).
