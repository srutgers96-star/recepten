# Ideeën voor later — Rutgers' Recepten

Losse ideeën van Stijn (en Gabi). Sinds 8 nov 2026 staat bovenaan **het plan** (Fable): welke ideeën in welke volgorde een
bouwblok worden, hoe groot, wat eerst beslist moet worden. Een idee wordt pas gebouwd als Stijn zegt: dit gaan we bouwen;
daarna krijgt het een spec in docs/specs/ en een rij in docs/specs/README.md §1b.

**Nieuw idee?** Onderaan toevoegen met datum en van wie, in dit formaat:
wens · prioriteit · wat we al weten · aanpak in grote lijnen · open vragen · hangt af van. Fable vult daarna de
**Uitwerking** aan (ontwerp, data, bestanden, grootte, wat Stijn moet beslissen).

---

## Plan: de ideeënronde (Fable, 8 nov 2026)

Het hoofdplan (README §1, veertien blokken) is af sinds 8 nov. Wat Stijn daarna vraagt, gaat in **verbeterrondes** (V-blokken):
klein, snel live, elk met een eigen spec. Dit is de voorgestelde volgorde; Stijn mag omgooien.

| Blok | Inhoud | Uit idee | Grootte | Stijn beslist eerst |
|---|---|---|---|---|
| **V1** | Handleiding ingeklapt en dubbel uitklapbaar · Meer opgeruimd (Badges-rij weg, huisgenoten onder Mijn profiel, Profielen-ingangen weg) · gekozen chips vooraan met kruisje, na drie uur vergeten | Stijns berichten 8 nov | M | — (live op main 8 nov, spec verbeterronde-1.md) |
| **V1b** | Meer: gecentreerd profielblok, tussenkop Huishouden & vrienden met gelabelde leden, Jouw stijl-rij weg, Confetti/Badges-tekst opent de pagina, Trillen zonder hint, Temperatuur °C/°F/beide · Home: "Verder met" na 3 uur weg en wegklikbaar, datum opent de kookkalender · receptkop compact met klokje · Mijn profiel: potlood rechtsonder, knipoog · selectie-ring volgt de lijstvorm · voorraaddrempel 100 g · uitdagingen +1 % per level (was V3) | Stijns tweede bericht 8 nov + idee 11 | M | — (in aanbouw, spec verbeterronde-1b.md) |
| **V2** | Delen zonder bestanden (links tot 20 KB, anders meerdere berichten; bestand alleen als laatste redmiddel) · bestandsnaam met de uitleg erin + knop "Stuur ook de uitleg" · Android-hint in In & uit · afzender met avatar op de inbox-kaarten · avatar uit een voortgangskaart overnemen · kalenderlegenda met mini-avatars | 13 + 12 | M | — (live op main 8 nov, spec verbeterronde-2.md) |
| **V3** | Avatar-ronde (Stijn 8 nov, derde bericht): poppetje iets kleiner in de lijst zodat haar en hoeden niet achter de lijst vallen, niveauring alleen op de kale cirkel (het "rare dunne randje" wás die ring), haar-revamp, zes grappige brillen na level 30 (twee ingrediënt-gebonden), zes kook-onderdelen, vijftien onderdelen met een te lage zeldzaamheid hersteld (levelregel ongewijzigd), tegel Verras me per laag; V3b: hoeden bedekken het haar (randlijn per hoed) | nieuw (idee 14) | M | — (live op main 8 nov: verbeterronde-3.md + verbeterronde-3b.md) |
| **V4** | Dopamine-kick bij Gekookt!: het woord groot, XP-balk die oploopt, ontgrendeling "Snelle vieringen" op level 30 | 9 | M | — (live op main 8 nov, spec verbeterronde-4.md) |
| **V5** | Vrijspeel-rijkdom (Stijn 8 nov, vierde bericht): confetti-ladder dubbel → trippel → quadruppel en acht nieuwe confetti-ontwerpen tot level 88; acht nieuwe timergeluiden die mensen herkennen of die steeds gekker worden (marimba, Ode an die Freude, Mozart, koekoek, haan, huilende baby, modem, misthoorn), gesynthetiseerd zoals de bestaande; het **gouden thema** (donkere basis, gouden accenten, goed leesbaar) als ontgrendeling op level 100 én als makers-ei: 33 keer tikken op Versie | nieuw (idee 15) | M–L | — (live op main 8 nov, spec verbeterronde-5.md) |
| **V6** | Gabi's WhatsApp-lijstje plakken met voorstellen (controlestap) · vooraf een data-ronde woordenlijst | 7 + 8 | M + S (data) | — (live op main 9 nov, spec verbeterronde-6.md) |
| **V7** | Boodschappen-badges over de ingrediënten (Verzamelaar, Groenteboer, Kaasmeester, Kruidenkast, Alfabet, …) mét avatar-beloningen (vier badge-gebonden onderdelen, waaronder minstens één bril); daarna de 30-jaar-simulatie opnieuw draaien en zo nodig de curve bijstellen | 4 | M | — (live op main 9 nov, spec verbeterronde-7.md) |
| **V8** | Van links naar rechts swipen door de vijf tabbladen | 6 | S–M | doorlopen aan de randen? (voorstel: nee) |
| **V9** | Voedingswaarden en macro's: eerst grammen-dekking (data), dan nutrition.json (data), dan één subtiele kcal-regel op de receptpagina met een uitklap voor de macro's | 1 | L (drie stappen) | — (Stijn 8 nov: subtiel, kcal in het recept, waarden bij de ingrediënten, details alleen in een uitklap; geen weektotalen) |

Afgerond en hier alleen nog als geschiedenis: **3** (uitdagingen, blok 6E) en **5** (swipe omlaag → Mijn profiel, blok 6D-S).
Volgorde na V1b (Stijn 8 nov): **V2 → V4 → V6 → V7 → V8 → V9**. Open punten uit de eindcontrole: de Engelse pass/fail in de
Apparaatcheck blijven (Stijn: "geen klachten over het Engels"); de chip-ring volgt de lijstvorm (V1b); de dubbele route naar de
avatar-maker blijft zo.
Niet gepland (geen idee, wel een antwoord): nagerecht/gebak/ontbijt-lunch bestaan als categorie en chip sinds 6B, maar geen van
de 216 recepten is er een (de lijsten "overig" en "oven" bevatten geen toetjes), dus er valt nu niets te labelen.

Werkwijze per V-blok: Fable schrijft de spec (met "Opus mag dit NIET zelf beslissen"), Opus bouwt via de lichte workflow,
Haiku-gate, direct naar main, handboekrij + DEVICE-TEST-rij, STATUS-alinea. Richtgetal: V2–V5 passen samen in één weekbudget.

---

## 1. Voedingswaarden en macro's (Stijn, 17 okt 2026)

**Wens.** Algemeen inzicht: veel mensen willen weten wat ze kiezen of eten. Op de receptpagina staat
klein "≈ 620 kcal p.p."; een subtiel uitklapmenu toont de details (eiwit, vet, koolhydraten en meer).
Klein en rustig, ook uitgeklapt.

**Prioriteit.** Leuk voor later, geen haast. **Eerst het XP/level-plan (6D) en de rest afmaken.**

**Ideeën van Stijn erbij.**
- **Badges** voor totalen, zoals "totaal eiwit gekookt" of "10.000 kcal gekookt". Die passen in het
  XP/badge-systeem van 6D, dus pas daarna. Houd ze bij koken als prestatie, niet bij lijnen (geen
  beloning voor "weinig calorieën").
- **Zelf aanvullen en aanpassen.** Waarden toevoegen waar ze ontbreken, of aanpassen (een ander merk,
  een andere regio). Net als eigen ingrediënten: een aanpassing per ingrediënt op het toestel, die mee
  gaat in de back-up.

