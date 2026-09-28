# ADR-0004 — Share token: `#r=` deflate-raw + base64url, ≤ ~3.5 KB per message, files above that

**Status:** Accepted · **Date:** 2026-09-24

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
  `#b=` bundle/backup. They are **never** hash routes (routes are `#/…`).
- Envelope: `{ v, t, by, at, msg?, … }` with `v` the contract version, `t` ∈ `r|p|w|b`, `by` the
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

## Consequences

- Recipe text never touches a server; WhatsApp's preview is the generic app card.
- One recipe fits comfortably in a link; weekly exchanges stay in text as long as possible because the
  file route costs the iPhone three extra taps (ADR-0006, flow C).
- Whether a 2 KB fragment link stays one tappable link in WhatsApp on both phones is UNKNOWN and is
  test 8 / the iPhone row in ADR-0001; the importer accepts the whole pasted message regardless.
- Adds the dependency `fflate` (lazy fallback only).
