# Spec Z — De handleiding (Meer → Handleiding), zoekbaar, tweetalig, met een Markdown-uitvoer

Status: compleet (Fable, 8 nov 2026). Eén blok, vier schrijvers + één UI-bouwer + integrator (lichte modus; de lens is een
feitencheck tegen de code). Bron: Stijn (3 okt 2026): "geen testpagina's meer maar gewoon een mooi zoekbaar bestand om alle
functionaliteiten goed te kunnen verkennen", als laatste blok, "als alles helemaal goed is"; (6 okt) een tweede versie "achter de
schermen" voor Stijn. STATUS "Blok Z" stelde voor: in de app als Meer → Handleiding, tweetalig, zoekveld, onderwerpen in een
logische volgorde, per functie wat het doet · waar je tikt · wat je dan ziet, tekst in een databestand. **Besluit Fable (8 nov):
beide vormen** — in de app, én als gegenereerde Markdown-bestanden (docs/HANDLEIDING.md en docs/HANDBOOK.md) zodat Stijn en Gabi
ook buiten de app kunnen zoeken. De versie achter de schermen schrijft Fable zelf als docs/ACHTER-DE-SCHERMEN.md (geen bouwwerk).
Leidend bij tegenspraak: docs/specs/README.md §2; CLAUDE.md invariant 5 (iPhone: plakken blijft de route) en 13 (timers beloven
niets dat niet bewezen is); de UI-teksten in src/i18n/*.ts zijn de enige bron voor knopnamen.

**Kritische lezer.** (1) Een handleiding die iets belooft wat de app niet doet is erger dan geen handleiding: elke schrijver
controleert elke "waar je tikt"-stap tegen de code (de i18n-sleutel van de knop en het scherm waar hij staat) en elke "wat je
ziet"-zin tegen het scherm; de lens doet dat nog eens steekproefsgewijs met reproductie. (2) Platformverschillen staan eerlijk in
het stukje "Goed om te weten", in de woorden van CLAUDE.md invariant 5/13 en PLAN.md §3 (VERIFIED/LIKELY), nooit ruimer. (3) De
handleiding mag de hoofdbundel niet zwaarder maken: de data wordt lazy geladen op het scherm zelf; de Safari-landing raakt niets.
(4) Knopnamen in de tekst zijn letterlijk de NL- respectievelijk EN-tekst uit src/i18n (vet), geen vertaling uit het hoofd. (5)
Eén handeling per zin, geen jargon (geen "service worker", "token", "standalone", "bundle", "override", "sheet" — zeg "venster"),
geen zinnen met twee stappen; geheugen van Stijn: "ik snap best veel vragen niet".

**Feitencheck (8 nov).** De app heeft vijf tabbladen (Home, Recepten, Week, Boodschappen, Meer; `src/components/Nav.tsx`) en in
Meer vier groepen: Jij & je huishouden (Mijn profiel, Profielen beheren, Huishouden, Badges, Kookkalender, Jouw stijl), Instellingen,
Recepten & delen (Stuur nieuwe naar …, Controleer mijn recepten, Woordenboek), Opslag & back-up, Hulp & over (Feedback voor Stijn,
Links, Apparaatcheck, Het verhaal, Over). Routes: `#/`, `#/recipes`, `#/recipe/<id>`, `#/cook/<id>`, `#/add`, `#/edit/<id>`,
`#/share`, `#/inbox`, `#/week`, `#/shopping`, `#/more`, `#/more/profiles|profile|storage|check-recipes|household|dictionary|
badges|style|calendar`, `#/story`, `#/check`, `#/onboarding`. docs/DEVICE-TEST.md heeft 88 Engelse en evenveel Nederlandse
testrijen (8–108) met per functie "waar je tikt" en "wat je ziet": de grondstof voor de schrijvers. Data-bestanden worden
geïmporteerd via de alias `@data/…` (src/challenges.ts); `tools/validate-data.ts` valideert elk databestand; `queryTerms` in
`src/domain/search.ts` normaliseert zoektermen (kleine letters, accenten weg).

## 1. Doel en gebruikersgedrag

- **Meer → Hulp & over → 📖 Handleiding** (EN **Handbook**), de eerste rij van die groep; route `#/more/handbook`.
- Bovenaan een **zoekveld** ("Zoek in de handleiding" / "Search the handbook", 16 px) dat op elke letter filtert; daaronder een
  rij **onderwerp-chips** in vaste volgorde (§2) die naar het onderwerp scrollen. Zonder zoekterm: alle onderwerpen met hun
  korte inleiding en hun onderwerpen als ingeklapte rijen (titel + eerste zin van "Wat het doet"). Tik op een rij → hij klapt uit.
- Met zoekterm: alleen de rijen die passen (alle termen komen voor in titel, tekst, stappen of trefwoorden van de huidige taal),
  uitgeklapt, gegroepeerd per onderwerp in de vaste volgorde; niets gevonden → "Niets gevonden voor '…'. Probeer een ander woord."
- Elke uitgeklapte rij toont, in deze volgorde en met deze kopjes: **Wat het doet** (1–3 zinnen) · **Waar je tikt** (genummerde
  stappen, één handeling per stap) · **Wat je dan ziet** (1–3 zinnen) · optioneel **Goed om te weten** (eerlijke grenzen,
  platformverschil) · optioneel een knop **Open** die de route van het onderwerp opent (bv. `#/shopping`). Een onderwerp dat
  alleen op Android of alleen op de iPhone bestaat, draagt een klein chipje "Android" of "iPhone".
- Taal volgt de app-taal (NL/EN) zoals alles.
- **Markdown-uitvoer**: `node --experimental-strip-types tools/handbook-md.ts` schrijft docs/HANDLEIDING.md (NL) en docs/HANDBOOK.md
  (EN) met inhoudsopgave uit dezelfde data; beide worden meegecommit en bij elke tekstwijziging opnieuw gegenereerd (de validator
  waarschuwt als ze ouder zijn dan de data).
- docs/DEVICE-TEST.md blijft bestaan als controlelijst voor de bouw (de gate kijkt ernaar), maar is niet langer wat Stijn en Gabi
  lezen; de handleiding vervangt het voor hen. Het scherm **Apparaatcheck** blijft (het meet wat de telefoon kan; het is geen
  testpagina).

## 2. Inhoud: de onderwerpen (vaste volgorde) en wat er minstens in moet

Elke schrijver maakt zijn onderwerpen compleet: elk schermonderdeel dat een gebruiker kan tegenkomen krijgt een rij. Minimum
per onderwerp hieronder; de schrijver voegt toe wat hij in de schermen en in DEVICE-TEST nog meer vindt. Per rij: `what`, `where`
(stappen), `see`, optioneel `know`, `route`, `platform`, 3–8 `keywords` per taal (synoniemen die iemand zou intypen, bv.
"afvinken, vinkje, streep").

1. **eerste-keer — Eerste keer / Getting started** (schrijver W1): installeren op Android (Chrome → Installeren) en iPhone
   (Safari → Deel → Zet op beginscherm); je naam en kleur (profiel); taal; wat Home laat zien (de dag, je naam/avatar, Vanavond,
   de compacte week, de rijen); de vijf tabbladen; een nieuwe versie ("Nieuwe versie — vernieuwen", nooit vanzelf); de twee
   installaties (main en next: "de testversie met het andere icoon en eigen gegevens"); toestemming voor opslag; de browsermelding
   en "Open in Chrome" (Android).
2. **recepten — Recepten / Recipes** (W2): bladeren, zoeken (naam, ingrediënt, keuken, categorie), sorteren, filters (dieetchips,
   labels, keukens met vlaggen, categorieën, bijgerechten); de receptpagina (porties schalen, °C/°F, foto's, groene ingrediënten in
   de stappen en de hoeveelheid met één tik, notities, favoriet, printen & kopiëren); versies als tabs (glutenvrij/vegetarisch/
   vegan/lactosevrij: voorstel met stippellijn, goedkeuren, "Ook als …", de gekozen versie volgt je); eigen versie en Tip van de
   maker; eigen recept maken (de +: de vier keuzes, de editor: ingrediëntregels, ?-chips en de woordkiezer "variant of nieuw?",
   stappen, Labels als laatste stap, de AI-prompt die keuken en categorie invult); plakken van een AI-antwoord of website (lege
   regels, haakjes, labels); Controleer mijn recepten; selecteren (labels, verwijderen, delen, QR); Engels toevoegen; klassiekers
   versus eigen recepten (een aangepaste klassieker).
3. **koken — Koken / Cooking** (W3): kookstand (stappen, swipen, groene ingrediënten, voorlezen aan/uit per stap, 🔊), timers
   (uit een stap, de kookbalk onderaan: waar je bent, twee recepten tegelijk, klaar met koken), timergeluid en trillen, wat er
   gebeurt met het scherm uit of de app op de achtergrond (eerlijk per platform: ADR-0001), spraakcommando's (Android; "volgende",
   "timer 10 minuten", de ?-knop), Gekookt! (het venster: sterren, foto, later beoordelen, Bewaar bovenaan; Gekookt zonder
   kookstand), de kookkalender.
4. **week-en-boodschappen — Week & boodschappen / Week & shopping** (W3): het weekplan (Kies 7, Verras me, meer kiezen, vastzetten,
   wisselen, bijgerecht erbij, de gekozen versie), de boodschappenlijst maken, afvinken, Heb ik al, aantallen en eenheden zelf
   typen, het × om een regel weg te halen, lang indrukken (houd-menu: aantal aanpassen, verwijderen, vaste lijst), winkelstand,
   Klaar, Leeg de lijst, de categorieën/gangpaden en hun kleuren, de vaste lijst (Elke week: beheren, Heb ik al, Ook voortaan,
   zonder weekplan), de lijst delen (als tekst, als link, als QR) en een gedeelde lijst ontvangen ("Zet op mijn lijst").
5. **delen-en-ontvangen — Delen & ontvangen / Sharing & receiving** (W4): wat je kunt delen (recept, weekplan, kaartje, voortgang,
   lijst, meerdere recepten als bestand), de drie vormen (link, QR, tekst/bestand) en wanneer een QR te groot is; ontvangen op
   Android (deelmenu, een link opent de app) en op de iPhone (kopiëren → app openen → Plak uit klembord: de iPhone opent de app
   nooit vanzelf; CLAUDE.md invariant 5); In & uit (plakken, bestand kiezen, de kaartjes, "Heb je al", conflicten "kies een kant");
   Stuur nieuwe naar … (het huishouden eerst, het rode getal); het huishouden (kaartje delen, lid toevoegen, kleuren, wie kookte
   wat); Sync mijn voortgang (wat er wel en niet meegaat).
6. **woordenboek — Woordenboek / Dictionary** (W2): wat het woordenboek is (ingrediënten, eenheden, gangpaden), eigen
   ingrediënten (bekijken, bewerken, samenvoegen, verwijderen), "bestaat al", ontbrekende velden en de vertaalprompt, een
   ingrediënt uit een recept toevoegen (de ?-chip), waarom een regel grijs of groen is.
7. **badges-xp — Badges, XP en levels / Badges, XP and levels** (W4): hoe je XP verdient (koken, eigen recepten, foto's …; eerlijk
   over 0 XP), levels en de kleuren van de ring, de XP-balk; badges (groepen, de acht niveaus en hun kleuren, geheime badges en de
   "?"-kaartjes, de tegels en de details); Mijn profiel (tik op je avatar op Home of trek Home naar beneden); de avatar maken (de
   tabs, de tegels per zeldzaamheid: gewoon/zeldzaam/episch/legendarisch, slotjes, Verras me, huid- en haarkleur, de lijst/frame
   en de achtergronden en waarom je kleur altijd zichtbaar blijft); Jouw stijl (geluiden, confetti, letters, thema; het level-up-
   venster); uitdagingen (vanaf level 20: drie per maandag, één tegelijk, voortgang, Opgeven zonder straf, de badge Uitdager);
   gamification uit (wat je dan nog ziet).
8. **instellingen-en-opslag — Instellingen & opslag / Settings & storage** (W1): taal, thema, Fahrenheit, timergeluid en trillen,
   voorlezen, spraak, experimenten; Opslag & back-up (een back-up maken: delen of downloaden, met of zonder foto's; terugzetten;
   de herinnering; opslagruimte; de app resetten en wat je dan kwijt bent); profielen beheren (meer mensen op één telefoon; wat per
   profiel is).
9. **iphone-vs-android — iPhone en Android / iPhone and Android** (W1): één rij per verschil, in alledaagse woorden en eerlijk:
   ontvangen (deelmenu vs kopiëren-plakken), een link opent de app of niet, timers met het scherm uit, trillen, spraakcommando's,
   een bestand opslaan, een QR scannen (altijd met de camera-app), installeren en updaten, de melding "Open in Chrome"; het venster
   **Links** in Meer verwijst hiernaar.
10. **hulp — Hulp & over / Help & about** (W1): Feedback voor Stijn (wat er met je bericht gebeurt), Steun dit project, Het verhaal,
    Apparaatcheck (wat het meet en voor wie), deze handleiding (zoeken, de chips, Open), waar je de versie ziet.

## 3. Datamodel en bestanden

- `data/handbook/<nn>-<id>.json` per onderwerp (`01-eerste-keer.json` … `10-hulp.json`), elk:
  ```json
  { "id": "recepten", "order": 2, "title": { "nl": "Recepten", "en": "Recipes" },
    "intro": { "nl": "…", "en": "…" },
    "entries": [ {
      "id": "recepten.zoeken", "title": { "nl": "Een recept zoeken", "en": "Find a recipe" },
      "what": { "nl": "…", "en": "…" },
      "where": { "nl": ["Tik onderaan op **Recepten**.", "Tik bovenaan in het zoekveld en typ een woord."], "en": ["…"] },
      "see": { "nl": "…", "en": "…" },
      "know": { "nl": "…", "en": "…" },
      "route": "/recipes", "platform": "all",
      "keywords": { "nl": ["zoeken", "vinden", "ingrediënt"], "en": ["search", "find", "ingredient"] } } ] }
  ```
  Regels: `id` kebab-case met het onderwerp als voorvoegsel; `title/what/see` NL én EN niet leeg; `where` 1–8 stappen per taal,
  gelijk aantal in beide talen; `know` optioneel maar dan beide talen; `route` optioneel uit de vaste lijst in de validator (de
  routes van de Feitencheck zonder `<id>`); `platform` in `all | android | ios` (standaard `all`); `keywords` 3–8 per taal.
  Vet (`**…**`) alleen om knop- en schermnamen; verder geen Markdown. Knopnamen letterlijk uit src/i18n (de schrijver zet de
  gebruikte i18n-sleutels niet in de data maar in zijn rapport, per rij).
- `src/handbook.ts`: lazy loader (`import.meta.glob('../data/handbook/*.json')` of een dynamische import per bestand), normaliseert
  tolerant naar `HandbookSection[]` gesorteerd op `order`; `src/domain/handbook.ts` (framework-vrij): `normalizeHandbook`,
  `searchHandbook(sections, query, lang)` (termen via dezelfde normalisatie als `queryTerms`: kleine letters, accenten weg; een rij
  past als elke term voorkomt in titel, what, see, know, stappen of keywords van die taal; volgorde blijft), `handbookToMarkdown(
  sections, lang)` (voor het tool én testbaar).
- `src/screens/HandbookScreen.tsx` + `src/styles/handbook.css` (main.tsx importeert hem): kop met Header, zoekveld (16 px,
  `type="search"`, wist met ×), chip-rij (scrollt horizontaal, 44 px), secties met `<h2>`, rijen als `<details>`/`<summary>` of een
  knop met `aria-expanded` (44 px), de vier kopjes als `<h3>`, stappen als `<ol>`, Open als `.btn-link`. Werkt op 360 px zonder
  horizontaal scrollen; donker thema via de bestaande tokens.
- Route `#/more/handbook` in `src/app.tsx`/`src/router.ts` (patroon van `/more/calendar`); Meer-rij `📖 Handleiding` als eerste in
  de groep Hulp & over (`src/screens/MoreScreen.tsx`).
- i18n (src/i18n/settings.ts): `more.handbook` NL "Handleiding" / EN "Handbook"; `handbook.title` idem; `handbook.search` NL "Zoek
  in de handleiding" / EN "Search the handbook"; `handbook.none` NL "Niets gevonden voor '{q}'. Probeer een ander woord." / EN
  "Nothing found for '{q}'. Try another word."; `handbook.what` NL "Wat het doet" / EN "What it does"; `handbook.where` NL "Waar je
  tikt" / EN "Where you tap"; `handbook.see` NL "Wat je dan ziet" / EN "What you then see"; `handbook.know` NL "Goed om te weten" /
  EN "Good to know"; `handbook.open` NL "Open" / EN "Open"; `handbook.platform.android` NL/EN "Android"; `handbook.platform.ios`
  NL/EN "iPhone"; `handbook.intro` NL "Alles wat de app kan, per onderwerp. Typ een woord om te zoeken." / EN "Everything the app
  can do, by topic. Type a word to search."
- `tools/validate-data.ts`: `validateHandbook(files)` met de regels hierboven plus: unieke ids over alle bestanden, `order` uniek
  1..10, geen verboden jargon (lijst: service worker, standalone, token, bundle, override, sheet, cache, IndexedDB, manifest — in
  beide talen; "sheet" alleen EN-woordgrens) → fout; een `**`-naam die niet letterlijk in een i18n-waarde van die taal voorkomt →
  waarschuwing met de naam (de schrijvers lossen ze op; de integrator laat er hoogstens vijf staan en noemt ze in STATUS); de
  Markdown-bestanden ouder dan het nieuwste databestand → waarschuwing.
- `tools/handbook-md.ts`: schrijft docs/HANDLEIDING.md en docs/HANDBOOK.md (kop, één regel uitleg, inhoudsopgave met ankers, per
  onderwerp `##`, per rij `###` met de vier kopjes en de stappen genummerd, platformchip als "(Android)"/"(iPhone)", "Open" als
  tekst "In de app: Meer → …" weggelaten — alleen de route als `#/…` erbij tussen haakjes).

## 4. Schrijfregels (voor elke schrijver; de lens controleert erop)

1. Alledaagse taal; de lezer is Stijn of Gabi, geen ontwikkelaar. Geen woord uit de jargonlijst van §3.
2. Eén handeling per stap: "Tik onderaan op **Boodschappen**." — nooit "Ga naar Boodschappen en tik op Deel".
3. Knopnamen letterlijk uit src/i18n in de taal van de tekst, vet; de plaats erbij ("onderaan", "rechtsboven", "in het venster").
4. "Wat je dan ziet" beschrijft wat op het scherm verschijnt, in de tegenwoordige tijd; geen "zou moeten".
5. Eerlijk over grenzen: iPhone en achtergrond-timers in de woorden van CLAUDE.md invariant 5 en 13 / ADR-0001; nooit "de link
   opent de app" zonder "op Android".
6. Brits Engels (colour, favourite, programme, organise); "tick" niet "check off"; "Home Screen" bij iPhone-installatie.
7. Geen verwijzingen naar blokken, fases, specs of data; geen interne namen (`#l=`, "envelope", "variant-id").
8. Zinnen van hoogstens ±20 woorden; "je/jij" in NL, "you" in EN.
9. Elke rij heeft de i18n-sleutels van de genoemde knoppen in het rapport van de schrijver, zodat de lens ze kan nalopen.
10. Twijfel over wat de app doet → lees de code of de DEVICE-TEST-rij; blijft het onduidelijk → laat het weg en meld het open.

## 5. Bestandsverdeling

| Wie | Raakt alleen |
|---|---|
| Schrijver W1 | `data/handbook/01-eerste-keer.json`, `08-instellingen-en-opslag.json`, `09-iphone-vs-android.json`, `10-hulp.json` |
| Schrijver W2 | `data/handbook/02-recepten.json`, `06-woordenboek.json` |
| Schrijver W3 | `data/handbook/03-koken.json`, `04-week-en-boodschappen.json` |
| Schrijver W4 | `data/handbook/05-delen-en-ontvangen.json`, `07-badges-xp.json` |
| UI-bouwer U | `src/domain/handbook.ts`, `src/handbook.ts`, `src/screens/HandbookScreen.tsx`, `src/styles/handbook.css`, `src/main.tsx` (import css), `src/app.tsx`, `src/router.ts`, `src/screens/MoreScreen.tsx` (één rij), `src/i18n/settings.ts` (de sleutels van §3), `tools/validate-data.ts` (`validateHandbook` + aanroep), `tools/handbook-md.ts`, `tests/handbook.test.ts`, `package.json` NIET (geen script-regel nodig; het tool draait met node) |
| Integrator | samenvoegen, `npm run validate:data` groen (waarschuwingen ≤ 5 vette namen), `node --experimental-strip-types tools/handbook-md.ts` draaien en docs/HANDLEIDING.md + docs/HANDBOOK.md meenemen, dev-app-check (§6), docs/STATUS.md, één regel "Gebouwd" onder deze spec; geen DEVICE-TEST-rij |

De schrijvers werken tegen het datamodel van §3 zonder op de UI-bouwer te wachten; ze controleren hun JSON met `node -e
"JSON.parse(require('fs').readFileSync(...))"` en met de validator zodra die er is (anders meldt de integrator het).

## 6. Testplan en acceptatie

- tests/handbook.test.ts: `normalizeHandbook` leest de echte tien bestanden (10 secties, ≥ 70 rijen, elke rij compleet in beide
  talen, gelijk aantal stappen); `searchHandbook` vindt "afvinken" en "tick" in het boodschappen-onderwerp, is accent-ongevoelig
  ("ingredient" vindt "ingrediënt"), geeft leeg bij onzin en behoudt de volgorde; `handbookToMarkdown` begint met de titel en
  bevat elke rij-titel precies één keer; validator-tests: jargon → fout, ontbrekende EN → fout, `route` buiten de lijst → fout,
  ongelijk aantal stappen → fout.
- Dev-app (integrator, 375 px en 360 px, NL en EN, licht en donker): Meer → Hulp & over → Handleiding opent; tien chips; tik op
  "Boodschappen" scrollt ernaartoe; typ "QR" → alleen passende rijen, uitgeklapt, uit minstens twee onderwerpen; wis → alles terug;
  een rij met Open brengt je naar dat scherm en Terug brengt je terug in de handleiding; geen horizontale scroll; het zoekveld
  zoomt niet op de iPhone (16 px).
- `npm run build`: de hoofdbundel groeit niet meetbaar (de handleiding is een eigen chunk); `landing-*.js` ongewijzigd.
- docs/HANDLEIDING.md en docs/HANDBOOK.md staan in de commit en komen overeen met de data (validator zonder waarschuwing
  "ouder dan").

## 7. Opus mag dit NIET zelf beslissen

- De onderwerpen, hun volgorde of hun ids; een extra kopje in een rij; een andere plek dan Meer → Hulp & over.
- Een bewering over iPhone/achtergrond/timers die ruimer is dan CLAUDE.md invariant 5/13 en ADR-0001.
- Een knopnaam anders schrijven dan src/i18n hem heeft; een jargonwoord toch gebruiken.
- Een dependency (geen zoekbibliotheek, geen Markdown-renderer: de tekst kent alleen `**vet**`).
- DEVICE-TEST.md inkorten of verwijderen (dat is een later besluit van Stijn).

## 8. Niet in dit blok

docs/ACHTER-DE-SCHERMEN.md (Fable schrijft hem na de bouw), het opruimen van DEVICE-TEST.md, een "Testen & nakijken"-pagina,
schermafbeeldingen in de handleiding, een zoekveld met markering van de gevonden term.
