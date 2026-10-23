# Status — Rutgers' Recepten (bijgewerkt 23 oktober 2026)

Lees dit eerst in een nieuwe Claude Code-sessie, samen met CLAUDE.md (invarianten) en PLAN.md §0 (besluiten).
Losse ideeën voor later (niet gepland) staan in **docs/IDEAS.md**; eerste idee: voedingswaarden en macro's
(17 okt). Stijn wil eerst het XP/level-plan (6D) en de rest afmaken.

## 23 okt (Opus): Home A+ blok 2
Gebouwd volgens docs/specs/home-a-plus.md §3 blok 2 (bouwers A en B + integrator). **Staat op `next`
(commit a3396e5) en online op /recepten/next/; `main` volgt na de telefoonronde met rij 70 en 71.** Wat er nu
staat: Home heeft op plek 2 de kaart **VANAVOND**
(src/components/TonightCard.tsx) met drie standen uit het pure `tonightMode` (src/domain/tonight.ts): laden;
**plan** (het eerste niet-gekookte gerecht van de week, metaregel "45 min · Vlees · nog 3 te gaan" / "de laatste
van je week", **🎲 Iets anders** bladert rond door de week en is grijs bij één, voetregel **Iets buiten je week ›**);
**free** (de oude Verras me: dobbelsteen met **🎲 Nog een**, voetregel **filters ▾** / **filters (n) ▾** met de
chips eronder, open/dicht onthouden in `recepten.tonightFiltersOpen`, en **Terug naar je week ›** zolang de week
nog iets open heeft). De chips blijven onder `recepten.surpriseFilters`. Op plek 3 de regel **Verder met: … ›**
(alleen vandaag bekeken, niet vandaag gekookt, niet het gerecht van de kaart; `noteViewed` schrijft nu ook
`recepten.recent.last`). Op plek 4 de compacte **Deze week** (src/components/WeekCard.tsx: "n van 7 gekookt", één
regel met max 3 namen + "+N", niet-gekookt eerst, gekookt doorgestreept achteraan; lege kaart ongewijzigd).
HomeScreen bevat geen dobbelsteen-logica meer. tests/tonight.test.ts dekt alle gevallen van §6a (43 nieuwe tests,
ook in andere tijdzones groen). **Afwijking van de letter van §3:** `LastViewed` staat in src/domain/tonight.ts en
src/recent.ts geeft hem door als type (zo importeert src/domain niets uit de app-laag, de ⚠ van de feitencheck).
**Keuze van de integrator** (vervangen door besluit 2 hieronder): de regel Verder met verscheen pas als de kaart
haar gerecht had gemeld (of 250 ms na het laden als de kaart niets toonde); anders flitste in de dev-app één beeld
lang "Verder met: <het kaartgerecht>" bij terugkomen op Home. Ongebruikte keys weggehaald na Grep:
`home.surprise` (browse.ts) en `home.weekOpen` (week.ts); dode CSS van de oude kaart weg (`.surprise` in browse.css, `.surprise .filter-chips` en
`.surprise .diet-chips` in home.css; `.surprise-name/-alt/-actions` blijven, de kaart gebruikt ze). DEVICE-TEST rij
71 toegevoegd, NL en EN, letterlijk uit de spec, op één plek na (review-ronde): stap 4 verwacht **filters (1) ▾**
in plaats van **filters ▾**, want Vegetarisch uit stap 2 staat dan nog aan (§1g; stap 2 van de rij zegt zelf al
"filters (1) ▾"). Check, test (765), build en build:next groen; geen nieuwe
dependency; Dexie blijft v7. In de dev-app (375 en 360 px, NL en EN) §6b checks 8–13 nagelopen; de testdatabase
van het browserpaneel heeft nu profiel "Stijn", een week van 7 (5 gekookt) en één kookbeurt Afwasmachinezalm.
**Besluit Fable (23 okt):** **1.** "Iets buiten je week" betekent echt buiten de week: in de free-stand rolt
de dobbelsteen over `outsideWeekIds(...)` (de chip-pool zonder de gerechten van het weekplan, de hele pool als dat
niets overlaat) en een onthouden worp buiten die pool wordt losgelaten, ook een van vóór Kies 7; rij 71 stap 4 blijft
zoals hij staat. **2.** `onShown` meldt via `useLayoutEffect` (vóór het tekenen), zodat Verder met nooit, ook niet één
beeld, het kaartgerecht herhaalt; het 250 ms-gordijn is weg, de regel wacht alleen op de eerste melding van de kaart
(null telt mee). In de dev-app nagelopen met een frame-monitor (🎲 Iets anders, Nog een, Iets buiten je week, Terug
naar je week, een plan-wijziging): nul foute beelden, met `useEffect` als tegenproef één. **3.** De "+N" van de
weekregel staat in een eigen span met `flex: none` en wordt nooit afgekapt; alleen de namen krimpen met een ellipsis
(360 en 375 px: "Spaanse groenten · Roergebakken… · +4").
**Twee restpunten, door Fable geaccepteerd (23 okt):** (1) Op 360 px breekt "🎲 Iets anders" / "🎲
Something else" over twee regels binnen de knop (48 px hoog, niets valt weg); de tekst blijft, want een korter
woord zegt minder. (2) "n van 7 gekookt" telt ook slots waarvan het recept weg is; de namenregel slaat die over.
Dat volgt de spec-signatuur en is zeldzaam (alleen na het verwijderen van een eigen recept uit een lopende week).
Kleine keuzes van bouwer B: kopregel VANAVOND 13 px (niet 12, §5b), Verder met in cobalt, een tijd van 0 minuten
valt weg uit de metaregel.
**Uitrol:** staat op `next` (23 okt); na de telefoonronde met rij 70 én 71 volgt `main`.

## 23 okt (Opus): Home A+ blok 1
Gebouwd volgens docs/specs/home-a-plus.md §3 blok 1 (bouwers A en B + integrator). **Live op `main` sinds
23 okt** (eerst op `next`, door Stijn gecheckt). Wat er nu staat: Home heeft in de kop een **+** met het nieuwe
`AddMenu` (src/components/AddMenu.tsx, ook op Recepten; volgorde Plak · Zelf · AI · Bestand; via SheetPortal;
sluit met ×, ernaast tikken, Escape of wegvegen; de veegcode is die van CookedSheet). De begroeting heeft het
avatar-rondje en daaronder het slot `HomeLevelRow` (tot 6D "🏆 Badges x/y ›", null bij badges uit/geen
profiel). De herinneringskaarten "nog niet gedeeld" en "In & uit" zijn de rij **📥 In & uit** ("1 ontvangen · 2
te delen" / "niets nieuws", cobalt bij ontvangen); de sectie Eigen & ontvangen is de rij **📒 Mijn recepten N**
(→ `#/recipes?sort=ownReceived`; RecipesScreen leest `?sort=`, onthoudt de keuze en haalt de query uit de hash);
de badges-kaart en de verhaal-kaart zijn weg (Het verhaal is nu een rij). Laatst gekookt toont 3 rijen,
Categorieën is één rij tegels van 148 px. Verras me en de oude weekkaart staan nog op plek 2 en 4 (blok 2
vervangt ze). Ongebruikte keys weggehaald na Grep: `home.ownReceived`, `noOwn`, `addFirst`, `allRecipes`,
`story`, `storyHint`, `badgesHint`, `teaser` (browse.ts), `home.inboxUnseen`, `inboxUnseenOne`, `inboxAction`
(week.ts) en `home.surpriseFilters` (phase2.ts); `home.weekOpen` (ook ongebruikt) blijft voor blok 2 volgens
§2c. DEVICE-TEST rij 58 (nieuwe volgorde) aangepast en rij 70 toegevoegd, NL en EN; na de review ook rij 15 (op Home
verdwijnt nu "n te delen" uit de rij In & uit, niet meer een kaart) en rij 44 (Home toont de regel "🏆 Badges
N/M ›" onder de begroeting, niet meer een kaart) bijgewerkt, NL en EN. Check, test (722),
build en build:next groen; geen nieuwe dependency; Dexie blijft v7. In de dev-app (375 en 360 px, NL en EN)
§6b checks 1–5 en 7 nagelopen; check 6 alleen in de code (de testdatabase heeft geen kookbeurten). In de
dev-database staat nu een ontvangen testrecept "Testsoep van Gabi" (`u:hometst1`) van check 4.
Twee kleine keuzes van bouwer A, buiten de letterlijke spec-code: een ongeldige `?sort=foo` verandert niets
maar verdwijnt wel uit de hash (§7 punt 3 "blijft niet hangen"), en een sorteerwissel vergeet ook de bewaarde
scrollpositie (anders zou de nieuwe volgorde na laden naar de oude plek springen; "scrolt naar boven").
**Besluit Fable (23 okt):** via de rij Mijn recepten wordt een oude zoekterm uit Recepten gewist
(`setQuery('')` in het `?sort=`-effect); de rij belooft "alleen je eigen en ontvangen recepten" (rij 70
stap 4). Een tik op de sorteerpil zelf laat de zoekterm staan, zoals voorheen. Review (2 lenzen + verifier):
4 bevindingen bevestigd, alle verwerkt. Haiku-gate groen.
**Uitrol:** blok 1 staat op de nieuwe branch `next` → https://srutgers96-star.github.io/recepten/next/ (eigen
database, eigen icoon). `main` is ongewijzigd tot de telefoonronde met rij 70 (beide telefoons) goed is;
daarna `next` in `main` mergen. Dan blok 2 (Vanavond-kaart en compacte week).

## 22–23 okt (Fable): de spec-ronde is af — Opus kan bouwen
**docs/specs/README.md is nu het startpunt voor elk bouwblok** (bouwvolgorde, register van velden/keys,
werkwijze + Workflow-sjabloon voor Opus, "Opus mag niet zelf beslissen", master-controlelijst voor Fable,
vragen aan Stijn). Negen specs, samen ±9.200 regels, elk met status "compleet (Fable, 22 okt 2026)" plus een
feitencheck (Opus, tegen de code van 22 okt) en een blok "Kritische lezer (Fable)" met de besluiten over
specs heen: home-a-plus · kookbalk (13K) · labels-categorieen (6B+13E) · bijgerechten (20 recepten) ·
inbouwen (13F, Dexie v8 = de enige nieuwe versie) · varianten-tabs (13D) · vaste-lijst (6C) · xp-levels (6D)
· badges-avatar (6D-2/6D-3). Bouwvolgorde: Home A+ → 13K → 6B+13E → bijgerechten → 13F → 13D → 6C → 6D-1 →
6D-2 → 6D-3 → 6D-4 → 13J (zonder spec) → Z → Fable-eindcontrole. DEVICE-TEST-rijen 70–101 zijn in de specs
al genummerd. De twee blokkerende vragen (README §6) zijn op 23 okt beantwoord: catalogus en avatar-bibliotheek
goedgekeurd; voornamen in de credits mogen genoemd worden; de rest standaard. **Niets blokkeert meer.**
De run kostte twee pogingen (sessielimiet na de schrijvers; hervat met resumeFromRunId, schrijvers uit cache).

## Online (https://srutgers96-star.github.io/recepten/)
**Fase 5 compleet** (fase 0–4 + blok A t/m F, 8 oktober 2026) **+ fase 6 blok 6A** (6A-1 9 okt, 6A-2 15 okt)
**+ ronde 13 okt deel 1** (15 okt). Repo: https://github.com/srutgers96-star/recepten.

## Branches
`main` = https://srutgers96-star.github.io/recepten/ (beide telefoons). `next` = …/recepten/next/ (testkanaal,
eigen database en icoon). 23 okt: **Home A+ blok 1** stond eerst op `next`, is na Stijns check in `main`
gemerged en staat live; **blok 2** staat op `next` en wacht op de telefoonronde (DEVICE-TEST rij 70 en 71),
daarna `next` → `main` (fast-forward). Elk volgend bouwblok gaat eerst naar `next`.
Eenmalig geregeld (23 okt): de GitHub Pages-omgeving `github-pages` stond alleen `main` toe als uitrolbranch;
`next` is toegevoegd (Settings → Environments → github-pages → Deployment branches). Zonder die regel faalt
de deploy-job van een push naar `next` met een environment-protection-fout.

## 16 okt (Opus 5.5): bugfixes van Gabi; de spec-ronde van Fable is NIET gelukt
- De spec-ronde (workflow wf_09446677-12f) stuitte twee keer op de Fable-limiet: geen enkele spec af.
  Alleen docs/specs/vaste-lijst.md (38 KB) staat er van de eerste poging, **niet nagekeken en mogelijk
  onvolledig**; niet gecommit. Bij de volgende Fable-sessie de spec-ronde hervatten
  (resumeFromRunId wf_09446677-12f) of opnieuw starten.
- **Gekookt-venster (bug Gabi):** Bewaar staat nu ook bovenaan (naast Annuleer). Besluit Stijn 16 okt: **alleen Bewaar bewaart**; wegvegen (greepbalkje), ernaast tikken, Annuleer en Escape sluiten zonder te bewaren (eerdere variant "wegvegen bewaart" teruggedraaid). Confetti bij sterren pas ná het bewaren (ook in de
  kookstand). Op de pc getest; op Gabi's iPhone nog te bevestigen (DEVICE-TEST rij 65).
- **Zoeken:** spellingvarianten van gerechtnamen (goulash = gulyás = gulasch, shoarma = shawarma,
  saté = satay …) in src/domain/search.ts + tests/search.test.ts. "Dino's Gulyás" verschijnt nu bij
  "goulash". (Hij staat niet in In & uit omdat Stijn hem zelf opsloeg, niet ontving.)
- **Kookstand (wensen Stijn):** (1) **vegen** tussen stappen werkte niet op een echte telefoon: het
  scrollende kaartje liet de browser horizontale vegen overnemen; nu `touch-action: pan-y` op `.cook-card`.
  (2) **Tik op een timer** in de timerbalk (of op de melding) → de kookstand van dat recept, op de stap
  van die timer (`timerPath`/`openTimerPath` in src/timers.ts, `?step=N` in CookScreen). (3) **🔊 is een
  schakelaar**: aan = deze en elke volgende/vorige stap voorlezen, uit = stil blijven; het is de instelling
  Meer → Voorlezen zelf, dus die blijft ook bij de volgende keer koken staan. Op de pc getest (375 px);
  op de telefoon DEVICE-TEST rij 66. De grotere wens, een **"Nu aan het koken"-balk** (ook zonder timer,
  meerdere recepten tegelijk), staat als 13K in docs/phase-6-spec.md voor Fable.
- **13I gebouwd (Opus, workflow: domein → UI+spraak → 3 reviewers → verifier → fixer → gate; 8 van 10
  bevindingen bevestigd en gerepareerd):** src/domain/stepingredients.ts herkent de ingrediënten van het
  recept in de staptekst (hele woorden, langste eerst, precisie boven volledigheid; 89% van de stappen
  heeft minstens één groen woord). Groen + onderstreept = tikbaar: de geschaalde hoeveelheid verschijnt
  erachter. Groen zonder streep = de hoeveelheid staat al in de tekst of de regel heeft er geen.
  "⚖️ Toon hoeveelheden" in de kookstand (instelling cook.showAmounts, src/step-amounts.ts); de
  receptpagina markeert ook. Spraak (Android): "hoeveel?" / "how much?" leest de hoeveelheden van de
  stap voor; tijdvragen ("hoeveel tijd nog") blijven timeLeft, praatzinnen ("hoeveel mensen eten er
  mee") doen niets. Bekend en geaccepteerd: "selderij" in een kipkarbonades-stap en "the onion and pepper
  mixture" tonen de volle hoeveelheid. DEVICE-TEST rij 68. 703 tests.
- **Foto bij ✓ Gekookt (wens Gabi):** 📷 Foto toevoegen in het Gekookt-venster (zonder `capture`, dus
  ook uit de fotobibliotheek). De foto wacht in het venster tot Bewaar, en krijgt de datum van de
  kookbeurt; wegvegen bewaart niets. DEVICE-TEST rij 67.
- **Boodschappen zelf typen (bug Stijn, 17 okt):** "200 gram boter" kwam als "gram boter" onder Overig:
  het vak las alleen een los getal. Nieuw: src/domain/shopinput.ts (`parseShopInput`, `splitShopList`)
  leest getal + eenheid + naam (parseQty van de parser; eenheden alleen in de typtaal; "ons"/"pond" als
  gram; "3 x 200 gram"; Engels "2 cans of chickpeas"; "een paar bananen" blijft tekst; "2 blik tomaten",
  "pak choi", "hand cream" houden hun eigen naam); "1,5 liter melk" blijft één regel. Engelse weergave van
  "2 dl" werd "2 ml": amountText rekent nu om. Nieuw ingrediënt "bloemen" (bos bloemen ≠ bloem).
  Review-workflow (2 reviewers + verifier): 15 van 20 bevindingen bevestigd en gerepareerd. Nog niet:
  verpakkingswoorden zonder eenheid in units.json (doos, tube, net, krat) — die gaan als tekst naar de
  afdeling van het product. DEVICE-TEST rij 69.
- **Vraag Gabi over de glutenvrij-badge:** geen bug. De badge telt kookbeurten van glutenvrije
  recepten (5 nodig), niet het maken van een versie; in de browser nagespeeld: versie maken 0/5,
  één keer gekookt 1/5.

## PAUZE (15 okt, avond) — volgende stap: de spec-ronde door Fable (zie "Werkwijze vanaf 15 okt")
Ronde 13 okt deel 1 staat online. Stijn koos Home-variant **A+** (docs/home-voorstel.md). Op zijn "door"
schrijft Fable eerst de bouwspecs in docs/specs/ voor: Home A+, 6B + 13E, 13F, 13D, 6C, 6D; daarna bouwt
Opus 5.5 ze blok voor blok. Niets in de werkmap; `main` is schoon.

## Afgerond 15 okt (avond): ronde 13 okt deel 1 (vier bouwers + integrator → 3 reviewers → skeptici → fixer → Haiku-gate; 8 bevindingen gerepareerd)
- **In & uit** (voorheen Inbox, route /inbox): Dexie v7 met tabel `events` (ShareEvent: in/uit, wat, aan/van
  wie, aantal, recept-ids); 'in' bij elke import en bij een kaartje, 'uit' bij elke geslaagde recept-/
  kaartje-/bundel-share (niet bij lijst/weekplan/back-up); tabs **Ontvangen** (met datum en van wie) en
  **Gedeeld** (datum, aan wie, wat; tik → recept(en)); plakvak bovenaan; events mee in de back-up (dedupe).
- **Sorteren** in Recepten: A–Z · Recent bekeken (src/recent.ts, localStorage) · Eigen · Eigen & ontvangen
  (onthouden); zoeken en chips werken in elke stand, letterrail alleen bij A–Z.
- **Browser-melding** (src/components/BrowserNotice.tsx, alleen op een telefoon in een browsertab): per
  platform eerlijke installatie-uitleg; Android buiten Chrome: "Je zit nu in Opera …" + **Open in Chrome**
  (intent-link met fallback "Kopieer de link") — die waarschuwing wordt niet weggesnoozed; in Chrome:
  "wat je hier bewaart komt ook in de app". Meer → Hulp & over → **Links openen in de app** (stappen per
  platform). Landingspagina (iPhone): 1 Kopieer · 2 Open de app → Meer → In & uit · 3 Plak van klembord.
  **Nog te bevestigen op een echte Android-telefoon**: of de intent-link met een #r=-fragment echt Chrome
  opent (DEVICE-TEST rij 62).
- **Opslag**: twee kaarten "Back-up voor mezelf" en "Mijn recepten aan iemand geven", elk met "Bewaar of
  deel" → Delen / Download met één zin uitleg; Herstel met uitleg; eerlijke teksten per telefoon.
- **Curator-pagina verwijderd** (CuratorScreen.tsx, route, Meer-rij, tests, 33 i18n-keys, CSS; CLAUDE.md
  mappenlijst bijgewerkt; DEVICE-TEST rij 48 vervallen). Engels van een klassieker verbeteren = editor.
- docs/home-voorstel.md (twee varianten; Stijn koos A+). DEVICE-TEST rijen 61–63. 659 tests.

## Afgerond 15 okt: blok 6A-2 + 13A(1) + 13C (drie bouwers + integrator → 3 reviewers → skeptici → fixer → Haiku-gate; 14 bevindingen gerepareerd)
docs/phase-6-spec.md 6A punten 9, 10, 13, 14, 16, 17 + ronde 13 okt 13A (deel 1) en 13C. Kern:
- **Plak-domein**: src/domain/paste-recipe.ts (websiterecept → naam/porties/tijd/regels/stappen/taal/
  confidence/leftovers; 17 fixtures in tests/fixtures/paste, 9 NL + 8 EN, bereiding ingekort), src/domain/
  paste-classify.ts (classifyPaste: empty → tokens → member → bundle → ai → website → unknown), photo-import.ts
  normalizePastedAnswer (markdown-escapes, code-fences, markers midden in een regel, in elkaar geschoven
  ingrediëntregels; Stijns uiensoep-voorbeeld → 13 regels) en de prompt in één codeblok ("tik op Kopieer
  code"); parser.ts: "naar smaak/naar wens/to taste" overal in de regel, "zout peper" → zout-en-peper,
  vage hoeveelheid in haken ("[een snufje]") = notitie. Golden byte-identiek.
- **Universeel plakvak**: src/components/UniversalPaste.tsx + src/paste.ts (classificatie → actie), in
  Toevoegen (defaultAction 'recipe'), Inbox ('import') en Huishouden ('member'); oude losse plakvakken weg.
  "+"-menu: Zelf schrijven · Plak een recept (/add?mode=paste) · Met AI (/add?mode=ai) · Kies een bestand.
  Editor: websiteroute met "Controleer"-kader (→ ingrediënt / → stap / weg), feedbackregel, labels/categorie
  uit een AI-antwoord gevuld (metaManual).
- **WordPicker** (src/components/WordPicker.tsx, src/domain/line-words.ts): woorden van een ?-chip aan/uit
  (groen = ingrediënt, grijs = opmerking), "Koppel zo" via de bestaande override-API (raw blijft),
  Link-vraag "variant van X of nieuw ingrediënt?" in IngredientPicker.
- DEVICE-TEST rijen 58–60. 646 tests.
**Daarna gebouwd:** ronde 13 okt deel 1 (zie boven). **Resterende volgorde:** specs door Fable → Home A+
→ 6B + 13E (labels, lactosevrij, keukens, nagerecht/gebak/bijgerecht/ontbijt & lunch, 20 bijgerechten) →
13F (inbouwen met id-migratie) → 13D (varianten als tabs) → 6C → 6D → Z → Fable-eindcontrole.

## Afgerond 9 okt: blok 6A-1 (vier bouwers + integrator → 3 reviewers → skeptici → fixer → Haiku-gate; 10 bevindingen gerepareerd)
docs/phase-6-spec.md 6A punten 2–8, 12, 15, 18. Kern: src/cooklog.ts `recordCooked` (zelfde stappen als de
kookstand: milestones, weekplan-vinkje alleen bij "vandaag", badges) + CookedSheet ("✓ Gekookt" op het recept:
vandaag/gisteren/datum, sterren, notitie; "Beoordeel" voor een kookbeurt zonder sterren, ook op Home met
`?rate=<entry-id>`); MoreScreen in vier inklapbare groepen + losse rij Opslag (stand in localStorage
`recepten.more.groups`), Feedback voor Stijn (shareText met versie/kanaal/build/toestel, geen nummers in
code), ☕ Steun dit project → https://bunq.me/StijnRutgers (Meer én Het verhaal), "Deel je nieuwe recepten"
met voorbeeldkader, installeerkaart (Android "Installeer de app"; iPhone inklapbaar, "± 2 MB");
spraak: repeat/ingredients/timeLeft (+ guards tegen keukengepraat) en ?-knop met VoiceHelp; 14
profielkleuren (contrast ≥ 4,5:1); voorraadkast-vinkje in gewone taal + eigen ingrediënt achteraf
bewerken (vlaggen, eenheid); curator toont de effectieve EN-weergave, "Verbeter in het woordenboek" alleen
bij eigen ingrediënten (ingebouwd = via Feedback); CheckRecipes "Categorie: …" / "Labels: …".
DEVICE-TEST rijen 54–57 + oudere rijen die naar de oude Meer-indeling wezen bijgewerkt. 539 tests.

## Afgerond 8 okt: blok F (drie bouwers + integrator → 3 reviewers → skeptici → fixer → Haiku-gate; 10 bevindingen gerepareerd)
- **Ledenkaartje `#f=`** (ADR-0004, alinea 8 okt): envelop `{ v: 2, t: 'f', f: { id, name, color, lang, deviceId? } }`,
  bevroren tokens in tests/fixtures; token.ts/router.ts/boot.ts/landing.ts kennen `f`. Meer → Huishouden:
  "Mijn kaartje" (Deel mijn kaartje = één `{text}`, Kopieer link, Toon QR alleen achter Experimenten) en
  "Voeg lid toe via link of plak"; de Inbox toont een `#f=` als kaart "Voeg <naam> toe aan je huishouden"
  (Android via de link, iPhone via plakken); "Stuur nieuwe naar …" toont huishoudleden als eerste keuze.
  Setting `device.id` = stabiel telefoon-id (ProfilesScreen `ensureDeviceId`). Eerlijke grens: een app van
  vóór blok F zegt bij een `#f=` "geen leesbaar recept" (v blijft 2), niet "update de app" — beide telefoons
  eerst bijwerken.
- **Receptvarianten**: data/swaps.json (77 swaps, `npm run validate:data` controleert ids en dieetvlaggen),
  src/domain/variants.ts (planVariant/makeVariant), `Recipe.variantOf`, repo.variantsOf, VariantSheet;
  het recept toont "Maak glutenvrije/vegetarische/vegan versie", "Ook als: …" en "Versie van …".
- Reviewfixes: variant zet metaManual (anders haalt "Controleer mijn recepten" het dieetlabel weer weg);
  geteld product → gewichtsproduct via gramsPer ("4 kipfilets" → "800 g tofu"); eenheidswoord-aliassen
  slokken de eenheid niet meer op; kooknotitie van een swap komt op de regel; kaartje van een nieuwe
  telefoon vervangt het oude lid (zelfde naam) i.p.v. een verborgen dubbel; "sinds"-historie in
  "Stuur nieuwe naar …" gevouwen vergeleken; afzender wordt alleen op naam herkend (eerlijk in code).
- Groen op 8 okt: check, test (521), build, build:next, validate:data. DEVICE-TEST rijen 52 en 53.
  CLAUDE.md invariant 7 en de "Also:"-regel noemen `#f=` nu ook.

## Afgerond (ter info)
Blok E (gebouwd met Opus 5.5, zie PAUZE hieronder): data/ingredients.json 378 → 1601 producten
(10 thematische slices in data/work/block-e/, samengevoegd door data/work/block-e/merge.mjs met dedupe;
beslissingen staan in dat script), parser-dekking blijft 1883/1883, 2 regels beter (vegagehakt);
Woordenboek-scherm met gangpadfilter, entry-weergave met vlaggen, "+ Nieuw ingrediënt", "Toon meer".
Kleine wensen 3 okt: "Alles klaar ✓" op Klaarzetten; spraakcommando's uit op iPhone (canListen()).
DEVICE-TEST rij 50 (woordenboek) en 51 (zekerheidscheck Opus-werk), in gewone taal.

Blok D: Dexie v6 photos-tabel + src/photo.ts (canvas ≤1024px WebP/JPEG, EXIF-rotatie), foto-hero +
galerij + overlay op het recept, "Foto toevoegen" bij Gekookt!, back-up "Met foto's" (default uit),
fotobadges live; src/print.ts + print.css (recept 1×A4 / ingrediënten / lijst met gangpad-kolommen+☐)
+ "Kopieer als tekst" (domain/recipe-text.ts, iOS-hint i.p.v. dode printknop); StoryScreen met
huishoudleden; CuratorScreen /more/curator (status machine/gecontroleerd/ontbreekt, EN-only patches
via saveOverride + text{en:'human',reviewedBy}, "Stuur correcties" via bestaande patch-envelopes);
Experimenten-switch; QR op het recept-deelscherm (qrcode-dependency, ADR-0007, lazy chunk);
DEVICE-TEST rijen 46–49. Eerder: blok C badges (commit e7298d8), blok B kookstand+ (4e4519e).

## Fable-review van het Opus-werk — afgerond 8 okt 2026 (ter info)
Blok E en de extra's van 3 okt waren met Opus 5.5 gebouwd zonder reviewronde. Fable heeft ze
nagelopen (workflow wf_7b8c69c0-cb4: 5 reviewers → skeptici → data-fixer + code-fixer → Haiku-gate):
- Data: taal en vlaggen bleken netjes (alle 1223 entries gelezen); 15 geverifieerde correcties
  (o.a. "coffee pad", "cold cuts", 3 vega-vervangers vegan→false, maïs-trema's, perishable/staple);
  nieuw: sultana, platte-perzik (geen "flat-leaf peach" meer); aliassen koosjer zout→zout,
  elstar/jonagold/granny smith/pink lady→appel, philadelphia→roomkaas, mie→noedels (niet eiermie:
  supermarkt-mie bevat geen ei), botrytis-/sémillonwijn→dessertwijn. **DATA_VERSION 3 → 4** (via
  tools/migrate-from-recepten2.ts + npm run migrate); golden hergenereerd (7 regels, allemaal beter).
  Bump in de browser getest: profiel, kooklog, favorieten en instellingen blijven staan, alleen de
  klassiekers worden ververst.
- Code: **vertaal-plakbug (6A.1) gefixt** — parseTranslationAnswer kent nu taalblokken ("=== NL ===",
  "English:", "Original/Translation" …) en krijgt de doeltaal mee; 10 nieuwe tests. Oorzaak was niet
  de UI-taal maar de blokvolgorde in het AI-antwoord ("eerste blok wint"). Al vastgelopen recepten
  herstellen zichzelf niet: in de editor (stand "beide") het verkeerde EN-vak leegmaken en opnieuw
  plakken. IngredientPicker krijgt de taal van de regel mee (6A.14-deel); detail-aliassen niet meer
  dubbel; diet.ts: qualifier "plantaardige" = veg+vegan, "vegetarische" = veg (vegan onzeker);
  "N overgeslagen (stond er al)" in de vertaalstatus.
- **Landingsbundel (iPhone-deelpagina):** woordenboek wordt lazy geladen ná de eerste weergave;
  share-chunk 572 → 57 kB (gzip 107 → 20 kB), landing 12,6 kB; woordenboek apart in data-*.js.
- DEVICE-TEST rij 42 en PLAN.md §0 "Spraak": iPhone-spraak staat bewust uit.
- Let op voor smoke-tests: de dev-database (localhost) is tijdens de review door een testagent
  gereset; er staat nu een profiel "Test" met één kookbeurt in.

## Daarna, blok voor blok, elk apart online — volgorde (bijgewerkt 8 okt 2026)
1. ~~Fable-review van het Opus-werk~~ (afgerond 8 okt)
2. ~~F vrienden via link/QR + varianten~~ (online 8 okt; telefoontest DEVICE-TEST 52–53 volgt later)
3. **Fase 6 — Stijns wensenlijst van 6 okt**, uitgewerkt in **docs/phase-6-spec.md**:
   6A snelle verbeteringen en bugs — **6A-1 online 9 okt; 6A-2 (plakken/prompt) volgt** (import-bug naam NL/EN, curator-ingrediënten, "Gekookt" zonder
   kookstand + later beoordelen, installeerkaart, "Stuur nieuwe naar" duidelijker, Meer opgeruimd,
   feedbackknop, meer spraakcommando's + ?-knop, plak-prompt vult labels in) →
   6B labels (lactosevrij, keukens/nationaliteit, labelstap in de editor, vertaalprompt ontbrekende
   ingrediënten) → 6C vaste boodschappenlijst → 6D XP, levels, badge-niveaus, ontgrendelingen.
   Elk blok begint met de open vragen uit dat document.
4. **Z handleiding** (altijd als laatste; voorheen "G").
5. Daarna testen Stijn en Gabi kritisch op de telefoons, en volgen verbeterrondes.
Stijn zegt per blok "door". De volgorde mag hij altijd omgooien.

## Blok Z — Handleiding (wens Stijn 3 okt 2026; bewust als LAATSTE, "als alles helemaal goed is")
Eén duidelijke, zoekbare, geordende handleiding waarmee je alle functies kunt verkennen — géén
testpagina's meer. Voorstel (bevestigen bij de start van G): in de app als Meer → Handleiding,
tweetalig, met zoekveld en onderwerpen in een logische volgorde (eerste keer · recepten · koken ·
week & boodschappen · delen & ontvangen · woordenboek · badges · instellingen · iPhone vs Android),
per functie: wat het doet, waar je tikt, en wat je dan ziet; tekst in een databestand
(bv. data/handbook.json) zodat hij los te onderhouden is. docs/DEVICE-TEST.md gaat daarin op
(de "probeer het"-stappen). Idee Stijn: DEVICE-TEST, het Apparaatcheck-scherm en de Curator op één
hoop (bv. Meer → "Testen & nakijken") — doen als dat handig blijkt.
Volgorde (Stijn): eerst het plan incl. extra's netjes af (F, fase 6, Z); pas dán testen en
kritisch kijken op de telefoons, daarna verbeterrondes.
Tweede versie erbij (6 okt): een handleiding "achter de schermen" voor Stijn (XP-berekening, waar
data staat, back-ups, delen), zie docs/phase-6-spec.md blok Z.
iPhone-spraakcommando's: bewust uit (3 okt) — canListen() is false op iOS; voorlezen werkt wel.

## Werkwijze vanaf 15 okt 2026: Fable ontwerpt, Opus bouwt, Fable controleert één keer aan het eind
Besluit Stijn (15 okt), om ±80 % Fable te besparen:
1. **Fable schrijft bouwspecs** (één spec-ronde, na ronde 13 okt deel 1) voor alle resterende blokken behalve
   de handleiding: Home A+ (13 okt deel 2), 6B + 13E (labels, lactosevrij, keukens, nieuwe categorieën +
   20 bijgerechten), 13F (inbouwen met id-migratie), 13D (varianten als tabs + "Tip van de maker"), 6C (vaste
   lijst), 6D (XP/levels/badges/avatar — **dit plan moet héél goed zijn**). Specs komen in docs/specs/<blok>.md:
   gedrag met NL+EN-teksten, datamodel, bestandsverdeling per bouwer, contracten, invarianten, testplan +
   acceptatiechecks, DEVICE-TEST-rijen, en een **controlelijst voor Fable**. Expliciet: wat Opus niet zelf
   mag beslissen.
2. **Opus 5.5 bouwt** blok voor blok volgens de specs (workflow met bouwers → integrator → Haiku-gate; de
   review-fan-out mag Opus zelf beperkt doen), Haiku voor het sjouwwerk. Kleine blokken, want ook Opus kan
   halverwege op een limiet stuiten: hervatten met resumeFromRunId, eerst de werkmap bekijken.
3. **Fable controleert één keer kritisch aan het eind**, ná de handleiding (blok Z), over alles wat Opus
   bouwde; alleen 13F (id-migratie) en 13D (deelformaat) krijgen vóór livegang een korte Fable-blik als
   Stijn dat wil. Gevonden fouten worden dan in één verbeterronde gerepareerd.

## Werkwijze (afgesproken 7 okt 2026, om de weeklimiet te sparen)
- **Fable is de bouwer en de controleur.** Ontwerp, ADR's, parser, share-token-codec, migraties,
  merge-logica en de Engelse teksten voor Gabi blijven bij Fable (invarianten 1–4).
- **Haiku voor afgebakend sjouwwerk**, als goedkope losse sessie of als `model: 'haiku'` voor
  mechanische stappen in een workflow: `npm run check/test/build/validate:data` draaien en fouten
  samenvatten, zoekwerk, i18n-keys NL+EN toevoegen, hernoemen, CSS-tokens, STATUS.md/DEVICE-TEST.md
  bijwerken, simpele batches met een duidelijk patroon. **Fable loopt daarna na** wat Haiku veranderde.
- Workflows: geen grote review-fan-outs als het niet nodig is; per stap het lichtste model dat het
  aankan; vertel Stijn vooraf ongeveer hoe zwaar een blok wordt. Let op: een hervatte workflow haalt
  niets uit de cache als het eerste agent()-call mislukte (de cache werkt op een ongebroken reeks).
- **Zichtbaar tijdens het werk (wens Stijn):** bij de start van een workflow het takenpaneel tonen
  (daar loopt de voortgang per agent en fase live mee; in de terminal: /workflows), de tijdlijn
  (https://claude.ai/artifact/6LXkS8KpLeqJfkXLYPrg3L) bijwerken met het blok dat loopt en welke
  agents er per fase aan werken, en na elke deploy de live app openen in het browserpaneel.

## Praktisch
- Git/gh niet in PATH van de tool-shell: `export PATH="/c/Program Files/Git/cmd:/c/Program Files/GitHub CLI:$PATH"` (Bash) of absolute paden.
- Commits in het Nederlands, afsluiten met de `Co-Authored-By:`-regel van het model dat de commit maakt.
- Gabi (iPhone, Engels) test mee en schrijft soms zelf in de chat — in het Engels antwoorden.
- Open bugs/wensen: zie PLAN.md §0 (rijen van 29/30-09) en docs/DEVICE-TEST.md.
- Blok B t/m E staan nog niet op de telefoons getest (DEVICE-TEST rijen 41–51). Stijn doet dat
  pas als E, F en G af zijn; vanaf blok G via de handleiding in plaats van het testdocument.
