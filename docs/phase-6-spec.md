# Fase 6 — wensen en verbeteringen van Stijn (6 oktober 2026)

Plan, nog niet gebouwd. Bron: Stijns lijst van 6 okt 2026. Volgorde en status staan in docs/STATUS.md.
Grootte: **S** = klein (minder dan een uur werk), **M** = middel, **L** = groot (meerdere sessies).
Alles NL + EN, CLAUDE.md-invarianten gelden; "eerlijk" = geen belofte die een telefoon niet waarmaakt.

## Blok 6A — Snelle verbeteringen en bugs

**Stand 9 okt 2026 — 6A-1 online:** punten 1 (vertaalbug), 2 (curator-ingrediënten), 3 (✓ Gekookt +
Beoordeel), 4 (installeerkaart), 5 ("Deel je nieuwe recepten"), 6 (Meer opgeruimd), 7 (feedback +
doneerknop), 8 (meer spraakcommando's + ?), 11 (woorden), 12 (profielkleuren), 15 (voorraadkast-vinkje +
eigen ingrediënt bewerken), 18 (categorie vs labels) zijn gebouwd. **Nog open = 6A-2 (de plak/prompt-
cluster):** 9, 10, 13, 14 (rest), 16, 17 — begin met het verzamelen van 10–15 echte plakteksten van
sites die Stijn en Gabi gebruiken (6A.17).

1. **✅ GEFIXT 8 okt (Fable-review): Bug: vertaling plakken werkt alleen goed als de app op Engels staat (M).** Oorzaak
   was de blokvolgorde in het AI-antwoord (eerste blok won), niet de UI-taal; parseTranslationAnswer kent
   nu taalblokken en de doeltaal (10 tests). Rest van dit punt ter info. Stijn (6 okt):
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
11. **✅ GEDAAN 8 okt. Ontbrekende woordenboekwoorden uit de screenshot (S).** sultana's (EN sultanas; eigen product
    naast rozijn) en dessertwijn (aliassen botrytiswijn, sémillonwijn; EN dessert wine). Meenemen in de
    Fable-review van blok E.
12. **Meer profielkleuren (S, wens Stijn).** Nu 6 kleuren (src/profile.ts `PROFILE_COLORS`); de
    gekozen kleur is al de achtergrond van het avatar-rondje met je beginletter. Uitbreiden naar ±12–16
    kleuren, elk met goed contrast voor de witte letter in licht én donker thema. In 6D blijft deze
    kleur de achtergrond achter de getekende avatar; extra's als verloop, goud of regenboog zijn
    vrij te spelen met levels.
13. **Toevoegen: alle keuzes meteen na de "+" (M, wens Stijn en Gabi).** Gabi plakt recepten van
    websites meestal zonder prompt rechtstreeks in de app; dat werkt heel vaak en ze vindt het fijn.
    De prompt zit nu te diep: Recepten → + → Nieuw recept → Importeer foto/tekst → Kopieer prompt.
    Voorstel: na de **+** direct vier keuzes, elk met één korte regel uitleg eronder (of een
    klein ?): **Zelf schrijven** · **Plak een recept** (tekst van een website; meestal genoeg) ·
    **Met AI** (prompt kopiëren, met foto of tekst; als plakken niet goed lukt) · **Kies een bestand**
    (recept, bundel of back-up). Dezelfde keuzes in de editor blijven bestaan.
