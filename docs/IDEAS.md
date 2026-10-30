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

**Gepland (30 okt):** gaat op in blok 6D-S "Jouw stijl" als scherm **Mijn profiel** (badges-avatar.md, blok 6D-S punt 4):
de pull-down én de profielpagina worden één scherm; Profielen beheren wordt alleen nog de lijst.

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
een nieuwe kind 'setting'; past bij het 24-okt-besluit "rijk, niet spaarzaam"). Blijft open: de balk ook bij foto/beoordeling,
of alleen bij koken.

