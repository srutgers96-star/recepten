# Bouwspecs fase 6 — leeswijzer, bouwvolgorde en werkwijze voor Opus

Status: compleet (kritische lezer Fable, 22 okt 2026)

Dit is het startpunt voor elke Opus-sessie die een blok bouwt. Lees eerst CLAUDE.md en docs/STATUS.md,
dan dit bestand, dan de spec van het blok dat aan de beurt is. De specs zijn door Fable geschreven
(22 okt 2026), door Opus op feiten gecontroleerd (regels "Feitencheck Opus" bovenaan elke spec) en
daarna één keer kritisch gelezen door Fable, over alle specs heen. Wat die lezing besliste, staat per
spec in het blok "Kritische lezer (Fable, 22 okt 2026)" direct onder de statusregel en is in de tekst
verwerkt; §2 hieronder verzamelt alles wat over specs heen geldt. **Bij een tegenspraak tussen een spec
en dit bestand wint dit bestand; bij een tegenspraak tussen een "Kritische lezer"-blok en de tekst
eronder wint het blok.**

## 1. Bouwvolgorde (vast; Stijn mag omgooien)

Elk blok gaat apart online: eerst `/next/` (eigen database), dan `main` na een telefoonronde, tenzij de
spec zegt dat het direct naar `main` mag. Eén regel per spec, met de status.

**Bijgewerkt 23 okt 2026 (besluiten Stijn tijdens het bouwen):**
- **Geen telefoonronde meer vóór `main`:** een blok gaat na de groene gate meteen `next` → `main`
  (fast-forward). De DEVICE-TEST-rijen blijven voor later. Uitzondering blijft: 13F (id-migratie) en
  6D-4/13D (deelformaat) krijgen vóór `main` een korte Fable-blik.