14. **Regels voor de AI-prompt en de parser (M, uit Gemini-feedback 7 okt).** *(Deel gedaan 8 okt:
    "Nieuw ingrediënt" kiest nu het naamvak op de taal van de regel.)* Bij een recept dat
    zonder prompt bijna lukte, maakte Gemini met de prompt toch fouten: "naar smaak"/"to taste"
    vooraan de regel, en zout en peper op één regel. Daardoor raakte de app in de war en kwam bij
    "Nieuw ingrediënt" het Nederlandse "koosjer zout" in het Engelse vak.
    - Prompt: **één ingrediënt per regel** ("zout en peper" → twee regels).
    - Prompt: een vage hoeveelheid **achteraan tussen haakjes**: "koosjer zout [naar smaak]".
      Gemini stelde een nep-hoeveelheid voor ("1 snuf"); dat liever **niet**: dan staat er een
      getal dat niet in het recept stond, en dat schaalt mee en komt op de boodschappenlijst.
    - Parser robuuster: "naar smaak"/"to taste" overal in de regel herkennen (ook vooraan), en
      "zout en peper" als twee ingrediënten lezen. Tests met de echte voorbeeldregels.
    - "Nieuw ingrediënt" vult de naam in het vak van de taal waarin de regel staat (hoort bij
      dezelfde bugfamilie als 6A.1).
    Samen met 6A.10 (rechte haakjes) in één keer oppakken. Let op: "zout en peper" bestaat al als
    gecombineerd woordenboekitem (`zout-en-peper`, voorraadkast); het echte probleem was "naar smaak"
    vooraan de regel.
15. **"Voorraadkast"-vinkje duidelijker en achteraf aan te passen (S, Stijn 7 okt).** *(Deel (3)
    gedaan 8 okt: "koosjer zout"/"kosher salt" zijn aliassen van zout.)* Stijn maakte
    "koosjer zout" aan zonder het vinkje "Voorraadkast (zout, olie, kruiden …)", omdat niet duidelijk
    was wat het betekent: een product dat je meestal al in huis hebt en dat op de boodschappenlijst
    op 0 begint. (1) Andere tekst, bv. "Hoef je meestal niet te kopen (zout, olie, kruiden …)", met
    één regel uitleg; (2) in Woordenboek → eigen ingrediënt ook dit vinkje, de dieetvlaggen en de
    eenheid achteraf kunnen aanpassen (nu alleen namen en gangpad); (3) data: "koosjer zout" /
    "kosher salt" als alias bij `zout` (meenemen in de Fable-review van blok E).
    Tot die tijd kan Stijn zijn eigen "koosjer zout" via Meer → Woordenboek → **Fuseer met bestaand**
    → **zout** samenvoegen; dan gedraagt het zich als voorraadkast.
16. **Onbekende ingrediëntnaam makkelijk inkorten (M; Fable bedenkt de beste oplossing).**
    Voorbeeld Stijn 7 okt: "2 sneetjes knapperig stokbrood of brood [voor erbij, maakt het recept
    glutenvrij]" wordt "2 slices **?knapperig stokbrood**": het bijvoeglijk naamwoord en het
    alternatief ("of brood") houden de herkenning tegen; de rest van het recept ging perfect.
    Twee kanten, allebei doen:
    - **Betere prompt:** vraag om de kortste winkelnaam als ingrediënt; beschrijvende woorden
      (knapperig, vers, rijp) en alternatieven ("of brood") achteraan tussen rechte haakjes:
      "2 sneetjes stokbrood [knapperig; of brood; voor erbij]".
    - **Gebruiksvriendelijker in de app:** Stijns neiging was op de oranje "?"-chip te tikken of
      het vakje naar "stokbrood" te schuiven. Idee: tik op de chip → de woorden van de naam
      verschijnen als losse knopjes; tik "knapperig" weg (wordt notitie) en de app herkent
      "stokbrood" meteen. Eventueel onthouden: "knapperig" voortaan als beschrijving behandelen.
      Parser: "X of Y" leest X als ingrediënt en bewaart "of Y" als notitie.
    Nu al mogelijk, maar weinig zichtbaar: de knop **Koppel/Link** naast de chip → kies "stokbrood"
    (de regeltekst blijft staan). Hoort bij 6A.10 en 6A.14; samen oppakken.
    Aanvulling Stijn (7 okt): woorden aan- en uitzetten met kleuren is "uitstekend" (bv. oranje =
    onbekend, groen = het ingrediënt, grijs = notitie). De **Link**-knop durfde hij niet te gebruiken:
    bang iets fout te doen of dat "knapperig" verloren ging. Voorstel: Link vraagt eerst
    **"Is dit een variant van gewoon stokbrood, of een heel nieuw ingrediënt?"** en zegt erbij dat
    de tekst van de regel blijft staan. Fable ontwerpt de definitieve vorm met deze ideeën.