**Wat we al weten (meting 17 okt).** Het lastige is niet de voedingsdata, maar elke receptregel
omrekenen naar grammen. Van de 1883 regels in de 196 klassiekers:

| Soort regel | Deel | Nu al in grammen? |
|---|---|---|
| Gewicht (g, kg) | 32% | ja |
| Stuks mét gewicht per stuk ("1 ui") | 23% | ja |
| Volume (ml, el, tl) | 32% | nee: gram per ml of per lepel per ingrediënt nodig |
| Stuks zónder gewicht (prei, laurierblad, takje tijm) | 8% | nee: `gramsPer` ontbreekt |
| Geen hoeveelheid ("naar smaak") | 5% | mag weg |

Dus nu ±55%; naar ±95% is vooral omrekenwerk (ook goed voor de boodschappenlijst). Maar **371 van de
1603** woordenboek-ingrediënten komen in de klassiekers voor: daar begin je.

**Aanpak in grote lijnen.**
- **Bron:** NEVO (de Nederlandse voedingsstoffentabel van het RIVM) voor Nederlandse producten
  (rookworst, ontbijtkoek, hagelslag); USDA FoodData Central (publiek domein) voor de rest. NEVO is
  gratis te gebruiken met bronvermelding: de actuele voorwaarden van het RIVM nalezen vóór het live
  gaat. Open Food Facts liever niet (share-alike-licentie, waarden per merk).
- **Opslag:** een apart bestand (bijvoorbeeld `data/nutrition.json`) met waarden per 100 g per
  ingrediënt-id plus de NEVO-code als bron, met een eigen validator (kcal ≈ 4·eiwit + 4·koolhydraten +
  9·vet). Vullen in batches zoals de vertalingen, meest gebruikte eerst.
- **Altijd berekend uit de regels:** schalen, glutenvrije versies en bewerkte recepten kloppen dan
  vanzelf. De deellink verandert niet (invariant 4 blijft heel).
- **Eerlijk tonen:** "≈ 620 kcal p.p. · 92% van de ingrediënten bekend". Niet in de kookstand. Een
  instelling om het uit te zetten.

**Valkuilen.** Droog of gekookt gewicht (pasta en rijst staan droog in recepten). Frituur- en bakolie
(maar deels opgegeten). Bouillon (blokje plus een liter water). Optionele garnering wel of niet tellen.
Eigen ingrediënten hebben geen waarden, tot iemand ze invult.

**Open vragen.**
1. Welke waarden komen in het uitklapmenu? Kcal plus de drie macro's zeker; vezels, suiker en zout ook?
2. Ook weektotalen in het weekplan, of alleen per portie?
3. Staat het standaard aan of uit?

**Hangt af van.** XP/badges (6D) voor de badges. Het omrekenen naar grammen kan los en eerder, bijvoorbeeld
als sjouwwerk voor Haiku, omdat het ook de boodschappenlijst helpt.

**Uitwerking (Fable, 8 nov 2026) — blok V9, drie stappen, L.**
- **Stap 1 · grammen-dekking (data, Haiku-sjouwwerk met Fable-controle).** Twee nieuwe velden in `data/ingredients.json`:
  `gramsPerPiece` (één prei = 150 g, één laurierblad = 0,2 g) en `gramsPerMl` (dichtheid: olie 0,92, bloem 0,55, suiker
  0,85; water-achtig = 1). Eerst de 371 ingrediënten die in de klassiekers voorkomen, daarna de rest in batches zoals de
  vertalingen (tools/apply-llm-batch.ts als voorbeeld). Validator: dichtheid tussen 0,2 en 2, stukgewicht tussen 0,1 g en
  5 kg. `tools/measure-parse.ts` krijgt een kolom "gram-dekking" (nu ±55 %, doel ≥ 95 %). Dit helpt meteen de
  boodschappenlijst: "2 el olie + 50 ml olie" telt dan op.
- **Stap 2 · nutrition.json (data).** `data/nutrition.json`: per ingrediënt-id `{ kcal, eiwit, vet, kh, vezels, zout,
  bron }` per 100 g product zoals het in het recept staat (pasta en rijst droog, zoals NEVO ze ook geeft); `bron` = NEVO-code
  of USDA-id. Validator: kcal binnen 15 % van 4·eiwit + 4·kh + 9·vet, geen negatieve waarden, elke id bestaat. Vullen in
  batches, meest gebruikte eerst; bronvermelding NEVO/RIVM in Het verhaal en onder Over. Eigen waarden van de gebruiker:
  per ingrediënt in het eigen woordenboek (6B), toestel-lokaal, mee in de back-up, winnen van de ingebouwde waarde.
- **Stap 3 · tonen (code).** `src/domain/nutrition.ts` (framework-vrij): per recept per portie uit de effectieve regels
  (dus na schalen, na een dieetversie, na eigen aanpassingen), met een dekkingspercentage (regels met bekende grammen én
  waarden / alle regels met een hoeveelheid; "naar smaak" telt niet mee). Op de receptpagina onder de metadata één rustige
  regel "≈ 620 kcal p.p. · 92 % bekend"; tik → uitklap met eiwit, vet, koolhydraten, vezels, zout per portie. Niet in de
  kookstand. Schakelaar **Voedingswaarden** onder Meer → Instellingen (voorstel Fable: standaard aan; het is informatie, geen
  oordeel). Weektotalen: pas als Stijn ze wil (ze zijn snel misleidend: wie eet welke portie).
- **Later, apart:** badges "Eiwitkampioen" en "10.000 kcal gekookt" uit kooklog × portiewaarden (alleen gekookte porties, nooit
  "weinig calorieën").
- **Bestanden:** data/ingredients.json, data/nutrition.json [nieuw], tools/validate-data.ts, tools/measure-parse.ts,
  src/domain/nutrition.ts [nieuw], src/screens/RecipeScreen.tsx (één regel + uitklap), src/i18n, tests/nutrition.test.ts.
- **Stijn (8 nov):** "subtiel met calorieën in recepten; de waarden bij de ingrediënten, verder niet standaard tonen; misschien bij
  calorieën een uitklap voor de macro's." Dus: één rustige kcal-regel op de receptpagina, de rest alleen in de uitklap, geen
  weektotalen, niets in lijsten of kookstand. Stap 1 en 2 zijn data-werk en kunnen eerder, los van de UI.

## 2. Archief van afgevinkte boodschappen (Stijn, 25 okt 2026)

**Wens.** Wat ooit is afgevinkt mag "een soort archief" in, in plaats van voorgoed weg. Nu kost permanent verwijderen
twee stappen (inhouden → verwijder); daarom is er sinds 25 okt de knop **Leeg de lijst** (met Ongedaan) om snel opnieuw
te beginnen.

**Prioriteit.** Later; eerst XP (6D).

**Aanpak in grote lijnen.** Bij "Klaar" en bij "Leeg de lijst" de afgevinkte regels (naam, hoeveelheid, datum) in een
klein archief bewaren (settings-key of tabel, toestel-lokaal, mee in de back-up); een rij "Eerder gekocht" onder
Boodschappen met zoeken en "zet terug"; automatisch opschonen na bv. 90 dagen. Kan samen met de vaste lijst (6C): wat je
vaak terugzet, is een kandidaat voor "elke week".

**Open vragen.** Alleen afgevinkt of alles wat van de lijst ging? Per huishouden of per persoon? Hangt af van 6C.

**Uitwerking (Fable, 8 nov 2026).** Gaat op in **V5** samen met idee 10 (dezelfde gegevens, twee ingangen: de kalender en de
rij "Eerder"). Zie de uitwerking bij 10.

