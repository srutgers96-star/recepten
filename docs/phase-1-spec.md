# Phase 1 — "Recepten2 op beide telefoons" — build spec

Goal (PLAN.md §10, phase 1, adjusted by the decisions in PLAN.md §0): replace the old app. Both phones
install the same URL and get: the 196 classics, browsing/search, a real cooking mode with timers,
own recipes (add/edit/delete), favourites per person, notes, sharing one recipe over WhatsApp and
paste-import, profiles, backup/restore, the family story, and the device-check page under "Meer".
Structured ingredients, English translations of the classics, categories and the planner come in
later phases — phase 1 stores ingredient lines **raw** (`{ raw: { nl } }`) and steps as text.

Everything below is binding for the agents. Contracts marked **CONTRACT** are imported across
ownership boundaries; implement them exactly.

## 1. Domain model (`src/domain/model.ts`, framework-free) — CONTRACT

```ts
export type Lang = 'nl' | 'en';
export interface Text { nl?: string; en?: string }               // every human-readable field
export type OriginKind = 'builtin' | 'user' | 'received';
export interface Origin { kind: OriginKind; author?: string | null; receivedFrom?: string | null; receivedAt?: string | null; basedOn?: string | null }
export interface Line { raw: Text; kind?: 'line' | 'header' }       // phase 2 adds qty/unit/ing/prep…
export interface TimerSpec { min: number; max?: number; unit: 'sec' | 'min' | 'hour'; label?: string }  // as found in the text
export interface Step { text: Text; timers?: TimerSpec[] }
export interface Recipe {
  schema: 2; id: string; rev: number; createdAt: string; updatedAt: string;
  origin: Origin;
  name: Text; description?: Text | null; category?: string | null; tags: string[];
  servings: number;                       // classics: 4
  time?: { active?: number; total?: number } | null;
  lines: Line[]; steps: Step[];
  servingTip?: Text | null; goesWith: string[]; aliases: string[];
  text?: { en?: 'llm' | 'human' | 'none'; reviewedBy?: string } | null;
  [k: string]: unknown;                   // unknown keys are preserved on round-trip (PLAN §5)
}
export interface Profile { id: string; name: string; lang: Lang; color: string; createdAt: string }
export interface Favorite { recipeId: string; profileId: string; at: string }
export interface Note { recipeId: string; profileId: string; text: string; updatedAt: string }
export interface CookLogEntry { id?: number; recipeId: string; profileId: string; at: string; stars?: number | null; note?: string | null }
export interface RunningTimer { id: string; recipeId?: string | null; stepIndex?: number | null; label: string; endAt: number; durationMs: number; createdAt: number }
export function pickText(t: Text | null | undefined, lang: Lang): string           // active lang, else the other, else ''
export function hasLang(t: Text | null | undefined, lang: Lang): boolean
export function builtinId(nameNl: string): string   // 'b:' + slug (use recipe-source.slugId)
export function newUserId(): string                 // 'u:' + 8 chars [a-z0-9] from crypto.getRandomValues
export function nowIso(): string
```

`src/domain/steps.ts` — CONTRACT: `splitSteps(instructions: string): string[]` — split on blank lines
first; a paragraph longer than ~350 characters is further split at sentence boundaries (protect
abbreviations `ca.`, `evt.`, `bijv.`, `min.`, `ml.`, `el.`, `tl.`, `°C.` and decimals), grouping
sentences so a step starts at a cooking verb where possible (Kook, Bak, Verhit, Voeg, Meng, Roer,
Laat, Serveer, Snijd, Schep, Giet, Breng, Doe, Zet, Verwarm, Fruit, Smoor, Stoof, Pureer, Klop,
Bestrooi, Leg, Verdeel, Dek, Haal) and never produces a step shorter than ~40 characters (short
tails join the previous step). `joinSteps(steps: string[]): string` (blank-line separated).
`src/domain/timers.ts` — CONTRACT: `findTimers(text: string): TimerSpec[]` for Dutch and English:
"25-30 minuten", "ca. 5 min", "een kwartier"(15), "een half uur"(30), "drie kwartier"(45),
"1 uur", "1½ uur", "30 seconden", "10 minutes", "an hour"; ignore "minuten" used as a noun without a
number. `formatTimer(t: TimerSpec, lang: Lang): string` ("25-30 min"). `timerMs(t): number` (use max).
`src/domain/recipe-io.ts` — CONTRACT: `normalizeRecipe(input: unknown): Recipe | null` accepts a
schema-2 recipe (unknown keys kept), the phase-0 shared shape `{name:{nl,en?}, servings?, ingredients:string[], instructions:{nl,en?}}`,
the phase-0 Dexie record `{name, nameEn?, ingredients, instructions, instructionsEn?, servings?, origin, by?, createdAt}`
and a plain `{name:string, ingredients:string[], instructions:string}` — always returning a full
schema-2 Recipe (missing id → newUserId(); origin.kind 'user' unless given); `recipeFingerprint(r): string`
(hash of name.nl|en + sorted raw lines, for "already present"); `recipeToShareEnvelope(r, by?) : Envelope`
(`{v:2,t:'r',by,at,r}`), `recipeFromEnvelope(env): Recipe | null`.