- **Volgorde omgegooid:** na de bijgerechten komt eerst **6D (XP)**: 6D-1 → 6D-2a/2b → 6D-3 → 6D-4a → 6D-4b.
  Daarna 13F → 13D → 6C → 13J → Z. 6D-1 hangt niet van 13F af (XP wordt afgeleid uit wat in de kooklog
  staat; 13F's alias-migratie zet de kooklog-ids om, de afleiding rekent daarna gewoon opnieuw).
- **Gebouwd tot nu toe:** Home A+ (1–2), 13K (1–2), 6B+13E (1–5), bijgerechten (24 okt). Volgende: 6D-1 in lichte modus.
- **Ambitie 6D omhoog (Stijn 24 okt):** avatar met zeven lagen × 40–70 onderdelen, gebouwd in rondes (6D-3 =
  raamwerk + ronde 1; daarna data-rondes door Fable); ontgrendelingen rijk (confetti, geluiden, lettertypes, gouden
  modus); challenges vrij op level 20 als eigen blok ná 6D-4. Zie de besluitblokken bovenaan badges-avatar.md en
  xp-levels.md. Lichte bouwmodus (§3b) geldt wel: één Opus-lens, Stijn reviewt zelf bij het testen.

| # | Blok | Spec | Blokken | Status |
|---|---|---|---|---|
| 1 | Home A+ (13A deel 2) | home-a-plus.md | 2 | compleet |
| 2 | 13K kookbalk | kookbalk.md | 2 | compleet |
| 3 | 6B + 13E labels, lactose, keukens, categorieën, + bijgerecht | labels-categorieen.md | 5 | compleet |
| 4 | 13E de 20 bijgerechten | bijgerechten.md | 1 (3 stappen) | compleet |
| 5 | 13F inbouwen met id-migratie | inbouwen.md | 4 | compleet (3 vragen aan Stijn, §6) |
| 6 | 13D varianten als tabs, tip van de maker | varianten-tabs.md | 4 (blok 5 vervallen) | compleet |
| 7 | 6C vaste lijst | vaste-lijst.md | 3 | compleet (open punten A–D beslist) |
| 8 | 6D-1 XP, levels, pops, level-up | xp-levels.md "Blok 6D-1" | 1 | compleet |
| 9 | 6D-2a/2b badge-catalogus, regels, badgepagina | badges-avatar.md §3a/§3b | 2 | compleet (§6 vraag 1) |
| 10 | 6D-3 avatar | badges-avatar.md §3c | 1 | compleet |
| 11 | 6D-4a ontgrendelingen (in xp-levels.md "Blok 6D-3") | xp-levels.md | 1 | compleet |
| 12 | 6D-4b sync + kookkalender (in xp-levels.md "Blok 6D-4") | xp-levels.md | 1 | compleet (Fable-blik vóór main) |
| 13 | 13J iPhone-sheets afmaken | geen spec nodig (§1a) | 1 | ontbreekt bewust |
| 14 | Z handleiding | nog zonder spec (STATUS.md "Blok Z") | — | ontbreekt (Fable schrijft hem na 13J) |
| 15 | Fable-eindcontrole | §5 hieronder | — | — |

Nummering 6D: de twee 6D-specs tellen hun blokken anders. Canoniek is de tabel: 6D-1 (xp-levels
"Blok 6D-1") → 6D-2a/2b (badges-avatar §3a/§3b) → 6D-3 (badges-avatar §3c) → 6D-4a (xp-levels
"Blok 6D-3", ontgrendelingen) → 6D-4b (xp-levels "Blok 6D-4", sync + kalender).

DEVICE-TEST-rijen zijn over alle specs heen definitief genummerd: Home A+ 70–71 · 13K 72–74 (+ rij 66
aangepast) · 6B 75–80 · bijgerechten 81 · 13F 82–85 · 13D 86–88 (13D blok 2 past rij 85 aan) · 6C 89–91
(+ rij 28 aangepast) · 6D-1 92–93 · 6D-2 94–95 · 6D-3 96–97 · 6D-4a 98 · 6D-4b 99–100.

### 1a. 13J zonder spec
Het patroon staat al in de code (src/components/SheetPortal.tsx, `.sheet-head.with-actions`,
`.sheet-head-btn` in base.css; CookedSheet en VariantSheet doen het al). 13J = datzelfde patroon
toepassen op WordPicker, PickSheet, IngredientPicker, het feedbackvenster en de keuzepanelen, zodra
Gabi DEVICE-TEST rij 65 bevestigt. Regels: een sheet die iets opslaat heeft Annuleer links en de
bewaarknop rechts in de kop; een kiezer zonder Bewaar heeft Sluit rechts; wegvegen, ernaast tikken en
Escape bewaren niets. Geen nieuwe teksten, geen datamodel. Eén Opus-workflow met twee bouwers +
integrator; DEVICE-TEST-rij 101.

## 2. Besluiten van de kritische lezer (gelden over alle specs)

### 2a. Versies en tellingen
- **Dexie:** v7 nu → **v8 = 13F** (upgrade zonder schemawijziging, `runAliasMigration`). 13D, 6C en 6D
  voegen géén versie toe (alles settings of velden zonder index); de eerstvolgende vrije versie is v9.
- **`DATA_VERSION`** (tools/migrate-from-recepten2.ts): 4 nu → 6B blok 2 **5** → blok 3 **6** → blok 4
  **7** → bijgerechten **8** → keukens-toewijzing 24 okt **9** → 13F **10**. Elke bump neemt `tests/migrate.test.ts` (`toBe(n)`) mee.
- **Klassiekers:** 196 → 216 (bijgerechten) → **236** (13F). `classicsTotal` volgt de bundel; badges
  "Het hele boek"/"Halverwege het boek" worden 236/118. Tests die over "de 196" gaan filteren op
  `createdAt === BUILTIN_TIMESTAMP` (import uit tools/migrate-from-recepten2.ts).
- **`migrate()`-volgorde (vast):** bron → batches → `applyReview` → sides (`data/source/bijgerechten.json`,
  `tools/sides.ts`) → extras (13F, `tools/import-stijnchat.ts`) → `applyMeta` (`data/review/meta.json`,
  kent ook side- en 13F-ids) → `applyDerivedTags` → sorteren. Er is géén `recipes-extra.json` en géén
  batch-21: het pad voor de 20 bijgerechten is dat van bijgerechten.md.
- **Woordenboek:** 1603 entries + 8 van 13F; `lactose` is vanaf 6B blok 1 verplicht op élke entry (ook
  de 8 van 13F). Badges: 43 → 44 (`zuivelvrije-ziel`, 6B) → catalogus 144 (6D-2, ids blijven).

### 2b. Velden, keys en namen (register; niets hiervan twee keer definiëren)
Nieuwe velden: `Recipe.cuisine?: string | null` (6B) · `Recipe.credit?: Text | null` (13F) ·
`Recipe.variants?: RecipeVariants | null` en `Recipe.tip?: Text | null` (13D) · `PlanItem.sideOf?: string`
(6B) · `PlanItem.variant?: VariantDiet | null` (13D) · `CookLogEntry.variant?` (13D) ·
`CookLogEntry.loggedAt?: string` (6D-1) · `Profile.avatar?: AvatarSpec | null` (6D-3) ·
`Ingredient.lactose?/lactoseUnsure?` (6B) · `ListItem.standing?: boolean` (6C) ·
`ListSource.diet?: VariantDiet` (13D; niet `variant`) · `CookingSession.variant?` (13D blok 3 op 13K).
Vaste constanten: `DIET_TAGS = ['vegetarisch','vegan','glutenvrij','lactosevrij']`;
`VARIANT_DIETS = ['glutenvrij','vegetarisch','vegan','lactosevrij']` (tabvolgorde; ook in 6B blok 2);
`NON_MAIN_CATEGORIES` = nagerecht · gebak · bijgerecht · ontbijt-lunch (6B blok 4, ReadonlySet in
planner.ts, met `isMainDish`/`excludeNonMain`/`applyPickFilter(…, { mainOnly })` en chip `pick.all`);
categorie-orders nagerecht 11, gebak 12, bijgerecht 13, ontbijt-lunch 14, overig 15; 18 keukens incl.
`hongaars` (6B §2c).
Settings-keys: `cook.sessions` (13K, toestel-lokaal) · `aliases.notice` (13F, toestel-lokaal) ·
`standing.list` (6C) · `xp.seenRulesVersion`, `xp.lastSeen`, `unlocks.disabled` (toestel-lokaal),
`unlocks.announced`, `cook.font`, `cooked.sound`, `progress.snapshots`, extra ids in `timer.sound` (6D) ·
`features.log`, `donate.hearts`, `avatar.seen` (toestel-lokaal), `badges.earned` krijgt ook `id@k` (6D-2).
localStorage: `recepten.tonightFiltersOpen`, `recepten.recent.last` (Home A+) · `recepten.vtab` (13D) ·
`recepten.badges.groups` (6D-2). Tokensleutels: `#x=` (6D-4b, in token.ts, router.ts, boot.ts,
landing.ts én pwa.ts `urlForChrome`); `#d=` gereserveerd voor de latere dank-je-link (geen landing).
i18n-prefixen per spec: `home.*` (Home A+, browse.ts; + `home.weekEmptyStanding` door 6C) · `cooking.*`
(13K) · `filter./tag./meta.tag.` lactosevrij, `filter.cuisine`, `recipe.cuisine`, `meta.cuisine*`,
`meta.title`, `pick.all`, `week.*Side*`/`week.sides`/`week.side`/`week.mainOnlyHint`, `dict.missing*`,
`dict.flag.lactose*`, `dict.form.lactose*` (6B) · géén keys (bijgerechten) · `aliases.notice.*`,
`story.added.*` (13F) · `vt.*`, `tip.*`, `version.*`, `edit.tip.*`, `share.noteAsTip*`, `inbox.with*`,
`week.variant*`, `recipe.edit`, `recipe.notesTipHint` in src/i18n/variants.ts (13D) · `shop.tab.*`,
`shop.standing.*`, `shop.menu.toStanding*`, `shop.menu.fromStanding`, `storage.standing` (6C) · `xp.*`,
`levelup.*`, `unlocks.*`, `progress.*`, `calendar.*` in src/i18n/xp.ts + `more.unlocks*`,
`more.calendar*`, `more.cookFont*`, `more.cookedSound*`, `more.timerSound.*`, `inbox.ev.progress`,
`paste.progress` (6D) · `badges.group.*`, `badges.tier*`, `badges.toast*`, `avatar.*` (6D-2/3).
Geen enkele nieuwe key bestaat nu al (gecontroleerd 22 okt); geen prefix wordt door twee specs gebruikt.

### 2c. Afstemming tussen specs
- **Home A+ ↔ 13K:** `<TimerBar />`-slot en componentnaam blijven; alleen de inhoud wordt de kookbalk.
- **Home A+ ↔ 6B:** na Home A+ staan de Home-dobbelsteen en de weekkaart in `TonightCard.tsx` en
  `WeekCard.tsx`; 6B blok 3/4 raakt die bestanden, niet HomeScreen.tsx.
- **Home A+ ↔ 6C:** 6C blok 2 zet `home.weekEmptyStanding` ("Alleen de vaste lijst ›") in de lege
  weekkaart van WeekCard.tsx.
- **Home A+ ↔ 6D:** `HomeLevelRow.tsx` is het slot; 6D-1 vult het met `LevelLine` (tik →
  `/more/profiles`); daarna geen badge-telling meer op Home. 6D-3 geeft `level` mee aan `<Avatar>` in
  de begroeting (één regel in HomeScreen.tsx).
- **6B ↔ bijgerechten:** bijgerechten bouwt géén eigen poolfilter en raakt categories.json niet; vier
  bijgerechten krijgen een keuken via meta.json; `checkSides` krijgt als `classics` het gecommitte
  bestand zonder de side-ids; tests/diet.test.ts filtert op `BUILTIN_TIMESTAMP`.
- **6B ↔ 13D:** `VARIANT_DIETS` in tabvolgorde; 6B's lactosevrij-knop/sheet is tijdelijk (13D blok 2
  vervangt alle blok-F-knoppen door tabs); 13D blok 5 vervalt (6B blok 2 doet swaps/SWAP_DIETS);
  margarine → vegan-boter krijgt geen `lactosevrij`.
