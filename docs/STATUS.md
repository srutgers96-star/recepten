# Status — Rutgers' Recepten (bijgewerkt 3 oktober 2026)

Lees dit eerst in een nieuwe Claude Code-sessie, samen met CLAUDE.md (invarianten) en PLAN.md §0 (besluiten).

## Online (https://srutgers96-star.github.io/recepten/)
Fase 0–4 compleet + fase 5 blok A, A-bis, B, C, D en E (3 oktober 2026). Repo: https://github.com/srutgers96-star/recepten.

## Lokaal gecommit, nog NIET gepusht
(niets — alles staat online)

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

## PAUZE tot volgende week — pas verder als Fable weer beschikbaar is (besluit Stijn, 3 okt 2026)
Blok E en de kleine wensen van 3 okt zijn gebouwd met Claude **Opus 5.5** (Fable-limiet bereikt).
De gebruikelijke reviewronde van de E-workflow is bewust overgeslagen om de weeklimiet te sparen;
er was alleen een lichte eigen controle. Daarom, als eerste stap van de volgende sessie, vóór blok F:
1. **Fable loopt het Opus-werk na** (review + fix waar nodig):
   - data/ingredients.json: de nieuwe supermarktproducten — Brits-Engelse vertalingen, meervouden,
     gangpaden, dieetvlaggen (vegan/veg/gluten), perishable/staple, dubbelen met bestaande entries;
   - tests/parser.golden.json: veranderde toewijzingen van receptregels (geen "kapingen");
   - src/screens/DictionaryScreen.tsx (+ IngredientPicker.tsx, i18n/edit.ts, settings.css): gangpadfilter,
     entry-weergave, Nieuw ingrediënt, prestaties bij ±2000 entries;
   - src/screens/CookScreen.tsx "Alles klaar ✓"; src/voice.ts canListen() uit op iOS;
   - DEVICE-TEST rij 51 (zekerheidscheck) staat erin — Stijn doet die op de telefoons;
   - **landingsbundel**: de Safari-deelpagina voor iPhone laadt het woordenboek mee (gedeelde chunk
     share-*.js groeide van 46 naar 107 kB gzip). Woordenboek uit de landingsbundel houden
     (er staat een losse taak-chip voor klaar);
   - suggesties van de data-agents die NIET zijn toegepast (aliassen op bestaande entries zoals
     elstar/jonagold → appel, philadelphia → roomkaas; qualifier "platte" → "flat-leaf peach";
     "plantaardige" als vegan in diet.ts): beoordelen;
   - DATA_VERSION staat nog op 3: de 2 verbeterde receptregels bereiken de telefoons pas na een bump.
   Het merge-rapport met alle details staat in het workflow-journal van run wf_c22cac7a-4bf.
2. Daarna pas **blok F** (raakt het deel-contract, invariant 4 — op Fable met volledige review).

## Daarna, blok voor blok, elk apart online — volgorde (bijgewerkt 6 okt 2026)
1. Fable-review van het Opus-werk (zie PAUZE hierboven)
2. F vrienden via link/QR + varianten (docs/phase-5-spec.md "Block F")
3. **Fase 6 — Stijns wensenlijst van 6 okt**, uitgewerkt in **docs/phase-6-spec.md**:
   6A snelle verbeteringen en bugs (import-bug naam NL/EN, curator-ingrediënten, "Gekookt" zonder
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

## Praktisch
- Git/gh niet in PATH van de tool-shell: `export PATH="/c/Program Files/Git/cmd:/c/Program Files/GitHub CLI:$PATH"` (Bash) of absolute paden.
- Commits in het Nederlands, afsluiten met de `Co-Authored-By:`-regel van het model dat de commit maakt.
- Gabi (iPhone, Engels) test mee en schrijft soms zelf in de chat — in het Engels antwoorden.
- Open bugs/wensen: zie PLAN.md §0 (rijen van 29/30-09) en docs/DEVICE-TEST.md.
- Blok B t/m E staan nog niet op de telefoons getest (DEVICE-TEST rijen 41–51). Stijn doet dat
  pas als E, F en G af zijn; vanaf blok G via de handleiding in plaats van het testdocument.
