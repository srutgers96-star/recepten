# Achter de schermen — hoe Rutgers' Recepten onder de motorkap werkt

Voor Stijn (8 november 2026, Fable). De handleiding in de app (Meer → Hulp & over → Handleiding) legt uit wat je ziet en waar je
tikt. Dit document legt uit *waarom* het zo werkt en waar alles staat. Geen code, wel de regels. Als iets hier niet klopt met de
app, dan wint de app en moet dit stuk worden bijgewerkt (bij elk blok dat de regels raakt).

## 1. Waar de app staat en hoe hij bij je komt

- De app is een website die je installeert. Hij staat op GitHub Pages, in twee kanalen: **main** op
  `https://srutgers96-star.github.io/recepten/` (de echte app op beide telefoons) en **next** op `…/recepten/next/` (de
  testversie, met een eigen icoon en eigen opslag). Sinds 23 oktober gaat elk afgerond blok meteen naar main; next staat op
  dezelfde versie.
- Elke keer dat ik op GitHub iets vastleg, bouwt GitHub beide kanalen opnieuw (ongeveer twee minuten). Beide telefoons merken bij
  de volgende start dat er een nieuwe versie is en tonen "Nieuwe versie — vernieuwen". De app vernieuwt nooit uit zichzelf (daar
  staat midden in een recept niets van op het spel).
- Er is geen server van onszelf, geen account, geen statistiek. Alles wat jij invoert staat alleen op jouw telefoon (en in je
  back-ups). Delen gaat via een link of een bestand, nooit via een centrale plek.

## 2. Waar je gegevens staan

- In de browseropslag van de telefoon (IndexedDB, via de bibliotheek Dexie), in een database die naar het kanaal heet: `recepten`
  voor main, `recepten-next` voor next. Daarom zie je op next nooit je echte gegevens en kan een half gelukt experiment op next
  nooit main raken.
