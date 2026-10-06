# Fase 6 — wensen en verbeteringen van Stijn (6 oktober 2026)

Plan, nog niet gebouwd. Bron: Stijns lijst van 6 okt 2026. Volgorde en status staan in docs/STATUS.md.
Grootte: **S** = klein (minder dan een uur werk), **M** = middel, **L** = groot (meerdere sessies).
Alles NL + EN, CLAUDE.md-invarianten gelden; "eerlijk" = geen belofte die een telefoon niet waarmaakt.

## Blok 6A — Snelle verbeteringen en bugs

1. **Bug: importeren vult de verkeerde naamvakjes (M).** Stijn: "Als ik toevoeg, staat er alleen de
   Engelse naam, of de Nederlandse in het vakje Engels. De Engelse vertaling kwam pas mee als ik
   toevoegde in het Engelse scherm, terwijl die wel in het importveld geplakt was."
   Verwachting: een tweetalig AI-antwoord (blokken `=== NL ===` en `=== EN ===`) vult altijd beide
   kolommen (naam, regels, stappen), los van de taal waarin de app staat. Eerst reproduceren in beide
   UI-talen (src/domain/photo-import.ts `parseBilingualPlain` → EditScreen); test erbij die het pint.
   *Open vraag 1* hieronder (precieze route + de geplakte tekst).
2. **Curator: ingrediënten tonen de woordenboekvertaling (M).** Nu zijn de Engelse ingrediëntvakjes
   leeg (placeholder "EN"), terwijl de app de regels in het Engels toont via het woordenboek. Als Gabi
   daar zelf tekst typt, botst die met het woordenboek (schalen, eenheden). Voorstel: per regel die het
   woordenboek herkent, de Engelse weergave grijs en alleen-lezen tonen, met "Verbeter in het
   woordenboek" (één correctie geldt dan voor alle recepten). Alleen regels die het woordenboek niet
   kent krijgen een vrij Engels tekstvak.
3. **"Gekookt" zonder kookstand + later beoordelen (M).** Stijns vriendin kookt uit het hoofd.
   - Op de receptpagina een knop **✓ Gekookt** → klein venster: wanneer (vandaag / gisteren / datum),
     sterren (mag leeg), notitie. Telt overal mee (kooklog, week, badges, XP).
   - Een kookbeurt zonder sterren toont op de receptpagina en bij "Recent gekookt" een knop
     **Beoordeel**; sterren achteraf geven ook de XP voor beoordelen.
4. **Installeerkaart (S).** Android: de knop/kop heet **"Installeer de app"** (begrijpen mensen beter dan
   "zet op beginscherm"). iPhone: de kaart mag niet helemaal weg (in een Safari-tabblad kunnen recepten
   verdwijnen, daarom staat hij er), maar wordt **inklapbaar tot één regel**, met de geruststelling
   "kost nauwelijks ruimte (± 2 MB)".
5. **"Stuur nieuwe naar …" duidelijker (S).** Nieuwe naam, bv. **"Deel je nieuwe recepten"**, met één
   zin uitleg op de rij ("alles wat je sinds de vorige keer maakte of aanpaste, in één bericht") en
   bovenaan het scherm een voorbeeld van wat de ander ontvangt.
6. **Meer-scherm opgeruimd (M).** Groepen met kopjes, inklapbaar:
   Jij & je huishouden (profiel, huishouden, badges/level) · Instellingen (taal, thema, confetti, °F,
   kookstand & timer) · Recepten & delen (Inbox, deel je nieuwe recepten, controleer mijn recepten,
   woordenboek) · Opslag & back-up · Hulp & over (handleiding, feedback, **Testen & nakijken** =
   apparaatcheck + testlijst + curator op één plek, versie). Zie ook Stijns screenshot-idee
   (de bijlage kwam door als thumbnail van 72×61 px, te klein om te lezen; zo nodig opnieuw sturen).