## 3. Challenges, vrij op level 20 (Stijn, 6 en 28 okt 2026) — GEBOUWD (6E, 8 nov 2026)

**Status.** Gebouwd als blok 6E (docs/specs/challenges.md): één lopende uitdaging, elke maandag een aanbod van drie (licht,
middel, zwaar), bonus-XP plus de ladderbadge Uitdager; avatar-onderdelen als beloning zijn nog niet gedaan. Het vervolg staat
in idee 11 (beloningen die meegroeien met je level).

**Wat het is.** Vanaf level 20 krijg je opdrachten met een eigen beloning (XP, een badge of een avatar-onderdeel):
een doel, een termijn en een voortgangsbalk op je profiel; nooit verplicht, nooit een straf bij niet halen.

**Eerste ideeën (vrij aan te vullen).**
- Weekchallenges: "kook deze week drie keer vegetarisch", "twee recepten uit een keuken die je nog nooit kookte",
  "een nagerecht en een bijgerecht in één week".
- Maandchallenges: "vijf nieuwe klassiekers", "elke dag van de week één keer gekookt", "een foto bij elk gerecht".
- Seizoen en feest: "december: vier feestgerechten", "zomer: drie salades".
- Samen: dezelfde challenge voor het huishouden, met een gezamenlijke teller (pas na Sync mijn voortgang, 6D-4b).
- Verrassing: "de dobbelsteen kiest, jij kookt" (het eerste gerecht dat de dobbelsteen geeft).
- Zeldzaam: "kook alle 20 bijgerechten" (lang), "een recept uit elke keuken die je in huis hebt".

**Nog open uit deze lijst (niet gebouwd):** samen-uitdagingen met een gezamenlijke teller (kan pas eerlijk als beide telefoons
hun voortgang delen; dan telt elk zijn eigen deel en toont de kaart de som van de laatst gedeelde stand), en avatar-onderdelen
als beloning (een data-ronde: per zware uitdaging één onderdeel in data/avatar-parts.json met `unlock: challenge:<id>`).

## 4. Boodschappen-badges over de 1600 ingrediënten (Stijn, 29 okt 2026)

**Wens.** Boodschappen laten sinds de mini-ronde na 6D-2b een spoor na: per recept "boodschappen gekocht" (voor de
badge Hele cirkel) en per ingrediënt hoe vaak het is afgevinkt (setting `shop.bought.ings`, huishoud-breed en per lid).
Stijn: "daar kan nog best wat creativiteit in, met 1600 verschillende ingrediënten" — dit kan later uitgebreid worden.

**Prioriteit.** Later; het spoor telt vanaf nu, zodat de badges straks geschiedenis hebben.

**Ideeën voor badges (nog niet gebouwd).** Ladder "Verzamelaar": {n} verschillende ingrediënten gekocht (10 … 500).
Per categorie uit de woordenlijst: alle kruiden, alle verse kruiden, tien soorten kaas, vijf soorten rijst, vijf soorten
noten. "Groenteboer": {n} verschillende groenten. "Vismarkt" / "Slager": {n} vis- / vleessoorten. "Zeldzaam": een
ingrediënt gekocht dat in maar één recept voorkomt. "Vaste klant" (6C) kan hier ook naar kijken. Seizoen: in
december speculaaskruiden, in de zomer aardbeien. Geheim: 1 kg boter in één lijst; "Alfabet": een ingrediënt met elke
beginletter. Bronnen: `shop.bought.ings` + de woordenlijst (categorie per ingrediënt, data/ingredients.json).

**Open vragen.** Telt "Heb ik al" (in huis) mee als gekocht? (Nu: nee.) Per huishouden of per lid? (Nu: beide geteld.)

**Uitwerking (Fable, 8 nov 2026) — blok V7, M.**
- **Bron van de feiten.** `shop.bought.ings` (src/domain/shopbought.ts) kent per ingrediënt-id het aantal vinkjes, totaal en
  per lid (`by`). Daar komt één veld bij: `first` (ISO van het eerste vinkje per ingrediënt per lid) voor seizoensbadges en
  "wanneer". Hoeveelheden worden niet bewaard, dus "1 kg boter in één lijst" vervalt (eerlijk: niet te tellen).
- **Regels** (nieuw in src/domain/badges.ts, `BadgeFacts.bought`): `boughtDistinct { n, aisle? }` (verschillende ingrediënten,
  optioneel binnen één gangpad uit data/aisles.json), `boughtGroup { ids: string[], n }` (n uit een vaste lijst, bv. tien
  kaassoorten), `boughtRare` (een ingrediënt dat in precies één recept voorkomt), `boughtLetters { n }` (n verschillende
  beginletters), `boughtInMonth { id, months }` (speculaaskruiden in december, aardbeien juni–augustus).
- **Set (data/badges.json, groep "boodschappen", ±12):** Verzamelaar (ladder 10/25/50/100/200/350/500), Groenteboer (gangpad
  groente-fruit 10/25/50), Kaasmeester (gangpad kaas 5/10), Slager (vlees-vis, vleessoorten 10), Vismarkt (vis 5), Kruidenkast
  (kruiden-specerijen 10/25), Wereldwinkel (gangpad wereld 10), Zeldzaam (boughtRare, geheim), Alfabet (boughtLetters 26,
  geheim), Speculaastijd (boughtInMonth), Zomerkoninkjes (aardbeien in de zomer). Zeldzaamheid en XP volgens badges-avatar.md
  (ladder = 50 XP per trede, geheim = 250).
- **Besluiten Fable:** "Heb ik al" telt niet (je kocht het niet); per lid tellen (wie afvinkt, krijgt het; zoals alle XP), de
  huishoud-brede teller blijft voor statistiek. Alleen op Badges en in de toast; niets in de kalender.
- **Bestanden:** src/domain/shopbought.ts (`first`), src/domain/badges.ts, data/badges.json, tools/validate-data.ts (nieuwe
  regelsoorten), tests/badges.test.ts, tests/validate-badges.test.ts (aantallen), handboekrijen in 07. Geen UI-werk buiten de
  bestaande badge-schermen.