## 2. Data (`data/recipes.json`) and tools

`tools/migrate-from-recepten2.ts` (Node 22 strip-types, no deps) reads `data/source/recipes-recepten2.json`
and writes `data/recipes.json` = `{ schema: 2, dataVersion: 1, generatedAt, recipes: Recipe[] }` sorted by
name; id `builtinId(name)`; origin builtin; servings 4; lines = raw strings (`Dressing:` → kind header,
empty strings dropped); steps = `splitSteps(instructions)` with `timers = findTimers(step)`; the stray
`""` key of "Rendang met zelfgemaakt boemboe" is appended to the instructions (recipe-source already
does this); names like "Naanbrood (voor bij dahl)" get `goesWith` = [id of the main dish] when the
main dish can be found by name, else []. Deterministic output (no timestamps except `generatedAt`).
`tools/validate-data.ts` validates `data/recipes.json` against the rules above (unique ids, name.nl,
lines non-empty raw, steps ≥ 1, servings > 0, goesWith ids exist) — exit 1 on error; keep the
existing source validation too. Tests: `tests/steps.test.ts`, `tests/timers.test.ts`,
`tests/recipe-io.test.ts` (round-trips of all shapes, fingerprint stability, unknown keys kept),
`tests/migrate.test.ts` (run the migration function in-process on the source file: 196 recipes,
unique ids, every recipe ≥ 1 step, Rendang keeps "Rendang: Vlees van vet").

## 3. Database (`src/db/db.ts`, Dexie 4) — CONTRACT

Name from `import.meta.env.BASE_URL` (`recepten` / `recepten-next`), unchanged. Version 2 tables:
```
builtins:    'id'                              // refreshed from data/recipes.json when dataVersion changes; never edited
userRecipes: 'id, updatedAt, origin.kind'      // user + received
favorites:   '[recipeId+profileId], profileId'
notes:       '[recipeId+profileId], profileId'
cookLog:     '++id, recipeId, profileId, at'
profiles:    'id'
settings:    'key'
imports:     '++id, at'                        // snapshot for undo (phase 3 uses it; store it now)
timers:      'id, endAt'                       // RunningTimer, survives reloads
```
Version 1 → 2 upgrade: old `userRecipes` rows (auto-increment ids, phase-0 shape) are converted with
`normalizeRecipe` into schema-2 records with `u:` ids; old `settings.profileName` seeds the first profile.
`src/db/repo.ts` — CONTRACT (all async, all typed; the ONLY module the UI talks to for data):
```ts
ensureBuiltins(): Promise<void>                       // bulkPut when settings.dataVersion !== bundled dataVersion
allRecipes(): Promise<Recipe[]>; getRecipe(id): Promise<Recipe|undefined>
saveUserRecipe(r: Recipe): Promise<void>              // bumps rev + updatedAt
deleteUserRecipe(id): Promise<void>
duplicateAsOwn(r: Recipe, profile: Profile): Promise<Recipe>   // builtin → own copy (basedOn set)
listFavorites(profileId): Promise<Set<string>>; toggleFavorite(recipeId, profileId): Promise<boolean>
getNote(recipeId, profileId): Promise<string>; setNote(recipeId, profileId, text): Promise<void>
logCooked(entry: Omit<CookLogEntry,'id'>): Promise<void>; recentCooked(profileId?, limit=10): Promise<CookLogEntry[]>
cookStats(recipeId): Promise<{count:number; last?:string}>
listProfiles(): Promise<Profile[]>; saveProfile(p): Promise<void>; deleteProfile(id): Promise<void>
getSetting<T>(key, fallback: T): Promise<T>; setSetting(key, value): Promise<void>
importRecipes(recipes: Recipe[], from: {name: string}): Promise<{added: string[]; updated: string[]; skipped: string[]}>  // by id; same fingerprint → skipped; writes an `imports` snapshot
exportBundle(): Promise<BackupBundle>; importBundle(b: BackupBundle): Promise<{recipes:number; favorites:number; notes:number; cookLog:number; profiles:number}>
listTimers(): Promise<RunningTimer[]>; putTimer(t): Promise<void>; deleteTimer(id): Promise<void>
```
`BackupBundle` = `{ v: 2, t: 'b', at, app: 'recepten', profiles, userRecipes, favorites, notes, cookLog, settings }`.
`src/db/live.ts` keeps `useLive(querier, deps)` (Dexie liveQuery → Preact hook).