7. **Feedback-knop "Feedback voor Stijn" (S).** Tekstvak → delen via het deelmenu (WhatsApp/mail),
   met app-versie, kanaal en toestel automatisch eronder. Geen server (invariant 14). **Geen
   telefoonnummer of e-mailadres in de code**: de repo en site zijn openbaar; de gebruiker kiest Stijn
   zelf in WhatsApp.
8. **Meer spraakcommando's + "?"-knop (S, alleen Android).** Synoniemen voor "nog een keer voorlezen":
   herhaal, opnieuw, nog een keer, lees opnieuw voor, wat zeg je, wat?, pardon / repeat, again, say that
   again, what?, pardon. Eventueel nieuw: "ingrediënten" (lees de lijst), "hoe lang nog" (lees de
   resterende timertijd). Een klein **?**-knopje naast de microfoon toont alle commando's.
   Grammatica in src/domain/voice.ts + tests (woordgrenzen blijven: "opnieuw" mag geen deel van een
   ander woord matchen).
9. **Plak-prompt vult labels en categorie al in (S).** De importprompt vraagt al om
   "Categorie:" / "Labels:" (fase 5 A.5). Controleren dat die na plakken de chips **invullen** (niet
   alleen voorstellen), inclusief de nieuwe keuken-labels uit 6B.

## Blok 6B — Nieuwe labels

1. **Lactosevrij (M, data-pass).** Nieuwe vlag `lactose` op alle ±1600 ingrediënten (plus
   `lactoseUnsure`), tags `lactosevrij` / `lactosevrij-optie`, dieetchip en filter zoals glutenvrij,
   validator-regel "alles of niets" zoals de andere dieetvlaggen, en een badge. *Open vraag 6.*
2. **Keukens / nationaliteit (M, data-pass).** Woordenlijst `data/cuisines.json` (tweetalig):
   Hollands, Italiaans, Frans, Spaans, Grieks, Midden-Oosten, Marokkaans, Indiaas, Thais, Chinees,
   Japans, Indonesisch, Surinaams, Mexicaans, Amerikaans, Brits, … Veld op het recept (lijst van ids),
   toegekend aan de 196 klassiekers (data-agents + validator), filterchips op Home/Recepten/Kies 7.
   Het bestaande label "wereld" vervalt of blijft als verzamelnaam. *Open vraag 4.*
3. **Labels als laatste stap bij een nieuw recept (S).** De editor eindigt met een stap "Labels":
   aanklikbare chips voor keuken, dieet en de overige labels, voorgevuld door de suggestie of de
   geplakte AI-tekst (6A.9).
4. **Vertaalprompt voor ontbrekende ingrediënten (M).** In Meer → Woordenboek: "Kopieer prompt voor
   ontbrekende ingrediënten" verzamelt eigen ingrediënten zonder Engels/Nederlands of zonder gangpad
   plus de niet-herkende regels uit eigen recepten → AI-prompt → antwoord plakken → voorbeeld →
   in één keer in het woordenboek (zelfde patroon als de bestaande vertaalprompt).

## Blok 6C — Vaste boodschappenlijst (M)

Voor wie elke week (deels) hetzelfde koopt. De bestaande "Elke week"-pin in de lijst is het begin.
- Een **vaste lijst** (Boodschappen → "Vaste lijst"): producten met een standaardhoeveelheid
  (bv. 3 l melk). De "Elke week"-pins verhuizen hierheen.
- Bij elke nieuwe weeklijst komen de vaste producten erbij, met per regel **"heb ik al"** (overslaan
  voor deze week) en een hoeveelheid die je **alleen voor deze week** aanpast (2 l i.p.v. 3 l);
  "ook voortaan" past de vaste lijst zelf aan.
- Werkt ook zonder recepten (PLAN §0: de lijst is ook een losse boodschappen-app). *Open vraag 5.*

## Blok 6D — XP, levels, badge-niveaus (L, meerdere sessies)