- **Avatar-beloningen (Stijn 8 nov, later die avond: "de nieuwe boodschappen-badges misschien een paar leuke nieuwe items, of
  linken met bestaande items, in ieder geval een bril"):** vier badge-gebonden onderdelen in data/avatar-parts.json
  (`unlock: { badge: … }`, zoals pastafarian → spaghettihaar): Verzamelaar trede 3 → `glasses-shopping` (bril met een prijskaartje
  aan de poot), Groenteboer → `pin-carrot` (wortelspeld), Kaasmeester → `hat-cheese` (kaaswig als hoedje), Alfabet (geheim) →
  `glasses-letters` (glazen in de vorm van een A en een Z). Zeldzaamheid: badge-onderdelen minstens zeldzaam, geheim episch.
- **Stijn (8 nov):** "Heb ik al" telt niet mee, en wees voorzichtig met badges over die producten (voorraadproducten als bloem
  en suiker dus niet als aparte badge-doelen). Na het bouwen de 30-jaar-simulatie (tests/xp.test.ts) opnieuw draaien: schuift
  level 100 meer dan ±10 % naar voren door de nieuwe badge-XP, dan de curve bijstellen (regelversie 4, eenmalige eerlijke melding).

## 5. Swipe omlaag op Home: profiel bijna paginavullend, avatar heel groot (Stijn, 29 okt 2026) — GEBOUWD (6D-S)

**Status (8 nov 2026).** Gebouwd in blok 6D-S als het scherm **Mijn profiel**: Home omlaag trekken (of op de begroeting tikken)
opent het, met de avatar op 60 % van de breedte, naam, level, XP-balk en de tegels. De aanvulling "Meer opschonen" gebeurt in
V1 (8 nov): Badges-rij weg, huisgenoten onder Mijn profiel, Profielen-ingangen weg.

**Wens.** Op Home naar beneden swipen (of vanaf de level-regel omlaag trekken) → het profiel vult bijna de hele pagina
en de avatar wordt heel groot, "zodat je heel de avatar met al zijn ditjes en datjes goed kan zien": alle lagen
(huid, haar, ogen, kleding, hoofddeksel, accessoire, achtergrond) op volle grootte, met naam, level, titel en XP-balk.

**Nog open uit dit idee:** een ander lid groot bekijken (tik op een huisgenoot → diens avatar groot). Klein; kan mee in V2
(huisgenoten-rijen op Meer → Huishouden → tik op de avatar → groot in een sheet).

## 6. Van links naar rechts swipen door de hoofdpagina's (Stijn, 29 okt 2026)

**Wens.** Horizontaal swipen om naar de volgende/vorige tab van de onderbalk te gaan (Home ↔ Recepten ↔ Week ↔
Boodschappen ↔ Meer), zoals in veel apps. "Zit vast nog wel een functionaliteit verborgen."

**Prioriteit.** Later.

**Aanpak in grote lijnen.** Eén touch-listener op de app-shell: horizontale beweging ≥ 60 px, duidelijk horizontaler
dan verticaal, en niet begonnen op een element dat zelf horizontaal scrolt of swipet (filterchips-rij, kookmodus met
`cookSwipe`, rijen met swipe-acties) → `navigate` naar de buur-tab, met een korte schuif-animatie (transform only).
Alleen op de vijf hoofdpagina's, niet in een recept, de editor of kookmodus.

**Let op.** De rand-swipe is op iPhone (Safari én Home Screen-app) en Android Chrome al "terug/vooruit": begin de
herkenning daarom pas ≥ 24 px van de schermrand. Niet laten botsen met de pull-down van idee 5.

**Open vragen.** Volgorde = volgorde van de onderbalk? Doorlopen (Meer → Home) of stoppen aan de randen?

**Uitwerking (Fable, 8 nov 2026) — blok V8, S–M.**
- `src/swipe.ts` [nieuw]: één `touchstart`/`touchmove`/`touchend` op `.shell`, alleen als de route één van de vijf tabbladen
  is (Home, Recepten, Week, Boodschappen, Meer) en niet in selectiestand of met een open sheet. Herkenning: start ≥ 24 px van
  de linker- en rechterrand; |Δx| ≥ 60 px én |Δx| > 2·|Δy|; niet begonnen in een element dat zelf horizontaal scrolt
  (`closest('.chips, .cook, .week-strip, [data-noswipe]')` of een element met `scrollWidth > clientWidth`). Daarna `navigate`
  naar het buur-tabblad.
- **Animatie:** de nieuwe pagina schuift 24 px in vanaf de kant van de beweging en vervaagt in 150 ms (alleen transform en
  opacity; class `.screen.slide-left/.slide-right` op de nieuwe pagina, verwijderd na `animationend`); `prefers-reduced-motion`
  → geen animatie.
- **Besluiten Fable:** volgorde = de onderbalk; stoppen aan de randen (geen doorlopen); de pull-down van Mijn profiel wint als
  de beweging eerst verticaal is (bestaande `usePullDown` meet dat al).
- **Bestanden:** src/swipe.ts, src/app.tsx (één hook), src/styles/base.css (twee animaties), DEVICE-TEST-rij op beide telefoons
  (iPhone-randswipe mag niet breken), handboekrij in 01 "De vijf tabbladen".
- **Stijn beslist:** doorlopen aan de randen ja/nee (voorstel: nee).

## 7. Gabi's WhatsApp-boodschappenlijstje plakken met voorstellen (Stijn, 30 okt 2026)

**Wens.** Gabi stuurt haar boodschappen als los WhatsApp-bericht, "een beetje een rotzooi", bijvoorbeeld:
"Coco acqua · Beetroot · Check ketchup · Pickles · Bread for breakfast". Stijn wil dat bij Boodschappen kunnen plakken
en dat de app "gewoon de goede dingen voorstelt en dan aan kan nemen ofzo": een ingrediënten-herkenner met een
tussenstap.

**Wat er al is (25 okt, "Leeg de lijst"-ronde).** Het plakvak "+ wc-papier, melk" onder Boodschappen herkent een
geplakte lijst met meerdere regels (`isShopList`/`splitShopList` in src/domain/shopinput.ts), haalt hoeveelheden en
eenheden eruit (`parseShopInput`) en koppelt elke regel aan de woordenlijst (NL en EN, 1603 producten). Onbekende
woorden komen als losse regel onder "Overig". Er is nog geen voorstel-stap: alles komt direct op de lijst.

**Prioriteit.** Later (Stijn: "kan ook later natuurlijk"); past goed bij 6C (vaste lijst) of de opschoonronde.

**Aanpak in grote lijnen.** Bij een geplakte tekst van ≥ 3 regels eerst een voorbeeldvenster: per regel de herkende
koppeling ("Beetroot → bietjes ✓", "Coco acqua → kokoswater?", "Check ketchup → ketchup (controleren)", "Bread for
breakfast → brood"), met per regel: aannemen (standaard als de koppeling zeker is), kiezen uit twee of drie
alternatieven uit de woordenlijst, of "als tekst houden". Daarna één knop "Zet op de lijst". Bouwstenen: de bestaande
fuzzy zoekindex (src/domain/search.ts), de aliassen in data/ingredients.json, en de IngredientPicker voor het
kiezen. Woorden als "check" / "controleer" worden een notitie bij de regel, geen product.

**Open vragen.** Alleen bij ≥ 3 regels of altijd? Ook voor de spraakinvoer? Leert hij van Gabi's keuzes (alias
toevoegen aan de woordenlijst, zoals 6B "Zet in woordenboek")?

**Uitwerking (Fable, 8 nov 2026) — blok V6, M (plus de data-ronde van idee 8 vooraf, S).**
- **Domein:** `suggestShopLines(text, dict, lang)` in src/domain/shopinput.ts: per regel `{ raw, qty, unit, match: { id,
  score } | null, alternatives: id[] (max 3, via de fuzzy index van search.ts over NL- én EN-namen en aliassen), note }`;
  "check/controleer/kijken of" wordt `note` en verdwijnt uit de productnaam; een `score` ≥ 0,85 heet zeker (groen ✓),
  0,5–0,85 twijfel (geel, alternatieven open), < 0,5 onbekend (grijs, "als tekst houden" standaard).
- **UI:** `ShopPasteSheet.tsx` [nieuw] opent bij een plak of spraakinvoer met ≥ 3 herkende regels (bij 1–2 regels blijft het
  directe gedrag, geen extra stap): per regel het voorstel als chip, bij twijfel twee of drie alternatieve chips, bij onbekend
  "Als tekst" en "Zoek…" (IngredientPicker). Onderaan één knop "Zet 7 regels op de lijst". Bestaande `addListLinesFromShare`-
  logica voor het plaatsen.
- **Leren:** een gekozen alternatief wordt een alias in het eigen woordenboek (`userIngredients`, zoals 6B "Zet in
  woordenboek"), zodat "coco acqua" de volgende keer meteen kokoswater is; zichtbaar en verwijderbaar onder Woordenboek.
  Besluit Fable: altijd leren, geen vinkje per regel.
- **Bestanden:** src/domain/shopinput.ts, src/domain/search.ts (alleen als de index een export mist), src/components/
  ShopPasteSheet.tsx [nieuw], src/screens/ShoppingScreen.tsx, src/i18n (shop.paste.*), tests/shopinput.test.ts (Gabi's
  voorbeeldlijst letterlijk als testgeval), handboekrij in 04.
- **Stijn (8 nov):** "is goed, als je dat kan maken klinkt het geweldig." Leren = ja.

## 8. Ingrediënten-upgrade: de woordenlijst uitbreiden (Stijn, 30 okt 2026)

**Wens.** Blok 13F (Stijns 22 recepten inbouwen) is vervallen (30 okt: "skipt weer een hoop en is niet nodig"), maar
de ingrediënten die daaruit voortkwamen moeten wél een keer in de woordenlijst komen. Dit is de verzamelplek voor
alles wat de woordenlijst (nu 1603 producten) nog mist.

**Uit 13F (inbouwen.md §2b), met exact deze ids zodat bestaande regels op beide telefoons blijven resolven:**
`nduja` (vlees-vis, g) · `panko` (droog, g, gluten) · `truffel` (groente-fruit, g) · `haas` (vlees-vis, g) ·
`foie-gras` (vlees-vis, g) · `keelspek` (vlees-vis, g) · `noilly-prat` (dranken, ml, alias "droge vermout") ·
`mokkaboontje` (snacks-zoet, stuk). Volledige entries met NL/EN one/many, gangpad, defaultUnit, staple, veg/vegan/
gluten/lactose. Van Stijns 12 eigen ingrediënten in de export van 13 okt zijn dit de 8 echte producten; de andere
vier zijn bestaande producten onder een andere naam (paprika-2 → paprika, crushed-tomatoes → tomatenblokjes,
pork-baby-back-ribs → spareribs, cooked-grain-pasta → geen).

**Ook hierheen.** Woorden die Gabi's WhatsApp-lijstjes niet herkennen (idee 7: "coco acqua" → kokoswater), en wat
Stijn via "Zet in woordenboek" (6B) zelf toevoegt en wat daarvan algemeen genoeg is om ingebouwd te worden.

**Prioriteit.** Later; alleen data (`data/ingredients.json` + `npm run validate:data`), geen code. Kan in één
uitbreidingsronde samen met de avatar-rondes.

**Open vragen.** Alleen deze 8, of meteen een bredere ronde (Aziatische en Oost-Europese producten voor Gabi's
Litouwse keuken)? Wie bepaalt de EN-namen?

**Uitwerking (Fable, 8 nov 2026) — data-ronde vóór V6, S.** Steekproef 8 nov: kefir, boekweit, dille, zure room, haring,
augurk, kwark, roggebrood, maanzaad, vissaus, kokosmelk, limoenblad, rijstazijn, sesamolie, tahin en harissa staan er al in;
de lijst is breder dan gedacht. Aanpak: (1) de 8 ids uit 13F letterlijk; (2) Haiku maakt een kandidatenlijst van ±60 Litouwse,
Baltische en Aziatische basisproducten en vergelijkt die met de 1603 (ook aliassen), Fable keurt wat overblijft; (3) EN-namen
uit de Britse keuken (Gabi leest Engels); (4) `npm run validate:data` en `tools/gen-golden.ts`. Bijvangst: elke onbekende term
uit Gabi's echte lijstjes (idee 7) komt als alias of product mee.

## 9. Dopamine-kick bij Gekookt!: het woord groot in de confetti en een XP-balk die oploopt (Stijn, 30 okt 2026)

**Wens.** "Cooked en Overcooked mogen vóór of in de confetti pontificaal in beeld, en misschien een fractie langer; de
dopamine-kick kan iets beter. En dan een soort XP-balkje in beeld dat je level optelt: je profiel-XP-balk waarbij je hem
omhoog ziet gaan, zodat je ziet wat voor verschil het maakt."

**Prioriteit.** Later; past bij de opschoon-/afwerkronde of als klein eigen blok na 6D-S (het raakt dezelfde
vieringslaag: src/celebrate.ts, src/components/Confetti.tsx, XpPop.tsx, XpBar.tsx).

**Aanpak in grote lijnen.** (1) Bij `celebrate('cooked' | 'overcooked')` het woord **Gekookt!** / **Overcooked!** groot en
gecentreerd over de confetti (±48 px, de kookstand-letter als die aanstaat, goud bij Gekookt!, de schud-animatie bij
Overcooked!), zichtbaar ±1,4 s in plaats van de huidige korte pop; `prefers-reduced-motion` respecteren. (2) Direct daarna
glijdt onderaan een strook in met dezelfde XP-balk als op het profiel: begint op de oude stand, telt in ±1,2 s op naar de
nieuwe ("+42 XP" ernaast), en bij een level-up loopt de balk vol, springt naar het nieuwe level en opent dan pas het
level-up-venster. Bron van de getallen: `settleXp` kent oud en nieuw totaal; de pop van 6D-1 (+12) gaat hierin op.
(3) Geluid: de tadaa (6D-4a) blijft op hetzelfde moment. (4) Alles alleen met badges aan (§1 xp-levels: geen spoor
van XP als badges uit staan).

**Antwoord Stijn (30 okt) op de open vragen.** Tikken tijdens de viering versnelt de animatie ×2 (altijd, geen instelling).
Daarnaast een **ontgrendeling op level 30: "Snelle vieringen"** — een schakelaar die alle vieringen (woord, confetti, XP-balk)
standaard op dubbele snelheid zet; verschijnt als tegel in Vrijgespeeld/Jouw stijl (data/unlocks.json, kind 'feature' of
een nieuwe kind 'setting'; past bij het 24-okt-besluit "rijk, niet spaarzaam"). **Besloten (Stijn 30 okt):** de XP-balk
NIET bij een foto of beoordeling (te klein om te laten zien), WEL bij koken en bij badges — badges geven meer XP naarmate je
verder komt, dus daar is het verschil pas significant. Geen open vragen meer.

**Uitwerking (Fable, 8 nov 2026) — blok V4, M; niets hiervan is op 8 nov gebouwd (Stijn vroeg het: nee; de XP-pop is nog
1,4 s klein rechtsonder en Gekookt! staat alleen in de toast).**
- **Woord:** `src/components/CelebrationWord.tsx` [nieuw], gemount in de shell naast Confetti: bij `celebrate('cooked')` het
  woord **Gekookt!** (EN **Cooked!**) 48 px, goud (`--gold`), in de kookstand-letter als die aanstaat, 1,4 s zichtbaar met
  een korte schaal-animatie (0,8 → 1,0 in 180 ms, dan vervagen); bij `overcooked` **Overcooked!** met de bestaande
  schud-animatie van de shell. `prefers-reduced-motion`: woord 1,4 s statisch, geen schaal.
- **XP-strook:** `src/components/XpRise.tsx` [nieuw]: onderaan (boven de navigatiebalk) schuift een strook in met dezelfde
  XpBar als op Mijn profiel, start op het oude totaal, loopt in 1,2 s naar het nieuwe, "+42 XP" ernaast; level-up: balk vol →
  springt naar het nieuwe level (titel verandert) → dan pas het bestaande level-up-venster. `settleXp` (src/xp.ts) geeft
  daarvoor `{ before, after }` terug (totaal, level, nextAt); de XpPop blijft voor foto en beoordeling, verdwijnt voor koken
  en badges (de strook toont dan de som).
- **Snelheid:** tik ergens tijdens de viering → alles ×2 (één keer per viering). Ontgrendeling **Snelle vieringen** op level 30
  (data/unlocks.json, nieuwe kind `setting`, sleutel `celebrate.fast`): een tegel in Vrijgespeeld en een schakelaar op Jouw
  stijl die standaard ×2 zet. Alleen met badges aan; met confetti uit blijft alleen de XP-strook (die is informatie).
- **Bestanden:** src/celebrate.ts, src/components/CelebrationWord.tsx [nieuw], XpRise.tsx [nieuw], XpPop.tsx, src/xp.ts,
  src/screens/StyleScreen.tsx (schakelaar), data/unlocks.json, tools/validate-data.ts (kind setting), src/styles/xp.css,
  tests/xp.test.ts (before/after), handboekrijen in 07, DEVICE-TEST-rij op beide telefoons (60 fps, geluid op hetzelfde moment).
- **Stijn (8 nov): "goed, gaan we zo doen."** Klaar voor een spec (V4), na V2.

## 10. Boodschappenlijstjes terugkijken in de kalender (Stijn, 8 nov 2026) — VERVALLEN (Stijn, 8 nov: te ingewikkeld)

**Wens.** "Kunnen gemaakte boodschappenlijstjes ook in de kalender? Dat je een beetje terug kan kijken?"

**Wat er nu is.** De app bewaart precies één lijst (`lists`, id `current`): bij **Maak lijst** wordt hij opnieuw opgebouwd
(vinkjes en aanpassingen overleven per regel), bij **Leeg de lijst** gaat hij leeg (Ongedaan alleen direct erna). Van vroegere
lijsten blijft alleen een dun spoor over: `shop.bought` (6D-2c) onthoudt per recept het moment van het eerste vinkje en per
ingrediënt hoe vaak het is afgevinkt — niet welke lijst op welke dag. De kalender (Meer → Kalender, 6D-4b) toont alleen wie
wat kookte per dag, uit het kooklogboek.

**Prioriteit.** Later; samen met idee 2 (archief van afgevinkte boodschappen, 25 okt): dezelfde gegevens, twee ingangen.

**Uitwerking (Fable, 8 nov 2026) — blok V5 (met idee 2), M.**
- **Momentopname.** Een rij in een nieuwe Dexie-tabel `listHistory` (`++id, at`; Dexie v8, geen migratie van bestaande data)
  bij drie momenten: **Deel lijst**, **Leeg de lijst**, en **Maak lijst** als de vorige lijst minstens één vinkje had. Inhoud:
  `at`, `reason` (shared/cleared/regenerated), het aantal gerechten in het plan, en de regels zoals ze waren: `{ key, ing,
  label (nl/en), qty, unit, checked, by? }`. Nooit twee opnames binnen vijf minuten met dezelfde inhoud (hash) — dus geen
  dubbele rij als je deelt en meteen leegt. Mee in de back-up (export/import zoals de andere tabellen). Opschonen bij het
  openen van het scherm: ouder dan 26 weken weg (voorstel; Stijn beslist).
- **Kalender.** Onder een dag met een opname een klein 🛒 naast de kookstippen (één icoon, ook bij twee opnames). Tik op de
  dag → onder de kooklijst een blok "Boodschappen van {datum}": afgevinkte regels bovenaan met ✓, de rest grijs; per regel een
  knop **Zet terug op mijn lijst** (voegt de regel toe aan de huidige lijst via de bestaande extra-regel-logica; bestaat de
  regel al, dan alleen een melding).
- **Rij Eerder.** Onder Boodschappen, onder de vaste lijst, een uitklaprij **Eerder** (idee 2): de laatste tien opnames
  (datum, aantal regels, reden) met zoeken over alle bewaarde regels ("wanneer kocht ik voor het laatst kaneel?") en dezelfde
  **Zet terug**-knop. Wat je vaak terugzet, krijgt het bestaande voorstel "Elke week?" (6C).
- **Niet:** geen XP, geen badge (een lijst bewaren is geen prestatie); niets in de deelcodes (`#l=` blijft wat het is).
- **Bestanden:** src/db/db.ts (v8), src/db/model.ts, src/db/repo.ts (snapshot schrijven in `markListShared`,
  `clearShoppingList`, `generateList`; `listHistory`-lezen; back-up), src/domain/progress.ts (kalenderdag krijgt `shopped`),
  src/screens/CalendarScreen.tsx, src/screens/ShoppingScreen.tsx (rij Eerder), src/i18n, tests/listhistory.test.ts [nieuw],
  handboekrijen in 04 en 07 (kalender), DEVICE-TEST-rij.
- **Stijn beslist:** de drie momenten (voorstel hierboven) en de bewaartermijn (voorstel 26 weken). Per huishouden (de lijst is
  al huishoudbreed); `by` per regel komt mee uit het vinkje als dat bekend is.

## 11. Uitdagingen: beloningen die meegroeien met je level (Stijn, 8 nov 2026)

**Wens.** "Misschien is het logisch dat als je hoger level bent, de beloningen voor challenges groter worden? Niet helemaal
meegroeien met de levels maar wel enigszins, zoals de advanced badges ook meer opleveren. Anders zijn challenges al snel weinig
waard. Maar dat ze voor 20 % meegroeien. Logisch of niet?"

**Wat de cijfers zeggen (regelversie 3, nagerekend 8 nov).** De curve is 11·(level−1)^2,5 plus een vaste 1176 uit de
beginversnelling. Een stap van level L naar L+1 kost:

| Level | XP totaal | Stap naar het volgende level | Weekuitdaging van 250 XP = … van die stap |
|---|---|---|---|
| 10 | 3.768 | 887 | 28 % |
| 20 | 18.485 | 2.368 | 10,6 % |
| 30 | 50.994 | 4.407 | 5,7 % |
| 50 | 186.053 | 9.577 | 2,6 % |
| 75 | 519.346 | 17.683 | 1,4 % |
| 99 | 1.046.998 | 26.884 | 0,9 % |

Koken schaalt óók niet met je level (een kookbeurt is 50–100 XP, keer streak tot ×2), dus een level duurt bewust steeds
langer: level 20 na ±4 maanden dagelijks koken, 1 jaar → 29, level 50 na ±4,4 jaar, level 100 na ±26 jaar (xp-levels.md
§6). Ladderbadges geven wél meer per trede (50 × tredenummer), dus Stijns vergelijking klopt. Tegenover de levelbalk is een
uitdaging op level 50 nog een kwart waard van wat ze op level 20 was, op level 99 een tiende. Tegenover koken blijft ze
gelijk: 250 XP is altijd ongeveer twee kookdagen.

**Uitwerking (Fable, 8 nov 2026) — blok V3, S. Antwoord: ja, logisch, mits gematigd.**
- **Regel:** beloning × (1 + 0,02 × (level − 20)), met het level van het lid **op het moment van starten**; afgerond op
  tientallen. Level 20 ×1,0 · 30 ×1,2 · 50 ×1,6 · 75 ×2,1 · 100 ×2,6. Stijns "20 % van de curve" (de stapgrootte voor 20 %
  volgen) geeft ×1,6 op 50 en ×3,1 op 100: tot level 60 vrijwel hetzelfde, daarboven steiler. Fable kiest de lineaire regel
  omdat hij in één zin past in de handleiding ("elke level boven de 20 maakt een uitdaging 2 % meer waard").
- **Gevolg voor de tijd:** wie dagelijks kookt én elke week een uitdaging haalt, haalt level 100 nu na ±19 jaar in plaats van
  ±26 (de uitdagingen tellen al mee); met de regel wordt dat ±16 jaar. "Bijna onhaalbaar" blijft waar; het verschil zit in
  de jaren 10–20 van een kookleven.
- **Techniek:** de factor wordt berekend bij **Start** (`startChallenge`: level uit `xpStateFor` op dat moment) en bewaard in
  `ActiveChallenge.xp`; bij het halen schrijft `settleChallenges` dat bedrag in `DoneChallenge.xp`. `deriveXp` leest zoals nu
  `DoneChallenge.xp`, dus niets verschuift met terugwerkende kracht en `XP_RULES_VERSION` blijft 3. De aanbodkaarten en de
  lopende kaart tonen het geschaalde bedrag ("+400 XP"); de uitleg in data/challenges.json blijft het basisbedrag. Badge
  Uitdager ongewijzigd.
- **Bestanden:** src/domain/challenges.ts (`rewardFor(challenge, level)` + test), src/challenges.ts, src/components/
  ChallengeCard.tsx en ChallengeOfferSheet.tsx (bedrag), tests/challenges.test.ts, handboekrij in 07, docs/specs/challenges.md
  (§2 aanvulling), ACHTER-DE-SCHERMEN.md (rekenregel).
- **Besluit Stijn (8 nov):** ja, maar **1 % per level** boven 20 (level 50 ×1,3 · 75 ×1,55 · 100 ×1,8). Gebouwd in V1b (§1f van
  docs/specs/verbeterronde-1b.md): `rewardFor(baseXp, level)`, vast bij de start, afgerond op tientallen.

## 12. Avatar en level laten meereizen: bij voortgang én bij gedeelde recepten (Stijn, 8 nov 2026)

**Wens.** "Bij 'share progress' worden de avatar en level niet meegedeeld, kan net zo goed erbij. Misschien ook wel bij het delen
van recepten dat ie dan ook al de avatar meeneemt als dat mogelijk is."

**Wat er al is (feitencheck 8 nov).** De voortgangskaart (`#x=`, src/domain/share.ts `ProgressCard`) reist al mét level, XP,
streak, badges, kookdagen van 90 dagen én de avatar (`avatar?: AvatarSpec`, sinds 6D-3); het kaartje (`#f=`) ook. Het
WhatsApp-zinnetje noemt "Level 12 · Soepkoker". Wat ontbreekt zit aan de **ontvangkant**: (a) een binnengekomen voortgang
ververst de avatar van het huishoudlid niet (alleen het kaartje zet die), (b) de kalenderlegenda toont stippen en namen, geen
avatars, (c) een gedeeld recept (`#r=`, `#b=`, `#p=`) draagt alleen de naam van de afzender (`by`), en de inbox toont die als
tekst.

**Uitwerking (Fable, 8 nov 2026) — in blok V2, S–M.**
- **Voortgang → avatar overnemen:** `applyProgressCard` zet `member.avatar` (en kleur en naam) bij als de kaart ze meebrengt;
  een vriend krijgt zijn avatar in de snapshot (al zo). De rij **Werk {naam} bij** in de inbox zegt erbij "ook de avatar".
- **Kalenderlegenda:** per persoon een mini-avatar (20 px, met de profielkleur als rand) in plaats van een stip; de stippen
  onder de dagen blijven stippen (ruimte). Huishouden en Vrienden tonen al avatars.
- **Recepten:** NIET de avatar in de deelcode stoppen (een avatar is ±150 tekens; dat kost QR-ruimte en invariant 4 wil geen
  halve codes). In plaats daarvan koppelt de inbox de afzender (`by`) aan een huishoudlid of vriend met `memberByName`
  (src/domain/household.ts, al in gebruik voor weekplannen) en toont diens avatar en kleur op de kaart "Recept van Gabi"; geen
  match → de beginletter in een grijs rondje zoals nu. Erbij: een optioneel veld `byId` (profiel-id van de afzender) in elke
  envelop, zodat een naamsverandering de koppeling niet breekt — onbekende sleutels blijven bewaard (invariant 4), oude apps
  negeren het.
- **Bestanden:** src/db/repo.ts (`applyProgressCard`), src/screens/HouseholdScreen.tsx (tekst), src/screens/CalendarScreen.tsx
  + xp.css (legenda), src/screens/InboxScreen.tsx (afzender-avatar), src/domain/share.ts (`byId` schrijven en lezen, bevroren
  token erbij in tests/token.test.ts), handboekrijen in 05 en 07.
- **Stijn beslist:** niets; dit zijn uitvoeringskeuzes.

## 13. Een bestand uit WhatsApp openen is te moeilijk: structureel zonder bestanden (Stijn, 8 nov 2026)

**Wens.** "Ik kreeg weer een json van Gabi over WhatsApp, heel vervelend want ik kan dat gedownloade json-bestand nooit vinden,
en ik ben relatief handig, dus daar moet een structurele oplossing voor komen."

**Wat er gebeurt (feitencheck 8 nov).** "Deel je nieuwe recepten" (en Deel bij meerdere recepten) maakt één WhatsApp-bericht met
een link per recept zolang de tekst onder 3.500 tekens blijft (`DEFAULT_MESSAGE_LIMIT`, src/domain/share.ts `planMessages`);
anders wordt het één bundelbestand `recepten-<naam>-<datum>.json`. Drie of vier recepten tegelijk zijn al te veel voor 3.500
tekens, dus Gabi's deltas worden bijna altijd een bestand. Op Android download WhatsApp zo'n document naar een map die de
bestandskiezer van "Kies bestand" niet vooraan zet; vandaar het zoeken. **Wat al werkt (DEVICE-TEST 9 en 17):** in WhatsApp het
document ingedrukt houden → **Delen** → **Rutgers' Recepten**; de app ontvangt het bestand via het deelmenu (manifest
`share_target` accepteert .json, sw.ts leest het) en opent In & uit met het voorproefje. Dat staat alleen nergens waar Stijn
het ziet. Voor de boodschappenlijst gebruikt 13c al een grens van 20.000 tekens per link zonder problemen.

**Uitwerking (Fable, 8 nov 2026) — in blok V2, S–M.**
- **Links eerst, bestand als laatste redmiddel.** `planMessages` krijgt een grens van 20.000 tekens (zoals `LIST_LINK_MESSAGE_LIMIT`)
  en splitst daarboven in **meerdere berichten** ("🍲 Recepten van Gabi, deel 1 van 2", elk met eigen kop en open-regel, elk
  onder de grens, elk recept in precies één deel). "Deel je nieuwe recepten" en Deel bij een selectie verzenden de delen na
  elkaar via het deelmenu (één `navigator.share({text})` per deel, elk vanuit een tik: knop **Deel deel 2 van 2**). Een
  bestand alleen als één recept op zichzelf boven de grens komt (komt in de corpus niet voor) of als de gebruiker **Exporteer**
  kiest. Patches (`#p=`) en weekplannen gaan mee in de delen.
- **Als het tóch een bestand wordt (Stijn 8 nov: "misschien een bericht bij de json, of de titel"):** de bestandsnaam draagt de
  uitleg: `Recepten van Gabi 8 nov - openen via Delen, Rutgers Recepten.json` (geen tekens die een bestandsnaam niet mag hebben;
  WhatsApp toont de naam als titel van het document). Een bericht mét het bestand kan niet (invariant 9: `navigator.share` met
  precies één veld), dus na een bestandsdeling verschijnt één knop **Stuur ook de uitleg** die als tweede deelactie een kort
  bericht deelt: "Open dit bestand in Rutgers' Recepten: houd het ingedrukt → Delen → Rutgers' Recepten (iPhone: Bestanden →
  In & uit → Kies bestand)."
