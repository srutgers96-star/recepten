# Status — Rutgers' Recepten (bijgewerkt 15 oktober 2026)

Lees dit eerst in een nieuwe Claude Code-sessie, samen met CLAUDE.md (invarianten) en PLAN.md §0 (besluiten).

## Online (https://srutgers96-star.github.io/recepten/)
**Fase 5 compleet** (fase 0–4 + blok A t/m F, 8 oktober 2026) **+ fase 6 blok 6A** (6A-1 9 okt, 6A-2 15 okt)
**+ ronde 13 okt deel 1** (15 okt). Repo: https://github.com/srutgers96-star/recepten.

## Lokaal gecommit, nog NIET gepusht
(niets — alles staat online; de tijdelijke branch wip/6a2-partial is na 6A-2 verwijderd)

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
