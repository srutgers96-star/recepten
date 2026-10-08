# ADR-0006 — iOS receiving is pull-based: flows A, B and C

**Status:** Accepted · **Date:** 2026-09-24 · re-check yearly (CLAUDE.md "Yearly task")

## Context (verified facts, PLAN.md §3)

- A link in a WhatsApp message on iOS **always opens Safari**, never the installed Home Screen app —
  no link capturing, also not in iOS 26 / Safari 26.4.
- The Home Screen app's storage (IndexedDB, localStorage) is a **separate bucket** from Safari, from
  in-app browsers and from a second icon of the same site. Whatever a Safari tab saves is invisible to
  the app.
- **Web Share Target does not exist on iOS** (WebKit bug 194593, open since 2019): the app can never
  appear in the iPhone share sheet.
- Home Screen apps are exempt from Safari's 7-day storage cleanup; a Safari tab is not.
- `navigator.share({text})` works; with `text`+`url` WhatsApp gets only the URL, with `files`+`text`
  the file is dropped → always exactly one field.
- Clipboard: `writeText` in a tap works; `readText` in a tap shows an iOS "Paste" callout she must
  tap; a plain `<textarea>` needs no API at all.
- The installed app always starts from `start_url`; fragments never reach it.

## Decision

Receiving on the iPhone is **pull-based**: the user brings the recipe into the app, the app never
pretends a link or the share sheet can do it.

- **Flow A — primary (~10 s):** long-press the WhatsApp bubble → Copy → Recipes icon → Import tab (one
  tap from Home) → **"Paste from clipboard"** (`readText` in the tap; she taps the iOS Paste callout)
  **or** long-press in the big text box → Paste (no API) → preview "New: Pasta pesto (from Stijn)" →
  Import → straight into her own IndexedDB.
- **Flow B — she taps the link:** Safari loads, via the boot rule in `src/boot.ts`, the **separate,
  tiny landing bundle** (`src/landing.ts`: no Dexie, no router). It decodes the fragment client-side,
  shows the recipe read-only with an NL/EN switch, offers **"Copy recipe code"** and a card "Open Recipes
  on your home screen → Import → Paste", and for new visitors "Add to Home Screen". **It never saves
  anything.**
- **Flow C — bundles and backups (three extra taps, said honestly):** `.json` document in WhatsApp →
  Share → Save to Files → app → Import → "Choose file" (validated on content) → "12 new, 2 updated" →
  Import. This is why the weekly exchange stays in text tokens up to ±3.5 KB (ADR-0004).
- **Flow D — same room, experimental, behind a flag:** Stijn shows a QR (raw deflate bytes, byte mode,
  ≈ version 19-20 ECC L); she scans in the app. Camera/`BarcodeDetector` in an iOS standalone app is
  UNKNOWN; fallback: scan with the iPhone Camera app → Safari → flow B. Single recipes only.

Boot rule (invariant): `#r=`/`#p=`/`#w=`/`#b=`/`#f=` (the member card, ADR-0004) **and** iOS **and** not standalone → landing bundle;
everything else (Android WebAPK, Android Chrome tab with shared storage, the installed iPhone app,
desktop) → full app with the import preview open.

## Consequences

- The **paste import (button and textarea) is never removed** from the app, on any platform; Android
  gets it too as the manual fallback next to the share target and link capture.
- The landing bundle stays tiny and storage-free; it is covered by the Playwright WebKit smoke test
  (mobile UA, `#r=`, non-standalone → landing).
- The app shows a **permanent** banner when it runs in a Safari tab ("Add me to your home screen,
  otherwise Safari may wipe your recipes after 7 days").
- If pasting really irritates after two months of use, the documented escape is ADR-0008: €99/year for
  a native iOS shell with a Share Extension and Universal Links; token, data files and `src/domain/`
  go along unchanged.
