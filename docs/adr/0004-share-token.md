# ADR-0004 — Share token: `#r=` deflate-raw + base64url, ≤ ~3.5 KB per message, files above that

**Status:** Accepted · **Date:** 2026-09-24 · **Amended:** 2026-09-29 (phase 3: `p` and `b` kinds, dict delta, the 3.5 KB rule in code) · 2026-10-08 (phase 5 block F: the `f` kind, `#f=` member card)

## Context

The two phones must exchange recipes without a server (ADR-0005), through WhatsApp, and on iOS the only
way into the installed app is the clipboard (ADR-0006). So the contract between the phones has to be
**text** that survives a WhatsApp message, is tappable as a link on Android, is decodable in a Safari
tab, and can be parsed out of a whole pasted message. Facts: a URL fragment never reaches a server
(RFC 3986); the largest Dutch recipe is 1,519 B JSON → 761 B deflate-raw → 1,015 URL characters,
bilingual ±1.5-2 KB; `CompressionStream('deflate-raw')` exists on iOS 16.4+ / Chrome 103+ and is
byte-identical to Java's `Deflater(nowrap=true)`; a WhatsApp message is documented at 4,096 characters
(65,536 observed); Safari URLs top out around 80 K.

## Decision

```
token = base64url( deflate-raw( UTF-8 JSON envelope ) )     // only [A-Za-z0-9_-], no padding
```

- Fragment keys are the type: `#r=` one recipe, `#p=` override patch on a built-in, `#w=` week plan,
  `#b=` bundle/backup, `#f=` member card (2026-10-08, below). They are **never** hash routes (routes are `#/…`).
- Envelope: `{ v, t, by, at, msg?, … }` with `v` the contract version, `t` ∈ `r|p|w|b|f`, `by` the
  sender's profile name, `at` an ISO timestamp, plus the payload (`r` = full schema-2 recipe in both
  languages and `dict` = only the dictionary entries the receiver may lack; `p` = `{baseId, rev,
  patch}`; `w` = `{weekStart, entries[], recipes[]}`; `b` = the full backup shape).
- **Rules:** unknown keys are preserved; `v` newer than the app → "update the app first"; a codec change
  gets a **new fragment key** (e.g. `#s=`), never a silent reinterpretation; frozen tokens of every
  version live in `tests/token.test.ts` with 196 round-trips.
- **Size limit ±3.5 KB per message** (well under the documented 4,096). Within that, several tokens may
  sit in one message (two small recipes, a delta of three NL-only recipes); the importer extracts every
  `#r=([A-Za-z0-9_-]{20,})` with a regex. Above the limit the share automatically becomes a **file**
  (`recepten-YYYY-MM-DD.json`, or the same bytes as `.txt` when `navigator.share({files})` refuses
  `.json`); the importer recognises files by content, never by extension.
- **Message format (exact):** line 1 `🍲 <NL name> · <EN name>`; line 2 `<servings> pers ·
  <n> ingrediënten · van <name>`; line 3 the bilingual "open in / tap to preview" sentence; the URL(s)
  as the **last line(s), alone**, with nothing but `[A-Za-z0-9_-]` after `#r=`.
- Sending: message built beforehand, `navigator.share({text})` **only** inside the tap handler with
  exactly one field; fallbacks `https://wa.me/?text=` and a Copy button. "Share as text" is a separate
  button for people without the app.
- Native `CompressionStream`/`DecompressionStream`; **fflate** loaded lazily only where they are missing.

## Phase 3 (2026-09-29): the `p` and `b` kinds, the dictionary delta, the 3.5 KB rule in code

Contract in `src/domain/share.ts` (docs/phase-3-spec.md §1); `token.ts` is unchanged, the fragment keys
stay the type. Every envelope is `{ v: 2, t, by?, at?, msg?, dict?, … }`.

| `t` | payload | meaning |
|---|---|---|
| `r` | `r: Recipe` — schema 2, both languages, the "Koppel" line overrides folded into the lines, override applied for a classic; receiver-side `sync`/`override` stripped | one recipe |
| `p` | `p: { baseId, rev, patch: RecipePatch, lineOverrides?, name?, updatedAt? }` | an **adjusted classic**: applied as an override on the receiver's own copy, never a duplicate. `name` is the sender's effective name so the message header and the Safari landing page can say which classic without a database |
| `b` | `b: { title?, recipes: Recipe[], patches: PatchPayload[], since? }` | a **bundle**: delta share ("Stuur nieuwe naar …") or the export of own recipes; also the shape of a bundle *file* |

- **`dict: { ing: Ingredient[] }`** — only the USER-created dictionary entries (ids the bundled dictionary
  does not know) that the payload references. The receiver adds missing ones and never overwrites a
  builtin id; between user entries the newer `updatedAt` wins. Builtin ids never travel.