- **Hint waar het misgaat.** Onder **Kies bestand** in In & uit, alleen op Android: "Kreeg je een bestand in WhatsApp? Houd het
  daar ingedrukt → Delen → Rutgers' Recepten." Op de iPhone blijft de bestaande uitleg (Bestanden → Kies bestand).
- **Handboek:** rij "Een bestand uit WhatsApp openen" in 05 (Android via Delen, iPhone via Bestanden) en de rijen over "te groot
  voor één bericht" aanpassen (meerdere berichten in plaats van een bestand).
- **Bestanden:** src/domain/share.ts (`planMessages` → `MessagePlan` met `parts: string[]`), src/screens/DeltaShareScreen.tsx,
  src/screens/RecipesScreen.tsx (selectie delen), src/screens/InboxScreen.tsx (hint), src/i18n, tests/share.test.ts
  (splitsing: elk deel ≤ grens, elk recept precies één keer), DEVICE-TEST-rij met Gabi's echte delta.
- **Stijn beslist:** de grens van 20.000 tekens per bericht (zoals de lijst) — of lager als een lang WhatsApp-bericht op de
  iPhone lastig kopieert; dat is op haar telefoon te testen met de lijst-link van 13c.

## 14. Avatar-ronde: ruimte in de lijst, haar, brillen, zeldzaamheid, Verras me per laag (Stijn, 8 nov 2026)

