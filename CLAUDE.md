# CLAUDE.md — Rutgers' Recepten v2

Project brief for AI assistants. Read this first, then `docs/STATUS.md` (where the work stands and what is next). The full design is `PLAN.md` (its §0 decisions table
wins over everything else in that file). Decisions with their "why" live in `docs/adr/`.

## Who uses this

| Person | Phone | Language | How the app arrives |
|---|---|---|---|
| Stijn (owner; builds with Claude Code) | Android, Chrome is the default browser | Dutch | Chrome → Install → WebAPK. Has share target + (likely) link capture. |
| His girlfriend (reviews the English edition; tests on `/next/`) | iPhone, iOS 26 | English (British) | Safari → Share → Add to Home Screen. **No share target, no link capture**: receiving is copy → app → paste. |

One codebase, one site, two channels: `main` → `https://srutgers96-star.github.io/recepten/`, `next` →
`…/recepten/next/` (test channel with its **own** database name, manifest id and icon).

## Stack (frozen)

Preact 10 + TypeScript 5.9 strict + `@preact/signals` · Vite 8 + `vite-plugin-pwa` (injectManifest,
hand-written `src/sw.ts`) · Dexie 4 over IndexedDB · `CompressionStream('deflate-raw')` with fflate as
lazy fallback · Vitest · Node 22 scripts in `tools/`. Plain CSS (no Tailwind), ~40-line hash router
(no router library), no state library. GitHub Pages; no backend.
**No new npm dependency without a line in an ADR.** Say so in your report instead of adding one.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with `--host` (phones on the same wifi: `http://<pc-ip>:5173`; HTTP only — share sheet and clipboard need HTTPS or the Chrome flag, see PLAN.md §4 "Dev-loop") |
| `npm run check` | `tsc --noEmit` — must be green before you finish |
| `npm test` | Vitest, `tests/**/*.test.ts`, node environment |
| `npm run build` | Production build, base `/recepten/` → `dist/` |
| `npm run build:next` | Same with `NEXT_CHANNEL=1`, base `/recepten/next/` → `dist-next/` |
| `npm run validate:data` | Validates `data/*.json` (`tools/validate-data.ts`) |
| `npm run measure-parse` | Parser coverage over the recipe corpus (`tools/measure-parse.ts`) |
| `npm run icons` | Regenerates `public/icons/*` from `assets/cover.png` (Python) |

Stijn's PC runs Windows 11 / PowerShell 5.1: no `&&` or `||`; chain with `;` or `if ($?) { … }`.

## Layout

```
src/boot.ts         decides landing bundle vs full app (boot rule below); imports nothing else
src/main.tsx        start({openImportFromHash}) → renders <App/> and registers the service worker
src/app.tsx         root component + hash router ('#/…')
src/landing.ts      tiny Safari viewer for share tokens: no Dexie, no router, NEVER writes storage
src/pwa.ts          registerServiceWorker, updateReady signal, reloadToNewVersion, requestPersistentStorage, isStandalone
src/sw.ts           precache + share_target POST handler (cache 'share-inbox', redirects to #/inbox) +
                    SKIP_WAITING message + notificationclick (timer notifications focus/open the app)
src/i18n/           lang signal 'nl'|'en' and t(key); dictionaries per owner (common, browse, edit,
                    settings) merged in index.ts; every UI string exists in both languages
src/styles/         base.css (tokens, shell, nav, buttons, inputs, cards, dark mode, safe-area) plus
                    browse.css, edit.css, settings.css; main.tsx imports all four
src/profile.ts      profiles + activeProfile signals; src/timers.ts app-level cooking-timer engine;
src/theme.ts        system/light/dark; src/inbox-badge.ts unseen count for the Inbox tab; src/celebrate.ts
src/domain/         FRAMEWORK-FREE (no preact, no dexie; runs in Node): model, parser, units, dictionary,
                    render, scale, aggregate, merge, token, message, steps, timers, search, planner
src/db/             Dexie schema, numbered migrations, one repository module (repo.ts, the ONLY module
                    the UI talks to for data); dbName derived from BASE_URL
src/screens/        home · recipes · recipe · cook · edit · share · inbox · more · profiles · storage ·
                    story · onboarding · check … (week · shopping · curator · book come later)
src/components/     header, nav, rows, step view, timer bar, line editor, confetti, install card …
data/               SOURCE OF TRUTH: recipes.json (schema 2, bilingual), ingredients/units/categories/…, i18n/
data/source/        recipes-recepten2.json: the 196 originals from Recepten2 (read-only, never edited by hand)
public/             icons/, cover.webp, share/index.html (share_target fallback), .nojekyll
tools/              Node 22 scripts: validate-data, measure-parse, make-icons.py, migration, translation batches
tests/              Vitest, only where data, parser, codec, scaling, aggregation or merge can break
docs/adr/           architecture decision records (0001 = phase-0 go/no-go checklist + results)
docs/DEVICE-TEST.md plain-language phone test walkthrough (NL + EN)
```