17. **Plakken van een website zonder prompt slimmer maken (M–L; belangrijk voor Gabi).** Gabi vindt
    de prompt te veel stappen en plakt recepten liever rechtstreeks; dat lukt al vaak. Doel: de gewone
    plak-route herkent meer van de gangbare vormen: kopjes als Ingredients / Method / Instructions /
    Directions / Preparation / Ingrediënten / Bereiding / Werkwijze / Benodigdheden, opsommingstekens,
    genummerde stappen, "Serves 4" / "Voor 4 personen", bereidingstijden. **Principe (Gabi): liever
    te veel dan te weinig.** Overbodige regels weghalen vindt ze niet erg; iets toevoegen wel. Dus bij
    twijfel een regel meenemen in plaats van weglaten. Aanpak: verzamel ±10–15 echte plakteksten van
    sites die Stijn en Gabi gebruiken (bv. BBC Good Food, Allerhande, Jamie Oliver, Leuke Recepten,
    24Kitchen) als testbestanden, en bouw de herkenning daartegen. De prompt blijft voor foto's en
    lastige gevallen.
18. **Categorie en labels uit elkaar houden (S).** Stijn zag "Salade" voorgesteld bij **Adopt**
    (Controleer mijn recepten), maar vond het niet tussen de labels. "Salade" is een **categorie**
    (één per recept: soep, salade, pasta …), geen **label** (meerdere: vegetarisch, snel …). In het
    voorstel en in de editor duidelijk tonen welk soort het is ("Categorie: Salade" / "Labels:
    vegetarisch, snel"). Fable controleert of de categoriechips in de editor Salade echt laten zien.

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
- **eigen avatar**, en die is **helemaal vrij te spelen met XP** (wens Stijn): iedereen begint met
  het rondje met beginletter op de eigen profielkleur (6A.12). Een paar levels verder komt de
  avatar-maker vrij met een simpel gezichtje; elk level daarna kan nieuwe onderdelen geven
  (kapsels, koksmuts, schort, pollepel, snor, brilletje …). Badges kunnen ook een onderdeel
  opleveren (bv. Fishlover → visje op je schort). Plus een **avatar-rand** die meekleurt met je
  level en vrij te spelen achtergronden (verloop, goud, regenboog). Welk onderdeel bij welk level
  hoort: uitwerken samen met de levelcurve, zodat er in elke fase iets nieuws te halen valt.
  **Een flinke bibliotheek** (wens Stijn): hoedjes, brillen, baarden/snorren, kapsels, shirtjes,
  achtergronden en accessoires, met **veel ingrediënten-thema's** (wortel achter je oor,
  broccoli-kapsel, citroenbrilletje, stokbrood onder je arm, chilipeper-snor, kaasblokhoed,
  aubergine-knuffel …). Vrijspelen per **level** of per **badge**; eerst eenvoudig, later steeds
  uitgebreider (zeldzame stukken op hoge levels en bij hoge badge-niveaus).
  Techniek: elk onderdeel is een klein stukje SVG in een databestand (bv. data/avatar-parts.json:
  id, laag, NL/EN-naam, ontgrendeld-door level of badge), lagen op elkaar getekend, geen nieuwe
  dependency. Je avatar is dan alleen een lijstje ids, dus klein genoeg om mee te sturen met
  "Sync mijn voortgang" en het ledenkaartje. De onderdelen tekenen is ontwerpwerk: in rondes
  uitbreiden, Stijn keurt per ronde goed;
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
**Anti-valsspeel (idee Stijn 13 okt):** maximaal 5 kookbeurten per dag leveren XP op; Fable werkt dit
uit samen met de XP-afleiding (een kookbeurt met een datum in het verleden telt ook mee voor díe dag).