- **6B ↔ 6D-2:** `zuivelvrije-ziel` (🥥) blijft het id; 6D-2 maakt er de ladder "tag lactosevrij" van;
  `zonder-zuivel` vervalt.
- **13F ↔ 13D:** 13F zet `variantOf`/`origin.basedOn` om en houdt de glutenvrije uiensoep als eigen recept
  ('personal'); 13D vouwt hem later in een tab. 13F's rij 85 geldt tot 13D blok 2.
- **13F ↔ 6D:** XP leidt af uit de kooklog zoals die na de migratie staat (geen actie); een toekomstige
  aliasronde verandert de seeds van omgezette kookbeurten (kleine herberekening, geen versiebump).
- **13F ↔ bijgerechten:** `ensureBuiltins` ruimt bij een versiewissel identieke ontvangen kopieën van een
  `b:`-id op (`contentFingerprint` gelijk); een afwijkende kopie blijft (bekende beperking).
- **13F intern:** `fieldFingerprints` + `contentFingerprint` in nieuw `src/domain/fingerprints.ts` (geen
  data.ts-import; merge.ts re-exporteert); `mapShareIds(share, aliases, lookup)`; `takePlan` mapt ids met
  `mapId`; `applyAliases` herrekent `generatedFrom`/`generatedFromAll`; dekkingsgrens 0,78 over de 20.
- **13K ↔ 13D:** `CookingSession.variant?` en `&v=` in `cookPath` komen in 13D blok 3 (bouwer A bezit
  dan ook src/domain/cooking.ts, src/cooking.ts, tests/cooking.test.ts). 13K zelf: CookScreen geeft
  `onTimerStart` mee (bump `lastActiveAt`); current-timers in de kookstand heten "stap N".
- **13K ↔ 6C:** beide raken ShoppingScreen.tsx; 13K eerst (balk onder de Header), 6C voegt de tabbladen
  eronder in.