Stijns idee, uitgewerkt. Alles valt onder de bestaande schakelaars: Badges uit = geen XP-weergave;
Confetti uit = geen animaties. **De app blijft rustig**: XP verschijnt alleen op beloningsmomenten
(koken, beoordelen, foto, badge), nooit tijdens bladeren. Waarom XP varieert wordt in de app niet
uitgelegd (wel in de handleiding voor Stijn, blok Z).

**Ontwerpprincipe (belangrijk voor 30 jaar gebruik):** XP wordt niet opgeteld in een teller maar
**afgeleid uit wat er al bewaard wordt** (kooklog, foto's, recepten, verdiende badges). Elke
willekeurige uitkomst gebruikt een vaste "dobbelsteen" per gebeurtenis (seed = id van die
gebeurtenis). Daardoor: na een back-up terugzetten of een nieuwe telefoon is je level precies
hetzelfde, herladen geeft geen nieuwe worp, en er kan niets "uit de pas" raken. Getallen blijven
klein (max level ≈ 1,1 miljoen XP).

**XP-bronnen (basis, vóór variatie):**
| Actie | XP |
|---|---|
| Recept gekookt — 1e keer dít recept | 100; 2e keer 90; 3e 80; … nooit lager dan 50 |
| Moeilijkheidsbonus | +5 per stap boven de 4, max +30 (voorstel; actieve kooktijd kan meewegen) |
| Beoordelen (sterren), ook achteraf | +5 per kookbeurt |
| Eerste foto van een gerecht | 30; daarna 20 per foto (max één beloonde foto per recept per dag) |
| Eigen recept toevoegen | 10; tweetalig (NL + EN) 15 |
| Badge-niveau gehaald | 50 × niveau (niveau 1 = 50 … niveau 8 = 400); geheime badges 250 |
| Volle week zonder overslaan (zie streak) | +50 |

**Variatie:** elke beloning ±20% (50 wordt 40–60). Daarna één worp: **5% "Cooked!"** = dubbel,
**1% "Overcooked!"** = ×5. Ook bij badge-niveaus.

**Kookstreak:** dagen op rij gekookt, **één dag per week overslaan mag** (de streak breekt dan niet).
Vermenigvuldiger: 3 dagen ×1,1 · 7 ×1,2 · 14 ×1,3 · 30 ×1,5 · 100 ×1,75 · 365 ×2 (maximum).
Een week zonder je overslaan-dag te gebruiken geeft de bonus van +50.

**Levelcurve (wiskunde):** totaal XP voor level L = 11 × (L − 1)^2,5, met 100 levels.
| Level | Totaal XP | Ongeveer (dagelijks koken, ±100 XP/dag) |
|---|---|---|
| 3 | 62 | na je eerste kookbeurt |
| 10 | 2.673 | ±25 keer koken |
| 20 | 17.300 | ±half jaar |
| 50 | 185.000 | ±5 jaar |
| 100 | 1.073.000 | ±30 jaar |
Wie twee keer per week kookt zit na een jaar rond level 14 en na drie jaar rond 22: vlot in het
begin, daarna loont dagelijks koken.

**Titels (voorstel, Stijn vult aan):** 1 Keukenpiep · 3 Aardappelschiller · 6 Oma · 10 Hulpkok ·
15 Commis · 20 Sous-chef · 25 Chef de partie · 30 Chef · 40 Chefkok · 50 Masterchef ·
60 Jamie Oliver · 70 Nigella · 80 Gordon Ramsay · 90 Michelinster · 100 T-rex.
(Namen van echte chefs: prima voor privégebruik; vervangen als de app ooit breder gaat.)
Profiel toont bv. **"Level 6 · Oma — 922 / 1.500 XP"** met een voortgangsbalk.

**Badge-niveaus:** herhaalbare badges krijgen 8 niveaus — geel, groen, blauw, rood, brons, zilver,
goud, platina — met drempels per soort (bv. koken: 1 · 10 · 25 · 50 · 100 · 250 · 500 · 1000).
Eenmalige badges blijven eenmalig. **Geheime badges** (±10, bv. koken na middernacht, drie dagen
achter elkaar hetzelfde recept, een Overcooked! gegooid) zijn onzichtbaar tot je ze hebt; de pagina
toont alleen "3 geheime badges gevonden".

**Wat je ziet:** een klein blauw **+12** in de hoek (na de confetti). Meerdere beloningen bij één
actie: snel na elkaar **+12 +43 +11 +33**, daarna de som eronder. Cooked!: gouden letters.
Overcooked!: het scherm schudt kort en zegt **OVERCOOKED!** (geen schudden bij "minder beweging").

**Ontgrendelingen (semi-verborgen, pas zichtbaar bij level-up, "Ontgrendeld: dubbele confetti &
koebel"):** bv. 5 koebel als timergeluid · 10 dubbele confetti · 15 groente-confetti · 25 krijtbord-
lettertype in de kookstand · 35 gekke confetti (kippen, taartjes) · 50 gouden thema · 75 … · 100
T-rex-confetti. Per ontgrendeling zelf aan/uit te zetten.

**Bouwvolgorde:** (1) domein: XP-afleiding, seeded random, streak, curve + uitgebreide tests (ook een
simulatie van 30 jaar dagelijks gebruik); (2) profiel-level + "+12"-animaties; (3) badge-niveaus en
geheime badges; (4) ontgrendelingen. Elke stap apart online.

## Blok Z — Handleiding (altijd het laatste blok; voorheen "G")

Zie docs/STATUS.md. Twee versies:
1. **Handleiding voor iedereen:** zoekbaar, per functie (wat het doet, waar je tikt, wat je ziet).
2. **Handleiding voor Stijn ("achter de schermen"):** hoe XP berekend wordt, waar data staat,
   back-ups, delen, het woordenboek, de testlijst — wat gebruikers niet hoeven te weten.

## Open besluiten (Stijn)

- **Doneerknop.** Een link naar een betaalpagina (bv. bunq.me, PayPal.me of "Buy Me a Coffee") in
  Meer → Over is technisch simpel en op een persoonlijke, niet-commerciële site gebruikelijk. GitHub
  Pages is niet bedoeld voor commerciële sites; lees hun voorwaarden zelf even na voor je hem
  plaatst. Geen betalingen in de app zelf; een Tikkie-link verloopt, kies dus een vaste link.
- **Gebruik zien / aantal bezoekers.** GitHub Pages geeft geen bezoekersstatistieken, en IP-adressen
  zijn persoonsgegevens (AVG): die verzamelen we niet. Mogelijk alternatief: een privacyvriendelijke
  teller zonder cookies of IP-opslag (bv. GoatCounter, gratis voor niet-commercieel gebruik) die
  alleen aantallen toont. Dat breekt invariant 14 ("geen analytics") en vraagt een ADR. Advies: nu
  niet; eerst de feedbackknop.

## Open vragen (bij de start van het betreffende blok beantwoorden)

1. **Import-bug (6A.1):** welke route precies (Recepten → + → Nieuw recept → importvak?), stond de app
   op NL of EN, en kun je de geplakte tekst één keer meesturen?
2. **XP (6D):** alleen per persoon, of ook een gezamenlijk huishoud-level?
3. **XP (6D):** mogen huishoudleden elkaars level zien (gezellig wedstrijdje), of houden we het privé?
4. **Keukens (6B.2):** één keuken per recept, of mag een recept er meerdere hebben (Indonesisch + Hollands)?
5. **Vaste lijst (6C):** één vaste lijst voor het hele huishouden, of per persoon?
6. **Lactosevrij (6B.1):** tellen oude harde kazen (Parmezaan, oude Gouda, vrijwel lactosevrij) als
   lactosevrij, of liever streng?
