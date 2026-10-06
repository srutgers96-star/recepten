# Fase 6 — wensen en verbeteringen van Stijn (6 oktober 2026)

Plan, nog niet gebouwd. Bron: Stijns lijst van 6 okt 2026. Volgorde en status staan in docs/STATUS.md.
Grootte: **S** = klein (minder dan een uur werk), **M** = middel, **L** = groot (meerdere sessies).
Alles NL + EN, CLAUDE.md-invarianten gelden; "eerlijk" = geen belofte die een telefoon niet waarmaakt.

## Blok 6A — Snelle verbeteringen en bugs

1. **Bug: vertaling plakken werkt alleen goed als de app op Engels staat (M).** Stijn (6 okt):
   route = in de editor de **vertaalprompt** ("Kopieer voor vertaling" → AI → "Plak vertaling").
   Met de app op **NL** plakte hij een antwoord met Nederlands én Engels, maar de app nam er maar één
   van over; met de app op **EN** werkte het wel. Ook: "hij was wel al vertaald maar had het niet altijd
   door, afhankelijk van welke taal geselecteerd was". Screenshot (editor, stand "beide"):
   `NL 50 g sultana's` / `EN 50 g sultana's` (Nederlands in het Engelse vak) en
   `NL 25 g botrytis-sémillonwijn` / `EN 25 g botrytis Semillon wine` (wel vertaald); beide regels
   onbekend in het woordenboek (oranje "?"-chip).
   Verwachting: plakken vult altijd beide kolommen (naam, regels, stappen, notities), los van de
   UI-taal. Reproduceren in beide UI-talen (EditScreen → `applyTranslationAnswer` /
   `buildTranslationPrompt`, src/domain/translate-prompt*), test erbij die het voor NL én EN pint.
   Controleer ook de import-route (`parseBilingualPlain`) op hetzelfde UI-taal-probleem.
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
   apparaatcheck + testlijst + curator op één plek, versie).
7. **Feedback-knop "Feedback voor Stijn" (S)** en daarnaast de **doneerknop** (zie Besluiten). Tekstvak → delen via het deelmenu (WhatsApp/mail),
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
10. **Rechte haakjes in de AI-prompts (S, idee Stijn).** De klassiekers schrijven bereiding en
    notities al tussen rechte haakjes ("1 sjalotje [gesnipperd]"). Als de parser dat betrouwbaar
    scheidt, vragen de import- en vertaalprompt de AI om hetzelfde formaat: "hoeveelheid eenheid naam
    [bereiding of notitie]". Eerst nagaan hoe de parser haakjes nu behandelt.
11. **Ontbrekende woordenboekwoorden uit de screenshot (S).** sultana's (EN sultanas; eigen product
    naast rozijn) en dessertwijn (aliassen botrytiswijn, sémillonwijn; EN dessert wine). Meenemen in de
    Fable-review van blok E.
12. **Meer profielkleuren (S, wens Stijn).** Nu 6 kleuren (src/profile.ts `PROFILE_COLORS`); de
    gekozen kleur is al de achtergrond van het avatar-rondje met je beginletter. Uitbreiden naar ±12–16
    kleuren, elk met goed contrast voor de witte letter in licht én donker thema. In 6D blijft deze
    kleur de achtergrond achter de getekende avatar; extra's als verloop, goud of regenboog zijn
    vrij te spelen met levels.

## Blok 6B — Nieuwe labels

1. **Lactosevrij (M, data-pass).** Nieuwe vlag `lactose` op alle ±1600 ingrediënten (plus
   `lactoseUnsure`), tags `lactosevrij` / `lactosevrij-optie`, dieetchip en filter zoals glutenvrij,
   validator-regel "alles of niets" zoals de andere dieetvlaggen, en een badge. **Alle**
   ingrediënten krijgen de vlag. Besluit Stijn (correctie 6 okt): **streng** — ook oude en harde
   kazen (Parmezaan, oude Gouda) tellen als lactosehoudend.