- **6D-1 ↔ 6D-2 (badge-model):** `Badge.tiers`/`BadgeStatus.tier`/`maxTier`/`hidden`/`xp` (badges-avatar
  wint). Badge-XP: ladder per bereikt niveau k één event base 50·k; eenmalig één event
  `badge.xp ?? (hidden ? 250 : 50)`; 6D-1 alleen → elke verdiende badge base 50; **6D-2a bumpt
  `XP_RULES_VERSION` naar 2** (eerlijke melding). `longestDayStreak(cookDays)` in src/domain/xp.ts (geen
  streak.ts). Badge "Overcooked!" = regelsoort `overcooked` over `BadgeFacts.xp?: XpState` ('overcooked'
  uit FEATURE_IDS; 32 ids). Avatar-maker op level 3 in beide specs. `#x=`: badges als `id`/`id@k`,
  `avatar?: AvatarSpec`.
- **6D-2 ↔ 6D-3 ↔ Home:** `memberFromProfile` en DeltaShareScreen geven `avatar` mee; Badges-tabs houden
  hun kleurstip. Facial-onderdelen heten `facial-*`. "Huiskok" blijft "Huiskok".
- **6D-1 anti-valsspeel (gat gedicht):** het dagplafond geldt óók per invoerdag (`loggedAt`):
  factor = `min(plafond op kookdag, plafond op invoerdag)`. `ownRecipes` sluit ook `origin.basedOn` uit.
  `settleXp` op zeven momenten (ook foto's via CookScreen en RecipeScreen). `unlocks.disabled` is
  toestel-lokaal. Twee profielen op één telefoon: XP is per profiel, een kookbeurt als "de ander" geeft
  de ander XP — aanvaard. Back-up terugzetten: afgeleid, dus zelfde stand (zonder foto's in de back-up
  minder foto-XP: eerlijk, staat in de spec). Klok verzetten blijft mogelijk; geen verdediging gebouwd.
- **6C open punten:** A `STANDING_STEP` (l 1 · kg 0,5 · g 50 · ml 100 · anders 1); B woordenboekkeuze
  zonder getal → 1, vrije tekst → zonder aantal; C vreemde eenheid blijft staan; D Home-link (zie boven).
- **Zoeken (6B):** een keukentreffer gaat vóór de ingrediëntgroep (alleen de keuken); "pasta" ongewijzigd.
- **6D-4b en CLAUDE.md:** de integrator voegt `#x=` toe aan invariant 7 en aan de regel "share tokens
  are …" in CLAUDE.md, en één regel aan docs/adr/0004-share-token.md; de fonts (6D-4a) krijgen een
  ADR-regel (licentie OFL, herkomst).

## 3. Standaardwerkwijze voor Opus

### 3a. Regels (gelden voor elk blok)
1. **Eerst `git status`** (werkmap schoon? een eerdere run afgebroken?), dan `npm test`. Hervatten na
   een limiet: `Workflow({ scriptPath, resumeFromRunId })` met hetzelfde script en dezelfde `args`.
2. **Kleine blokken**: één spec-blok per workflow (±3 bouwers + integrator). Te zwaar? Splits zoals de
   spec aangeeft (bv. kookbalk blok 1b), nooit twee blokken in één run.
3. **Strikte bestandsverdeling**: elke bouwer raakt alleen de bestanden die de spec hem geeft; wat hij
   van een ander nodig heeft staat als signatuur in de spec. Een bouwer die iets anders nodig heeft
   stopt en meldt dat in zijn rapport (de integrator beslist, binnen de spec).
4. **Ontwerpen mag niet**: alles wat een keuze is staat in de spec (§5 "Opus mag dit NIET zelf
   beslissen", §4 hieronder). Staat het er niet, dan stoppen en de vraag in het eindrapport zetten;
   niet gokken.
5. **i18n**: elke nieuwe key in NL én Brits-Engels, letterlijk uit de spec, in het bestand dat de spec
   noemt; geen hardgecodeerde UI-tekst. Code en commentaar in het Engels.
6. **Geen nieuwe npm-dependency** (invariant 15). Nodig? Stoppen en melden.
7. **Groen vóór commit**: `npm run check`, `npm test`, `npm run build`, `npm run build:next` en (bij data)
   `npm run validate:data`. Commit in het Nederlands, afgesloten met de `Co-Authored-By:`-regel van het
   bouwende model; pas committen na de Haiku-gate.
8. **Sheets**: elke nieuwe sheet via `SheetPortal` met de knoppen in de kop (13J); wegvegen bewaart niets.
9. **docs/specs/ niet aanpassen**, behalve één regel onder de statusregel van de gebouwde spec:
   `Gebouwd: <datum> (blok N, workflow <runId>)`. Alles wat afwijkt komt in STATUS.md en in het rapport.
10. **DEVICE-TEST** (NL én EN, de nummers uit §1) en **STATUS.md** zijn werk van de integrator; de
    Haiku-gate controleert dat ze er staan.
11. **Deploy**: eerst `/next/` (`npm run build:next`), na Stijns/Gabi's telefoonronde `main`; de spec
    zegt per blok of direct `main` mag. Nooit zelf herladen in de app (invariant: "Nieuwe versie — vernieuwen").
12. **Zichtbaar werken** (wens Stijn): takenpaneel aan bij de start, tijdlijn bijwerken, na een deploy
    de live app in het browserpaneel openen.

### 3b. Workflow-scriptsjabloon (zoals de 13I-run: bouwers → integrator → review-lenzen + verifier → fixer → Haiku-gate)

**Lichte modus (besluit Stijn, 24 okt 2026; geldt vanaf de eerstvolgende bouw):** twee reviewlenzen plus een
verifier per bevinding is te duur; Stijn doet de kritische blik zelf bij het testen. Per blok dus:
bouwers (Opus) → integrator (Opus) → **één** reviewlens "correctness" (Opus) die een bevinding zelf
reproduceert vóór hij hem meldt (geen aparte verifier) → fixer alleen als er bevindingen zijn → Haiku-gate.
Blokken zonder app-logica (alleen data, zoals de lactose-slices of een bronbestand) slaan de reviewlens over
en houden alleen de gate. In het sjabloon hieronder: `lenses: ['correctness']` en de verifier-stap
weglaten. Waarom één Opus-lens en niet twee Haiku-lenzen: de echte fouten van 23 okt (bijgerecht als
"Vanavond", keuken weg bij een update, porties gewist bij een koude start, dobbelsteen in de eigen week)
vond de Opus-lens door de code te lezen en te reproduceren; Haiku vangt vooral oppervlakte (ontbrekende
i18n, een vergeten regel), en dat doet de gate al. De ambitie in 6D blijft volledig (±120 badges, ±60
avatar-onderdelen): die is het spel.
Aanroepen met `Workflow({ script, args: { spec: 'docs/specs/<spec>.md', block: 'Blok 2', builders: [
{ name: 'A', brief: '…' }, { name: 'B', brief: '…' }, { name: 'C', brief: '…' } ], lenses:
['correctness', 'spec-conformance'] } })`. De `builders`-lijst komt letterlijk uit §3 van de spec (naam
+ de bestanden die hij bezit); `lenses` zijn één of twee review-lenzen (nooit meer dan twee).

```js
export const meta = {
  name: 'build-spec-block',
  description: 'Bouw één blok uit docs/specs volgens de spec: bouwers → integrator → review → fixer → gate',
  phases: [
    { title: 'Bouwen', detail: 'één agent per bouwer, strikte bestandsverdeling' },
    { title: 'Integreren', detail: 'samenvoegen, check/test/build groen, DEVICE-TEST + STATUS' },
    { title: 'Review', detail: 'één of twee lenzen, daarna een verifier per bevinding' },
    { title: 'Repareren', detail: 'bevestigde bevindingen oplossen, weer groen' },
    { title: 'Gate', detail: 'Haiku controleert de definition of done', model: 'haiku' },
  ],
}
const { spec, block, builders, lenses } = args
const common = `Lees ${spec} helemaal, daarna docs/specs/README.md §2–§4 (die winnen bij tegenspraak).
Bouw alleen ${block}. Beslis niets wat de spec niet beslist: stop en meld het in je rapport.`

const REPORT = { type: 'object', required: ['done', 'files', 'open'], properties: {
  done: { type: 'string' }, files: { type: 'array', items: { type: 'string' } },
  open: { type: 'array', items: { type: 'string' } } } }
const FINDINGS = { type: 'object', required: ['findings'], properties: { findings: { type: 'array',
  items: { type: 'object', required: ['file', 'line', 'claim', 'why'], properties: {
    file: { type: 'string' }, line: { type: 'integer' }, claim: { type: 'string' }, why: { type: 'string' } } } } } }
const VERDICT = { type: 'object', required: ['confirmed', 'reason'], properties: {
  confirmed: { type: 'boolean' }, reason: { type: 'string' } } }

phase('Bouwen')
const built = (await parallel(builders.map((b) => () => agent(
  `${common}\nJij bent bouwer ${b.name}: ${b.brief}\nRaak alleen jouw bestanden. Schrijf tests waar de spec
ze noemt. Draai npm run check voor je rapport. Rapporteer wat af is, welke bestanden je raakte en wat open bleef.`,
  { label: `bouwer ${b.name}`, phase: 'Bouwen', schema: REPORT })))).filter(Boolean)
log(`${built.length}/${builders.length} bouwers klaar`)

phase('Integreren')
const integ = await agent(`${common}\nJij bent de integrator. Rapporten van de bouwers:\n${JSON.stringify(built, null, 1)}
Voeg samen, maak npm run check / npm test / npm run build / npm run build:next (en npm run validate:data bij
datawijzigingen) groen, loop de acceptatiechecks van §6 na in de dev-app (375 px), zet de DEVICE-TEST-rijen
(NL én EN, de nummers uit README §1) in docs/DEVICE-TEST.md en een alinea in docs/STATUS.md. Commit NIET.`,
  { schema: REPORT })

phase('Review')
const found = (await parallel(lenses.map((lens) => () => agent(
  `Review de werkmap (git diff) voor ${block} van ${spec} door de lens "${lens}". Alleen echte fouten met
bestand en regel; geen stijl. Controleer ook §5 "Opus mag dit NIET zelf beslissen" en §7 van de spec.`,
  { label: `lens ${lens}`, phase: 'Review', schema: FINDINGS })))).filter(Boolean).flatMap((r) => r.findings)
const verified = (await parallel(found.map((f) => () => agent(
  `Probeer deze bevinding te weerleggen met de code in de werkmap: ${JSON.stringify(f)}. Bij twijfel: niet bevestigd.`,
  { label: 'verifier', phase: 'Review', schema: VERDICT }).then((v) => (v && v.confirmed ? f : null))))).filter(Boolean)
log(`${verified.length} van ${found.length} bevindingen bevestigd`)

phase('Repareren')
const fixed = verified.length ? await agent(`${common}\nRepareer alleen deze bevestigde bevindingen:
${JSON.stringify(verified, null, 1)}\nDaarna check/test/build weer groen. Commit NIET.`, { schema: REPORT }) : null

phase('Gate')
const gate = await agent(`Controleer in de werkmap (lees-only, voer de commando's uit): npm run check, npm test,
npm run build, npm run build:next groen; elke nieuwe i18n-key in NL én EN; geen nieuwe dependency in package.json;
docs/DEVICE-TEST.md heeft de rijen uit README §1 voor ${block} in beide talen; docs/STATUS.md heeft een alinea;
de spec heeft alleen de regel "Gebouwd: …" erbij. Rapporteer per punt ja/nee.`,
  { model: 'haiku', effort: 'low', schema: REPORT })
return { built, integ, verified, fixed, gate }
```

Na de gate commit Opus zelf (Nederlands, `Co-Authored-By`), bouwt `/next/` en opent de live app. Faalt
de gate, dan één extra fixer-ronde met dezelfde `resumeFromRunId`; daarna stoppen en Stijn vragen.

## 4. "Opus mag dit NIET zelf beslissen" — samengevat over alle specs

Zo doen als het in de spec staat; anders vragen aan Stijn/Fable. De volledige lijsten staan in §5 van elke
spec; dit is de ontdubbelde kern.
1. Volgorde, Dexie-versie (alleen 13F → v8), `DATA_VERSION`-reeks 5/6/7/8/9/10 en de tellingen 216/236 (§2a).
2. Geen nieuwe tabel, setting, localStorage-key, route, fragmentsleutel of veld buiten het register §2b.
3. Deelformaat: `v` blijft 2; nieuwe velden alleen zoals genoemd (`cuisine`, `credit`, `variants`, `tip`,
   `of`, `vr`, `avatar` op `#f=`, sleutel `x`); elk nieuw bevroren token één keer maken en nooit meer
   hergenereren; `src/domain/token.ts` alleen door 6D-4b aangeraakt.
4. Data: recepttekst van de 20 bijgerechten en de 20 van 13F letterlijk; ids = `builtinId(naam)`;
   nooit met de hand in data/recipes.json; alleen `npm run migrate`.
5. Lactose streng (ghee en elke kaas `true`; twijfel = `false, unsure`; vegan ⇒ false); de steekproef is
   leidend; 18 keukens en 71 (+4) toewijzingen exact; vijf hercategorisaties exact.
6. Hoofdgerecht = categorie ∉ NON_MAIN; alleen de kiezers filteren (`mainOnly`); de Recepten-lijst nooit.
7. Kookbalk: 8 uur vervaltijd, vier eindes, × alleen zonder lopende timer, kookstand opent direct op de
   onthouden stap, `src/timers.ts` importeert nooit `@/cooking`.
8. 13F: de tabel in §2b (ids, namen, credits, categorieën, keukens, 'personal'); herschreven stappen alleen
   voor web/book; nooit een regel schrappen; vergelijking alleen via fingerprints; geen reset, geen
   `deleteUserRecipe()` in de migratie.
9. 13D: varianten op het recept/in de patch, nooit een tabel; `variantView`-volgorde natural → approved/
   stale → proposed; goedkeuren pas als elke "controleer zelf" is afgevinkt; stapteksten niet herschrijven;
   privénotitie reist nooit zonder schakelaar.
10. 6C: setting `standing.list`; vaste regels nooit opgeteld bij receptregels; `pantry` nooit aangeraakt;
    Klaar is het enige "nieuwe week"-moment; besluiten A–D zoals vastgelegd.
11. 6D: alle getallen in `XP_RULES`, de curve, de hash en seeds letterlijk; XP afgeleid, nooit opgeslagen;
    geen `Math.random`; badges uit = geen spoor; `settleXp` alleen op de zeven beloningsmomenten; de 100
    titels, 15 ontgrendelingen, 144 badges, 66 avatar-onderdelen, kleuren en drempelreeksen letterlijk;
    `XP_RULES_VERSION` 1 in 6D-1, 2 in 6D-2a; `#x=` precies zoals §2h.
12. UI-teksten letterlijk uit de spec (NL + Brits-Engels); past iets niet op 360 px, dan in beide talen
    inkorten en melden; emoji's zoals genoemd; elke sheet via SheetPortal met knoppen bovenaan.
13. Geen Home-wijzigingen buiten wat de spec noemt (slots: TimerBar, HomeLevelRow, TonightCard, WeekCard);
    geen wijziging aan landing.ts, sw.ts, boot.ts behalve de `x`-regex in 6D-4b.
14. Nooit een i18n-key verwijderen zonder Grep buiten src/i18n; de lijst "blijven" per spec respecteren.

## 5. Master-controlelijst voor Fable (eindcontrole, na blok Z)

Gegroepeerd en ontdubbeld over de negen specs (de nummers verwijzen naar §7 van de spec).

**Hygiëne en invarianten**
1. [ ] `src/db/db.ts` eindigt op `version(8)` (13F) zonder `.stores()`-wijziging; geen andere spec voegde
       een versie toe. `DATA_VERSION === 10`, `data/recipes.json` 236 recepten, `npm run migrate` tweemaal
       → alleen `generatedAt` verschilt; tests/migrate.test.ts op 10/236.
2. [ ] package.json ongewijzigd (geen nieuwe dependency); `src/landing.ts` kent alleen de `x`-regex als
       wijziging en schrijft niets; `sw.ts` onaangeraakt; share-chunk niet gegroeid door id-aliases.json.
3. [ ] CLAUDE.md: invariant 7 en de tokenregel noemen `#x=`; ADR-0004 heeft de `x`-regel; de fonts hebben
       een ADR-regel; CLAUDE.md-mappenlijst noemt de nieuwe domeinmodules niet verkeerd.
4. [ ] Elke nieuwe i18n-key in NL én EN (grep per prefix uit §2b); geen key-naam zichtbaar bij taalwissel;
       verwijderde keys nergens meer gebruikt; "Every week" consequent als Engelse naam van de vaste lijst.
5. [ ] 360 px overal zonder horizontale scroll (kop Home, kookbalk-timerrij, tabrij varianten, chips,
       badge-grid, avatar-tegels); tikdoelen ≥ 44 px; inputs ≥ 16 px; donker thema leesbaar (nieuwe tokens
       in alle drie themablokken: `--diet-*`, `--gold`, `--lvl-1..8`).
6. [ ] Elke nieuwe sheet (AddMenu, SideSheet, MissingSheet, VariantSheet, StandingSheet, LevelUpSheet,
       AvatarSheet) via SheetPortal met knoppen in de kop; wegvegen/ernaast/Escape bewaart niets.

**Deelformaat (invariant 4)**
7. [ ] Alle oude bevroren tokens byte-gelijk; nieuwe bevroren tokens W_SIDE, R_ALIAS, R/P/W_VARIANTS,
       F_AVATAR, X decoderen op beide engines en `encodeToken` reproduceert ze; `TOKEN_RE` in vijf
       bestanden bevat `x`; de "unknown kind"-tests gebruiken `z`.
8. [ ] `recipeFingerprint`/`contentFingerprint` ongewijzigd (nu in fingerprints.ts, re-export in merge.ts);
       `planHash` zonder variant byte-gelijk aan vroeger; `planDishCount` telt alleen hoofdgerechten.
9. [ ] `#x=` bevat geen notes/stars/photos; max 90 dagen, 5 ids; badges als `id`/`id@k`.

**Data en migratie**
10. [ ] data/ingredients.json: elke entry boolean `lactose`, validator-regels (vegan ⇒ niet true/unsure);
        steekproef tests/lactose.test.ts groen; de 8 entries van 13F dragen de vlag.
11. [ ] data/cuisines.json 18 keukens; meta.json 71 + 4 keukens, 5 categorieën, goesWith polenta;
        categories.json orders 11–15; recipes.json telt 75 keukens.
12. [ ] data/source/bijgerechten.json byte-gelijk aan bijgerechten.md §2g; golden 1443; de 20 onder
        `excludeNonMain`; diet.test op BUILTIN_TIMESTAMP.
13. [ ] data/id-aliases.json 21 sleutels/20 doelen; `applyAliases` puur en idempotent; `importBundle` mapt
        vooraf; `ensureBuiltins` draait de run alleen bij een wissel en ruimt identieke `b:`-kopieën op;
        tweede herstel van een oude back-up voegt niets toe; `generatedFrom` herrekend.
14. [ ] Alle 11 herschreven bereidingen van 13F gelezen (NL én EN; Fat Duck en Lièvre extra kritisch; °C).
15. [ ] data/levels.json 100 titels (anchors exact), data/unlocks.json 15 (avatar-maker level 3),
        data/badges.json 144 actief + 6 retired, alle 44 oude ids aanwezig, data/avatar-parts.json 66
        met `facial-*`-ids; `npm run validate:data` 0 errors.

**Gedrag per blok (steekproef in de dev-app en op de telefoons)**
16. [ ] Home A+: volgorde §1a; AddMenu op Home én Recepten (Plak eerst); `?sort=` werkt; TonightCard drie
        standen; WeekCard "n van N gekookt"; "Verder met" alleen vandaag; HomeLevelRow null bij badges uit.
17. [ ] Kookbalk: sessie begint/eindigt volgens §1a; × alleen zonder lopende timer; kookstand opent op de
        onthouden stap; `cook.sessions` in DEVICE_LOCAL_SETTINGS; current-timers "stap N"; rij 66 aangepast.
18. [ ] 6B: vier dieetchips overal via `DietChips`; keukenrij alleen met aanwezige keukens; zoeken
        "italiaans" → keukengroep eerst; Kies 7/Verras me/🎲/Kies-sheet/Home-dobbelsteen alleen
        hoofdgerechten met `pick.all` als uitzondering; "+ bijgerecht" met cascades en `of` in `#w=`;
        editor eindigt met Labels; woordenboek-prompt met limiet 40.
19. [ ] 13F: credit op de receptpagina, kaart "Nieuw sinds de eerste druk", AliasNotice één keer; oude
        `#r=` met u:-id → present of patch, nooit nieuw; oud `#w=` vult het plan (takePlan mapt).
20. [ ] 13D: tabrij alleen als er iets te kiezen valt; stippel/vol/✓; goedkeuren pas na afvinken; `?v=` +
        geheugen; kookstand, lijst (`ListSource.diet`), week en filters volgen de tab; tip reist, notitie
        alleen met schakelaar; "Eigen versie maken" zet variantOf + basedOn; kookbalk onthoudt `variant`.
21. [ ] 6C: pins verhuisd (idempotent); twee tabbladen; StandingSheet met Sluit; stap 1 l bij melk; "Heb
        ik al" niet onthouden; Klaar reset; back-up/herstel merge; Home-link in de lege weekkaart.
22. [ ] 6D-1: geen `Math.random`; pins (hash32, 94/505, curve, 491/level 5, 1.259.039) groen; 30-jaar-test
        < 50 ms; invoerdag-plafond werkt; badges uit = geen spoor; `reloadXp` na herstel zonder pops;
        `loggedAt` geschreven.
23. [ ] 6D-2/3: acht groepen, ladders met `id@k`, Geheim toont nooit het totaal, toasts per hoogste niveau,
        32 feature-hooks op de juiste momenten, `XP_RULES_VERSION === 2` met de melding; avatar-maker vanaf
        level 3, 66 onderdelen renderen, kaartje `#f=` met avatar, lokale leden tonen de avatar.
24. [ ] 6D-4a/4b: Vrijgespeeld met aan/uit per telefoon (`unlocks.disabled` toestel-lokaal), geluiden en
        lettertypes; `#x=` ontvangst met de drie uitkomsten; kalender met lokaal-wint-regel; landingspagina
        voor `#x=` zonder storage.

**Documentatie**
25. [ ] docs/DEVICE-TEST.md rijen 70–101 in NL én EN, nummers als §1, rijen 28 en 66 aangepast, geen
        [open punt]-restjes; docs/STATUS.md per blok een alinea; elke spec heeft precies één
        "Gebouwd: …"-regel en verder geen wijzigingen; docs/IDEAS.md onaangeraakt behalve nieuwe ideeën.

## 6. Vragen aan Stijn vóór de bouw

**De twee die het meest blokkeerden — beantwoord door Stijn op 23 okt 2026:** (1) de badge-catalogus en
de avatar-bibliotheek zijn **goedgekeurd** zoals ze staan; avatar-maker vanaf level 3 (standaard).
(2) de voornamen **mogen genoemd worden** ("Van Gabi", "Van Dino, via Stijn"); Griekse salade heet
"Griekse salade van Stijn" (standaard); de twee kookboekrecepten worden ingebouwd met herschreven bereiding
(standaard). Niets blokkeert meer; de antwoorden staan ook in §8 van inbouwen.md en badges-avatar.md.

1. **6D (blokkeert 6D-2 en 6D-3):** keur de badge-catalogus (badges-avatar.md §2d: namen — mag Engels als
   "Fishlover"/"Cuppa" in de NL-editie? — drempelreeksen, de zes `retired` badges) en de avatar-bibliotheek
   (§2f) goed, of noem wat anders moet. Ook: avatar-maker vanaf level 3 (standaard) of 5?
2. **13F (blokkeert blok 1):** (a) naam van jouw Griekse salade — standaard "Griekse salade van Stijn" /
   "Stijn's Greek salad"; (b) de twee kookboekrecepten (Botrytis cinerea-dessert, Lièvre à la royale):
   inbouwen met volledig herschreven bereiding (standaard) of als eigen recept laten staan; (c) de
   voornamen "Van Gabi" en "Van Dino, via Stijn" op de openbare site — vragen aan Gabi en Dino, of
   "Van een huisgenoot" / "Van een vriend"?

**Per spec (standaard = zoals gekozen; alleen antwoorden als je het anders wilt):**
- Home A+: de regel "🏆 Badges x/y ›" onder de begroeting tot 6D-1 er is — tonen (standaard) of weg?
- Kookbalk: Gekookt!/✓ Gekookt stopt ook de nog lopende timers van dat recept (standaard); vervaltijd
  8 uur (standaard; 6 of 12 kan).
- Labels: ghee telt als lactosehoudend (standaard, streng); de Nederlands-Italiaanse pasta's krijgen geen
  keuken (standaard); "lactosevrij-optie" op klassiekers met alleen wat kaas erover: niemand zet die nu
  (standaard) of Fable maakt bij de eindcontrole een lijstje?
- Bijgerechten: tellen de 20 mee voor "Het hele boek" (standaard ja); mogen ze direct naar `main` na de
  groene reeks (standaard ja), of wil jij/Gabi de teksten eerst op `/next/` lezen?
- Varianten-tabs: jouw glutenvrije uiensoep-kopie blijft eigen recept en wordt tab "Stijn"; je ene
  kookbeurt erop blijft op de kopie (standaard) of moet 13F die naar het origineel overzetten? Later een
  instelling "ik eet glutenvrij" (nu niet)? Naam "Goulash (versie van Dino)" (standaard) of "Dino's goulash"?
- Vaste lijst: recept + vaste regel van hetzelfde ingrediënt = twee regels (standaard) of één opgeteld?
  "Heb ik al" op een vaste regel geldt tot Klaar (standaard) of ook tot "Maak de lijst"?
- XP: titels 61/72/81 zijn grappen op Jamie/Nigella/Gordon en de tussentitels zijn Fables invulling —
  akkoord (standaard) of eerst zelf nalopen (data/levels.json, later gratis te wijzigen)? Tempo: level 20
  na ±4 maanden dagelijks, level 100 na ±26 jaar dagelijks met vakanties — akkoord (standaard) of trager
  (dan vóór 6D-1)? Vrienden: een onbekende afzender van "Sync mijn voortgang" kan vriend worden zonder lid
  te zijn (standaard) of mag iedereen gewoon lid worden?
- Badges/avatar: het hartje via ref + WhatsApp + dank-je-link `#d=` met ECDSA als eigen klein blok ná 6D-3
  (standaard), één hartje of niveaus (€ 5/10/25/50/100)?

Alle overige keuzes zijn in de specs en in §2 van dit bestand gemaakt; Opus hoeft niets te vragen om te
beginnen met Home A+ blok 1.
