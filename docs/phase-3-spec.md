# Phase 3 — "Delen compleet" — build spec

Goal (PLAN.md §10 phase 3, §7, decisions §0): sharing between the two phones becomes complete and
honest on both platforms: everything that can travel in a WhatsApp message does (recipes, edited
classics, new ingredients), duplicates and conflicts are handled, "Stuur nieuwe naar <naam>" keeps two
phones in step without a server, bundles go as files, and backups are visibly healthy. No backend.

Existing (phase 1-2, keep): `src/domain/token.ts` (`#r=` codec, `extractTokens`, `buildShareUrl`),
`src/domain/message.ts` (`buildShareMessage`, `buildReadableRecipe`), `src/domain/recipe-io.ts`
(`normalizeRecipe`, `recipeFingerprint`, `recipeToShareEnvelope`, `recipeFromEnvelope`),
`src/domain/overrides.ts`, `src/db/repo.ts` (`importRecipes`, `exportBundle`, `importBundle`, overrides,
lineOverrides, userIngredients), `src/screens/{ShareScreen,InboxScreen,StorageScreen}.tsx`,
`src/landing.ts`, `src/sw.ts` share_target, `src/inbox-badge.ts`. Invariants in CLAUDE.md (esp. 4, 5, 6, 9).

## 1. Envelopes — CONTRACT (`src/domain/share.ts`, framework-free; token.ts unchanged)

All envelopes: `{ v: 2, t, by?: string, at?: string, msg?: string, dict?: DictDelta, ... }`.
`DictDelta = { ing: Ingredient[] }` — only USER ingredients (ids not in the bundled dictionary) that the
payload references; receivers add missing ones (`saveUserIngredient`) and never overwrite builtin ids.

| t | payload | meaning |
|---|---|---|
| `r` | `r: Recipe` (schema 2, both languages, effective lines with `lineOverrides` folded in, override applied for classics) | one recipe |
| `p` | `p: { baseId, rev, patch: RecipePatch, lineOverrides?: LineOverride[] }` | an edited classic, applied as an override on the receiver (never a duplicate) |
| `b` | `b: { title?: string, recipes: Recipe[], patches: PatchPayload[], since?: string }` | bundle: several recipes/patches (delta share, export) |

Functions:
```ts
buildRecipeEnvelope(recipe, ctx: { by: string; userIngredients: Ingredient[]; lineOverrides?: LineOverride[] }): Envelope
buildPatchEnvelope(override: RecipeOverride, ctx: { by: string; userIngredients: Ingredient[]; lineOverrides?: LineOverride[] }): Envelope
buildBundleEnvelope(items: { recipes: Recipe[]; patches: RecipeOverride[] }, ctx, opts?: { title?: string; since?: string }): Envelope
parseEnvelope(env: unknown): ParsedShare  // { kind: 'recipe'|'patch'|'bundle', by, at, msg, dict, recipes: Recipe[], patches: PatchPayload[] } — tolerant: unknown keys kept, phase-0/1 shapes via normalizeRecipe
planMessages(envelopes: Envelope[], appUrl: string, opts: { limit?: number /* chars, default 3500 */ }): Promise<MessagePlan>
   // MessagePlan = { text: string; tokens: number; chars: number } | { file: { name: string; json: string }; reason: 'too-large' }
   // packs as many `#r=`/`#p=` tokens as fit under the limit into one WhatsApp text (each URL on its own line,
   // human header lines from message.ts); above the limit → a bundle FILE (.json) instead.
```
Fragment keys: `#r=` recipe, `#p=` patch, `#b=` bundle (all deflate-raw + base64url via token.ts;
`extractTokens` already returns the key). A codec change gets a NEW key, never a silent reinterpretation.
Frozen example tokens of every kind go into `tests/share.test.ts` (must decode forever).

## 2. Merge rules — CONTRACT (`src/domain/merge.ts`, pure, unit-tested per row)

`planImport(incoming: ParsedShare, local: LocalState): ImportPlan` where
`LocalState = { recipes: Recipe[]; overrides: RecipeOverride[]; userIngredients: Ingredient[] }` and
`ImportPlan = { items: ImportItem[]; dict: { add: Ingredient[]; skip: string[] } }`,
`ImportItem = { kind: 'recipe'|'patch'; incoming; existing?; status: 'new'|'present'|'update'|'conflict'|'similar'; similarTo?: Recipe; fields?: ConflictField[] }`.

| Situation | Status | Default action |
|---|---|---|
| same `id`, same fingerprint (name nl/en + sorted raw lines + steps) | `present` | skip ("Heb je al") |
| same `id`, incoming `rev` > local `rev`, local untouched since it was received (`local.sync.receivedRev === local.rev`) | `update` | replace, label "bijgewerkt door <naam>", keep local favourites/notes |
| same `id`, both changed (local.rev ≠ local.sync.receivedRev AND incoming differs) | `conflict` | conflict card: per field name/lines/steps → mine / theirs / both ("both" = keep mine + import theirs as a copy named "<name> (<by>s versie)" with a new `u:` id) |
| different `id`, same fingerprint | `similar` | "Lijkt op <name>": replace / keep both / skip |
| new `id` | `new` | add with `origin.kind = 'received'`, `origin.receivedFrom = by`, `sync = { receivedRev: rev, receivedAt }` |
| patch for a classic the receiver has | `new` / `update` / `conflict` on the override (rev/fingerprint of the patch) | apply `saveOverride` (+ lineOverrides) |
| language fields | field-level: incoming `en` touches only `en` (invariant 3) — applies to `update` and to the "theirs" choice per field |
| dictionary delta | builtin ids never overwritten; user entries: newer `updatedAt` wins (add `updatedAt` to user Ingredient entries; missing = older) |
| deletions | never travel (no tombstones in v1) |

