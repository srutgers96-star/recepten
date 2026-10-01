# Phase 5 — "Afwerking & wensen" — build spec (blocks A–F)

Phase 5 is built in blocks, each its own workflow, deployed after each block. Decisions in PLAN.md §0
bind (Gamification, Spraak, Timer-afloop, Groot ingrediëntenwoordenboek, Vrienden, Dieet-categorieën,
Categorie & dieet in de editor, Varianten, Kleine wensen, plus the 30-09 additions below). CLAUDE.md
invariants apply. No new npm dependencies unless an ADR line says so (see block D for the QR encoder).

Additions decided 2026-09-30 (Stijn):
- **Reset app** (block A): Meer → Opslag → "App resetten": dialog "Weet je het zeker? Je verliest je
  geschiedenis en eigen recepten." with **Ja** / **Nee** / **Ja, maar exporteer eerst mijn recepten**
  (runs the own-recipes export share first, then resets). Reset = clear every Dexie table incl.
  profiles/settings and every `recepten.*` localStorage key, keep the service worker, reload → onboarding.
- **One household** (block A + C): `household` setting `{ name, members: Member[] }`, `Member =
  { id, name, color, lang?, local: boolean /* a profile on this phone */, deviceId?: string }`. Local
  profiles are members automatically; other people join as a **member card** received via link/QR
  (`#f=` token: `{ v:2, t:'f', f: { id, name, color, lang } }`, block F) or typed by hand. Cook log,
  "laatst gekookt", plan "Gekookt" and badges are attributed to a member; "samen" counters cover the
  household. Received recipes map `by` to a member by name (case-insensitive) when possible.
- **"Controleer mijn recepten"** (block A): Meer → "Controleer mijn recepten": runs `suggestMeta` over
  all own/received recipes and lists per recipe the suggested category + diet/other tags next to the
  current ones; **Overnemen** per recipe or **Alles overnemen**; the same suggestion appears live in the
  editor (Categorie + Dieet rows) and the photo/text import prompt asks for `Categorie:` and `Labels:`
  lines (optional; ids or Dutch/English words, mapped through i18n labels).

## Block A — Data, diet, editor meta, reset, household basics

1. `data/ingredients.json`: every entry gets `vegan: boolean` and `gluten: boolean` (contains gluten:
   tarwe/wheat products, pasta, couscous, bulgur, bread, breadcrumbs, flour, soy sauce (not tamari),
   beer, seitan, most stock cubes are gluten-free in NL — mark `gluten: false` unless clearly wheat-based;
   uncertain → `glutenUnsure: true`). `veg` exists (vegetarian). Done by 2 data agents on alphabetical
   halves + a merge/consistency check; `validate:data` requires the two booleans.
2. `src/domain/diet.ts` (framework-free): `dietTags(lines: Line[], dict): { vegetarisch?: boolean; vegan?: boolean; glutenvrij?: boolean; unsure: string[] }`
   — a recipe is vegetarian when no resolved ingredient has `veg: false`; vegan when all resolved are
   `vegan: true`; gluten-free when none has `gluten: true`; unresolved lines (ing null) make the answer
   "unsure" for that dimension (listed) — the UI shows "waarschijnlijk" then. `suggestMeta(recipe, dict):
   { category?: string; tags: string[]; unsure: string[] }` — category from name/ingredient heuristics
   (pasta ids → pasta, rijst → rijst, soep in name → soep, salade → salade, taart/quiche → hartige-taart,
   stamppot/stamp → stamppot, wok/roerbak/noedels → wok-noedels, oven/gratin/schotel → oven, vis ids and no
   meat → vis, meat ids → vlees, else null) and tags: diet tags + `snel` when time.total ≤ 30 or steps ≤ 3
   short, `oven` when a step mentions oven/°C, `wok` when roerbak/wok. Tests with real recipes.