## 4. App shell — CONTRACT (owned by the shell agent, used by everyone)

- `src/profile.ts`: `activeProfile` signal (`Profile | null`), `profiles` signal, `loadProfiles()`,
  `setActiveProfile(id)`, `needsOnboarding` computed (no profiles yet). Changing the active profile
  sets `lang` (i18n) to the profile's language.
- `src/i18n/index.ts`: `lang` signal, `t(key, vars?)` with `{name}` interpolation, `setLang`.
  Dictionaries are split per owner and merged: `src/i18n/common.ts` (shell, nav, generic buttons),
  `src/i18n/browse.ts` (home, list, detail, cook), `src/i18n/edit.ts` (editor, share, inbox/import),
  `src/i18n/settings.ts` (more, profiles, storage, story, check). A missing key renders the key
  itself (never throws) so agents can work in parallel.
- Routes (`src/router.ts` unchanged API): `/` Home · `/recipes` A-Z · `/recipe/:id` · `/cook/:id` ·
  `/add` · `/edit/:id` · `/share/:id` · `/inbox` (import + received) · `/more` · `/more/profiles` ·
  `/more/storage` · `/story` · `/check` · `/onboarding`. Bottom nav: Home · Recepten · Toevoegen(+) ·
  Inbox (badge = received & unseen) · Meer. Detail/cook/edit/share push; tabs replace.
- `src/styles/base.css` (tokens, shell, nav, buttons, inputs, cards, list rows, sticky headers, safe
  area, dark mode — the phase-0 tokens), plus per-owner sheets `src/styles/browse.css`,
  `src/styles/edit.css`, `src/styles/settings.css`; `main.tsx` imports all four.
- `index.html`: viewport gets `interactive-widget=resizes-content` (keyboard shrinks the layout so
  bottom content stays reachable); everything else unchanged.
- Gamification hooks (decisions §0): `src/components/Confetti.tsx` (CSS-only burst, ~1.2 s, respects
  `prefers-reduced-motion`, disabled by setting `confetti=false`) and `celebrate(kind)` in
  `src/celebrate.ts`; phase 1 fires it on "Gekookt!" and on the first own recipe. Badges come later.

## 5. Screens