**Wens (letterlijk).** "sommig haar mag een kleine revamp, sommige zijn wat laag, de hanenkam ofzo. misschien als je de frames wat
groter maakt, dat de haren en kleding en accessoires wat zichtbaarder zijn: niet wegvallen achter het frame. de frames passen niet
helemaal, klein oranje randje bij mij, bij gabi een raar groen randje terwijl haar profielkleur paars is. per categorie een verras me.
het brillen-assortiment uitbreiden met grappige brilletjes na level 30, iets ingrediënt-gebonden ertussen; kook-gerelateerd mag vaker.
zeldzaam mag alles boven level 40 zijn, niet 60: vind gewoon wat vol meestal."

**Feitencheck (8 nov).** Het randje is de niveauring uit 6D-3 (2 px langs de lijst in de levelkleur: level 30–39 rood, 10–19 groen).
Onderdelen zijn tot de rand van het vak getekend en de clips zijn r 40–46, dus toppen vallen weg. Gewoon telt 77 onderdelen.

**Uitwerking.** Spec docs/specs/verbeterronde-3.md: één binnenschaal (0,9, verankerd op de onderkant) in de renderer; niveauring
alleen zonder lijst; vier dikke lijsten naar clip r 44; haar-revamp; zes brillen (ster, hart, 3D, wortel, nerd, olijf) en zes
kook-onderdelen (garde, chili-speld, saussnor, vergiet, spaghettimond, spiegelei-ogen); zeldzaamheid: Stijn zag onderdelen bij Gewoon die pas op level 59
vrijkomen — vijftien onderdelen stonden te laag (data-fout); ze krijgen de zeldzaamheid van de levelregel (t/m 20 · 50 · 80 blijft) en de
validator verbiedt dat voortaan; tegel Verras me per laag.