## Invariants (PLAN.md §12 step 3 — never break these)

1. **ids never change.** A recipe id is forever; favorites, cook log, plans and shares all point at it.
2. **A raw ingredient line is never deleted.** Structure lives next to `raw`; re-parsing re-reads `raw`.
3. **Every human-text field is `{nl, en}`.** Either side may be empty; an incoming `en` only touches `en`.
4. **The share token is a versioned contract.** `#r=` = base64url(deflate-raw(JSON envelope with `v`)).
   Unknown keys are preserved; `v` newer than the app → "update the app first"; a codec change gets a
   **new fragment key** (e.g. `#s=`), never a silent reinterpretation. Frozen tokens of every version
   stay in `tests/token.test.ts`.
5. **iOS has no share target and no link capture.** The paste import (button **and** plain textarea) is
   never removed from the app, and no flow may pretend a link opens the installed iPhone app.
6. **The landing bundle never writes storage.** Safari's bucket is invisible to the Home Screen app.
7. **Boot rule** (`src/boot.ts`): hash token (`#r=`/`#p=`/`#w=`/`#b=`/`#f=`) **and** iOS **and** not standalone
   → `landing.ts`; everything else → full app, with the import preview opened when a token is present.
8. **`navigator.storage.persist()` on every start.**
9. **`navigator.share` with exactly ONE field** (`{text}` or `{files}`); `text`+`url` or `files`+`text`
   loses one of them on iOS/WhatsApp.
10. **Manifest `id`, `start_url` and `scope` = the base path** (`/recepten/` or `/recepten/next/`), never `/`.
11. **Exactly ONE `share_target`, POST multipart**, action `<base>share/`, handled in `sw.ts`;
    `public/share/index.html` is the no-service-worker fallback.
12. **Database name derived from `import.meta.env.BASE_URL`** (`recepten` on `/recepten/`,
    `recepten-next` on `/recepten/next/`) so a half-finished migration on `/next/` never touches real data.
13. **Timers promise nothing that phase 0 did not prove on that device.** Background and locked-screen
    behaviour is recorded per platform in ADR-0001; the UI says so honestly.
14. **No backend, no accounts, no analytics.** Backup is one tap to Files/Drive/WhatsApp.
15. **No new dependency without an ADR line.**

Also: hash routes are `#/…`; share tokens are `#r=`, `#p=`, `#w=`, `#b=`, `#f=` (member card, block F) and are never a route.

## House rules for code

- TypeScript strict; Preact function components + hooks + signals; plain CSS with design tokens.
- Mobile first: 16 px minimum font-size on inputs (prevents iOS zoom), 44 px tap targets, safe-area
  insets via `env()`, everything works at 360 px width.
- All UI text goes through `src/i18n/` (NL + EN, every key in both). Code comments in English.
- Never reload for an update on your own; the user taps "Nieuwe versie — vernieuwen".
- Touch only the files your task owns; other agents may work in parallel on other files.

## Definition of done

`npm run check`, `npm test` and `npm run build` green. Half-finished work sits behind a flag and ships
only on `/next/`; `main` is always usable on both phones. Anything that needs a real phone to verify gets
a line in `docs/DEVICE-TEST.md` or ADR-0001, not a promise in the UI.

## Where decisions live

`PLAN.md §0` — the decisions table (28 Sep 2026), which overrides the rest of the plan. `PLAN.md §3` —
platform facts with VERIFIED / LIKELY / UNKNOWN status. `docs/adr/` — the numbered decision records.

## Yearly task: re-check WebKit/Chrome facts

Once a year (or at a major iOS/Chrome release) re-verify PLAN.md §3 and update ADR-0001/0006: iOS link
capture for Home Screen apps; Web Share Target on iOS (WebKit bug 194593); storage-bucket isolation of
Home Screen apps; `persist()` heuristics; `navigator.share` single-field behaviour; wake lock in
standalone; local notifications without push; `CompressionStream` support; Chrome Android share_target
and WebAPK link verification; `showSaveFilePicker` on Android; the `.json` allowlist for
`navigator.share({files})`. Record the date of the last check here: **2026-09-24**.
