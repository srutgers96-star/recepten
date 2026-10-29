# Ideeën voor later — Rutgers' Recepten

Losse ideeën van Stijn (en Gabi) die nog **niet** gepland zijn. Geen volgorde, geen belofte.
Een idee gaat pas naar `docs/phase-6-spec.md` (of een volgende fase) als Stijn zegt: dit gaan we bouwen.

**Nieuw idee?** Onderaan toevoegen met datum en van wie, in dit formaat:
wens · prioriteit · wat we al weten · aanpak in grote lijnen · open vragen · hangt af van.

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

## 3. Challenges, vrij op level 20 (Stijn, 6 en 28 okt 2026) — GEPLAND, verzamelplek voor de inhoud

**Status.** Dit wordt gebouwd: eigen klein blok ná 6D-4 (zie docs/specs/xp-levels.md besluitblok 24 okt en
docs/specs/README.md §1). Fable ontwerpt de eerste set; hier verzamelen we de ideeën tot het zover is.

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

**Aanpak in grote lijnen.** data/challenges.json (id, nl/en, soort, doel, termijn, beloning, unlock-level), pure
evaluatie uit kooklog/foto's zoals badges (`src/domain/challenges.ts`), een kaart op het profiel en in het
level-up-overzicht; lopende challenge in `settings`, afgeronde in een lijstje dat mee gaat in de back-up.

**Open vragen.** Hoeveel tegelijk (één lopende, of twee)? Zelf kiezen uit een aanbod of toegewezen? Beloning in
XP alleen, of ook een avatar-onderdeel per challenge?

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

## 5. Swipe omlaag op Home: profiel bijna paginavullend, avatar heel groot (Stijn, 29 okt 2026)

**Wens.** Op Home naar beneden swipen (of vanaf de level-regel omlaag trekken) → het profiel vult bijna de hele pagina
en de avatar wordt heel groot, "zodat je heel de avatar met al zijn ditjes en datjes goed kan zien": alle lagen
(huid, haar, ogen, kleding, hoofddeksel, accessoire, achtergrond) op volle grootte, met naam, level, titel en XP-balk.

**Prioriteit.** Later; ná 6D-3 (avatar-garderobe) en 6D-4 (unlocks), want dan is er iets om te bekijken.

**Aanpak in grote lijnen.** Geen nieuwe route: een "sheet" die vanaf de bovenkant van Home opentrekt bij een
pull-down-gebaar (touch, drempel ±80 px, niet in conflict met de browser-pull-to-refresh: in standalone staat die uit,
in de browser alleen tonen via een tik op de avatar). De avatar-SVG schaalt naar ±70 % van de viewportbreedte; daaronder
naam, titel, level, XP-balk, en de knoppen "Kleedkamer" (6D-3) en "Badges". Sluiten met swipe omhoog, tik buiten of
de Terug-knop (hash-state zodat Terug op Android werkt). Houd 60 fps: alleen transform/opacity animeren.

**Open vragen.** Alleen Home of ook op de Profielen-pagina? Ook voor de andere leden (tik op een ander lid → diens
avatar groot)? Hoort hier ook de "gouden modus" (6D-4) bij als achtergrond?

**Aanvulling Stijn (29 okt).** Als dit er is, is het profiel-blok bovenaan Meer waarschijnlijk overbodig: dat kan dan
weg of kleiner, zodat Meer rustiger wordt. Bij het bouwen van dit idee dus meteen Meer opschonen (alleen nog een
regel "Profielen" en "Badges" als ingang, geen tweede avatar + level).

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