3. `tools/derive-tags.ts` + migrate step: for the 196, `vegetarisch`/`vegan`/`glutenvrij` are set from
   `dietTags` (fact-based; overrides the LLM's `vegetarisch`), `-optie` tags stay as they are; regenerate
   `data/recipes.json`; `docs/measure-diet.md` with counts. Filter chips get labels for the new tags
   (nl+en) and a "Dieet" chip row on Home/Recipes/Kies N that lists vegetarisch · vegan · glutenvrij (+
   -optie variants) prominently; recipe detail shows diet tags as chips with "waarschijnlijk" when unsure.
4. Editor: rows **Categorie** (segmented/select over categories.json) and **Dieet & labels** (chips over
   the tag vocab), pre-filled by `suggestMeta` on new recipes and re-suggested when lines change until
   the user touches the row (`metaManual: true` stored on the recipe); classics in override mode too.
5. Import prompt (photo-import.ts): format gains optional `Categorie:`/`Category:` and `Labels:`/`Tags:`
   lines per block; parser maps words to ids (nl/en labels, tolerant) and unknown words are dropped.
6. **Controleer mijn recepten** screen (`/more/check-recipes`): list of own/received recipes with
   current vs suggested category/tags, per-row Overnemen, Alles overnemen, skip; writes `category`/`tags`
   and `metaManual: true`.
7. Reset app (see above) in StorageScreen + repo `resetEverything()`.
8. Household basics: setting + members derived from profiles; `Member` type; cook log entries keep
   `profileId` (= member id); MoreScreen → "Huishouden" row shows members (local ones editable via
   Profiles; a "Voeg lid toe" form by hand: name, color) — link/QR joins come in block F.
9. Gram rounding (PLAN §0 "Kleine wensen"): `formatQty` shows whole numbers for g/ml/kg/l (62.25 g → 62 g;
   1.3 kg stays "1,3 kg"), fractions only for count units, spoons and pieces.

## Block A-bis — English input & line translation (decided 30-09, after block A)

1. **Free text is never half-translated.** Parenthetical text on a line: try `prep-phrases.json`
   (incl. `{n}` templates) for the whole parenthetical and for `,`/`;`-separated parts; a match → `prep`
   (both languages); no match → `note` in the SOURCE language only, rendered in that language and
   styled muted (`LineView`/chips show it in quotes or grey) — never a mix of translated qualifier +
   raw name; when the ingredient itself is unresolved the whole line renders raw (already the rule).
2. **Translation prompt only asks for what the app cannot do**: name, description, steps, serving tip,
   per-line free text (`note`, unmatched prep) and unresolved lines in full — numbered as today.
   `parseTranslationAnswer` writes only those parts into the target language (`note.{to}`,
   `prep.{to}`, `raw.{to}` for unresolved lines). Resolved lines keep `raw` in the source language;
   the target rendering comes from the dictionary. Never overwrite existing target text unless the
   user pastes explicitly for that field (a per-line "replace" is not needed in v1).
3. Editor mode "beide": for resolved lines the other column shows the dictionary rendering as a grey
   placeholder (read-only look, editable on tap); saving stores nothing for that language unless the
   user typed something different from the placeholder.
4. **US English**: units `lb`/`pound(s)` (453.6 g), `oz`/`ounce(s)` (28.35 g), `cup` US (240 ml —
   keep `kop` for NL "kop"; EN `cup` maps to `kop` today: make `cup` its own unit `cup` = 240 ml, en
   one/many cup/cups, nl render "ml" ×240, and keep `kop` NL-only), `fl oz`, `stick` (butter, 113 g),
   `pint` (473 ml US / 568 ml UK → use 500 ml), `quart`; NL rendering converts to g/ml; EN keeps them.
   Aliases: ground beef/ground meat → gehakt, heavy cream → slagroom, powdered/confectioners' sugar →
   poedersuiker, all-purpose flour → bloem, cornstarch → maizena, scallions (exists), cilantro (exists),
   eggplant (exists), zucchini (exists), shrimp (exists), garbanzo beans → kikkererwten, bell pepper
   (exists), green/red onion, arugula (exists), bacon strips, etc. Note phrases table (nl↔en):
   approximately/about/roughly ↔ ongeveer, to taste ↔ naar smaak, optional ↔ optioneel, divided ↔
   verdeeld, or more ↔ of meer, for serving ↔ om te serveren, at room temperature ↔ op kamertemperatuur,
   melted ↔ gesmolten, softened ↔ zacht, plus quantity+unit conversion inside notes ("approximately 1
   pound" → "ongeveer 450 g"). A pack size in US units ("(15 oz)", "(28-ounce)") stays a converted
   note (`note` en "15 oz" / nl "430 g"), not a `packSize` (decided 01-10: EN keeps the US text, and
   the shopping list does not round US tins to packs).
5. Tests: Gabi's line `1 medium eggplant (approximately 1 pound)` (EN column) → aubergine, middelgrote,
   note en "approximately 1 pound", NL render `1 middelgrote aubergine (ongeveer 450 g)`; Stijn's line
   `1 grote groene appel (gesneden in blokjes van ongeveer 2 cm breed)` → appel, grote+groene, prep via
   template or note NL only, EN render `1 large green apple (…)` with the note muted; `1 lb ground beef`
   → rundergehakt 454 g (`ground meat` → gehakt); translation prompt for a recipe with 3 resolved + 1 unresolved line lists only the
   unresolved line and the notes.

6. **Dictionary hygiene (Stijn/Gabi 30-09)**: IngredientPicker "Nieuw ingrediënt" first checks whether
   the typed name (either language, aliases included, case/diacritic-insensitive) already resolves →
   "Bestaat al: aubergine (eggplant) — die gebruiken?" with one tap to link instead of creating; own
   entries get **Fuseer met bestaand** in the dictionary screen (Meer → Woordenboek → own entry → pick
   the existing entry → every own recipe line, line override, list item and pantry row referencing the
   old id is rewritten to the new id in one transaction; the own entry is deleted; undo via the last
   snapshot); own entries can be edited (nl/en names, aisle). A "Opruimen" helper lists own entries
   whose names match an existing entry and offers to merge them all.
7. **Translation answer tolerance**: the recipe name is taken from "1." OR "Name:/Naam:/Title:/Titel:"
   OR the first non-empty line before the first "I1"/"S1" marker; a missing name never blocks the rest.
8. **Select mode in the recipe list**: long-press (or a "Selecteer" header button) → checkboxes →
   actions: Deel (one message with several tokens or a bundle file), + Deze week, Categorie/labels
   wijzigen, Verwijder (own only), Exporteer; also usable on the Home "Eigen & ontvangen" list.
9. **File import everywhere**: "Kies bestand" (recipe/bundle/backup files) also in the Add screen's
   import section and in the "+" menu of Recipes; after every export on Android show "Opgeslagen als
   <naam> in Downloads" and put "Deel het bestand" (WhatsApp to yourself / Drive) first.

## Block B — Cook mode+: read-aloud, voice, timer sound

1. `src/speech.ts`: `speak(text, lang)` via `speechSynthesis` (voice by lang, rate 0.95, cancel on
   navigation), `canSpeak()`; cook mode gets a 🔊 "Lees voor" button per step (reads the step; long-press
   reads the ingredient list), setting `speech.readAloud` (off by default) that auto-reads on step change.
2. Voice commands (setting `speech.commands`, off by default, Android first): `webkitSpeechRecognition`
   continuous, lang from profile, grammar: volgende/next, vorige/previous/back, timer N minuten/minutes,
   lees voor/read, stop; visible mic state; honest capability text (iPhone: experimental; needs internet).
3. Timer end: settings `timer.sound` ('beeps' | 'bell' | 'melody' | 'off') with a test button, `timer.vibrate`
   (on), a 🔔 toggle in the timer bar (mirrors `timer.sound` off/on); WebAudio renders the three sounds
   (no audio files); iPhone hint about the silent switch when `isIOS` (i18n).
4. DEVICE-TEST rows for both phones.

## Block C — Gamification: badges & confetti (PLAN §0)

1. `data/badges.json`: `{ id, nl: { name, description }, en: {...}, icon: emoji, rule: { kind, ... }, tier?: 1|2|3 }`
   with rule kinds: `cookCount` (n), `distinctRecipes` (n), `letters` (all initials A–Z), `category` (id, n),
   `tag` (id, n), `ingredient` (id, n — rare ingredients), `ownRecipes` (n), `reviews` (n stars given),
   `oneStar` (n), `photos` (n), `shared` (n), `received` (n), `streakWeeks` (n weeks with ≥1 cook),
   `allClassics`, `halfClassics`. ~40 badges with playful names (Fishlover, Van A tot Z, Halverwege het
   boek, Kritische tong, Pastafarian, Wokmeester, Oventovenaar, Saffraankenner…). Evaluated by
   `src/domain/badges.ts` (pure) over the cook log / recipes / photos of a member and of the household.
2. Screen `/more/badges` (also a Home card "Badges 7/40" when enabled): grid per member tab + "Samen";
   earned vs locked with progress; tap → detail. New badge → toast + confetti (milestone kind).
3. Settings toggles: confetti (exists), badges (`badges.enabled`), both off = no gamification at all.
4. Dopamine moments beyond badges: rating a recipe (stars) → small confetti; first photo; 10th/25th/50th
   cook milestones bigger confetti; cook log stars per member.

## Block D — Photos, print/copy, story, curator, QR

1. Own photo per recipe (`photos` table: recipeId, memberId, blob ≤ 1024 px WebP/JPEG re-encoded on the
   phone via canvas, at); detail shows the latest photo hero + gallery; cook mode "Gekookt!" offers "Foto
   toevoegen". Never in tokens; in backups optional (size!) — export without photos by default with a toggle.
2. Print/PDF/copy: `window.print()` with print stylesheets for recipe (one page), ingredients per recipe
   (compact list), shopping list (A4, aisle columns, checkboxes); "Kopieer als tekst" for the same three;
   iPhone: print via the share sheet's Print / "Kopieer als tekst" always works.
3. Story page complete: cover hero, both languages, "Samen al N van de 196", household members.
4. Curator screen for Gabi (`/more/curator`): list of the 196 with status machine/reviewed/missing,
   EN next to NL editing (override with `text: { en: 'human', reviewedBy }`), "Reviewed by" credit, and
   "Stuur correcties" = bundle of overrides via share (patches).
5. QR: ADR line allowing `qrcode` (encode) — or a small self-written QR encoder in `src/domain/qr.ts`
   (byte mode, ECC L, versions 1–25) if no dependency is wanted; "Toon QR" on the share screen behind
   the Experimenten flag; scanning via the phone's camera app (opens the landing page) — no in-app scanner.

## Block E — Big dictionary + Woordenboek screen

1. Data agents add ~1500 common supermarket products (NL/EN, aisle, defaultUnit, veg/vegan/gluten,
   perishable, staple) in alphabetical slices, merged with dedupe against the existing 376+; validate.
2. Screen `/more/dictionary`: search, filter by aisle, entry view (names, aisle, flags), edit own entries,
   add new (reuses IngredientPicker's form), counts; shopping extras and editor chips use it.

## Block F — Friends/members via link or QR, recipe variants

1. `#f=` member card token (see above): Profiles → "Deel mijn kaartje" (navigator.share text with the
   link; QR when block D shipped) and "Voeg lid toe via link/plak"; Inbox recognises `#f=` and offers
   "Voeg toe aan huishouden"; "Stuur nieuwe naar …" lists members; received `by` maps to members.
2. Variants: on a recipe "Maak … versie" (glutenvrij / vegetarisch / vegan): creates a copy with
   `variantOf: <id>` + the diet tag, pre-applies swaps from `data/swaps.json` (pasta → glutenvrije pasta,
   gehakt → vega-gehakt, sojasaus → tamari, room → plantaardige room, …) with a review list before saving;
   the original shows "Ook als: …" chips linking to variants; variants travel in tokens like any recipe.

## Non-negotiables

CLAUDE.md; NL + EN for every string; 44 px targets; navigator.share single field; `npm run check`,
`npm test`, `npm run build`, `npm run build:next`, `npm run validate:data`, `npm run migrate` deterministic.