## Ronde 13 okt 2026 — Stijns notities, geordend (nog niet gebouwd; geordend door Opus 5.5)

### 13A. Eén plakplek voor alles; de Inbox herzien (M–L; hoort bij 6A-2)
Stijn: "Ik wil één plakscherm voor links, recepten en kaartjes, niet verschillende plakschermen."
Hij vond het plakvak voor links niet: dat zit alleen in de Inbox, en recepttekst plakken zit alleen in
Toevoegen → importvak. "De Inbox is sowieso een wat vreemde functie."
Voorstel: één **Plak**-ingang (eerste keuze na de "+" en een knop bovenaan Home/Recepten) met één
tekstvak + "Plak van klembord". De app herkent wat erin staat en stuurt door:
- deellink(s) `#r/#p/#w/#b` (ook meerdere) → het voorbeeld met Bewaar (wat de Inbox nu doet);
- ledenkaartje `#f=` → "Voeg toe aan je huishouden";
- websiterecept of AI-antwoord → de editor met alles ingevuld.
De Inbox wordt "Ontvangen": de geschiedenis plus wat via het deelmenu (Android) binnenkwam, onder Meer.
iPhone: het plakvak blijft een gewone textarea (invariant 5). Samen bouwen met 6A.13 (keuzes na de +).
**Antwoord Stijn (13 okt):** de Inbox mag een overzicht worden van **alles wat in- en uitging**
(ontvangen én gedeeld, met datum en van/aan wie). Verder: de receptenlijst sorteert nu alleen A–Z;
erbij: **Recent bekeken**, **Eigen**, **Eigen & ontvangen**. De Home-indeling is "al best goed maar kan
misschien beter": Fable doet een voorstel (twee varianten met schets), Stijn kiest.

### 13B. Links openen de browser in plaats van de app; installeren duidelijker (M)
Stijn: een deellink tikken opent de browser, "en mijn browser is niet mijn profiel, dat is de app".
Duidelijker uitleggen hoe je installeert ("open de link die je kreeg in Chrome"); gebruik in de browser
echt afraden; verschilt per iPhone/Android.
Feiten: **Android**: een via Chrome geïnstalleerde app deelt zijn opslag met Chrome op dezelfde site; een
recept dat je in een Chrome-tabblad bewaart staat dan ook in de app, tenzij de standaardbrowser geen
Chrome is of de app niet echt via "App installeren" is geïnstalleerd. Dat links in de app openen is niet
gegarandeerd (ADR-0001), maar kan meestal via Android-instellingen → Apps → Rutgers' Recepten →
Standaard openen → "Ondersteunde links openen". **iPhone**: links openen altijd Safari, en Safari heeft
echt een eigen opslag (invariant 5/6); daarom bestaat de voorproefpagina met "Kopieer code".
Voorstel: (1) in browsermodus bij de start een duidelijke melding "Je gebruikt de app in de browser —
installeer hem" met stappen per platform en klein "Toch in de browser"; (2) Android: in Meer → Hulp een
stap-voor-stap "Zorg dat links in de app openen" + DEVICE-TEST-rij; (3) iPhone: de voorproefpagina nog
duidelijker ("Kopieer → open de app → Plak").
**Antwoord Stijn (13 okt):** zijn standaardbrowser was **Opera**; met Chrome als standaard werkt het.
Verklaring: Opera heeft een eigen opslag, dus een recept dat in Opera werd bewaard stond niet in de app.
Extra voorstel: op Android in een andere browser dan Chrome (Opera, Samsung Internet, Firefox; te zien aan
de user-agent) een knop **"Open in Chrome"** tonen via een `intent://…;package=com.android.chrome;end`-link,
die de link meteen in Chrome (en zo vaak in de app) opent; plus in de installatie-uitleg "zet Chrome als
standaardbrowser". Eerst op een echte telefoon testen (DEVICE-TEST). iPhone: een link kan Safari niet
omzeilen; daar blijft kopiëren → app → plakken de route.