- **The 3.5 KB rule is code, not advice:** `planMessages(envelopes, appUrl, { limit = 3500 })` packs as
  many `#r=`/`#p=` links as fit into ONE WhatsApp text (header lines from `message.ts`, the open line,
  one URL per line) and, above the limit, returns a bundle **file** instead — pretty JSON of one `b`
  envelope named `recepten-<name>-YYYY-MM-DD.json`, shared with `navigator.share({ files })` as `.json`,
  the same bytes as `.txt` when the platform refuses `.json`, an `<a download>` as the last resort.
  A single recipe over the limit takes the same route. The importer recognises files by content
  (`parseEnvelope`, which also reads the legacy backup shape), never by extension.
- **Message formats (exact):** one `r` = the phase-1 four-line message; one `p` = `🍲 <name> (aangepast)`
  / `van <by>` / open line / URL; several items = `🍲 <n> recepten van <by>` / open line / one URL per line.
- **Landing (`src/landing.ts`, iOS Safari outside the app):** `#p=` shows "Aanpassing van <name> door <by>"
  with the changed fields and the patched content, `#b=` lists the recipes (both languages) and the
  adjustments; both keep "Kopieer receptcode" + "Open de app" and still never write storage.
- **Frozen tokens:** `tests/fixtures/frozen-share-tokens.ts` holds a `#p=` and a `#b=` token (native
  and fflate engines) next to the phase-1 `#r=` tokens; they must decode forever.
- **Delta share bookkeeping** is a setting, not part of the token: `share.lastSentTo = { [name]: ISO }`.
  A share-sheet success stores the date; Copy / wa.me cannot know, so "Markeer als verzonden" exists.
- Deletions never travel (no tombstones in v1); `sync` on a received recipe is receiver-side only.
  A received **override** carries the same bookkeeping (`RecipeOverride.sync = { receivedRev }`, set by
  the importer, kept by `saveOverride` while it bumps `rev`), so a patch of a classic follows the same
  new / update / conflict rule as a recipe: an update only replaces an override that is untouched since
  it was received; an override made here (no `sync`) makes a differing incoming patch a conflict.
- A `p` envelope with an **empty patch** `{}` and `lineOverrides` carries the "Koppel ingrediënt" links of
  a classic that has no override (an `r` of a classic would be "Heb je al" on the receiver). The receiver
  writes the line overrides only and never an override row.

## Phase 5, block F (2026-10-08): the `f` kind — a member card (`#f=`)

A fifth kind, a new fragment key, the same v2 envelope: `{ v: 2, t: 'f', by, at, f: { id, name, color,
lang, deviceId? } }` — the sender as a household member (`id` = their profile id `p:…`, `color` the profile
swatch, `lang` `'nl'|'en'`, `deviceId` a stable random id of their phone from the setting `device.id`, so a
re-sent card updates the same member instead of adding a second one). It carries no recipes and no `dict`.
`src/domain/share.ts`: `buildMemberEnvelope(card)`, `readMemberPayload(v)` (tolerant: `id` and `name`
required, the colour falls back to cobalt unless it is a plain CSS colour, `lang` defaults to `nl`, unknown
keys stay) and `parseEnvelope` → `{ kind: 'member', member }`; `buildMemberShareMessage` is the one-sentence
WhatsApp text with the `#f=` URL alone on the last line. `token.ts`, `router.ts`, `boot.ts` and
`landing.ts` accept `f` next to `r|p|w|b`; the landing page shows "Kaartje van <name>" with the swatch and
language, "Kopieer code" and the same hand-off card (on an iPhone the card arrives by copy → app → Inbox →
Plak; a link never opens the installed app, CLAUDE.md invariant 5). Frozen `#f=` tokens (native and
fflate) sit in `tests/fixtures/frozen-share-tokens.ts`. **Honest limit:** an app from before this block
does not know `f` — its `extractTokens` skips `#f=` and its `parseEnvelope` answers `invalid-token`, so
such a phone shows "no readable recipe" / opens Home, **not** "update the app" (that message is tied to `v`,
which stays 2); both phones need this version before cards can be exchanged.

## Consequences

- Recipe text never touches a server; WhatsApp's preview is the generic app card.
- One recipe fits comfortably in a link; weekly exchanges stay in text as long as possible because the
  file route costs the iPhone three extra taps (ADR-0006, flow C).
- Whether a 2 KB fragment link stays one tappable link in WhatsApp on both phones is UNKNOWN and is
  test 8 / the iPhone row in ADR-0001; the importer accepts the whole pasted message regardless.
- Adds the dependency `fflate` (lazy fallback only).