## 15. Vrijspeel-rijkdom: confetti-ladder, herkenbare timergeluiden, gouden thema (Stijn, 8 nov 2026)

**Wens (letterlijk).** "maak nog maar een hoop meer confetti dingen in hogere levelklassen. misschien dat je dubbel, trippel,
quadruppel zo veel confetti op die volgorde kan vrijspelen? en dan steeds grappigere/leukere dingen, of mooiere designs. mag ook bij
geluidjes voor de timer: geluidjes die mensen herkennen, klassiek iphone, europees volkslied, mozart, huilende baby??? kan ook
progressief grappig. en als ik 15 keer (of hoeveel dat bij android is) op versie druk, dan voor mij gold-theme vrijspelen, want ik ben
de maker: een hele mooie maar goed leesbare en werkbare gold-theme, achtergrond donker, meer gouden accenten overal."

**Wat er is (8 nov).** Confetti-stijlen (data/unlocks.json, kind `confetti`, getekend in src/components/Confetti.tsx): dubbel (3),
groenten (7), feest (12), T-rex (25, episch), goud (40, legendarisch), sterren (50), vuur (badge Op dreef). Timergeluiden
(src/sounds.ts, gesynthetiseerd met Web Audio, geen bestanden): piepjes, bel, melodie (basis), koebel (5), gong (10), keuken (15),
fanfare (30). Thema: systeem/licht/donker (src/theme.ts, `data-theme`), de "gouden modus" stond gereserveerd in xp-levels.md voor
een hoog level. Versie staat onder Meer → Hulp & over → Over.