- Tabellen (vrij vertaald): je eigen recepten, je aanpassingen aan klassiekers (per regel en per recept), je eigen
  ingrediënten (woordenboek), weekplannen, boodschappenlijsten, de voorraad ("Heb ik al"), foto's, en een logboek van
  gebeurtenissen (kookbeurten, sterren, foto's, gedeeld, ontvangen). Instellingen en profielen staan in een aparte tabel.
- De 216 klassiekers en de bijgerechten zitten in de app zelf (het bestand `data/recipes.json` in de code), tweetalig. Je
  aanpassingen liggen er als een dun laagje overheen: de klassieker zelf verandert nooit, jouw regel wint bij het tonen.
- Op de iPhone: de opslag van Safari en de opslag van de geïnstalleerde app zijn twee aparte bakjes. Wat je in Safari ziet (de
  landingspagina van een link) schrijft daarom bewust niets weg; het geeft je alleen de knop "Kopieer code" voor in de app.
- "Toestemming voor opslag" (de app vraagt dat bij elke start) betekent: de browser mag deze opslag niet zomaar opruimen als de
  telefoon vol raakt. Chrome geeft dat na installeren vanzelf; Safari beslist zelf.

## 3. Back-up en terugzetten

- Opslag & back-up maakt één JSON-bestand, `recepten-JJJJ-MM-DD.json`, met alles uit §2 (foto's alleen als je dat aanvinkt; dat
  maakt het bestand flink groter). Je kiest zelf waarheen: delen (WhatsApp aan jezelf, Drive, Bestanden) of downloaden.
- Terugzetten voegt samen: wat in het bestand nieuwer is wint, wat op de telefoon nieuwer is blijft. Een oude back-up zet dus
  niets stuk dat je sindsdien deed. De rode herinnering komt na 30 dagen zonder back-up als er wijzigingen zijn die nergens
  anders staan.
- Een back-up van main kun je op next terugzetten (en andersom): het is hetzelfde formaat. Zo test ik een nieuwe versie met echte
  gegevens zonder main te raken.

## 4. Delen: links, QR en bestanden

- Een deellink is de adres van de app met achter het hekje een code: `#r=` voor een recept, `#p=` voor een aangepaste klassieker,
  `#w=` voor een weekplan, `#b=` voor meerdere recepten (als dat nog in een link past), `#f=` voor je kaartje (naam, kleur,
  avatar), `#x=` voor je voortgang (level, badges, kookdagen) en `#l=` voor een boodschappenlijst. De code is de inhoud zelf,
  samengeperst en in letters gezet; er wordt niets opgehaald van een server. Daarom werkt een link ook zonder internet, en daarom
  kan hij lang zijn.
- Een QR is dezelfde link als plaatje. Tot ±1.600 tekens scant een telefooncamera hem betrouwbaar; daarboven zegt de app eerlijk
  "te groot voor een QR, deel de link". Een kort recept, een kaartje, een lijst of een weekplan past bijna altijd; een lang
  recept de helft van de keren.
- Wordt het bericht langer dan één WhatsApp-bericht redelijk aankan, dan wordt het een bestand (`.json`) in plaats van tekst; de
  link-knop blijft werken.
- Bij het delen stuurt de app precies één ding mee (of tekst, of een bestand), omdat WhatsApp en de iPhone anders één van de
  twee laten vallen.
- De code is een afspraak met een versienummer erin. Een nieuwere app mag nieuwe velden toevoegen (een oude app bewaart ze en
  negeert ze); een echt ander formaat krijgt een nieuwe letter achter het hekje, nooit een stille verandering. Elke versie van de
  code staat bevroren in de tests, zodat een link van vorig jaar altijd blijft openen.
- Android: een link opent de geïnstalleerde app, en de app staat in het deelmenu van andere apps (daarom kun je vanuit WhatsApp
  "Delen → Rutgers' Recepten" doen). iPhone: geen van beide; vandaar kopiëren → app → plakken. Dat is geen keuze van ons maar
  van Apple; het staat vast in de spelregels van het project (invariant 5).

## 5. Het woordenboek en het herkennen van ingrediëntregels

- Elke ingrediëntregel die je typt of plakt wordt ontleed in hoeveelheid, eenheid, ingrediënt en een kwalificatie ("rode" bij ui).
  De ruwe regel blijft altijd bewaard; de ontleding staat ernaast. Opnieuw ontleden leest de ruwe regel weer. Zo gaat er nooit
  tekst verloren, ook niet als de herkenning een keer mis is.
- Het woordenboek (ruim 1.600 ingrediënten met gangpad, dieetvlaggen en Engelse naam) zit in de app; jouw eigen ingrediënten komen
  erbij. Een oranje ?-chip betekent: dit woord ken ik niet; jij kiest "variant van … " of "nieuw ingrediënt".
- Het gangpad van een ingrediënt bepaalt de categorie op de boodschappenlijst; de dieetvlaggen bepalen of een recept als
  glutenvrij, vegetarisch, vegan of lactosevrij telt en welke ruil de versie-tabs voorstellen.

## 6. XP, levels en badges — de rekenregels

Het belangrijkste principe: **XP wordt nooit opgeteld en opgeslagen, maar elke keer opnieuw berekend uit de feiten** (kookbeurten,
sterren, foto's, eigen recepten, badges, uitdagingen). Verandert een regel, dan verandert iedereen z'n XP eerlijk mee, en niemand
kan XP "kwijtraken" door een bug in het optellen. De regelversie is 3.

- **Kookbeurt**: de eerste keer dat jij dít recept kookt 100 XP, elke volgende keer 10 minder, nooit onder de 50. Plus 5 per
  ingrediëntregel boven de 7 (maximaal +30). Plus 5 als je sterren gaf (ook achteraf).
- **Per dag**: kookbeurt 1 tot 3 tellen vol, 4 en 5 de helft, daarna niets. Een dag met vier of meer tellende kookbeurten is
  "druk"; vanaf de vierde drukke dag op rij levert koken even niets op. Meer dan 7 dagen terug gelogd telt niet.
- **Reeks**: dagen achter elkaar gekookt geven een vermenigvuldiger: vanaf 3 dagen ×1,1, 7 dagen ×1,2, 14 ×1,3, 30 ×1,5, 100 ×1,75,
  365 ×2. Eén vrije dag per week mag zonder de reeks te breken.
- **Variatie en crits**: elke beloning schommelt ±20 %, en 5 % van de keren is het "Cooked!" (×2), 1 % "Overcooked!" (×5). De
  schommeling komt uit een vaste berekening op de kookbeurt zelf, dus dezelfde feiten geven altijd dezelfde uitkomst — ook na
  terugzetten van een back-up.
- **Foto's**: eerste foto van een gerecht 30, daarna 20 (één beloonde foto per recept per dag). **Eigen recept**: 10, tweetalig
  15. **Hele week** (7 van 7 dagen gekookt in één week): 50. **Badge**: 50 × niveau (niveau 1 = 50 … niveau 8 = 400); een geheime
  badge 250. **Uitdaging gehaald**: de bonus die op de kaart staat (150–1500).
- **Levels**: 100 levels. De benodigde XP per level volgt een kromme (k = 11, macht 2,5), met de eerste tien stappen bewust
  dikker gemaakt (level 1 → 2 twee keer zo groot als de kromme zegt, dan 90 %, 80 % … 10 % extra bij 10 → 11), zodat de eerste
  levels niet in één avond voorbij zijn. De niveaukleur van de ring: geel vanaf 5, groen 10, blauw 20, rood 30, brons 40, zilver
  50, goud 60, platina 80.
- **Badges** (146) worden ook afgeleid uit de feiten: elke badge heeft een regel (ingrediënt gekookt, keuken, seizoen, reeks,
  functie gebruikt, samen gekookt …) en een ladder van acht drempels. Een geheime badge toont tot je hem hebt een "?"-kaartje.
  Een badge kan een avatar-onderdeel vrijspelen; levels spelen de rest vrij.
- **Uitdagingen** (vanaf level 20): elke maandag drie uit dertig, bepaald door een vaste berekening op weeknummer en profiel
  (iedereen in het huishouden krijgt dus een ander aanbod, maar het aanbod verandert niet als je de app herstart). Voortgang
  wordt uit de feiten geteld; een gehaalde uitdaging wordt een feit dat bonus-XP geeft. Opgeven kost niets.
- **Badges uit** in Meer verbergt alles van XP, levels, badges en avatar; de feiten blijven geregistreerd, dus aanzetten geeft je
  alles terug.

## 7. Profielen, huishouden en samen koken

- Meer mensen op één telefoon: elk profiel heeft een eigen naam, kleur, avatar, taal en kooklog. De recepten, het weekplan en de
  boodschappenlijst zijn van de telefoon (gedeeld), de kookbeurten en badges van het profiel.
- Een huishouden over twee telefoons werkt met kaartjes: jij deelt `#f=`, de ander voegt je toe, en bij "Stuur nieuwe naar …" staan
  je huisgenoten bovenaan. "Sync mijn voortgang" stuurt je level, badges en kookdagen van de laatste 90 dagen als `#x=`; de ander
  ziet ze in de kookkalender en op het voortgangskaartje. Er is geen live koppeling: wat je ziet is wat de ander het laatst
  stuurde.

## 8. Timers, geluid en de achtergrond

- Timers lopen in de app zelf; of ze doorlopen met het scherm uit hangt af van de telefoon. Op Android (Chrome, geïnstalleerd)
  blijft de melding komen; op de iPhone alleen zolang de app open staat, en met de stil-schakelaar aan alleen de melding (geen
  geluid). Wat per telefoon bewezen is staat in `docs/adr/0001-runtime.md`; de app belooft in zijn teksten nooit meer dan dat.
- Spraakcommando's werken alleen op Android (de iPhone-app heeft geen spraakherkenning in de browser); voorlezen werkt op beide.

## 9. Hoe er gebouwd wordt

- Jij zegt wat je wilt; ik (Fable) schrijf per blok een spec in `docs/specs/` met het gedrag, de teksten in beide talen, de
  bestandsverdeling en wat de bouwers niet zelf mogen beslissen. Opus bouwt volgens die spec (twee tot vier bouwers tegelijk,
  elk eigen bestanden), een integrator maakt alles groen en kijkt in de dev-app, één controleur zoekt fouten die hij zelf kan
  reproduceren, een fixer herstelt ze, en Haiku controleert de definitie van klaar. Daarna neem ik de open keuzes, leg ze vast
  in de spec en in `docs/STATUS.md`, en zet het blok op GitHub.
- "Groen" betekent: typecontrole, alle tests (ruim 1.700), de bouw van beide kanalen en de controle van de databestanden slagen.
- Vaste spelregels die nooit breken staan in `CLAUDE.md` (invarianten): een recept-id verandert nooit; een ruwe ingrediëntregel
  wordt nooit gewist; elke tekst bestaat in NL en EN; de deelcode is een afspraak met versie; de iPhone-plakroute blijft altijd;
  de Safari-landing schrijft niets; geen server, geen accounts, geen statistiek; geen nieuwe bibliotheek zonder een beslisnotitie.
- Waar wat staat: `docs/STATUS.md` (stand van zaken, bovenaan het nieuwste), `docs/specs/README.md` (bouwvolgorde en het
  register van alle instellingen en sleutels), `docs/specs/*.md` (de specs met onderaan per blok "Gebouwd" en mijn besluiten),
  `docs/adr/` (de beslisnotities), `docs/IDEAS.md` (jouw losse ideeën voor later), `docs/DEVICE-TEST.md` (de controlelijst die de
  bouw-gate gebruikt; voor jou is de handleiding).

## 10. Als er iets misgaat

- App start niet of ziet er leeg uit: eerst "Nieuwe versie — vernieuwen" afwachten, dan de app helemaal sluiten en opnieuw openen.
- Gegevens lijken weg: controleer of je in main zit en niet in next (ander icoon). Daarna Opslag & back-up → terugzetten.
- Een link opent niet op de iPhone: dat is normaal; kopieer het bericht, open de app, Meer → In & uit → Plak uit klembord.
- Een gedeelde code "van een nieuwere app": eerst de app vernieuwen, dan opnieuw plakken.
- Iets anders: Meer → Hulp & over → Feedback voor Stijn maakt een bericht met de versie erbij; stuur dat door naar de Claude-sessie,
  dan zoek ik het uit.
