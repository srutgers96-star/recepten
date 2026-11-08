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
- **Bijgewerkt 30 okt (Stijn):** ná 6D-4b een **6D-UI-ronde** (tabs per categorie voor de badgepagina en de
  avatar-maker in plaats van één lange lijst; avatar mooier, groter en gedetailleerder, het attribuut valt nu weg) →
  13D blok 1 → **6D-R zeldzaamheid** (klein) → 13D blok 2–4 → **6D-S Jouw stijl** → 6C → **13Q QR en link overal** → 13J → **challenges (level 20)** → **opschoonronde** (minder uitleg en tekst in de app, bv. niet
  overal "geel = niveau 1"; rustiger) → Z → eindcontrole. Stijn: "waarschijnlijk later in een soort opschoon-ronde
  nadat alles er staat"; Fable: de tabs en de avatar wél meteen na 6D-4b, omdat Stijn die schermen nu test.
- **Bijgewerkt 30 okt (Stijn): 13F vervalt.** De 22 recepten uit Stijns export worden niet ingebouwd ("skipt weer
  een hoop en is niet nodig"); geen id-migratie, geen Dexie v8, DATA_VERSION blijft 9, 216 klassiekers. De 8
  woordenboek-entries die eruit voortkwamen staan in docs/IDEAS.md idee 8 (ingrediënten-upgrade).
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
| 5 | 13F inbouwen met id-migratie | inbouwen.md | 4 | **vervallen** (Stijn 30 okt: niet nodig; de 8 woordenboek-entries → IDEAS 8) |
| 6 | 13D varianten als tabs, tip van de maker | varianten-tabs.md | 4 (blok 5 vervallen) | compleet |
| 7 | 6C vaste lijst | vaste-lijst.md | 3 | compleet (open punten A–D beslist) |
| 8 | 6D-1 XP, levels, pops, level-up | xp-levels.md "Blok 6D-1" | 1 | compleet |
| 9 | 6D-2a/2b badge-catalogus, regels, badgepagina | badges-avatar.md §3a/§3b | 2 | compleet (§6 vraag 1) |
| 10 | 6D-3 avatar | badges-avatar.md §3c | 1 | compleet |
| 11 | 6D-4a ontgrendelingen (in xp-levels.md "Blok 6D-3") | xp-levels.md | 1 | compleet |
| 12 | 6D-4b sync + kookkalender (in xp-levels.md "Blok 6D-4") | xp-levels.md | 1 | compleet (Fable-blik vóór main) |
| 12b | 6D-UI tabs per categorie (badges én avatar-maker) + avatar ronde 2 (mooier, groter, gedetailleerder; attribuut zichtbaar) | badges-avatar.md "Blok 6D-UI" | 1 | compleet, gebouwd 30 okt |
| 12c | 6D-R zeldzaamheid van avatar-onderdelen (gewoon/zeldzaam/episch/legendarisch; moeilijkheid én uitstraling) | badges-avatar.md "Blok 6D-R" | 1 (klein) | compleet (Stijn 30 okt; direct ná 13D blok 1) |
| 12c2 | 6D-B badgepagina als tegels (alleen iconen, tik voor details, net als de avatar-maker) | badges-avatar.md "Blok 6D-B" | 1 (klein) | compleet (Stijn 30 okt; direct ná 6D-R) |
| 12d | 6D-S "Mijn profiel" + "Jouw stijl": profielscherm (grote avatar, level, vijf tegels; pull-down en tik op Home; Meer en Profielen beheren rustiger) en één personaliseer-menu (avatar · geluiden · confetti · letters · thema; zeldzaamheid op ontgrendelingen; Vrijgespeeld gaat erin op) | badges-avatar.md "Blok 6D-S" | 1 | compleet (Fable 8 nov) |
| 12e | 6D-F avatar ronde 3: lijsten (frames) als twaalfde laag met eigen clipvorm, 11 lijsten + 17 achtergronden (12 dekkend), profielkleur altijd zichtbaar (impliciete ring) | frames.md | 1 | compleet (Fable 8 nov) |
| 13 | 13J iPhone-sheets afmaken | geen spec nodig (§1a) | 1 | ontbreekt bewust |
| 13a | 13Q QR en link overal: elke deelknop krijgt "Deel via link" én "Toon QR" (QR uit Experimenten); nieuwe sleutel `#l=` voor een boodschappenlijst als link, ontvangst in In & uit ("Zet op mijn lijst") en op de iPhone-landing; te lange tokens → eerlijk "te groot voor QR, deel de link" | qr-link.md | 1 | compleet (Fable 8 nov) |
| 13b | 6E Uitdagingen (challenges), vrij op level 20: aanbod van drie per week, één lopende, bonus-XP, badge Uitdager | challenges.md | 1 | compleet (Fable 8 nov) |
| 13c | Opschoonronde: minder uitleg en tekst, rustiger, losse eindjes van de lenzen (Stijn 30 okt) | opschoonronde.md | 1 | spec compleet (Fable 8 nov) |
| 14 | Z handleiding: Meer → Hulp & over → Handleiding (zoekveld, tien onderwerpen, per rij wat/waar/wat je ziet/goed om te weten/Open), data/handbook/*.json, Markdown-uitvoer docs/HANDLEIDING.md + HANDBOOK.md; ACHTER-DE-SCHERMEN.md door Fable | handbook.md | 1 | compleet (Fable 8 nov) |
| 15 | Fable-eindcontrole | §5 hieronder | — | — |

Nummering 6D: de twee 6D-specs tellen hun blokken anders. Canoniek is de tabel: 6D-1 (xp-levels
"Blok 6D-1") → 6D-2a/2b (badges-avatar §3a/§3b) → 6D-3 (badges-avatar §3c) → 6D-4a (xp-levels
"Blok 6D-3", ontgrendelingen) → 6D-4b (xp-levels "Blok 6D-4", sync + kalender).

DEVICE-TEST-rijen zijn over alle specs heen definitief genummerd: Home A+ 70–71 · 13K 72–74 (+ rij 66
aangepast) · 6B 75–80 · bijgerechten 81 · 82–85 vrij (13F vervallen) · 13D 86–88 (13D blok 2 past rij 85 aan) · 6C 89–91
(+ rij 28 aangepast) · 6D-1 92–93 · 6D-2 94–95 · 6D-3 96–97 · 6D-4a 98 · 6D-4b 99–100.

### 1a. 13J zonder spec
Het patroon staat al in de code (src/components/SheetPortal.tsx, `.sheet-head.with-actions`,
`.sheet-head-btn` in base.css; CookedSheet en VariantSheet doen het al). 13J = datzelfde patroon
toepassen op WordPicker, PickSheet, IngredientPicker, het feedbackvenster en de keuzepanelen, zodra
Gabi DEVICE-TEST rij 65 bevestigt. Regels: een sheet die iets opslaat heeft Annuleer links en de
bewaarknop rechts in de kop; een kiezer zonder Bewaar heeft Sluit rechts; wegvegen, ernaast tikken en
Escape bewaren niets. Geen nieuwe teksten, geen datamodel. Eén Opus-workflow met twee bouwers +
integrator; DEVICE-TEST-rij 101.
Gebouwd: 8 nov 2026 (13J, workflow wf_f6a8f3ca-a39). Besluit Fable na de lens: in het formulier 'Nieuw ingrediënt' heet de linkerknop weer 'Terug naar zoeken' (picker.cancel) als de kiezer niet newOnly is — hij gaat immers terug naar zoeken; alleen bij newOnly 'Annuleer' (sluit). Bestaande focus bij openen blijft (zoekveld/eerste woord); Escape op het houd-menu en de MetaSheet en lange bewaarteksten in de kop → opschoonronde.

## 2. Besluiten van de kritische lezer (gelden over alle specs)

### 2a. Versies en tellingen
- **Dexie:** v7 nu; 13F (v8, `runAliasMigration`) is vervallen (Stijn 30 okt). 13D, 6C en 6D
  voegen géén versie toe (alles settings of velden zonder index); de eerstvolgende vrije versie is v8.
- **`DATA_VERSION`** (tools/migrate-from-recepten2.ts): 4 nu → 6B blok 2 **5** → blok 3 **6** → blok 4
  **7** → bijgerechten **8** → keukens-toewijzing 24 okt **9**; de eerstvolgende vrije is **10** (13F vervallen). Elke bump neemt `tests/migrate.test.ts` (`toBe(n)`) mee.
- **Klassiekers:** 196 → 216 (bijgerechten); 13F (236) is vervallen. `classicsTotal` volgt de bundel; badges
  "Het hele boek"/"Halverwege het boek" blijven 216/108. Tests die over "de 196" gaan filteren op
  `createdAt === BUILTIN_TIMESTAMP` (import uit tools/migrate-from-recepten2.ts).
- **`migrate()`-volgorde (vast):** bron → batches → `applyReview` → sides (`data/source/bijgerechten.json`,
  `tools/sides.ts`) → `applyMeta` (`data/review/meta.json`,
  kent ook side-ids; 13F vervallen) → `applyDerivedTags` → sorteren. Er is géén `recipes-extra.json` en géén
  batch-21: het pad voor de 20 bijgerechten is dat van bijgerechten.md.
- **Woordenboek:** 1603 entries (de 8 van 13F gaan naar IDEAS 8, ingrediënten-upgrade); `lactose` is vanaf 6B
  blok 1 verplicht op élke entry. Badges: 43 → 44 (`zuivelvrije-ziel`, 6B) → catalogus 144 (6D-2, ids blijven).

### 2b. Velden, keys en namen (register; niets hiervan twee keer definiëren)
Nieuwe velden: `Recipe.cuisine?: string | null` (6B) · `Recipe.credit?: Text | null` (13F) ·
`Recipe.variants?: RecipeVariants | null` (met `RecipeVariant.checkedIngs?`, 13D blok 3) en `Recipe.tip?: Text | null` (13D) · `PlanItem.sideOf?: string`
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
`features.log`, `donate.hearts`, `avatar.seen` (toestel-lokaal), `badges.earned` krijgt ook `id@k` (6D-2) · `shop.bought` (per recept/ingrediënt afgevinkt) en
`badges.catalogSynced` (6D-2c) · `challenges.active` (per lid) en `challenges.done` (groeit alleen; bij herstel samengevoegd) (6E) · `confetti.style` ('random' | stijl-id, toestel-lokaal, 6D-S); route `#/more/unlocks` is sinds 6D-S een doorverwijzing naar `#/more/style`. Veld `Origin.via` ('ai' | 'paste' | 'website' | 'manual'): alleen bij aanmaken gezet,
reist niet mee in deel-tokens (`travelRecipe`), wel in de back-up (6D-2c).
localStorage: `recepten.tonightFiltersOpen`, `recepten.recent.last` (Home A+) · `recepten.vtab` (13D) ·
`recepten.badges.tab` (6D-UI; verving `recepten.badges.groups` van 6D-2) · `recepten.style.tab` (6D-S). Tokensleutels: `#l=` (13Q, boodschappenlijst; dezelfde vijf plekken; `Collected.lists`, `paste.list`; sinds 13c optioneel lijstregelveld `variant` = kwalificatie-id, bv. "rode"; ontbreekt → geen kwalificatie) · `#x=` (6D-4b, in token.ts, router.ts, boot.ts,
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
  `XP_RULES_VERSION` naar 2** (eerlijke melding); **sinds 30 okt is het 3** (eerste tien levels uitgedikt,
  Stijn + Fable; xp-levels §2b "Levelcurve"). `longestDayStreak(cookDays)` in src/domain/xp.ts (geen
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
    `XP_RULES_VERSION` 1 in 6D-1, 2 in 6D-2a, 3 sinds 30 okt (eerste tien levels uitgedikt); `#x=` precies
    zoals §2h.
12. UI-teksten letterlijk uit de spec (NL + Brits-Engels); past iets niet op 360 px, dan in beide talen
    inkorten en melden; emoji's zoals genoemd; elke sheet via SheetPortal met knoppen bovenaan.
13. Geen Home-wijzigingen buiten wat de spec noemt (slots: TimerBar, HomeLevelRow, TonightCard, WeekCard);
    geen wijziging aan landing.ts, sw.ts, boot.ts behalve de `x`-regex in 6D-4b.
14. Nooit een i18n-key verwijderen zonder Grep buiten src/i18n; de lijst "blijven" per spec respecteren.

## 5. Eindcontrole Fable (8 nov 2026, na blok Z) — uitkomst

De master-controlelijst van 15–23 okt is afgewerkt en samengevat; de 13F-punten (id-migratie, Dexie v8, aliases, 236 recepten)
vervielen met 13F (30 okt). Mechanisch nagelopen door Fable met een script over de werkmap; gedrag per blok is per blok al door
de integrator in de dev-app gecontroleerd en door de lens gereproduceerd (zie de "Na de lens"-alinea's in elke spec). De telefoons
zijn aan Stijn en Gabi: DEVICE-TEST 70–108 en de handleiding.

**Hygiëne en invarianten** — ✔ Dexie eindigt op `version(7)`, geen `.stores()`-wijziging sinds 6C; 216 recepten; package.json:
preact, @preact/signals, dexie, fflate, qrcode (ADR-0007), workbox-precaching/-routing — geen dependency zonder ADR; `src/landing.ts`
noemt storage alleen in commentaar (invariant 6); `Math.random` in src/domain alleen als injecteerbare standaard in planner.ts en
tonight.ts (weekkeuze), nergens in XP/badges/avatar; CLAUDE.md invariant 7 en de tokenregel noemen `#x=` en `#l=`; tests/i18n.test.ts
bewaakt dat elke sleutel NL én EN heeft en gebruikt wordt (allowlist: negen `cook.cmd.*Say`); de SheetPortal-sheets hebben de knoppen
in de kop (13J), Escape sluit ook houd-menu en labels-venster (13c).

**Deelformaat (invariant 4)** — ✔ Bevroren tokens van alle versies byte-gelijk in tests/token.test.ts, incl. het 13c-token met
`variant`; `TOKEN_RE` in token.ts, router.ts, boot.ts en landing.ts kent `x` en `l`; `#x=` zonder notities/sterren/foto's, 90 dagen;
`#l=` met optioneel `variant`.

**Data** — ✔ `npm run validate:data` 0 fouten: 216 recepten, 152 badges (146 actief + 6 retired), 16 ontgrendelingen, 154
avatar-onderdelen (12 lagen, 30 achtergronden waarvan 14 dekkend, 11 lijsten), 100 leveltitels, 30 uitdagingen, handboek 10
onderwerpen / 217 rijen; 4 bekende waarschuwingen in swaps.json (tamari).

**Documentatie** — ✔ Elke spec heeft per gebouwd blok precies één "Gebouwd: …"-regel met run-id (badges-avatar 8, labels-categorieen
6, varianten-tabs 4, xp-levels 3, vaste-lijst 3, home-a-plus 2, kookbalk 2, bijgerechten/challenges/frames/handbook/opschoonronde/
qr-link 1; inbouwen.md 0 = vervallen); DEVICE-TEST NL en EN hebben dezelfde 104 rijen (1–108, zonder gaten in de nummers die
bestaan), geen "[open punt]"; STATUS heeft per blok een alinea met de besluiten; IDEAS.md alleen met ideeën.

**Gate op de laatste commit (248e047)** — ✔ `npm run check`, 1780 tests in 79 bestanden, `npm run build`, `npm run build:next`,
`npm run validate:data`.

**Open voor Stijn (geen bugs, wel keuzes)** — de schakelaar Experimenten doet niets meer; pass/fail in de Apparaatcheck zijn Engels;
de ronde `box-shadow` van een gekozen chip in "Deel je nieuwe recepten" blijft rond bij een zeshoek- of gouden lijst; de knop
"Maak je avatar" staat nog onder Naam & kleur én in Jouw stijl (twee routes). Alles wat in het testen opvalt → één verbeterronde.

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