### 13C. AI-antwoord plakken gaat mis met witregels en \[ \] (bug; hoort bij 6A-2) (M)
Stijn (screenshots 13 okt): bij ChatGPT gaat het "bijna altijd" mis met witregels: óf alles komt in de
naam ("=== NL === # Broccoli quiche Porties: 4 Categ…" in het Naam-vak), óf alle ingrediënten staan op één
regel; rechte haakjes komen binnen als "\[in plakken\]".
Waarschijnlijke oorzaak: ChatGPT schrijft Markdown; bij het kopiëren van de opgemaakte tekst vallen enkele
regeleinden weg en zet hij een backslash voor [ en ].
Allebei doen:
- **Prompt**: vraag om het HELE antwoord in **één codeblok** (```). ChatGPT en Gemini tonen dan een knop
  "Kopieer code" die de tekst exact kopieert, met regeleinden en zonder backslashes. Ingrediënten met
  "- " ervoor. In de uitleg bij de prompt: "tik op Kopieer code onder het antwoord".
- **Parser robuust**: backslash-escapes weghalen (\[ \] \* \_ \#); bekende markeringen ook midden in een
  regel herkennen ("=== NL ===", "# ", "Porties:", "Categorie:", "## Ingrediënten", "## Bereiding");
  een in elkaar geschoven ingrediëntenregel splitsen vóór elke hoeveelheid+eenheid en na "]".
  De twee screenshots (Broccoli quiche, Franse uiensoep-ingrediënten) worden testgevallen.

### 13D. Varianten en aanpassingen opnieuw ontwerpen (L; Fable ontwerpt)
Stijns wensen:
1. **Dino's notitie**: Dino (Hongaars) maakte een aangepaste goulash met een persoonlijke notitie; die kwam
   niet mee. Feit: notities zijn bewust privé per profiel en reizen nooit mee. Wens: een variant mét de
   notities, en een duidelijke manier om het alternatief te sturen.
2. Na veganiseren de ingrediënten die niet vervangen konden worden **op het recept zelf** markeren (nu
   alleen in het venster vóór opslaan).
3. Onderscheid **"Recept bewerken"** (dit recept verandert) en **"Eigen versie maken"** (het origineel
   blijft; jouw versie hangt eraan en is apart te delen, bv. "Dino's versie van goulash").
4. Glutenvrij/vegan/vegetarisch (en lactosevrij) **niet meteen als nieuw recept opslaan**, maar per recept
   één keer **goedkeuren** en daarna **wisselen**, zoals NL/EN: "kook glutenvrij" / "toon het glutenvrije
   alternatief". Ook wisselen tussen iemands versie en het origineel.
5. **Varianten als tabs/swipe** op het recept: vegetarisch, vegan, glutenvrij, lactosevrij altijd zichtbaar;
   stippellijn = nog niet bevestigd, volle kleur = bevestigd; van nature al glutenvrij = meteen vol (dan
   hoeft er niets te swipen); persoonlijke versies (Dino's) ook als tab; links/rechts swipen tussen
   origineel en varianten. Kleurvoorstel Stijn: glutenvrij geel, vegan groen, vegetarisch lichtbruin,
   lactosevrij wit; eventueel een kleurcodering op de achtergrond. "Een hippe oplossing."
Richting (Fable beslist): een dieetvariant wordt **geen kopie** meer maar een **goedgekeurde set
vervangingen bovenop het origineel** (zoals de Engelse tekst bij het recept hoort): één recept, een rij
gekleurde tabs boven de ingrediënten, swipen wisselt de weergave, en kookstand en boodschappenlijst volgen
de gekozen tab. Persoonlijke versies blijven echte recepten (`variantOf`) en verschijnen als extra tab.
Notities: nieuw veld **"Tip van de maker"** ({nl,en}) dat wél meereist; de privénotitie blijft privé, met
bij delen de vraag "notitie meesturen?". De kopie-varianten uit blok F (bv. "Franse uiensoep met Gruyère
(glutenvrij)") worden bij de overstap omgezet naar een tab. Raakt het deelformaat (een goedgekeurde
variant moet meereizen): nieuwe velden, bevroren tests (invariant 4).
**Antwoord Stijn (13 okt):** akkoord met tabs, "zolang Fable er iets moois van maakt: niet te druk, elegant
en functioneel". Varianten moeten **ook in de weekplanner gekozen kunnen worden**.

### 13E. Nagerechten en gebak (S–M)
Stijn: bananenbrood tussen de weekgerechten is onhandig; misschien splitsen in gebakken en niet-gebakken.
Nu staan "Stijn's Bananenbrood" en "Stijn's Clafoutis" in Oven en het Botrytis-dessert in Overig.
Voorstel: nieuwe categorieën **Nagerecht** en **Gebak** (zoet uit de oven: cake, bananenbrood, koekjes);
Kies 7 en Verras me kiezen alleen hoofdgerechten, tenzij je zelf iets anders toevoegt.
**Antwoord Stijn (13 okt):** categorieën **Nagerecht**, **Gebak** (taarten, cake, bananenbrood),
**Bijgerecht** en **Ontbijt & lunch**. De bestaande bijgerechten krijgen die categorie: Aardappelpuree,
Rucola-spinaziepesto en Tomatensalsa (alle drie "bij kabeljauw met notencrumble") en Naanbrood (bij dahl);
nu staan ze in Overig. Een bijgerecht is geen hele maaltijd, maar handig als je er brood of een salade bij
wilt: in de weekplanner per gerecht **"+ bijgerecht"** (sluit aan op het bestaande `goesWith`). De
importprompt vraagt de AI ook om deze categorieën. **Fable schrijft 20 gewone bijgerechten** (eigen
tekst, NL+EN): bv. stokbrood/kruidenboter, knoflookbrood, groene salade, komkommersalade, tomatensalade,
coleslaw, aardappelpuree, gebakken krieltjes, ovenfrietjes, aardappelpartjes, witte rijst, couscous,
gestoomde broccoli, sperziebonen met knoflook, gegrilde groenten, worteltjes met honing, rode kool,
tzatziki, guacamole, naanbrood (bestaat al: dan een ander, bv. focaccia).

### 13F. Stijns toevoegingen ingebouwd voor iedereen (M)
Bron: Stijns export van 13 okt (22 recepten: 15 van Stijn, 7 ontvangen van Gabi).
- **Geen reset nodig, juist niet doen.** Een ingebouwd recept krijgt een `b:`-id, het eigen recept heeft
  een `u:`-id; favorieten, kooklog, foto's, weekplan en deellinks wijzen naar het oude id. Plan: een
  migratie die per recept alles van het oude naar het nieuwe id overzet en de eigen kopie weghaalt (eigen
  wijzigingen blijven als aanpassing). Ontvangen recepten houden op beide telefoons het id van de maker,
  dus dit werkt ook bij Gabi. Een reset wist kooklog, badges en foto's (en later XP).
  Belangrijk: `u:`-ids blijven als alias geldig (invariant 1), zodat oude deellinks blijven werken.
- **Openbaar**: repo en site zijn openbaar; ingebouwde recepten staan dan online. Bereidingsteksten uit
  kookboeken of van websites zijn auteursrechtelijk beschermd (bv. "Botrytis Cinerea-dessert (The Fat
  Duck)", "Lièvre à la royale …"). Voorstel: alleen eigen/familierecepten inbouwen of de bereiding in
  eigen woorden herschrijven; de rest blijft een eigen recept dat je via een link deelt.
- Opgemerkt: twee bijna gelijke recepten van Gabi ("Pittige Ndujaworst met Aubergine Ragout" en
  "Pittige worst, aubergine en nduja ragù").
**Antwoord Stijn (13 okt):** alle recepten inbouwen; de twee nduja-ragù's zijn **dubbel** (één houden, de
ander via dezelfde id-migratie erop laten wijzen, zodat kooklog/favorieten samenkomen). Bij Stijn én Gabi
mogen er **geen dubbelen** ontstaan (de id-migratie hierboven). Bron: veel komt van internet; de
"Stijn's …"-gerechten zijn de favorieten van verschillende Stijnen uit de **Stijnchat** (vermelden als
"uit de Stijnchat", ook mooi voor Het verhaal).
Aanpak voor het auteursrecht (voorstel Opus, Fable/Stijn beslissen): ingrediëntenlijsten mogen zoals ze
zijn; de **bereiding herschrijven in eigen woorden** (kort en duidelijk, zoals de 196) bij het inbouwen,
met bronvermelding waar bekend. De twee uit kookboeken (Fat Duck-dessert, Lièvre à la royale) volledig
herschrijven of als eigen recept laten staan.

### 13G. Opslag & back-up duidelijker (S)
Stijns vraag: "Exporteer eigen recepten" en "Back-up" hebben allebei een deelbestand; verschil? En zijn
"Download" en "Deel het bestand" niet hetzelfde?
- **Back-up** = alles voor jezelf (recepten, favorieten, notities, kooklog, profielen, weekplan; foto's
  optioneel), om je eigen app terug te zetten via Herstel.
- **Export** = alleen je eigen en ontvangen recepten, aanpassingen en eigen ingrediënten, om aan iemand
  anders te geven; die importeert het via de Inbox (straks: de Plak-plek).
- **Download** zet het bestand in je Downloads-map; **Delen** laat je kiezen waarheen (WhatsApp, Drive …).
Voorstel: knoppen noemen wat ze doen ("Back-up voor mezelf" / "Mijn recepten aan iemand geven"), één knop
"Bewaar of deel" met de keuze daarna, en de uitleg in één zin eronder.

### Volgorde-voorstel (Stijn mag omgooien)
6A-2 + 13A + 13C (plakken en toevoegen, één plakplek) → 13B + 13G (installeren, browser, opslag) →
6B + 13E (labels, lactosevrij, keukens, nagerecht/gebak) → 13F (inbouwen) → 13D (varianten als tabs)
→ 6C (vaste lijst) → 6D (XP) → Z (handleiding).

### Open vragen ronde 13 okt
Vragen 1–8 zijn op 13 okt beantwoord:
7. **De Curator-pagina mag weg** (Stijn). Bij het weghalen: route `/more/curator`, de rij onder Hulp &
   over → Testen & nakijken, DEVICE-TEST rij 48 en de curator-tests; Engelse teksten van klassiekers
   verbeteren kan daarna nog via de editor (aanpassing van een klassieker). Code van "Stuur correcties"
   niet zomaar weggooien: dezelfde patch-route gebruikt de editor al.
8. **Inbouwen: de recepten gewoon overnemen**, licht versimpelen mag waar dat beter past (Stijn). Hij is
   "niet van plan hem nu te publiceren". **Let op (door Opus gemeld):** de site
   https://srutgers96-star.github.io/recepten/ en de GitHub-repo zijn nu al openbaar, dus inbouwen in
   data/recipes.json zet de recepten meteen online. Vóór het inbouwen dat met Stijn bevestigen, of eerst
   kiezen voor een alternatief: (a) de repo privé maken (GitHub Pages vanuit een privérepo vraagt een
   betaald GitHub-abonnement), (b) de Stijnchat-recepten niet inbouwen maar als bundelbestand aan Gabi en
   de Stijnen geven (blijft privé, werkt nu al), of (c) bewust accepteren dat ze online staan.

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