2. **Keukens / nationaliteit (M, data-pass).** Woordenlijst `data/cuisines.json` (tweetalig):
   Hollands, Italiaans, Frans, Spaans, Grieks, Midden-Oosten, Marokkaans, Indiaas, Thais, Chinees,
   Japans, Indonesisch, Surinaams, Mexicaans, Amerikaans, Brits, … Besluit Stijn: **één keuken per
   recept, en alleen als het écht uit die keuken komt** (veel Italiaans en Hollands, veel recepten
   zonder). Veld `cuisine: id | null` op het recept, toegekend aan de 196 klassiekers (data-agents +
   validator), filterchips op Home/Recepten/Kies 7. Het bestaande label "wereld" blijft als
   verzamelnaam voor gerechten zonder duidelijke keuken.
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
- Werkt ook zonder recepten (PLAN §0: de lijst is ook een losse boodschappen-app).
- Voorbeeld Stijn: elke week in ieder geval 1 pot mayonaise, 1 pot pindakaas en x liter melk
  (aanpasbaar). Besluit: **één vaste lijst per huishouden** (een huishouden van één persoon = per persoon).

## Blok 6D — XP, levels, badge-niveaus (L, meerdere sessies)

Stijns idee, uitgewerkt. Alles valt onder de bestaande schakelaars: Badges uit = geen XP-weergave;
Confetti uit = geen animaties. **De app blijft rustig**: XP verschijnt alleen op beloningsmomenten
(koken, beoordelen, foto, badge), nooit tijdens bladeren. Waarom XP varieert wordt in de app niet
uitgelegd (wel in de handleiding voor Stijn, blok Z).

**Wat je ziet:** op je profiel je level, titel en een **XP-balk met hoeveel XP je nog nodig hebt**
voor het volgende level ("Level 6 · Oma — 922 / 1.500 XP").

**Hoe het achter de schermen werkt (onzichtbaar voor de gebruiker, belangrijk voor 30 jaar):** de app
bewaart niet één getal "922 XP" dat steeds wordt opgehoogd, maar **rekent je XP elke keer opnieuw uit**
uit wat er toch al bewaard wordt: kooklog, foto's, recepten en badges. Zo'n opgeteld getal kan
kwijtraken of scheef gaan (half opgeslagen, back-up van een ouder moment, twee telefoons); een
herberekening niet. De "dobbelsteen" voor variatie en crits ligt per gebeurtenis vast (seed = id van
die kookbeurt/foto). Daardoor is je level na een back-up of op een nieuwe telefoon precies hetzelfde,
en geeft opnieuw laden geen nieuwe worp. Getallen blijven klein (max level ≈ 1,1 miljoen XP).

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

**Titels (voorstel, Stijn vult aan):** 1 Keukenpiep · 2 **T-rex** (te korte armpjes, kan nog niet
koken — de grap van Stijn) · 3 Aardappelschiller · 6 Oma · 10 Hulpkok · 15 Commis · 20 Sous-chef ·
25 Chef de partie · 30 Chef · 40 Chefkok · 50 Masterchef · 60 Jamie Oliver · 70 Nigella ·
80 Gordon Ramsay · 90 Michelinster · **100 = MAX LEVEL: "Best Chef of the Universe"** (besluit Stijn).
(Namen van echte chefs: prima voor privégebruik; vervangen als de app ooit breder gaat.)

**Badges: een eigen deelplan binnen 6D ("veel meer badges", wens Stijn).** De huidige 43 worden een
grote catalogus (richting 120–150), gemengd zodat je ze allemaal wilt hebben:
- **Doortellende badges met kleurniveaus:** 8 niveaus — geel, groen, blauw, rood, brons, zilver, goud,
  platina — met drempels per soort (bv. koken: 1 · 10 · 25 · 50 · 100 · 250 · 500 · 1000). Elk volgend
  niveau duurt **langer maar levert meer XP** op.
- **Eenmalige badges**: kun je maar één keer halen (bv. eerste eigen recept, eerste foto, alle 196
  gekookt). Dit bedoelde Stijn met "aflopen".
