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