`applyImportPlan(plan, choices)` is in the repo (needs the db): writes in one Dexie transaction, stores an
`imports` snapshot `{ at, from, before: { recipes, overrides, lineOverrides, userIngredients } }` so
**"Maak deze import ongedaan"** restores exactly. `sync` lives on the recipe record as an unknown-key-safe
field `sync?: { receivedRev?: number; receivedAt?: string; receivedFingerprint?: string }`; `saveUserRecipe`
leaves it alone (so "untouched since receipt" = `rev === sync.receivedRev`).

## 3. Delta share ("Stuur nieuwe naar <naam>")

- Settings key `share.lastSentTo` = `{ [name: string]: string /* ISO */ }`. Partner names come from the
  profiles list (all profiles except the active one) plus a free-text name.
- Collect since that timestamp: own/received recipes with `updatedAt > since` (received ones only if edited
  after receipt), overrides with `updatedAt > since`, user ingredients referenced by them (+ those with
  `updatedAt > since`). Show a preview "3 recepten, 1 aangepaste klassieker, 2 nieuwe ingrediënten".
- `planMessages` → one WhatsApp text with several tokens when ≤ 3.5 KB, else a bundle file
  (`recepten-<naam>-YYYY-MM-DD.json`, `navigator.share({ files })`, `.txt` fallback when `.json` is refused,
  `<a download>` as last resort). After a successful share the timestamp is stored; "Markeer als verzonden"
  exists for the copy/wa.me fallback paths (share() cannot tell whether it was sent).
- Entry points: Meer → "Stuur nieuwe naar …", Inbox → top card when there is something unsent (count badge).

## 4. Screens

**Share (`/share/:id`)**: for an overridden classic share the PATCH (`#p=`) — message line 1 says
"<name> (aangepast)"; the readable text variant stays the full recipe. Recipes referencing user
ingredients include the dict delta. Keep: Deel via WhatsApp (single `{text}`), Kopieer, Deel als tekst.
**Inbox (`/inbox`)**: import section accepts text with several tokens, `#b=` bundles, `.json`/`.txt` bundle
files, the legacy backup format, and phase-0/1 tokens; the preview lists every item with its status
(Nieuw / Heb je al / Bijgewerkt door X / Conflict / Lijkt op Y) and the dictionary delta; per item a
choice where needed (conflict card with per-field mine/theirs/both; similar: replace/both/skip); one
"Importeer" button applies the plan; result line "3 nieuw · 1 bijgewerkt · 2 overgeslagen" with **"Maak
ongedaan"** (until the next import). Received list (unseen badge) as in phase 1; a patch import shows
the classic with an "aangepast door X" badge. Import history: last 10 imports with undo of the latest.
**Storage (`/more/storage`)**: counters (recipes own/received, overrides, ingredients, favourites, notes,
cook log), last backup date, a **red line when > 30 days of unbacked-up changes** (compare `updatedAt`s
with `backup.lastAt`) mirrored as a small badge on the Meer tab and a one-line reminder card on Home;
Back-up maken / Herstel as before but restore reports counters per table; "Exporteer eigen recepten"
(bundle file of own + received + overrides + user ingredients, importable on the other phone).
**Landing (`src/landing.ts`)**: `#p=` shows "Aanpassing van <classic name> door <by>" with the changed
fields; `#b=` lists the recipes (names, both languages) with "Copy code" + "Open the app"; still never
writes storage; still tiny (no Dexie).
**Home**: the backup reminder card (muted) when overdue; the "unsent changes" hint when `share.lastSentTo`
has an entry and there are newer changes.

## 5. Tests and docs

`tests/share.test.ts` (envelopes: recipe/patch/bundle round-trips, dict delta only for user ids, frozen
tokens of all three kinds, planMessages packing/limit → file), `tests/merge.test.ts` (one test per table
row incl. field-level language merge and the "both" copy naming), `tests/token.test.ts` unchanged + new
frozen tokens, repo-level logic kept thin. `docs/DEVICE-TEST.md`: phase-3 rows — Android: share a patch,
receive a two-token message via the share sheet, receive a bundle document; iPhone: paste a two-token
message, Files → import bundle, landing page for `#p=`/`#b=`. ADR-0004 updated with the `p`/`b` kinds.

## 6. Non-negotiables

CLAUDE.md invariants (single-field `navigator.share`, paste import never removed, landing never writes,
tokens versioned). No new npm dependencies (QR stays out of this phase). NL + EN for every string.
`npm run check`, `npm test`, `npm run build`, `npm run build:next`, `npm run validate:data` green.