**Home `/`** ("Vanavond?"): greeting with the profile name and a NL|EN pill; card "Verras me" → a random
recipe (button rerolls; opens detail); "Favorieten" horizontal chips (per profile, empty state text);
"Laatst gekookt" (cookLog, last 5); "Eigen & ontvangen" (last 5 user/received); link card "Het verhaal";
teaser card "Weekplanner en boodschappenlijst komen in een volgende versie" (muted, not a button).
**Recepten `/recipes`**: the phase-0 list (sticky letters, A-Z rail, search) on `allRecipes()`; row =
name in the active language (fallback other) + small badges: ★ favourite, "eigen", "van <naam>";
"(voor bij …)" side dishes stay in the alphabet (goesWith UI later).
**Detail `/recipe/:id`**: name, servings ("4 pers." — scaling comes with structured lines), meta
(from whom / cooked N× / last), primary button **Koken** (→ cook), secondary **Deel** (→ share),
★ toggle, ingredients as tickable rows (tick state in memory only), steps numbered with timer chips
(tap → starts a timer in the global timer store and shows the bar), "Bij dit gerecht" list when
goesWith non-empty, notes textarea (per profile, autosave debounced, "nooit vertaald"), actions:
own recipe → Bewerk / Verwijder (confirm); builtin → "Maak eigen kopie" (duplicateAsOwn → edit).
Back button in the header (iOS).
**Koken `/cook/:id`**: step 0 = ingredient checklist ("Klaarzetten"), then one step per screen, big
type, progress dots + "stap 3 van 8", swipe left/right (pointer events, threshold 60 px) and big
prev/next tap zones, wake lock (release on leave), timer chips per step, running timers bar at the
top (all timers, mm:ss, −1/+1 min, ×), last screen "Gekookt!" → `logCooked` (+ optional stars 1-5
and note) + confetti + back to detail. Timer engine `src/timers.ts` (app-level, not per screen):
persisted via repo timers, ticking with a single interval while any timer runs, wall-clock `endAt`,
on finish: beep (WebAudio, unlocked on the first tap in the app — keep the phase-0 approach that
proved to sound in the background), vibrate, and if Notification permission is granted a service-
worker notification "Timer klaar — <label>" (tag `timer:<id>`); while running and permission granted,
a silent notification with the remaining minutes updated once per minute (`renotify:false`,
`silent:true`, same tag) — Stijn's "min-tijd zien" wish; a "Meldingen aanzetten" prompt the first
time a timer starts (once). sw.ts gets a `notificationclick` handler that focuses/opens the app.
**Toevoegen `/add` & Bewerken `/edit/:id`**: language choice **NL / EN / beide** at the top (the
girlfriend types English); name (per chosen language), servings stepper (default 4), ingredient
lines: one free-text input per line with "+ regel", ✕ per line, Enter moves to the next line (never
submits); steps: one textarea per step with "+ stap", ✕, and a "Plak hele bereiding" box that splits
with `splitSteps`; **Bewaar in the header** (sticky, always visible; disabled until name + ≥1 line +
≥1 step) and a duplicate Bewaar at the bottom; Verwijder (own only, confirm). Saves via repo, then
navigates to the detail. First own recipe → confetti.
**Delen `/share/:id`**: message preview (`buildShareMessage`, active language), "Deel via WhatsApp"
(share({text}) in the tap; wa.me fallback), "Kopieer", and **"Deel als tekst"** (readable recipe:
title, servings, lines, numbered steps, in NL/EN/both, link last) — `buildReadableRecipe(r, langs)` in
`src/domain/message.ts`. Sender name = active profile.
**Inbox `/inbox`**: top = the phase-0 import UI (textarea, Plak van klembord, bestand, share-target
inbox, `#r=` hash → preview) now decoding to a schema-2 recipe via `recipeFromEnvelope`/`normalizeRecipe`,
preview with Nieuw / Al aanwezig (fingerprint) / Bijgewerkt, "Bewaar" → `importRecipes` with origin
received; below = list of received recipes (newest first) with "van <naam>", unseen badge (setting
`inbox.seenIds`), tap → detail. Nav badge = unseen count.
**Meer `/more`**: active profile card (switch between profiles, "+ profiel"), language, theme
(systeem/licht/donker), confetti toggle, Opslag & back-up (→ `/more/storage`: standalone, persisted,
counts, last backup date, **Back-up maken** = share `recepten-YYYY-MM-DD.json` via share({files}) or
download fallback (.txt when .json refused), **Herstel** = file input → importBundle with counts),
Het verhaal (→ `/story`), Apparaatcheck (→ `/check`, the phase-0 page kept as is), Over (version, sha,
channel, link to GitHub).
**Onboarding `/onboarding`** (shown when no profile exists): "Wie ben jij?" name, language, colour
(6 swatches from the palette) → creates the profile, sets it active → Home. Profiles are a list;
"+ profiel" in Meer reuses the form.
**Het verhaal `/story`**: cover.webp hero, the About text in NL and EN (translate faithfully; keep
the tone), "Eerste editie december 2025 · Tweede editie (app) 2026", "Samen al N van de 196 gekookt"
(distinct builtin ids in cookLog).
**Landing (`src/landing.ts`)**: same behaviour as phase 0, reading a schema-2 `r` payload through
`normalizeRecipe` (lines raw, steps) — still never writes storage.

## 6. Non-negotiables

Invariants in CLAUDE.md. Plus for this phase: no new npm dependencies; 16 px inputs; 44 px targets
(also the small ones); no text selection on controls; works at 360 px; NL and EN complete for every
new string; `npm run check`, `npm test`, `npm run build`, `npm run build:next`, `npm run validate:data`
green. Comments in English; UI copy NL + EN.