**Uitwerking (Fable, 8 nov 2026) — blok V5, M–L, drie bouwers + handboek.**
- **Confetti-ladder en ontwerpen** (Confetti.tsx + unlocks.json): `confetti-triple` (level 22, drie keer zoveel snippers) en
  `confetti-quadruple` (level 45, vier keer; met een lichte opbouw zodat het niet dichtslaat), in die volgorde ná dubbel. Nieuwe
  ontwerpen: hartjes (17), herfstblaadjes die zweven (33), sneeuw (38, langzaam en wit, ook in licht thema zichtbaar met een randje),
  pasta (56: farfalle, penne en spiralen), vuurwerk (62: snippers die uit drie punten barsten), bellen (68: doorzichtige cirkels die
  omhoog gaan), lampionnen (77: rood-goud, langzaam), noorderlicht (88, legendarisch: lange slierten in groen en paars). Elke stijl =
  één `look` in Confetti.tsx (vorm, kleuren, aantal, zwaartekracht/snelheid) + een regel in unlocks.json + validator kent de waarde.
- **Timergeluiden** (sounds.ts, allemaal met oscillatoren zoals nu; geen opnames, geen bestanden, geen auteursrechtelijk beschermde
  melodieën): marimba (8: een eigen vierklank "à la klassieke telefoon", niet de Apple-melodie), Ode an die Freude (21, Beethoven,
  publiek domein, acht maten), Kleine Nachtmusik (27, Mozart, het openingsmotief), koekoeksklok (34), haan (42: glissando met
  vibrato, grappig), huilende baby (48: wah-wah-formant, progressief grappig), modem (55: het inbelgeluid in drie seconden), misthoorn
  (60). Elk geluid ≤ 4 s, test-knop in Jouw stijl zoals nu; `TimerSound` krijgt de nieuwe waarden.
- **Gouden thema** (theme.ts + base.css + StyleScreen): `Theme` krijgt `'gold'`; `:root[data-theme='gold']`: papier #15120c (donker,
  warm), kaart #1f1a10, inkt #f3e9c8, muted #c9b98a, kobalt → goud #d4a72c (knoppen, actieve tab, voortgangsbalken, de bijschriften
  van Meer en de handleiding), on-cobalt #1a1406, lijn rgba(212,167,44,.22), press rgba(212,167,44,.16), rozemarijn (succes) #9fcf8a;
  contrast: inkt op papier ≈ 14:1, goud op papier ≈ 8:1 (allebei ruim boven AA). Het thema-tegeltje **Goud** op Jouw stijl → Thema
  verschijnt alleen als het vrij is. **Vrijspelen op twee manieren:** (1) ontgrendeling `gold-theme` in unlocks.json (kind `feature`,
  level 100, legendarisch: de gereserveerde gouden modus); (2) het makers-ei: **33 keer** achter elkaar tikken op de regel **Versie** onder Meer → Hulp &
  over → Over (Stijn 8 nov: "33, dan is het nog wat lastiger om zomaar te vinden"; de teller loopt zolang er binnen twee seconden
  weer getikt wordt), met vanaf de 25e tik een kleine telling ("nog 8 keer…") en daarna de toast "🏆 Gouden thema vrijgespeeld — jij bent de maker." Dat zet de toestel-instelling
  `theme.goldUnlocked`; het tegeltje toont daarna ook de regel "vrijgespeeld als maker". Geen XP, geen badge (het is een ei).
- **Handboek:** rijen over confetti-stijlen en timergeluiden (aantallen en levels), het gouden thema (level 100; het ei blijft
  ongeschreven in de handleiding, wel in ACHTER-DE-SCHERMEN voor Stijn).
- **Stijn beslist:** niets vooraf; Fable keurt de confetti-ontwerpen en geluiden in de dev-app.