- **Badges voor alle functies** van de app (koken, week, boodschappen, delen, woordenboek, curator,
  foto's, print, spraak …) en "van alles en nog wat"; ruim aanbod, Stijn breidt later zelf uit
  (data/badges.json is daarvoor gemaakt).
- **Doneer-badge** met 5 niveaus, cumulatief tot € 100 (voorstel: € 5 · € 10 · € 25 · € 50 · € 100).
  Probleem: de app kan een bunq-betaling **niet zien** (geen server, bunq.me meldt niets aan de app).
  Twee mogelijkheden, zie open vraag 1: (a) op erewoord: knop "Ik heb gedoneerd" + bedrag; simpel,
  maar iedereen kan het aanklikken; (b) een **dank-je-code van Stijn**: Stijn maakt na een donatie
  met een klein scriptje op zijn pc een ondertekende code en stuurt die via WhatsApp; de app
  controleert de handtekening met een publieke sleutel (WebCrypto, geen server) en kent het niveau
  toe. Niet na te maken, wel een handeling van Stijn per donatie.
  **Besluit Stijn:** de doneer-badge is cosmetisch, **een klein hartje** bij de avatar, en geeft geen
  of weinig XP (level is niet te koop). Niveaus en drempels: later uitwerken.
  **Hoe Stijn de donateur bereikt (idee Stijn + uitwerking, later):** de doneerknop in de app opent
  bunq.me met een korte **referentie** in de omschrijving (bv. `bunq.me/StijnRutgers/5/RR-7K3F`;
  bunq.me ondersteunt bedrag en omschrijving in de link: eerst testen). Daarna biedt de app
  "Stuur Stijn een berichtje voor je hartje" aan: het deelmenu opent WhatsApp met "Ik heb
  gedoneerd, ref RR-7K3F". Stijn ziet dezelfde ref bij de betaling, en antwoordt in datzelfde
  WhatsApp-gesprek met de dank-je-link; de donateur tikt erop en krijgt het hartje. Zo is WhatsApp
  het kanaal om elkaar te bereiken; er hoeven geen telefoonnummers in de betaalomschrijving
  (die blijft voor altijd bij de bank staan). Of bunq links in een omschrijving klikbaar maakt, is
  onbekend; daarom de ref plus WhatsApp in plaats van een link in de betaling.
- **Verborgen badges voor app-ontdekkers:** onzichtbaar tot je ze hebt, en je verdient ze door
  functies te ontdekken (eerste spraakcommando, recept geprint, weekplan gedeeld, QR getoond, thema
  gewisseld …). Plus een paar gekke geheime badges (koken na middernacht, drie dagen achter elkaar
  hetzelfde recept, een Overcooked! gegooid). De pagina toont alleen "3 geheime badges gevonden".
- **Badge-groepen** op de badgepagina: Koken · Ontdekken (196) · Keukens van de wereld · Seizoenen ·
  Samen & delen · Fotografie · Reeksen · Geheim.
Aanpak: eerst de catalogus als lijst laten goedkeuren door Stijn, dan bouwen (data/badges.json +
validator + evaluatie-uitbreiding).

**Wat je ziet:** een klein blauw **+12** in de hoek (na de confetti). Meerdere beloningen bij één
actie: snel na elkaar **+12 +43 +11 +33**, daarna de som eronder. Cooked!: gouden letters.
Overcooked!: het scherm schudt kort en zegt **OVERCOOKED!** (geen schudden bij "minder beweging").

**Ontgrendelingen (semi-verborgen, pas zichtbaar bij level-up, "Ontgrendeld: dubbele confetti &
koebel"):** bij elke level-up een **mooi overzicht** van wat je net vrijspeelde, en op je profiel
een pagina "Vrijgespeeld" met alles op een rij (per stuk aan/uit). Ideeën die de functionaliteit niet
veranderen maar wel leuk zijn om te winnen:
- **confetti**-soorten (dubbel, groente, gekke dingen zoals kippen en taartjes, T-rex);
- **geluiden** voor de timer (koebel, gong, keukenwekker) en voor "Gekookt!";
- **lettertypes** voor de kookstand (krijtbord, handschrift);
- **eigen avatar** maken (wens Stijn), met vrij te spelen spullen: koksmuts, schort, pollepel,
  snor, op je eigen profielkleur als achtergrond (6A.12); plus een **avatar-rand** die meekleurt
  met je level en vrij te spelen achtergronden (verloop, goud, regenboog);
- **stickers** in je kooklog (een stempel per gekookt gerecht);
- **thema's** voor gedeelde receptkaarten en prints;
- **gouden modus** naast licht en donker (veel later);
- **challenges** die op level 20 vrijkomen (later uitwerken, idee Stijn).
Niet mogelijk: het app-icoon veranderen (dat staat vast na installatie op Android en iPhone).

**Samen (besluiten Stijn 6 okt):** XP en levels zijn **per persoon**, en huishoudleden **mogen
elkaars level en avatar zien**: een beetje wedstrijd, wie veel kookt stijgt harder. Nieuw:
een **kookkalender van het huishouden**: wie heeft wat wanneer gekookt (gezellig en eerlijk).
Eerlijk over de techniek: er is geen server (invariant 14). Profielen op dezelfde telefoon ziet de app
meteen. Iemand op een **andere telefoon** zie je alleen als die zijn kaartje of kookbeurten deelt
(via het ledenkaartje van blok F of een linkje **"Sync mijn voortgang"**; akkoord Stijn 6 okt).
Dat linkje werkt met het **huishouden én met vrienden**: zo kun je ook met vrienden levels en
kookbeurten vergelijken. Dat is een uitbreiding van het deelformaat, dus ontwerpen met een nieuwe
sleutel en bevroren tests (invariant 4), op Fable. Toekomst: met een server wordt delen automatisch
en beter (eerst ADR; raakt invariant 14).

**Bouwvolgorde:** (1) domein: XP-afleiding, seeded random, streak, curve + uitgebreide tests (ook een
simulatie van 30 jaar dagelijks gebruik); (2) profiel-level, XP-balk + "+12"-animaties;
(3) badge-catalogus (eerst ter goedkeuring), badge-niveaus, groepen, verborgen en tijdgebonden badges;
(4) ontgrendelingen + level-up-overzicht + avatar; (5) kookkalender huishouden en levels van
anderen via delen; (6) later: challenges (level 20), gouden modus. Elke stap apart online.

## Blok Z — Handleiding (altijd het laatste blok; voorheen "G")

Zie docs/STATUS.md. Twee versies:
1. **Handleiding voor iedereen:** zoekbaar, per functie (wat het doet, waar je tikt, wat je ziet).
2. **Handleiding voor Stijn ("achter de schermen"):** hoe XP berekend wordt, waar data staat,
   back-ups, delen, het woordenboek, de testlijst — wat gebruikers niet hoeven te weten.

## Besluiten van Stijn (6 okt 2026)

- **Doneerknop: ja (in 6A).** Link: **https://bunq.me/StijnRutgers** (vaste link, bedoeld om
  openbaar te zijn). Twee plekken: (1) onderaan **Het verhaal**; (2) een **aparte knop** in Meer,
  vlak bij "Feedback voor Stijn" (bv. "Steun dit project ☕"). Een gewone link die de bunq-pagina
  opent; geen betalingen in de app zelf. GitHub Pages is niet bedoeld voor commerciële sites: een
  fooi-link op een persoonlijk project is gebruikelijk, maar Stijn leest de Pages-voorwaarden zelf
  even na.
- **Bezoekers tellen: eerst de feedbackknop, daarna GoatCounter.** Stijn wil zelf de controle over
  zijn project houden: een eigen GoatCounter-account (gratis voor niet-commercieel gebruik), alleen
  aantallen, geen cookies, geen IP-adressen opslaan (die zijn persoonsgegevens onder de AVG). Dat
  wijzigt invariant 14 ("geen analytics"), dus eerst een ADR met precies wat er gemeten wordt en een
  regel in de app ("we tellen alleen het aantal bezoeken").
- XP per persoon, elkaars level/avatar zien, kookkalender huishouden: zie 6D "Samen".
- Keukens: één per recept, alleen echte (6B.2). Vaste lijst: per huishouden (6C). Lactose: alle
  ingrediënten, streng: ook oude en harde kaas telt als lactosehoudend (6B.1).
- Level 100 heet **"Best Chef of the Universe"** (in beide talen hetzelfde, tenzij Stijn nog een
  Nederlandse versie wil).
- Kookkalender en levels delen: voor nu via een **deelbaar linkje "Sync mijn voortgang"**, met het
  huishouden en met vrienden. Stijn overweegt later een server; dan kan het automatisch. Dat raakt
  invariant 14 (geen backend) en het deelformaat, dus dan eerst een ADR.
- Badges: "aflopen" = eenmalig; badges voor alle functies; doneer-badge met 5 niveaus tot € 100.

## Open vragen (bij de start van het betreffende blok beantwoorden)

1. **Doneer-badge (6D, later):** de route met ref + WhatsApp + dank-je-link (hierboven) bevestigen
   bij de start van dat deel, en de niveaus/drempels kiezen.
