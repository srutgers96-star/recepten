# Status — Rutgers' Recepten (bijgewerkt 9 oktober 2026)

Lees dit eerst in een nieuwe Claude Code-sessie, samen met CLAUDE.md (invarianten) en PLAN.md §0 (besluiten).

## Online (https://srutgers96-star.github.io/recepten/)
**Fase 5 compleet** (fase 0–4 + blok A t/m F, 8 oktober 2026) **+ fase 6 blok 6A-1** (9 oktober 2026).
Repo: https://github.com/srutgers96-star/recepten.

## Lokaal gecommit, nog NIET gepusht
(niets — alles staat online)

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
**Volgende: 6A-2** (plak/prompt-cluster: 9, 10, 13, 14-rest, 16, 17) — vraag Stijn/Gabi eerst om 10–15
echte plakteksten van hun receptensites als testmateriaal.

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
