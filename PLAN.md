# Rutgers' Recepten v2 — definitief herontwerpplan

*Datum: 24 september 2026. Voor Stijn. Gebaseerd op het winnende voorstel (PWA-first), aangevuld met de beste ideeën uit de andere drie, de geverifieerde platformfeiten en jouw twee besluiten D1 (compleet nieuwe app) en D2 (Android eerst; iPhone alleen als het weinig kost). Herzien na de kritische lezing: eerlijker over inspanning, timers, het deelmenu-manifest, het `/next/`-kanaal en de dev-loop.*

---

## 0. Besluiten uit de functiereview (28 september 2026)

Stijn heeft het plan per thema doorgenomen. Deze besluiten gaan vóór alles wat verderop in dit document anders staat.

| Thema | Besluit |
|---|---|
| **Oude data** | Geen eigen recepten/favorieten in Recepten2 → exportknop vervalt; Recepten2 wordt **helemaal niet** aangeraakt. |
| **Hosting** | Publieke GitHub-repo + GitHub Pages akkoord. |
| **Naam** | "Rutgers' Recepten" / "Rutgers' Recipes"; korte naam "Recepten". |
| **Telefoon** | Chrome is de standaardbrowser op zijn Android (WebAPK-route bevestigd). |
| **Look** | Warm cover-palet, maar **minimaal**: veel witruimte, één duidelijke actie per scherm; dark mode volgt het systeem. Illustraties in cover-stijl alleen als placeholder waar nog geen eigen foto is; nooit chaotisch. |
| **Startscherm** | Home "Vanavond?": deze week, dobbelsteen met filters, categorie-tegels, favorieten, laatst gekookt. A-Z één tik weg. |
| **Categorieën** | De 9 uit het verhaal + Vis + Wok & noedels; filterchips vegetarisch/snel/oven. |
| **Profielen** | Een **lijst** van profielen (naam, taal, kleur): minimaal Stijn en zij, "profiel toevoegen" voor wie later meedoet. Favorieten per persoon + "wij"-badge. |
| **Splash** | Weg; cover wordt icoon, header van "Het verhaal" en palet. |
| **Kookstand** | Belangrijk onderdeel. Eén stap per scherm, swipen tussen stappen, diepte/kleur toont waar je bent; scherm blijft aan; ingrediënten afvinken; prep-checklist als stap 0; "Gekookt!" aan het eind. **Timers** worden automatisch uit de tekst gezet, zijn per minuut (−/+) bij te stellen, lopen op wall-clock door terwijl je verder bladert of iets anders op je telefoon doet, en stappen kunnen "alvast/tegelijk" tijdens een lopende timer. Alarm bij gesloten app alleen als de fase-0-test het bewijst (eerlijk in de UI). Datamodel: `timers[]` per stap (min/max/label) + "tegelijk"-markering; bij eigen recepten automatisch afgeleid uit "bak 25-30 minuten", daarna corrigeerbaar — nooit codes typen. Aanpassen van recepten en persoonlijke notities moeten makkelijk zijn. |
| **Porties** | Schalen kan (2/4/6/8, slimme afronding), maar **standaard 4** (halveren maakt hoeveelheden vaak raar). |
| **Klassiekers** | Aanpasbaar als laag over het origineel, met "Toon origineel"/"Herstel". |
| **Vertaling 196** | Gratis in Claude Code-sessies (batches van ~10), gevalideerd door script. Eenheden: namen vertalen, metrisch houden, °F optioneel. |
| **Eigen recepten & taal** | Bij schrijven kies je **NL / EN / beide**. Ingrediënten renderen automatisch in beide talen via het woordenboek; naam en stappen via "Kopieer voor vertaling → Plak vertaling" of zelf typen. Curator-scherm voor haar review: ja. |
| **Foto-import (nieuw, fase 2)** | Foto van een kookboekpagina → app geeft een kant-en-klare prompt ("zet dit recept om naar dit formaat") → plakken met de foto in ChatGPT/Claude → antwoord plakken in de app → parser koppelt ingrediënten aan het woordenboek; onbekende: "bestaat al als X?" of "nieuw ingrediënt". Geen LLM in de app. |
| **Delen** | Inbox met badge; "Stuur nieuwe naar <naam>" (delta); "Deel als tekst" voor mensen zonder app; QR later, experimenteel. |
| **Weekplanner** | **Vrije lijst** van 1 tot N gerechten, **geen dagen**. "Kies N" met drie soorten willekeur: alles, één slot, of één slot **binnen een filter** (zoekresultaten / ingrediënt(en) als trekpot). "Verras me" met variatieregels blijft. |
| **Boodschappenlijst** | **Proto-lijst vóór bevestigen**: alle hoeveelheden berekend, per item −/+; zout/peper/olie/boter standaard op 0 en klein weergegeven, op 1 te zetten; losse items toevoegen (met autocomplete) — die groeien het woordenboek. Lijst werkt ook **zonder recepten** (vaste weekitems, afvinken, delen als tekst). |
| **Gangpaden** | **Eén logische standaardvolgorde voor iedereen**, inclusief categorieën zonder recept-ingrediënten (ontbijt & broodbeleg, dranken, snacks, huishoudelijk/non-food, drogisterij) → potentieel een all-in boodschappen-app. |
| **Kooklog** | Wie, wanneer, sterren, notitie; voedt "lang niet gegeten", statistieken, "Samen al N van de 196". |
| **Gamification (nieuw)** | Tweeledig, allebei apart uitzetbaar en nooit in de weg van gewone functionaliteit: (1) **dopamine-momenten** — confetti/animatie bij een recensie, eerste eigen recept, foto, mijlpaal; (2) een **badge-pagina**, uitgebreid en creatief, speelse namen ("Fishlover", "Van A tot Z", "Halverwege het boek", "Zeldzaam ingrediënt", "Kritische tong: 5× één ster", vegetarisch-reeksen, 200 gerechten gegeten, alles gekookt…), grotere mijlpalen extra feestelijk. Badges als **databestand** (`data/badges.json` met voorwaarde-regels) zodat Stijn ze later zelf kan uitbreiden. Vervangt het anti-feature "streaks/punten". |
| **Foto's** | Eigen foto van het resultaat per recept, groot te bekijken; badges daarvoor. |
| **Uitvoer** | Print / PDF-delen / kopiëren als tekst, in drie vormen: recepten, ingrediënten per recept, en de samengevoegde boodschappenlijst. |
| **Spraak in de kookstand (besloten 29-09)** | Twee opties, beide **optioneel** (schakelaar in Instellingen), fase 5: (1) **Voorlezen** van de huidige stap en de ingrediëntenlijst via de spraaksynthese van de telefoon (werkt op Android én iPhone, in de taal van het recept); (2) **Spraakcommando's** — "volgende", "vorige", "timer 10 minuten", "lees voor" — via spraakherkenning van de browser: alleen Android Chrome (herkenning via Google, dus met internet). **iPhone bewust uit (besloten 03-10):** Safari stopt in een beginscherm-app na elke zin en vraagt telkens opnieuw om de microfoon; `canListen()` is daarom false op iOS en Meer toont dat eerlijk. Voorlezen werkt wél op de iPhone. Vervangt het anti-feature "voice control" uit §9. |
| **Timerbalk** | Reset-knop ↻ (opnieuw vanaf de oorspronkelijke tijd) naast −1 / +1 / ×. Meerdere timers stapelen in de balk. Gebouwd 29-09. |
| **Receptpagina** | Geen vinkjes bij de ingrediënten (lezen, niet afvinken); afvinken alleen in de kookstand en straks in de boodschappenlijst. |
| **Kleine wensen (backlog)** | Grammen en milliliters altijd als heel getal tonen (62.25 g → 62 g); breuken (¼, ½, 1½) alleen bij lepels, stuks en teentjes. Lage prioriteit, meenemen bij de afwerking van de weergave (fase 5). |
| **Vertaling eigen recepten (besloten 29-09, direct na fase 3)** | (1) De sectie "Vertaling" (Kopieer voor vertaling → Plak vertaling) staat in élke kolomstand, als "Engels toevoegen" bij een Nederlands recept en "Nederlands toevoegen" bij een Engels recept; na plakken springt de editor naar "beide". (2) De foto/tekst-importprompt vraagt de AI om het recept in **beide talen** terug te geven (blok NL en blok EN, zelfde regels en stappen); de editor vult beide kolommen. (3) Op de receptpagina van een eigen recept zonder tweede taal: regel "Engels ontbreekt — toevoegen" die naar de editor springt. |
| **Timer-afloop (backlog, fase 5)** | Zichtbare knop "geluid aan/uit" in de timerbalk; in Instellingen het geluidje kiezen (pieptonen / belletje / melodie) met proefknop; trillen bij afloop (Android; iPhone kan niet trillen vanuit een web-app, alleen via een melding); hint dat de stil-schakelaar op de iPhone web-geluid blokkeert en dat meldingen dan de enige weg zijn. Aanleiding: Gabi hoorde de timer niet (geluid uit). |
| **Landingspagina iPhone** | Uitleg op de voorproefje-pagina nadrukkelijker: "Op een iPhone opent een link altijd Safari — kopieer de code en plak hem in de app (Inbox)"; knop-volgorde: Copy recipe code → Open the app. |
| **Groot ingrediëntenwoordenboek (backlog, fase 5)** | Het woordenboek wordt een eigen scherm: alle ingrediënten die je in een supermarkt vindt, tweetalig, met gangpad — ook zonder recept. Twee bronnen: (1) een eenmalige uitbreidingsronde door agents (±1500 courante supermarktproducten, NL/EN, gangpad, veg/vegan/gluten-vlaggen) als `data/ingredients.json`-aanvulling; (2) zelf toevoegen in de app (bestaat al via "Nieuw ingrediënt"), zichtbaar in Meer → Woordenboek met zoeken en bewerken. Gebruikt door de boodschappenlijst (losse items) en de slimme invoer. |
| **Vrienden (backlog, fase 5)** | Haalbaar zonder server als *contactkaart*: bij Profielen "Vriend toevoegen" via link of QR (`#f=`-token met naam, taal, apparaat-id). Wat het oplevert: "Stuur nieuwe naar Gabi" staat klaar met de juiste naam en laatst-verstuurd-datum, ontvangen recepten krijgen haar naam en kleur, en later kan een sleutel in die kaart versleuteld delen via een relais mogelijk maken. Wat het níet oplevert: automatisch pushen — WhatsApp blijft de drager (geen server). |
| **Dieet-categorieën (fase 5, data + UI)** | `glutenvrij`, `glutenvrij-optie`, `vegan`, `vegan-optie` komen erbij naast `vegetarisch`/`vega-optie`. Niet met een vertaalpass maar **afgeleid uit de ingrediënten**: het woordenboek krijgt per ingrediënt de vlaggen `veg` (bestaat), `vegan`, `gluten`; een script berekent de tags voor alle 196 en voor eigen recepten gebeurt dat live (met de mogelijkheid het handmatig te overrulen). Filterchips en de Kies-N-chips lezen tags generiek, dus nieuwe tags verschijnen vanzelf. |
| **Categorie & dieet in de editor** | De editor krijgt een rij "Categorie" (één keuze) en "Dieet" (chips), met een voorstel op ingrediëntenbasis ("lijkt vegetarisch") dat je kunt aanpassen. Nu kan de categorie alleen op de receptpagina gewijzigd worden; dat blijft. |
| **Varianten van een recept (backlog, fase 5)** | "Maak glutenvrije / vegetarische / vegan versie": kopie gekoppeld aan het origineel (`variantOf` + dieet-tag), met voorgestelde vervangingen uit het woordenboek (pasta → glutenvrije pasta, gehakt → vega-gehakt, sojasaus → tamari); op de pagina van het origineel staat "Ook als: glutenvrij · vegetarisch". |
| **Getal in Het verhaal** | 199 in de database, 196 in de app — tekst aangepast (29-09). |
| **Zelfde persoon op twee apparaten (vraag van Gabi, 30-09)** | Gabi maakte recepten op haar MacBook (browser) en zag ze niet op haar iPhone: elk apparaat heeft zijn eigen opslag, er zijn geen accounts. Nu: back-up maken op de Mac → bestand naar de iPhone → Herstel; daarna "Stuur nieuwe naar …" naar jezelf. Op de lijst: (1) een één-tik-flow **"Verhuis mijn gegevens naar een ander apparaat"** (back-up delen → op het andere apparaat openen → klaar), fase 5 blok D; (2) later optioneel: sync tussen eigen apparaten via een gedeeld bestand (iCloud/Drive) of versleutelde relay — nog steeds zonder accounts en zonder recepten op een server. |
| **Vertaling van ingrediëntregels (besloten 30-09, blok A-bis)** | Een regel = gecodeerd deel (aantal · eenheid · eigenschap · ingrediënt, vertaald door het woordenboek) + vrije tekst tussen haakjes. Vrije tekst wordt **nooit half vertaald**: bekende bereidingszinnen via `prep-phrases.json`, anders blijft de tekst in de brontaal (grijs) tot er een vertaling is. De vertaalprompt bevat alleen wat de app niet zelf kan (haakjesteksten, onherkende regels, naam, stappen); "Plak vertaling" vult uitsluitend die delen en overschrijft nooit gecodeerde regels. In de stand "beide" toont de tweede kolom voor gecodeerde regels de woordenboekvertaling grijs als placeholder. Plus: Amerikaanse eenheden (lb, oz, US cup → g/ml in NL) en Amerikaanse ingrediëntnamen als aliassen. Aanleiding: Gabi's "1 medium eggplant (approximately 1 pound)" en Stijns "(gesneden in blokjes van ongeveer 2 cm breed)". |
| **Play-test 30-09 (blok A-bis, aanvullingen)** | Woordenboek-hygiëne: "Nieuw ingrediënt" waarschuwt als de naam al bestaat; **Fuseer met bestaand** voor eigen ingrediënten (overal vervangen, ongedaan te maken) en een "Opruimen"-helper; eigen ingrediënten bewerkbaar. Vertaal-antwoord: titel ook uit Title/Naam of eerste regel. **Selecteer-stand** in de receptenlijst (delen als één bericht/bestand, + deze week, categorie, verwijderen). "Kies bestand" ook bij Toevoegen; na export op Android een regel "Opgeslagen in Downloads" en "Deel het bestand" als eerste keuze. |
| **Werkwijze** | Claude Code bouwt; Stijn test op de telefoons. Bij vragen tijdens het bouwen: doorgaan met de rest als Stijn niet meekijkt, vragen bundelen. |

---

## 1. Samenvatting & advies

1. **Stack:** één nieuwe TypeScript-webapp (Preact + Vite + Dexie/IndexedDB, handgeschreven service worker) in een nieuwe map `C:\Users\srutg\AndroidStudioProjects\RutgersRecepten`, gratis gehost op GitHub Pages. Recepten2 blijft onaangeroerd als bron van de 196 recepten, de cover en het verhaal.
2. **Op jouw Android** installeert Chrome de app als WebAPK: icoon in de app-lade, offline, staat in het WhatsApp-deelmenu (VERIFIED), updatet zichzelf. Dat een WhatsApp-link direct in de app opent is op Chrome **LIKELY**, niet zeker (Android 12+-domeinverificatie voor WebAPK's is ongedocumenteerd); we testen het op dag 1 en de Chrome-tab-fallback werkt hoe dan ook, met dezelfde opslag. **Op haar iPhone** wordt dezelfde URL een Home Screen-app (iOS 26: twee tikken) met de volledige app in het Engels.
3. **D2-oordeel (iPhone: ja, met voorwaarde en met een eerlijk prijskaartje).** De webroute kost je op Android drie concrete dingen: geen betrouwbaar achtergrond-alarm voor kooktimers (wat een webapp op de achtergrond nog kan melden is op **beide** platforms UNKNOWN en wordt in fase 0 getest), geen "Openen met" voor .json-bestanden, en een iets minder "native" gevoel dan Compose. De extra inspanning ten opzichte van alleen-native-Android is **niet nul maar ±7-10 hobby-dagen (±20%)**: de landingsbundel voor Safari, de iPhone-ontvangstflows, tests op twee telefoons en de Engelse editie-tooling. Daar staat tegenover: geen APK-sideloading, geen keystore, geen Google-verificatie in 2027, automatische updates, een snellere dev-loop met Claude Code, en een vriendin met een volwaardige app in plaats van niets. Dat is "weinig kost" in de zin van D2; daarom kiezen we het, maar met een **go/no-go in fase 0 (4 dagen)** op jouw eigen telefoon met een meetbare checklist, en een **tweede beslismoment aan het eind van fase 1** waarop je nog zonder verlies naar route (iii) kunt.
4. **Eerste bruikbare versie (eind fase 1, ±dag 16):** de 196 recepten op beide telefoons, bladeren/zoeken/koken, eigen recepten toevoegen en bewerken, favorieten per persoon, en al een eerste "Deel via WhatsApp" + plak-import. Engels en gestructureerde ingrediënten volgen in fase 2, volledig delen in fase 3, weekplanner + boodschappenlijst in fase 4.
5. **Inspanning, eerlijk:** een *hobby-dag* is ±3 geconcentreerde uren met Claude Code (een avond of een halve weekenddag). De **kern** (alles wat per fase moet) is ±50 hobby-dagen; kern plus de "als tijd over"-lijsten ±65-70; **reken op 60-80** voor Must + Should. Alles gratis (GitHub, Pages, Actions); enige mogelijke kostenpost is de vertaal/structureerpass: enkele euro's aan API-tegoed óf nul euro als je die pass in Claude Code-sessies doet (§6).
6. **Het contract tussen de telefoons is één tekst-token** (`#r=` deflate+base64url JSON) in een WhatsApp-bericht; op Android komt het via het deelmenu (of de link) in de app, op iPhone via kopiëren → app → plakken (het enige wat iOS toestaat).
7. **Het hart van de app is de wekelijkse "Kies 7 → boodschappenlijst"**, het familieritueel uit het Access-verhaal, gebouwd op gecodeerde ingrediënten met een woordenboek dat vertaling, schalen en optellen mechanisch maakt.
8. **Geen backend, geen accounts, geen analytics.** Back-up is één tik naar Files/Drive/WhatsApp.
9. **Onderhoud voor twee hobbyisten + AI:** één kleine codebase, `CLAUDE.md` met invarianten, tests alleen op data/parser/codec/optelling, een `/next/`-kanaal met **eigen database en eigen icoon** waar zij jouw halve features kan proberen zonder haar echte data te raken.
10. **Eerste stap vandaag:** jouw eigen recepten uit Recepten2 veiligstellen (als tekst, geen FileProvider nodig), map + repo + CI aanmaken, en de fase-0-testpagina op beide telefoons zetten.

---

## 2. Wat er nu is en wat we meenemen

Recepten2 is ±500 regels Kotlin/Compose zonder architectuur: alle state in `MainActivity`, eigen recepten als één JSON-string in DataStore, favorieten als `Set<String>` van **namen** (geen ids), navigatie op naam, geen bewerken/verwijderen, geen delen, geen categorieën, geen porties, geen git. Herschrijven is besloten (D1); dit is wat we meenemen:

| Meenemen | Hoe |
|---|---|
| `assets/recipes.json` (196 recepten, 1910 ingrediëntregels, alle Nederlands) | Eenmalige migratie door script naar schema v2 (gestructureerd, tweetalig). Bestand blijft in Recepten2 staan; wij lezen het alleen. **Eerst bevestigen dat Recepten2 de gezaghebbende bron is** — naast Recepten2 staan ook de mappen `Recepten` en `FamilyRecipes` (open vraag §11). |
| Jouw eigen recepten + favorieten op je telefoon | Kleine "Exporteer mijn recepten"-knop in Recepten2: `ACTION_SEND` met `type = "text/plain"` en `EXTRA_TEXT` = `{"userRecipes":[...],"favoriteNames":[...]}` (naar WhatsApp-naar-jezelf of Drive) plus een tweede knop "Kopieer naar klembord" (`ClipboardManager`). Dat zijn echt ±10-15 regels; **geen** `.json`-bestand via `ACTION_SEND`, want dat vereist een FileProvider (manifest-`<provider>`, `res/xml/file_paths.xml`, `content://`-URI) en is een klassiek vastlooppunt. Nieuwe importer accepteert dit formaat. Bouwt het project niet meer (AGP 8.13.1 / Compose BOM 2024.09 op de huidige Android Studio): fallback in §12. **Dag 0**, vóór iets anders. |
| Het About-verhaal (Access-database, 199 gerechten, zeven per week, de printer, Julia en Katinka, het boek, eerste editie dec 2025) | Wordt de pagina "Het verhaal / The story" in NL en EN, met groeiende editielijn en "Samen al N van de 196 gekookt". |
| `drawable/cover.png` (734 KB) | Wordt app-icoon, install-schermen en header; hercomprimeren naar ±120 KB WebP; palet (kobalt, tomaat, rozemarijn, oranje, papier) wordt het design-token-palet. |
| De bedoelde categorieën uit de About-tekst (Soep, Salade, Hartige taart, Pasta, Rijst, Vlees, Stamppot, Oven, Overig) | Worden echte data (`categories.json`) plus twee die de data nodig heeft: Vis en Wok & noedels. |
| Alfabetische lijst met plakkende letterkoppen, zoeken, donkere modus | Blijven, beter uitgevoerd (A-Z-rail, tweetalig zoeken, drieweg-thema). |
| Materiaal dat wegkan | 2-seconden-splash, paarse Material-standaard, naam-gekoppelde favorieten, N losse ingrediëntvelden in het invoerformulier. |

---

## 3. Harde feiten over de platforms

Alle ontwerpkeuzes hieronder volgen uit deze feiten. Status: **VERIFIED** (primaire bron), **LIKELY** (consistente secundaire bronnen), **UNKNOWN** (moet op de telefoons getest worden).

### iPhone (Home Screen-webapp)

| Feit | Status | Gevolg |
|---|---|---|
| Een link in een WhatsApp-bericht opent op iOS altijd Safari, nooit de geïnstalleerde webapp (geen link capturing, ook niet in iOS 26 / Safari 26.4). | VERIFIED | De link is een **preview-pagina**, geen import-kanaal. |
| Storage (IndexedDB, localStorage) van de Home Screen-app is een **aparte bucket**, gescheiden van Safari, van in-app browsers én van een tweede icoon van dezelfde site. | VERIFIED | De Safari-landingspagina mag **nooit** opslaan "voor de app". Een `/next/`-icoon heeft op de iPhone zijn eigen, lege data. |
| Web Share Target (app in het deelmenu) bestaat niet op iOS (WebKit bug 194593, open sinds 2019). | VERIFIED | Ontvangen op iPhone is pull-based: plakken, bestand, QR. |
| Home Screen-app is vrijgesteld van Safari's 7-dagen-opruiming (ITP). Safari-tab niet. | VERIFIED | Installeren op het beginscherm is verplicht; app waarschuwt permanent als ze in een Safari-tab werkt. |
| `navigator.storage.persist()` wordt heuristisch toegekend aan Home Screen-apps (Safari 17+); beschermt tegen verwijdering bij opslagdruk, niet tegen "Wis websitegegevens" of het icoon verwijderen. | VERIFIED / LIKELY | `persist()` bij elke start; back-up is de echte garantie. |
| `navigator.share({text})` werkt (iOS 12.2+); met `text`+`url` samen krijgt WhatsApp alleen de URL; met `files`+`text` valt het bestand weg. | VERIFIED | Altijd precies één veld delen. |
| Klembord: `writeText` in een tik werkt; `readText` in een tik toont een iOS "Plak"-callout die zij moet aantikken; een gewone `<textarea>` heeft geen API nodig. | VERIFIED | Import-scherm: knop én textarea. |
| Wake Lock werkt in Home Screen-apps sinds iOS 18.4 (WebKit noemt receptenapps als use case). | VERIFIED | Kookstand houdt het scherm aan. |
| Push werkt (16.4+) maar vereist een push-server en opent alleen de startpagina. | VERIFIED | Geen push (geen backend). |
| **Lokale meldingen zonder push** (een timer die afgaat terwijl de app open, vergrendeld of op de achtergrond is): alleen push-gedreven meldingen zijn geverifieerd; geen bron bevestigt dat een Home Screen-app zelf een melding kan tonen, laat staan op de achtergrond. | UNKNOWN | Timer-UI ontworpen op het slechtste geval (§9); test in fase 0 op haar iPhone. |
| Camera (`getUserMedia`) en `BarcodeDetector` in een Home Screen-app (standalone). | UNKNOWN | QR-scannen is experimenteel achter een flag; fallback: iPhone Camera-app scant de QR → Safari → Flow B. |
| iOS 26: elke site kan als webapp op het beginscherm; opent standalone ("Open als webapp" staat standaard aan). EU-DMA-beperking is in maart 2024 teruggedraaid. | VERIFIED | Installatie = Delen → Zet op beginscherm. |
| De geïnstalleerde app start altijd vanaf `start_url`; fragment/parameters bereiken de app nooit. | LIKELY | `start_url` stabiel; nooit data via URL "in de app" willen krijgen. |
| `<input type=file>` werkt; `accept` wordt op iOS genegeerd. | LIKELY | Bestanden valideren op inhoud. |
| Native iOS-app: bouwen/signen vereist macOS+Xcode (Kotlin/Native, Flutter, Expo allemaal); installeren op haar iPhone vereist €99/jaar (TestFlight) of gratis Apple-ID met **7-daagse** hersignering op hetzelfde wifi. EU-alternatieve distributie en AltStore PAL zijn geen hobby-routes. | VERIFIED | Native iOS is alleen een betaalde upgrade later (ADR-0008). |
| Compose Multiplatform for Web is Beta, canvas-gerenderd; of haar Safari de Wasm-GC-build draait is niet geverifieerd. | VERIFIED / UNKNOWN | Niet gebruikt. |

### Android

| Feit | Status | Gevolg |
|---|---|---|
| Een door Chrome geïnstalleerde PWA is een WebAPK: icoon in de app-lade, intent-filters voor de manifest-scope, dus links binnen scope horen in de app te openen. | VERIFIED (mechanisme) | Deel-URL valt binnen de scope. |
| Hoe WebAPK-links de Android 12+-domeinverificatie passeren is ongedocumenteerd. | UNKNOWN (LIKELY op Chrome) | Test op dag 1 met `adb shell pm get-app-links`; Chrome-tab deelt opslag met de WebAPK, dus "Bewaar" werkt ook daar. |
| Web Share Target werkt in Chrome Android na installatie; **één** `share_target`-object per manifest; bestanden vereisen `POST` + `multipart/form-data`, afgehandeld in de service worker. Niet in Samsung Internet/Firefox. | VERIFIED | "Delen → Recepten" vanuit WhatsApp voor bericht én document, via één gecombineerd POST-target (§4). |
| `navigator.share({files})` weigert `.json` (Chromium-allowlist: afbeeldingen, audio, video, PDF, .txt/.csv/.html). | VERIFIED | Bundels als `.json` als het kan, anders dezelfde bytes als `.txt`. |
| File Handling ("Openen met") en protocol handlers zijn desktop-only in Chrome. | VERIFIED | Android verliest "Openen met .json"; deelmenu en bestandskiezer vervangen het. |
| Chromium verwijdert alleen best-effort-origins onder opslagdruk; geïnstalleerde PWA krijgt persistentie heuristisch; nooit wegens inactiviteit. | VERIFIED | Laag risico; back-up blijft. |
| Alle GitHub-projectsites van één gebruiker delen de origin `<jij>.github.io`, en op Android Chrome deelt de WebAPK de opslag van het Chrome-profiel. | VERIFIED | `/recepten/` en `/recepten/next/` zien dezelfde IndexedDB tenzij de databasenaam verschilt (§4). |
| Sideloaded APK's: Google developer-verificatie live 30-9-2026 in vier landen, wereldwijd 2027; gratis limited-distribution-account (20 apparaten) bestaat. Play Store: $25 + ID + 12 testers/14 dagen. | VERIFIED | URL is het distributiekanaal; APK (TWA) alleen optioneel later. |
| WhatsApp opent links uit persoonlijke chats via de externe browser (in-app browser alleen voor business-CTA's). | LIKELY | Links kunnen door de WebAPK worden gevangen. |
| Chrome 132+ heeft `showSaveFilePicker` op Android; beperkingen (MIME-filter, nieuw bestand aanmaken) onduidelijk. | VERIFIED / UNKNOWN | Feature-detect; `<a download>` + share sheet als universele fallback. |
| **Timers op de achtergrond:** of JS-timers in een verborgen WebAPK worden afgeremd, of `showNotification` zonder push werkt en of een lokale melding vanuit een WebAPK op de achtergrond afgaat, staat in geen enkele geverifieerde bron. Native `AlarmManager` is betrouwbaar. | UNKNOWN | Fase-0-test op jouw telefoon (voorgrond / vergrendeld / achtergrond); timer-UI ontworpen op het slechtste geval. |

### WhatsApp & transport

| Feit | Status | Gevolg |
|---|---|---|
| Fragment (`#…`) bereikt nooit de server (RFC 3986); WhatsApp-preview wordt op de telefoon van de zender gemaakt van de kale URL. | VERIFIED | Recepttekst raakt nooit een server; preview is altijd de generieke app-kaart. |
| Gemeten: grootste Nederlandse recept 1.519 B JSON → 761 B deflate-raw → 1.015 URL-tekens; tweetalig ±1,5-2 KB. | VERIFIED | Eén recept past ruim in een link. |
| `CompressionStream('deflate-raw')`: iOS 16.4+, Chrome 103+; byte-gelijk aan Java `Deflater(nowrap=true)`. | VERIFIED | Geen library nodig; fflate als lazy fallback. |
| URL-limieten: Chrome 2 MB; Safari ±80 K; WhatsApp-bericht 65.536 tekens (secundair; Meta-API gedocumenteerd: 4.096). | VERIFIED / LIKELY | Eén bericht blijft onder **±3,5 KB** (ruim onder de gedocumenteerde 4.096); alles groter als .json-document (2 GB). |
| Blijft een 2 KB fragment-link één tikbare link in WhatsApp op beide telefoons? | UNKNOWN | Test op dag 1; importer accepteert sowieso het hele geplakte bericht. |
| `wa.me/?text=` zonder nummer opent WhatsApp met voorgevuld bericht. | VERIFIED | Fallback voor `navigator.share`. |
| QR: één recept (raw deflate-bytes, byte mode) ≈ versie 19-20 bij ECC L; boven ±versie 25 scant slecht van een scherm. | VERIFIED | QR alleen voor één recept. |

### Data, vertaling, hosting

| Feit | Status | Gevolg |
|---|---|---|
| Geen bestaande ingrediëntparser ondersteunt Nederlands. | VERIFIED | Eigen regelparser (±150 regels) + eenmalige LLM-pass. |
| Chrome's Translator API is desktop-only; Safari heeft geen web-vertaal-API; Apple's Translation-framework is native-only. | VERIFIED | Geen runtime-vertaling op telefoons; woordenboek + handmatig + copy-paste. |
| DeepL API Free bestaat niet meer (Developer: 1M tekens eenmalig); Google 500k/maand met billing. Corpus ±160k tekens. | VERIFIED / LIKELY | Eén LLM-pass die vertaalt én structureert; nooit in de app. Een Claude Code-abonnement geeft **geen** API-sleutel; twee uitvoeringsopties in §6. |
| GitHub Pages gratis voor publieke repo's (1 GB, 100 GB/maand); elke deploy met `actions/deploy-pages` **vervangt de hele site**. Cloudflare Pages gratis met privérepo en met automatische branch-previews op eigen origin. `assetlinks.json` werkt op Pages met `.nojekyll`. | VERIFIED | Publieke repo (recepten staan al in een gedrukt boek); één workflow die `main` én `next` in één artefact bouwt (§4); Cloudflare als privacy- of `/next/`-alternatief (ADR-0002). |

---

## 3b. iPhone: wel of niet?

De vraag uit D2, eerlijk beantwoord. Drie routes, allemaal vanaf jouw Windows-pc, zonder Mac, zonder betaalde accounts. Inspanning in hobby-dagen van ±3 geconcentreerde uren met Claude Code, kern-omvang (zonder "als tijd over").

| Criterium | (i) Alleen native Android (Kotlin/Compose) | (ii) Eén webapp/PWA voor beide telefoons | (iii) Native Android + installeerbare leesplank-PWA voor haar |
|---|---|---|---|
| **Android UX / polish** | Best: echte Compose, Material 3, voorspelbare back-gesture, edge-to-edge, per-app-taal via OS. | Goed, niet identiek: Chrome-WebAPK; scroll/keyboard-gedrag is browser-achtig; eigen design-systeem i.p.v. Material You. Merkbaar voor jou, niet storend voor een receptenapp — **te beoordelen in fase 0 met een checklist**, niet op gevoel. | Zoals (i). |
| **Functiebeperkingen op Android** | Geen. AlarmManager-timers die op de achtergrond afgaan, FLAG_KEEP_SCREEN_ON, "Openen met" voor .json, app-private opslag, ML Kit-vertaling (unverified). | Verliest: **achtergrond-alarm voor timers** (wat een webapp nog kan melden is UNKNOWN; ontwerp gaat uit van "alleen zolang de app open is"), **"Openen met" .json**, ML Kit. Houdt: wake lock, offline, share target (VERIFIED), link capture (LIKELY), opslag met `persist()`. | Geen. |
| **Delen/ontvangen op Android** | App Links (assetlinks.json) + ACTION_SEND/VIEW: link, deelmenu en document openen allemaal in de app. | Link → WebAPK (LIKELY, test op dag 1) of Chrome-tab met gedeelde opslag; deelmenu via `share_target` (VERIFIED) voor tekst én document; plakken; bestandskiezer. | Zoals (i). |
| **Delen/ontvangen op iPhone** | Zij krijgt een leesbaar WhatsApp-tekstbericht. Geen app. | Volledige app in het Engels: bewerken, plannen, boodschappenlijst, kookstand. Ontvangen = kopiëren → app → plakken (of bestand, QR); versturen = gewoon deelmenu. | **Installeerbare alleen-lezen PWA**: zelfde manifest, zelfde plak-import, IndexedDB, favorieten, zoeken, kookstand-basis, `persist()` en de Safari-versus-standalone-regels — zonder editor, parser-UI, planner of lijst. Haar eigen recepten moeten via jouw telefoon. |
| **Inspanning (kern)** | ±40-43 dagen. | **±49-52 dagen voor beide telefoons**: dezelfde data-, parser- en token-dagen als (i), plus ±7-10 dagen (±20%) voor landingsbundel, iPhone-ontvangstflows, tests op twee toestellen en Engelse-editie-tooling. | ±55-62 dagen: alles van (i) plus een tweede runtime (JS) voor de leesplank, renderregels dubbel, plus dezelfde iPhone-installatie- en plak-logica als (ii). |
| **Onderhoud** | Gradle/AGP/Compose-upgrades, keystore bewaren, APK-sideloading + Google-verificatie 2027 (gratis registratie, 20 apparaten), geen auto-updates; alleen jij kunt bouwen. | Eén kleine TS-codebase; `git push` = deploy; auto-update via service worker; geen keystore; zij kan branches op `/next/` proberen en met Claude Code meebouwen. WebKit/Chrome-gedrag jaarlijks herchecken. | Alles van (i) plus drift tussen twee renderers, elke datamodelwijziging op twee plekken. |
| **Kosten** | €0 | €0 | €0 |
| **Jouw Kotlin-kennis** | Volledig benut. | Terzijde geschoven voor de app; blijft nuttig voor de exportknop en een optionele Capacitor/TWA-schil later. | Volledig benut. |

**Oordeel.** Route (ii). D2 stelt twee voorwaarden: weinig kosten in Android-UX/functies, en weinig extra inspanning. De extra inspanning is **±7-10 hobby-dagen (±20%)** — geen nul, maar aanvaardbaar omdat die dagen precies de dingen kopen die (i) je blijvend kosten: geen sideloading, geen keystore-beheer, geen Google-verificatie in 2027, geen handmatige APK-distributie bij elke wijziging, en een dev-loop waarin `git push` de app op beide telefoons bijwerkt. De Android-kosten zijn drie concrete, benoembare verliezen (achtergrond-alarm, "Openen met", native-gevoel) tegenover die winsten en één grote: je vriendin heeft een volwaardige app en kan er echt aan meebouwen, wat de kern van je vraag was ("samen lekker uitbouwen"). De verliezen raken geen van de zes harde eisen R1-R6. Wat zij bij (ii) wint ten opzichte van (iii) in één zin: eigen recepten invoeren, vertalen, plannen en de boodschappenlijst maken op haar eigen telefoon in plaats van via de jouwe.

**Voorwaarde 1: fase 0 is een go/no-go op jouw telefoon, met een meetbare checklist.** Vier dagen, een wegwerp-PWA op jouw Android én haar iPhone die **realistisch genoeg is om het gevoel te beoordelen**: de volledige lijst van 196 namen met plakkende letterkoppen en A-Z-rail, één receptdetail met lange scroll, een toevoegformulier met meerdere tekstvelden (keyboard-gedrag), een deelknop, een plakknop, een testtimer en een installkaart. Geen "voelt als een website" maar deze lijst, elk item **pass/fail**, vastgelegd in `docs/adr/0001-runtime.md`:

| # | Test (jouw Android, tenzij anders) | Pass |
|---|---|---|
| 1 | Icoon in de app-lade en in Instellingen → Apps (WebAPK) | ja |
| 2 | Geen adresbalk; statusbalk in thema-kleur; safe-area klopt | ja |
| 3 | Koude start offline (vliegtuigmodus, na herstart telefoon) | < 2 s tot lijst |
| 4 | Lijst van 196 scrollt vloeiend; plakkende koppen; overscroll voelt niet als browser-pull-to-refresh | ja |
| 5 | Toetsenbord in het formulier bedekt geen invoerveld; geen zoom bij focus (16 px inputs) | ja |
| 6 | Terug-gebaar: verlaat de app alleen vanaf Home, nooit midden in een recept | ja |
| 7 | Tekstselectie/lang drukken doet niets browser-achtigs op knoppen en lijstrijen | ja |
| 8 | 2 KB `#r=`-link in WhatsApp tikbaar; opent in de app (`pm get-app-links` = verified) of in Chrome-tab met werkende "Bewaar" | noteren welke |
| 9 | "Delen → Recepten" in het WhatsApp-deelmenu voor een bericht én voor een .json-document (POST-target) | beide |
| 10 | `navigator.share({text})` naar WhatsApp; `readText` + plakken; textarea-plak | ja |
| 11 | Timer 30 s: (a) app op de voorgrond, (b) scherm vergrendeld, (c) app op de achtergrond — wat gaat af (melding / geluid / trilling)? | noteren; alleen (a) is vereist |
| 12 | `persisted()` = true na installatie | ja |
| **iPhone** | Beginscherm-installatie (standalone), `persisted()`, share({text}) naar WhatsApp, `readText`-callout, textarea-plak, offline start na herstart, 2 KB-link tikbaar (opent Safari-landing), **timer (a)/(b)/(c)** — als zij er niet bij is: via de ingebouwde checklistpagina die de resultaten als kopieerbare tekst teruggeeft (§11) | noteren |

**Go** = 1-7, 9, 10, 12 pass, 8 minstens de tab-fallback, 11 minstens (a). Zeg jij bij 2, 4, 5 of 6 "nee", dan gaan we naar (iii): de UI wordt Kotlin/Compose, de webapp krimpt tot landingspagina + installeerbare leesplank, en alles uit fase 1-2 (schema, parser, woordenboek, token, migratietools, tests in Node) blijft één op één bruikbaar.

**Voorwaarde 2: tweede beslismoment aan het eind van fase 1 (±dag 16).** Dan gebruik je de echte app twee weken op je telefoon. Bevalt het niet, dan is alle domein- en datawerk (`src/domain/`, `data/`, `tools/`, tests) nog steeds herbruikbaar in route (iii); alleen de schermen (fase 1, ±8 dagen) zouden opnieuw in Compose moeten.

**Eerlijke verlieslijst bij (ii)** (ook in ADR-0001): geen achtergrond-alarm voor timers; geen "Openen met .json"; geen Material You; geen ML Kit; link-capture op Android niet gegarandeerd; QR-scan op iPhone onzeker.

**Wat zij concreet krijgt bij (ii):** dezelfde app als jij, UI in Brits Engels, de 196 klassiekers vertaald en door haar zelf nagekeken (Curator-scherm), ingrediënten die automatisch in het Engels renderen, haar eigen recepten in het Engels (die bij jou in het Nederlands verschijnen voor zover het woordenboek reikt), weekplanner en boodschappenlijst, kookstand met wake lock, back-up naar Files, en ontvangen van jouw recepten in ±10 seconden (lang drukken → Kopieer → app → Plak). Bundels en back-ups kosten haar drie extra tikken (Bewaar in Bestanden → app → Kies bestand); dat staat ook zo in §7.

**Wat later nog kan (ADR-0008, niet gepland):** als het plakken na twee maanden echt gebruik irriteert, koopt €99/jaar een native iOS-schil via cloud-build + TestFlight met Share Extension en Universal Links; het token, de datafiles en `src/domain/` gaan ongewijzigd mee. Voor Android kan een Capacitor-schil (Kotlin-glue van jouw hand) ooit AlarmManager-timers en "Openen met" toevoegen; ook dat verandert niets aan de webapp.

---

## 4. Architectuur

### Stack

| Laag | Keuze | Waarom |
|---|---|---|
| UI | **Preact 10 + TypeScript 5**, hash-router van ±40 regels, `@preact/signals` voor de paar globale stores | ±4 KB, gewone TSX + hooks: wat Claude Code het betrouwbaarst schrijft en wat een beginner kan lezen. Geen Svelte/Vue-compilersyntax, geen SSR, geen state-library. |
| Build | **Vite 6**, `vite-plugin-pwa` in **injectManifest**-modus (eigen `sw.ts` van ±80 regels, precache-lijst gegenereerd) | Eigen SW-code blijft leesbaar; alleen de bestandslijst wordt gegenereerd. HTTPS voor telefoontests: zie "Dev-loop" hieronder — `vite-plugin-mkcert` is **niet** de primaire route. |
| Opslag | **Dexie 4** over IndexedDB; genummerde upgrade-functies; `liveQuery`; **databasenaam afgeleid van `import.meta.env.BASE_URL`** (`recepten` op `/recepten/`, `recepten-next` op `/recepten/next/`) | Declaratief schema, migraties met fixture-tests; `/next/` raakt nooit de echte data. Geen localStorage voor records, geen OPFS. |
| Compressie | `CompressionStream('deflate-raw')` native; **fflate** lazy geladen als fallback | iOS 16.4+/Chrome 103+; byte-compatibel met Kotlin `Deflater(nowrap=true)`. |
| Zoeken | Handgerolde index (196 records) | Geen library nodig. |
| QR | `qrcode` (encode), `BarcodeDetector` + `jsQR` fallback (decode), achter een flag, **experimenteel** | Same-room-overdracht; camera in iOS-standalone is UNKNOWN. |
| Tests | **Vitest** + één **Playwright**-smoketest (WebKit, iPhone-viewport, mobiele UA, niet-standalone) | Alleen waar data/parser/codec/optelling kan breken. Playwright is een **regressiewacht**, geen vervanging van de iPhone: het emuleert geen storage-isolatie, Plak-callout of standalone-modus. |
| Tools | **Node 22**-scripts in `/tools` (migratie, LLM-pass, validatie, review-patch, promote, token-meting, parse-telling) | Je hebt Node 22; dezelfde parser als de app (`src/domain/`). |
| Hosting | **GitHub Pages** vanuit publieke repo via **één** workflow die `main` (→ `/recepten/`) en `next` (→ `/recepten/next/`) samen in één artefact bouwt | Gratis, `git push` = deploy. Elke Pages-deploy vervangt de hele site, dus twee losse deploys zouden elkaar wissen. Cloudflare Pages + privérepo (met gratis branch-previews op eigen origin) is het gedocumenteerde alternatief (ADR-0002). |
| Android-schil | Chrome WebAPK (geen build). Optioneel later: Bubblewrap TWA-APK als GitHub Release | Alleen als ooit een niet-Chrome-icoon of Play-listing gewenst is. |
| Dependency-lijst bevroren | Preact, signals, Dexie, fflate, qrcode/jsQR (flag), Vite + plugins, Vitest, Playwright | Elke extra dependency vereist een ADR-regel. |

### Ondersteuningsvloer

- **Volledig ondersteund:** iOS 17+ (Home Screen-app) en Chrome Android 120+.
- **iOS 16.4-17:** geen `persist()` (Opslag-paneel toont "onbekend"); **onder 18.4** geen wake lock in de Home Screen-app (kookstand toont de hint "zet Automatisch vergrendelen op Nooit").
- **Onder iOS 16.4 / Chrome 103:** fflate-polyfill laadt lazy voor het token; verder niet getest en niet ondersteund.
- Samsung Internet/Firefox op Android: werkt als website/snelkoppeling, zonder deelmenu en link-capture; de app zegt dat bij installatie.

### Repo-layout (nieuwe map)

```
C:\Users\srutg\AndroidStudioProjects\RutgersRecepten\      # publieke GitHub-repo "recepten"
├─ CLAUDE.md                 gebruikers & telefoons, commando's, invarianten, definition of done
├─ CONTRIBUTING.md           plain English voor haar: installeren, /next/ (eigen data!), review-pagina,
│                            hoe iets voorstellen; bijlage: CA-installatie voor lokale HTTPS (optioneel)
├─ README.md
├─ package.json              dev (--host) · check · test · test:e2e · validate:data · build
│                            · migrate · translate · apply-review · promote · measure-tokens · measure-parse
├─ .github/workflows/pages.yml  één workflow: bouwt main én next, deployt één artefact (schets hieronder)
├─ .github/ISSUE_TEMPLATE/   idee.md · bug.md · vertaling.md (telefoonvriendelijk)
├─ .claude/skills/           add-classic · translate-recipe · release
├─ docs/adr/                 0001-runtime (go/no-go + checklist), 0002-hosting, 0003-dexie, 0004-share-token,
│                            0005-no-backend, 0006-ios-receive-is-pull-based, 0007-paid-native-ios-path
├─ data/                     BRON VAN WAARHEID
│  ├─ recipes.json           {schema:2, dataVersion, recipes[]} tweetalig, gestructureerd
│  ├─ ingredients.json · units.json · prep-phrases.json · qualifiers.json · categories.json
│  ├─ glossary.json          keukenwoordenboek NL→EN
│  ├─ i18n/nl.json · i18n/en.json
│  └─ changelog.json         tweetalig "Wat is nieuw"
├─ public/
│  ├─ manifest.webmanifest   id/start_url/scope "/recepten/", standalone, maskable icons,
│  │                         ÉÉN share_target (POST multipart), shortcuts (Android)
│  ├─ manifest.next.webmanifest  id/start_url/scope "/recepten/next/", naam "Recepten NEXT", eigen icoon
│  ├─ share/index.html       fallback-pagina voor share_target (meta-refresh → /recepten/#/import)
│  ├─ review/                statische review-pagina (Engelse editie), eigen kleine bundel
│  ├─ icons/ · splash/ · cover.webp
│  ├─ .nojekyll
│  └─ .well-known/assetlinks.json   alleen als de optionele TWA ooit bestaat
├─ src/
│  ├─ boot.ts                beslist: landingsbundel of volledige app (regel hieronder)
│  ├─ main.tsx · app.tsx · router.ts · flags.ts · i18n.ts
│  ├─ landing.ts             APART, piepklein entry-bundle voor de Safari-viewer (#r= decoderen,
│  │                         tonen, "Copy recipe code"); geen Dexie, geen router, schrijft NOOIT
│  ├─ sw.ts                  precache + share_target POST-handler + update-prompt
│  ├─ domain/                FRAMEWORK-VRIJ (ESLint no-restricted-imports: geen preact, geen dexie)
│  │   model.ts · parser.ts · units.ts · dictionary.ts · render.ts · scale.ts · aggregate.ts
│  │   merge.ts · token.ts · message.ts · steps.ts · timers.ts · search.ts · planner.ts
│  ├─ db/                    schema.ts · migrations.ts · repo.ts (één repository-module; dbName uit BASE_URL)
│  ├─ screens/               home · all · recipe · cook · edit · week · shopping · import · inbox
│  │                         settings · storage · curator · book · glossary · experiments · devicecheck
│  └─ components/            design-tokens uit het cover-palet, dark mode, safe-area
├─ tools/                    migrate-from-recepten2.ts · translate-batch.ts (+ prompts/) · validate-data.ts
│                            apply-review.ts · promote.ts · measure-tokens.ts · measure-parse.ts · review-page.ts
├─ tests/
│  ├─ parser.golden.json     alle unieke regels: parse + gerenderde NL- én EN-string
│  ├─ parser.test.ts · render.test.ts · token.test.ts (196 round-trips + bevroren v2-tokens)
│  ├─ aggregate.test.ts · scale.test.ts · merge.test.ts · migrations.test.ts · validate-data.test.ts
│  └─ e2e/smoke.spec.ts      iPhone-viewport: toevoegen → delen → kopiëren → plak-import → in lijst;
│                            plus: WebKit mobiele UA + #r= + niet-standalone → landingsbundel
└─ android-twa/              optioneel, later; keystore NOOIT in de repo
```

Recepten2 blijft waar het staat; alleen de exportknop wordt toegevoegd.

### Welke bundel laadt bij dezelfde URL (`boot.ts`)

Landingspagina en volledige app zijn **hetzelfde `index.html`**. De regel, ook als invariant in `CLAUDE.md` en als Playwright-test:

```ts
const hasToken   = /^#(r|p|w)=/.test(location.hash);
const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
const isIOS      = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (hasToken && isIOS && !standalone) import('./landing');          // Safari-tab: alleen kijken + kopiëren, nooit opslaan
else import('./main').then(m => m.start({ openImportFromHash: hasToken }));  // alles anders: volledige app + import-preview
```

Gevolg: op haar iPhone krijgt een getikte link altijd de opslagvrije viewer (de Safari-bucket is toch onzichtbaar voor de app); op jouw Android krijgt een Chrome-tab de volledige app met "Bewaar" (gedeelde opslag met de WebAPK); een Android-toestel met Samsung Internet krijgt ook de volledige app in de tab, waar de data dan gewoon in die browser leeft.

### Hoe de app op de telefoons komt

- **Android:** URL openen in Chrome → "Installeren". Chrome maakt een WebAPK. Vrienden met Android: dezelfde URL. Nooit een APK via WhatsApp.
- **iPhone:** URL openen in Safari → Delen → Zet op beginscherm. De app detecteert `display-mode: standalone`; in een Safari-tab toont ze een **permanente** (niet eenmalige) banner: "Zet me op je beginscherm, anders kan Safari je recepten na 7 dagen wissen."
- **Updates:** service worker downloadt de nieuwe versie stil; toepassen alleen na de tik "Nieuwe versie — vernieuwen", nooit midden in een recept. About toont versie + git-SHA.

### Het `/next/`-kanaal, veilig

- `next` wordt gebouwd met `--base=/recepten/next/` en krijgt `manifest.next.webmanifest`: `id`, `start_url` en `scope` = `/recepten/next/`, naam **"Recepten NEXT"**, icoon met een gele band. Dexie-databasenaam `recepten-next`: op Android (gedeelde origin-opslag) raakt een halve schema-migratie op `/next/` dus **nooit** de echte `recepten`-database.
- Op de iPhone is het NEXT-icoon een eigen opslagbucket met **lege** data. Testen op `/next/` begint daarom altijd met "Herstel uit back-up" (één bestand uit Files); dat staat als eerste stap in `CONTRIBUTING.md`.
- Bekende wrat: `/recepten/next/` ligt binnen de scope van de hoofd-WebAPK, dus een NEXT-link die jij op Android in WhatsApp tikt kan in de hoofdapp openen. Voor een testkanaal aanvaardbaar (je opent NEXT via zijn eigen icoon); bijt het, dan verhuist `next` naar een eigen origin — Cloudflare Pages branch-preview of een tweede repo `recepten-next` — een uur werk, vastgelegd in ADR-0002.

### CI: één workflow, één artefact (`.github/workflows/pages.yml`, schets)

```yaml
name: pages
on: { push: { branches: [main, next] } }
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { ref: main, path: main }
      - uses: actions/checkout@v4
        with: { ref: next, path: next }
        continue-on-error: true                       # next hoeft niet te bestaan
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: cd main && npm ci && npm run check && npm run validate:data && npm run build -- --base=/recepten/
      - run: cd main && npx playwright install --with-deps webkit && npm run test:e2e
      - run: |                                        # next-build mag falen zonder main te blokkeren
          if [ -d next ]; then cd next && npm ci && npm run build -- --base=/recepten/next/ \
            && mkdir -p ../main/dist/next && cp -r dist/* ../main/dist/next/; fi
        continue-on-error: true
      - uses: actions/upload-pages-artifact@v3
        with: { path: main/dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

Elke push naar `main` óf `next` bouwt dus **beide** takken opnieuw en deployt de site als geheel; niets wist elkaar.

### Dev-loop op de telefoons (HTTPS is verplicht voor deelmenu en klembord)

1. **Primair: `git push` naar `next`** → na ±2 minuten staat het op `/recepten/next/` op beide telefoons, met echte HTTPS. Voor 90% van het werk genoeg.
2. **Alleen jouw Android, zonder certificaten:** `chrome://flags/#unsafely-treat-insecure-origin-as-secure` met `http://192.168.x.x:5173` (alleen voor testen) — dan werken share en klembord ook op `npm run dev -- --host`.
3. **mkcert (optioneel, beide telefoons):** `vite-plugin-mkcert` is één regel op de pc, maar de telefoons moeten de mkcert-root-CA vertrouwen, anders falen share/klembord stil en lijkt de app kapot. Android: `rootCA.pem` naar de telefoon → Instellingen → Beveiliging → Certificaat installeren (CA). iPhone: `rootCA.pem` mailen/AirDroppen → profiel installeren onder Instellingen → Algemeen → VPN en apparaatbeheer → daarna **Instellingen → Algemeen → Info → Certificaatvertrouwensinstellingen → volledig vertrouwen aanzetten**. Stappen met screenshots in `CONTRIBUTING.md`; alleen doen als 1 en 2 tekortschieten.

### Offline & opslag

- Precache: app-shell + `data/*.json` (±400 KB) → volledig offline op beide telefoons.
- IndexedDB (Dexie): v1 in fase 1 (`builtins`, `userRecipes` met raw-only regels, `favorites`, `settings`, `imports`); **v2 in fase 2** parseert bij de upgrade elke eigen regel opnieuw uit `raw` met de nieuwe parser (raw blijft), en `builtins` worden simpelweg vervangen op `dataVersion`. Volledige tabellenlijst: `builtins` (id; ververst bij nieuwe `dataVersion`, nooit bewerkt) · `userRecipes` (id, origin.author, updatedAt, *tags) · `overrides` (baseId) · `dictOverrides` (id) · `favorites` ([recipeId+profile]) · `notes` · `cookLog` · `photos` (Blob) · `plans` (weekStart) · `lists` (weekStart) · `pantry` (ing) · `inbox` (recipeId) · `imports` (++id, snapshot voor undo) · `shareInbox` (van de service worker) · `settings` (key).
- `navigator.storage.persist()` bij elke start; Settings → Opslag toont: standalone ja/nee, persisted ja/nee, aantal recepten, laatste back-up, en een rode regel als er >30 dagen niet-geback-upte wijzigingen zijn.

### Manifest en service worker: het deelmenu, correct

Een manifest mag **precies één** `share_target` bevatten; tekst/URL en bestanden gaan samen in één POST-multipart-target (een GET-target kan geen bestanden ontvangen). De `action`-URL moet bestaan: de service worker onderschept de POST en `public/share/index.html` vangt elke aanroep die de SW niet ziet.

```json
"share_target": {
  "action": "/recepten/share/",
  "method": "POST",
  "enctype": "multipart/form-data",
  "params": {
    "title": "title", "text": "text", "url": "url",
    "files": [{ "name": "files",
                "accept": ["application/json", ".json", "text/plain", ".txt", "application/octet-stream"] }]
  }
}
```

```ts
// sw.ts — ontvangen van WhatsApp (bericht of document) en doorgeven aan de pagina
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/recepten/share/') return;
  event.respondWith((async () => {
    const form  = await event.request.formData();
    const text  = ['title', 'text', 'url'].map(k => form.get(k)).filter(Boolean).join('\n');
    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    const payload = { at: Date.now(), text,
      files: await Promise.all(files.map(async f => ({ name: f.name, type: f.type, text: await f.text() }))) };
    const cache = await caches.open('share-inbox');
    await cache.put('/recepten/share/inbox', new Response(JSON.stringify(payload)));
    return Response.redirect('/recepten/#/import?from=share', 303);
  })());
});
```

De import-route leest bij `from=share` de inbox uit de cache, verwijdert hem en toont de preview; de regex haalt elke `#r=`-token uit de tekst, bestanden worden op inhoud herkend. `public/share/index.html` is een lege pagina met `<meta http-equiv="refresh" content="0;url=/recepten/#/import">`, zodat een aanroep zonder actieve service worker nooit op een 404 landt.

Overige manifest-details: `id`, `start_url` en `scope` = `/recepten/` (project-site op GitHub Pages; nooit `/`); `display: standalone`; `theme_color` volgt licht/donker; maskable icons uit de cover; `apple-touch-icon` en iOS-startup-images.

---

## 5. Datamodel & ingrediënten-codering

Alle vier voorstellen convergeerden hierop; dit is de vastgestelde vorm.

### Recept (schema 2)

```jsonc
{
  "schema": 2,
  "id": "b:afwasmachinezalm",          // ingebouwd: "b:" + slug van de NL-naam, wijzigt NOOIT
  "rev": 1,                            // eigen: "u:" + 8 tekens random; +1 bij elke save
  "createdAt": "2025-12-01T00:00:00Z", "updatedAt": "2026-09-24T18:02:00Z",
  "origin": { "kind": "builtin",       // builtin | user | received
              "author": null, "basedOn": null, "receivedFrom": null, "receivedAt": null },
  "name":        { "nl": "Afwasmachinezalm", "en": "Dishwasher salmon" },
  "description": { "nl": null, "en": null },
  "category": "vis", "tags": ["snel"], "season": null,
  "servings": 4, "time": { "active": 10, "total": 45 }, "planAheadHours": null,
  "goesWith": [], "aliases": [],
  "lines": [
    { "raw": {"nl": "4 zalmfilets van 150 g"}, "qty": {"min": 4}, "unit": null,
      "ing": "zalmfilet", "packSize": "150 g" },
    { "raw": {"nl": "7 el limoensap"}, "qty": {"min": 7}, "unit": "el", "ing": "limoensap" },
    { "raw": {"nl": "1 bos koriander [zonder steeltjes]"}, "qty": {"min": 1}, "unit": "bos",
      "ing": "koriander", "prep": {"nl": "zonder steeltjes", "en": "stems removed"} },
    { "raw": {"nl": "zout en peper"}, "qty": null, "ing": "zout-en-peper", "optional": true }
  ],
  "steps": [
    { "nl": "Verwarm de oven voor op {temp:200}.", "en": "Preheat the oven to {temp:200}.",
      "timers": [{"min": 25, "max": 30, "unit": "min"}], "ingRefs": ["zalmfilet"] }
  ],
  "servingTip": { "nl": "Lekker met een frisse salade.", "en": "Nice with a crisp salad." },
  "text": { "en": "llm" }              // llm | human | none  (+ "reviewedBy": "<naam>")
}
```

Regels: `id` verandert nooit (hernoemen → `aliases`); `raw` wordt nooit verwijderd; elk mensentekstveld is `{nl, en}`; onbekende keys worden bij round-trip **bewaard** (niet weggegooid), zodat een oudere app een nieuwer recept intact kan doorsturen; alleen `schema` nieuwer dan de app is een harde weigering ("Update de app eerst").

### Ingrediëntregel (`Line`)

```ts
type Line = {
  raw: { nl?: string; en?: string };          // origineel, nooit weg
  kind?: 'line' | 'header';                   // "Dressing:" → header, genegeerd door de lijst
  qty?: { min: number; max?: number; approx?: boolean } | null;   // "2-3", "ca."
  unit?: string | null;                       // units.json-id; null = telwoord via dict.defaultUnit
  ing?: string | null;                        // ingredients.json-id; null = vrije tekst
  qual?: string[];                            // "kleine", "rode", "verse", "hardgekookte"
  part?: 'sap' | 'rasp' | 'wit' | 'geel' | null;
  prep?: { nl?: string; en?: string } | null; // uit [haken]
  note?: { nl?: string; en?: string } | null; // niet-alternatief tussen (haakjes): "(ontdooid)"
  packSize?: string | null;                   // "(400 g)", "van 150 g"
  alt?: Line[]; altMode?: 'or' | 'and-or';    // "(of kabeljauw)", "en/of"
  optional?: boolean;                         // "naar smaak", "(garnering)", "evt."
  role?: 'main' | 'garnish';
};
```

### Woordenboek (`ingredients.json`, ±400-450 entries)

```jsonc
{ "id": "ui",
  "nl": {"one": "ui", "many": "uien"}, "en": {"one": "onion", "many": "onions"},
  "aliases": {"nl": ["uitje"], "en": ["yellow onion"]},
  "aisle": "groente-fruit", "defaultUnit": "stuk", "buyUnit": "stuk",
  "gramsPer": {"stuk": 120}, "staple": false, "perishable": true, "veg": true }
{ "id": "rookworst", "nl": {"one": "rookworst", "many": "rookworsten"},
  "en": {"one": "smoked sausage", "many": "smoked sausages"},
  "gloss": {"en": "Dutch smoked sausage"}, "aisle": "vlees-vis", "veg": false }
{ "id": "zout-en-peper", "nl": {"one": "zout en peper"}, "en": {"one": "salt and pepper"},
  "aisle": "kruiden-specerijen", "staple": true }
```

Samengestelde voorraaditems (`zout-en-peper`, `olie-en-boter-om-in-te-bakken`) zijn volwaardige entries: de kok leest wat er staat, de lijst zet ze onder "Voorraadcheck". Gangpaden zijn ids met i18n-labels: `groente-fruit, brood, vlees-vis, zuivel-eieren, droog-pasta-rijst, blik-pot, kruiden-specerijen, wereld, diepvries, non-food, overig`.

### Eenheden (`units.json`, ±30 ids, allemaal in het corpus gezien)

```jsonc
{ "id": "g",    "group": "mass",    "g": 1 }
{ "id": "kg",   "group": "mass",    "g": 1000 }
{ "id": "el",   "group": "volume",  "ml": 15,  "nl": {"one":"el","long":"eetlepel"}, "en": {"one":"tbsp","long":"tablespoon"} }
{ "id": "tl",   "group": "volume",  "ml": 5,   "en": {"one":"tsp"} }
{ "id": "dl",   "group": "volume",  "ml": 100, "en": {"render":"ml","scale":100} }   // Britten kennen geen dl
{ "id": "kop",  "group": "volume",  "ml": 250, "en": {"one":"cup"} }               // Nederlandse kop, geen US-cup
{ "id": "teen", "group": "count",   "nl": {"one":"teentje","many":"teentjes"}, "en": {"one":"clove","many":"cloves"},
                "buy": {"unit": "bol", "per": 10} }
{ "id": "blik", "group": "package", "nl": {"one":"blik","many":"blikken"}, "en": {"one":"tin","many":"tins"} }
{ "id": "mp",   "group": "pinch",   "nl": {"one":"mespunt"}, "en": {"one":"pinch"} }
{ "id": "bos",  "group": "count",   "en": {"one":"bunch"} }, { "id": "takje", "en": {"one":"sprig"} },
{ "id": "stengel", "en": {"one":"stalk"} }, { "id": "plak", "en": {"one":"slice"} }, { "id": "bakje", "en": {"one":"tub"} }
```

Corpusfrequenties: g 432, el 198, tl 88, ml 75, dl 31, teen 29, kg 21, blik 16, plak 12, takje 12, l 12, kop 10, stengel 9, bos 8, pot 7, mp 6, pak 5, dan zak/snee/scheut/snuf/beker/stuk/blad/bakje/klont/hand/cm/fles/glas. Package-eenheden hebben geen conversie en tellen per stuk.

### Vijf echte regels uit recipes.json, geparsed

| # | Raw (NL) | Parse | Rendert NL / EN | Voor 2 personen | Boodschappenlijst |
|---|---|---|---|---|---|
| 1 | `250 g schelvisfilet (of kabeljauw) [stukken van 2-3 cm]` | `{qty:{min:250}, unit:"g", ing:"schelvisfilet", alt:[{ing:"kabeljauw"}], altMode:"or", prep:{nl:"stukken van 2-3 cm", en:"2-3 cm pieces"}}` | 250 g schelvisfilet (of kabeljauw), stukken van 2-3 cm / 250 g haddock fillet (or cod), 2-3 cm pieces | 125 g | vlees-vis: 125 g schelvisfilet (of kabeljauw) — één keuzerij |
| 2 | `sap van ½ limoen` | `{qty:{min:0.5}, unit:null, ing:"limoen", part:"sap"}` | sap van ½ limoen / juice of ½ lime | ¼ → getoond als "¼" met origineel in grijs | telt in count-groep, ceil → 1 limoen; met een andere "½ limoen" samen 1 |
| 3 | `1 1/2 el mayonaise` | `{qty:{min:1.5}, unit:"el", ing:"mayonaise"}` | 1½ el mayonaise / 1½ tbsp mayonnaise | ¾ el / ¾ tbsp | 22,5 ml; mayonaise is `staple` → "Voorraadcheck: mayonaise ≈ 1½ el" |
| 4 | `1 rode ui [gesnipperd]` | `{qty:{min:1}, unit:null (defaultUnit stuk), ing:"ui", qual:["rode"], prep:{nl:"gesnipperd", en:"finely diced"}}` | 1 rode ui, gesnipperd / 1 red onion, finely diced | ½ rode ui | sleutel `ui|rode|count` blijft apart van gewone `ui` (kleur = variant; grootte "grote" wordt notitie) |
| 5 | `Rookworst en/of braadworst` | `{qty:null, ing:"rookworst", alt:[{ing:"braadworst"}], altMode:"and-or"}` | (raw) / smoked sausage and/or frying sausage | ongewijzigd | één rij "rookworst en/of braadworst · pm" met keuzemarker onder "Controleer zelf"; nooit gesplitst |

Bonus: `zout en peper` → `{ing:"zout-en-peper", optional:true}` → "salt and pepper" → Voorraadcheck. `Dressing:` → `{kind:"header"}`.

### Parser (deterministisch, ±150 regels, `src/domain/parser.ts`)

Grammatica: `^(qty)?\s*(unit)?\s*(name)(\s*\((paren)\))?(\s*\[(prep)\])?$` met
`qty = \d+([.,]\d+)? | [½¼¾] | \d+\s?[½¼¾] | \d+\s\d/\d | \d+\s?(-|of|tot)\s?\d+`, optioneel `ca.` → `approx`; `unit` = langste match in `units.json`-aliassen; kwalificatiewoorden aan het begin van de naam via `qualifiers.json`; haakjes geclassificeerd als alternatief (`of X`, `en/of`), packSize (`\d+\s?(g|ml|kg)`), toestand/verduidelijking (→ `note`); `naar smaak`/`(garnering)`/`evt.` → optional/garnish; `sap van`/`rasp van` → `part`; trailing `:` → header; naam opgezocht (lowercase, diakritieken gestript) in enkelvoud/meervoud/aliassen, anders `ing:null`. **Engelse variant** wisselt de eenheid- en telwoordtabellen en de decimaalscheider (tbsp/tsp/clove/tin/sprig, `1.5`), voor haar eigen regels en voor bulk-plakken uit Engelse bronnen.

**Ruwe telling op het echte bestand** (regex-only, `tools/measure-parse.ts`, wordt op dag 0 gecommit zodat het cijfer reproduceerbaar is): van 1.377 unieke regels (na trimmen; 1.378 ongetrimd) beginnen er 969 met hoeveelheid + bekende eenheid, 322 met hoeveelheid + telwoord/naam, 75 zonder hoeveelheid, en 11 zijn sectiekoppen. Dit is een **schatting van de verdeling**, geen parse-succes: hoeveel regels ook een woordenboek-id krijgen, blijkt pas uit de golden fixture in fase 2. Verwachting: >90% automatisch, de rest via de review-pagina.

### Migratie van de 1910 regels (`tools/migrate-from-recepten2.ts`, eenmalig, reproduceerbaar)

1. **Regelparser** over elke regel (hoeveelheden zijn hierna vast; de LLM mag ze niet wijzigen). Slug-ids munten. Instructies splitsen op bestaande `\n\n` (137 recepten), dan zinsgrenzen met afkortingen beschermd (`ca.`, `evt.`, `bijv.`), samengevoegd tot 4-10 stappen op kookwerkwoorden (Kook, Bak, Verhit, Voeg, Meng, Roer, Laat, Serveer); korte staartzinnen ("Giet af en laat uitlekken.") bij de vorige stap. Temperaturen (`200 °C`, `200°C`, `180 ℃`, 11 recepten met ℃) → `{temp:200}`. `(voor bij dahl)`-namen → `goesWith`. Tijdregex → `timers[]` en `planAheadHours`.
2. **LLM-pass** (`tools/translate-batch.ts`), één aanroep per recept met het groeiende woordenboek in context en een strikt JSON-schema: per regel `ingredientId`, `qual`, `prep.en`, `confidence`, eventueel `newDictionaryEntry`; `name.en`, `description.en`, `steps[].en` (Brits Engels, metrisch, tbsp/tsp/tin/clove), `category` (uit `categories.json`), `tags` (vegetarisch, vega-optie, snel, wereldkeuken, …), `time`, `season`. Validatie: hoeveelheden ongewijzigd, ids bestaan of zijn voorgesteld; bij schemafout opnieuw. Prompt, schema en script in de repo; **uitvoering op twee manieren** (§6): met een API-sleutel in een env-var op jouw pc, of batchgewijs binnen Claude Code-sessies zonder sleutel. De app roept nooit een LLM aan.
3. **Uitvoer:** `data/recipes.json`, `ingredients.json`, `units.json`, `prep-phrases.json` (119 haaknoten: fijngehakt→finely chopped, gesnipperd→finely diced, in vieren→quartered, roosjes→florets, sjablonen `blokjes van {n} cm`→`{n} cm dice`), `qualifiers.json`, en de **review-pagina** onder `/recepten/review/` (raw | parse | ing | EN | confidence, ±120 lage-confidence-regels eerst). Jij checkt ids en gangpaden op de pc; zij het Engels op haar iPhone, vanaf fase 2, zonder git. Hoe haar correcties terugkomen staat in §6 ("Review-pagina: het correctieformaat").
4. **Guards in CI:** `parser.golden.json` bevriest voor alle unieke regels de parse **én de gerenderde NL- en EN-string**, zodat een renderwijziging nooit stil verandert wat een van jullie leest; `validate:data` eist: unieke ids, `name.nl` én `name.en`, geldige `category`, alleen bekende `ing`/`unit`-ids, **gelijk aantal stappen per taal** (stap 3 NL = stap 3 EN), geen lege `raw`.

### Nieuw recept invoeren zonder frictie

- Eén vrij tekstveld per regel (zoals in het boek en op websites). Eronder live chips: `[2] [el] [olijfolie ✓] [prep: voor bakken]`. Autocomplete over NL- en EN-namen en aliassen (zij typt "onion", krijgt `ui`).
- Onbekende naam → twee knoppen: **Bewaar als tekst** (`ing:null`, gewoon zichtbaar, badge "nog niet vertaalbaar") en **Nieuw ingrediënt** (NL, EN, gangpad → lokaal woordenboek; reist als delta mee in tokens). Opslaan wordt nooit geblokkeerd.
- Chip aantikken → inline editor voor hoeveelheid/eenheid/prep/optioneel.
- **Bulk-plakken** (als tijd over in fase 2): hele receptentekst (website, Live Text van een foto, Notities) in één vak; korte regels die met een getal beginnen = ingrediënten, alinea's = stappen; parser vult de editor voor. Engelse tabellen als de tekst Engels is.
- Achteraf repareren waar het gevolg zichtbaar is: in de boodschappenlijst staat de onbegrepen regel onder "Controleer zelf" met **Koppel** → mapping op de regel én als alias.

---

## 6. Tweetaligheid (NL/EN)

| Onderdeel | Aanpak |
|---|---|
| **UI-chrome** | `data/i18n/nl.json` + `en.json` (Brits Engels), inclusief categorie-, tag-, gangpad- en eenheidlabels. Taal per **profiel** (jouw telefoon NL, de hare EN), gekozen bij de eerste start; NL\|EN-pil in de app-balk voor één-tik-wisselen; `lang="nl"/"en"` op elk tekstknooppunt voor VoiceOver/TalkBack. |
| **De 196 klassiekers** | Eenmalige LLM-pass (§5, stap 2) op jouw pc; corpus ±160k tekens. Elke tekst krijgt `text.en: "llm"`; na nakijken door haar `"human"` + `reviewedBy`. Badge in de UI zolang het "llm" is. About crediteert haar als reviewer van de Engelse editie. DeepL/Google zijn niet nodig: ze kunnen wel vertalen, niet structureren. |
| **Hoe de LLM-pass draait (kies één)** | **(a) Met API-sleutel:** een Claude Code-abonnement geeft géén API-sleutel of tegoed voor een Node-script; je maakt een aparte API-sleutel aan met een paar euro prepaid tegoed, zet die in een env-var (nooit in de repo) en draait `npm run translate`. **(b) Zonder sleutel:** dezelfde prompt en hetzelfde JSON-schema staan in `tools/prompts/`; je laat Claude Code in sessies van ±10 recepten per keer de JSON naar `data/` schrijven en `validate:data` erover draaien. (b) kost nul euro en ±3-4 sessies; (a) kost enkele euro's en één avond. Beide leveren identieke, gecommitte output; keuze bij de start van fase 2. |
| **Kwaliteitscheck** | (1) Ingrediëntnamen en eenheden komen **nooit** uit vrije vertaling maar uit het woordenboek; (2) de LLM mag hoeveelheden niet aanraken; (3) review-pagina met lage-confidence-regels eerst; (4) later het in-app **Curator**-scherm: lijst van 196 met status machine/nagekeken/ontbreekt, EN naast NL bewerken, "Reviewed by <naam>", export als JSON-patch via het deelmenu → `npm run apply-review` → CI deployt. |
| **Review-pagina: het correctieformaat** | De statische pagina onder `/recepten/review/` bewaart **elke correctie direct per regel in `localStorage`** (sleutel `lineKey` = `recipeId + ':' + lineIndex`), zodat een afgesloten tab niets kost. "Exporteer correcties" maakt een JSON-patch `[{lineKey, ing?, en?, prepEn?, nameEn?, stepEn?: {i, text}}]` en verstuurt die als `.txt`-bestand via `navigator.share({files})` (files-only; `.txt` zit in de Chromium-allowlist en iOS laat bestand-zonder-tekst intact) naar WhatsApp of Files; `npm run apply-review` merget op `lineKey` en weigert patches op regels waarvan `raw` inmiddels veranderd is. Omdat een Safari-tab zijn `localStorage` na 7 Safari-gebruiksdagen kan verliezen, vraagt de pagina na elke sessie om te exporteren en biedt ze aan om zichzelf als apart icoon "Recepten Review" op het beginscherm te zetten (eigen bucket, ITP-vrij). |
| **Ingrediëntregels** | Renderen uit het woordenboek in de actieve taal: `2 el olijfolie` → `2 tbsp olive oil` zonder dat die zin ooit vertaald is. Prep-noten via `prep-phrases.json`, kwalificaties via `qualifiers.json`. Nederlands-only producten dragen een gloss: "rookworst — Dutch smoked sausage", "kruimige aardappelen — floury potatoes". |
| **Eenheden voor haar** | Alleen **namen** veranderen: el→tbsp, tl→tsp, mp→pinch, teentje→clove, blik→tin, bos→bunch, takje→sprig, **dl→ml** (×100). Gram, ml en °C blijven (ze is Brits; cups en ounces zouden het recept slechter maken). |
| **Oventemperaturen** | Token `{temp:200}` in stappen; Settings: °C, of °C + °F uit de vaste oventabel (160→325, 180→350, 200→400, 220→425). Later: hetelucht (−20) en gas mark (200 °C = Gas 6), vijf regels tabel. |
| **Eigen recepten, drie tiers** | **Tier 1 automatisch:** ingrediënten, eenheden, kwalificaties en bekende prep-noten renderen in beide talen; een recept dat jij in het Nederlands typt toont bij haar direct Engelse ingrediënten (en andersom). **Tier 2 handmatig:** "Voeg Engels toe / Add Dutch" opent een side-by-side-editor (origineel boven, doel onder), ingrediëntregels voorgevuld; alleen naam en stappen typen. **Tier 3 geassisteerd:** "Kopieer voor vertaling" zet een vast genummerd prompt + het recept op het klembord; plakken in ChatGPT/Claude/Google Translate; antwoord in "Plak vertaling" → gevalideerd en alleen de doeltaalvelden samengevoegd. Op jouw desktop-Chrome wordt de ingebouwde Translator API direct gebruikt als hij er is. |
| **Weergaveregel** | Actieve taal; ontbreekt die, dan de andere met een NL/EN-chip en "Voeg … toe". **Lang drukken** op een stap toont de andere taal. Per recept een schakelaar **NL / EN / beide** (ook in kookstand) voor samen koken van één telefoon. |
| **Notities** | Worden **nooit** machinaal vertaald; ze zijn persoonlijk en gesigneerd. |
| **Keukenwoordenboek** | `glossary.json` (mespunt, snufje, teentje, bosje, aanfruiten, afblussen, beetgaar, dakpansgewijs, kruimig, stamppot …) uit het woordenboek + instructiewoordenschat; tik op een bekend woord in Nederlandse tekst toont de uitleg. |
| **Field-level merge** | Een binnenkomend `en`-veld vult/vervangt alleen `en`, nooit `nl` leeg. Dus zij vertaalt, jij kookt, WhatsApp draagt het. |

---

## 7. Delen via WhatsApp

### Het contract: één versioned tekst-token

```
token = base64url( deflate-raw( UTF-8 JSON-envelop ) )    // alleen [A-Za-z0-9_-], geen padding
```

```jsonc
// t:"r" — één recept
{ "v": 2, "t": "r", "by": "stijn", "at": "2026-09-24T18:02Z", "msg": "Je moet dit proberen!",
  "r": { /* volledig schema-2-recept, beide talen */ },
  "dict": { "ing": [ /* alleen entries die de ontvanger kan missen */ ], "prep": [] } }
// t:"p" — override-patch op een ingebouwd recept: { "baseId": "b:klassieke-lasagne", "rev": 2, "patch": {...} }
// t:"w" — weekplan: { "weekStart": "2026-09-28", "entries": [{"rid":"b:dahl","day":1,"srv":2,"type":"recept"}],
//                     "recipes": [ /* eigen recepten die de partner mist */ ] }
// t:"b" — bundel/back-up: { "title": "...", "recipes": [], "overrides": [], "dict": {}, "favorites": [],
//                           "plans": [], "notes": [], "cookLog": [], "settings": {} }
```

Regels: onbekende keys bewaren; `v` nieuwer dan de app → "Update de app eerst"; codec-wijziging → nieuwe fragmentsleutel (`#s=`), nooit stille herinterpretatie; gemeten ±1 KB per NL-recept, 1,5-2 KB tweetalig. **Groottegrens per bericht: ±3,5 KB totaal** (ruim onder de gedocumenteerde 4.096). Daarbinnen mogen **meerdere `#r=`-tokens in één bericht** staan (twee kleine recepten, een delta van drie NL-only recepten) — de importer haalt ze er toch alle met een regex uit. Pas daarboven wordt het automatisch een bestand. Bevroren tokens uit elke versie staan in `token.test.ts`.

### Het bericht (exact)

```
🍲 Afwasmachinezalm · Dishwasher salmon
4 pers · 10 ingrediënten · van Stijn
Open in Rutgers' Recepten (of tik voor een voorproefje / or tap to preview):
https://<gebruiker>.github.io/recepten/#r=eJx9kU1v2zAMhu_5FYQv...
```

Beide namen op regel 1 (leesbare bubbel); de URL('s) als **laatste regel(s), alleen**; geen `&`, `=`, `%`, `+`, `/` na `#`. Verzenden: bericht vooraf opgebouwd, `navigator.share({text})` **alleen** in de tik-handler; fallbacks `location.href = 'https://wa.me/?text=' + encodeURIComponent(msg)` en een Kopieer-knop. **"Deel als tekst"** is een aparte knop: leesbaar recept (titel, porties, geschaalde regels, genummerde stappen, servingTip) in NL, EN of beide, met de link als laatste regel — voor ouders en vrienden zonder app.

### Ontvangen op Android (Chrome-WebAPK), stap voor stap

1. **Tik op de link** in WhatsApp → URL valt in scope → geïnstalleerde app opent (LIKELY) → `boot.ts` laadt de volledige app → Import-preview → "Importeer". Routeert Android 12+ hem toch naar een Chrome-tab: `boot.ts` laadt daar óók de volledige app (niet-iOS), met **gedeelde opslag**, dus "Bewaar in mijn recepten" schrijft in dezelfde IndexedDB. Test op dag 1: `adb shell pm get-app-links <webapk-package>`.
2. **Bubbel lang drukken → Delen → Recepten** (share_target POST met `text`) → service worker → `#/import?from=share` → importer haalt met regex elke `#r=([A-Za-z0-9_-]{20,})` uit de tekst → meerdere doorgestuurde recepten importeren in één keer.
3. **Document → Delen → Recepten** (share_target POST met `files`, afgehandeld in `sw.ts`) → importer op inhoud.
4. **Handmatig:** Import-scherm met textarea, "Plak van klembord", bestandskiezer; QR-scan (flag).

### Ontvangen op iPhone (Home Screen-app), stap voor stap

- **Flow A (primair, ±10 s):** bubbel lang drukken → Kopieer → Recepten-icoon → tab Import (één tik vanaf Home) → **"Plak van klembord"** (`readText` in de tik; zij tikt de iOS "Plak"-callout) óf lang drukken in het grote tekstvak → Plak (geen API nodig) → preview "Nieuw: Pasta pesto (van Stijn)" → Importeer → direct in de eigen IndexedDB.
- **Flow B (zij tikt de link):** Safari opent via `boot.ts` de **aparte, piepkleine landingsbundel** (`landing.ts`, enkele KB, geen Dexie): decodeert het fragment client-side, toont het recept alleen-lezen met NL/EN-schakelaar, dan "Copy recipe code" + kaart "Open Recepten op je beginscherm → Import → Plak", en voor nieuwe bezoekers "Zet op beginscherm". **Slaat nooit iets op** (Safari-bucket is onzichtbaar voor de app).
- **Flow C (bundels/back-ups; drie extra tikken, eerlijk gezegd):** .json-document in WhatsApp → Delen → Bewaar in Bestanden → app → Import → "Kies bestand" (gevalideerd op inhoud) → "12 nieuw, 2 bijgewerkt" → Importeer. Daarom blijft de gewone wekelijkse uitwisseling zo lang mogelijk in tekst (meerdere tokens tot ±3,5 KB).
- **Flow D (zelfde kamer, experimenteel, achter flag):** jij "Toon QR" (raw deflate-bytes, byte mode, ≈ versie 19-20 ECC L); zij "Scan" in de app → direct in haar opslag, geen kopieer-dans. Camera/`BarcodeDetector` in een iOS-standalone-app is UNKNOWN; de fallback is: scannen met de iPhone Camera-app → opent Safari → Flow B. Alleen enkele recepten.
- **Invariant in CLAUDE.md:** de plak-import wordt nooit uit de app gehaald; nooit een flow bouwen die doet alsof de link de app opent.

### Bestanden

Bundel `recepten-YYYY-MM-DD.json` via `navigator.share({files})` **zonder tekst**; als `canShare({files})` `.json` weigert (Chromium-allowlist) dezelfde bytes als `.txt`; importer herkent op inhoud. Nooit een eigen `.recept`-extensie (wordt `application/octet-stream`/"BIN").

### Merge-regels (`src/domain/merge.ts`, unit-getest, op beide platforms identiek)

| Situatie | Actie |
|---|---|
| Zelfde `id`, zelfde fingerprint (hash van naam + gesorteerde raw-regels) | "Heb je al" — overslaan |
| Zelfde `id`, hogere `rev`, mijn kopie onaangeroerd sinds laatste ontvangst | Vervangen, label "bijgewerkt door <naam>" |
| Zelfde `id`, beide bewerkt | Conflictkaart: per veld mijn/haar/beide ("… (Stijns versie)") |
| Ander `id`, zelfde fingerprint | "Lijkt op X" — vervangen / beide houden / overslaan |
| Taalvelden | Field-level: binnenkomend `en` raakt alleen `en` |
| Bewerkte ingebouwde recepten | Reizen als `{baseId, patch}`; ontvanger met hetzelfde ingebouwde recept ziet "Stijn heeft Lasagne aangepast — overnemen?" i.p.v. een duplicaat |
| Woordenboek-delta's | Ingebouwde entries nooit overschreven; user-entries last-write-wins op `updatedAt` |
| Verwijderingen | Reizen nooit mee (geen tombstones in v1) |

Elke import is één transactie met snapshot in `imports` → **"Maak deze import ongedaan"**. Import schrijft **direct** naar IndexedDB met `origin.received*` en `seen:false`; **Inbox**-tab met badge, "van <naam>", haar optionele bericht, open / + Deze week / verwijder.

### Delta-share ("Stuur nieuwe naar <naam>")

Verzamelt alles wat sinds `lastSentTo[<naam>]` is gewijzigd (recepten, overrides, woordenboek) → één bericht met meerdere tokens zolang het onder ±3,5 KB blijft, anders bundel → timestamp vastgelegd. Beide kanten op, ±wekelijks: twee telefoons convergeren zonder server.

### Tests op dag 1 (fase 0, vastgelegd in ADR-0001)

Op **beide** telefoons: blijft een 2 KB `#r=`-link één tikbare link; `navigator.share({text})` naar WhatsApp; `readText` + Plak-callout; textarea-plak; offline start na herstart; `persisted()`-status; **timer 30 s in voorgrond / vergrendeld / achtergrond** (wat gaat af: melding, geluid, trilling). Op jouw Android bovendien: `pm get-app-links`, share_target met tekst én met document (POST), en de UX-checklist uit §3b.

---

## 8. Weekplanner & boodschappenlijst

### Het ritueel als held van het Week-scherm

Het Week-tabblad opent leeg met één grote knop **"Kies 7"** — het familieritueel uit het verhaal, letterlijk zo genoemd — en daaronder (als tijd over) "Verras me" als assistent. Kies 7 opent een multi-select met categoriechips (Soep, Salade, Pasta, Rijst, Vlees, Stamppot, Oven, Vis, …), sortering "lang niet gegeten", en een teller 3/7. Bord: ma-zo (weekstart instelbaar op jullie boodschappendag) plus een pool "Nog geen dag", want de familie hing nooit dagen aan gerechten. Elke receptkaart en detailpagina heeft "+ Deze week". "Volgende week" is een tweede tab.

Per slot: recept, **porties** (stepper 2/4/6/8, standaard = huishoudgrootte uit Settings, "Wij zijn met 2"), type **recept / restjes / vrij**, "Kook dubbel" (verdubbelt porties en zet een gekoppeld restjes-slot op een latere dag), menu (Verplaats naar dag, Wissel, Verwijder). "Verras me" vult lege slots met variatieregels: max 2 pasta en 2 rijst, minstens één vegetarisch, niets uit de laatste 6 weken, geen twee ovengerechten na elkaar, bijgerechten reizen mee met hun hoofdgerecht; per slot dobbelsteen en slotje. Schermtoestanden: leeg → deels (3/7, "Vul de rest aan") → vol ("Boodschappenlijst maken" primair) → vandaag gemarkeerd met "Vandaag koken"-kaart → voorbije week alleen-lezen met "Gekookt?"-vinkjes en "Kopieer naar volgende week".

### Merge-algoritme (`src/domain/aggregate.ts`, pure functie, één unit test per regel)

1. Sla slots `restjes`/`vrij` over. `factor = slot.servings / recipe.servings`.
2. Per regel: `ing:null` → **Controleer zelf** (raw, ×N, receptnaam; nooit vermenigvuldigd, nooit weggelaten). Anders `qty = qty.max ?? qty.min ?? null` ("2-3 el" → 3; "1 of 2" → 2); `null` → "pm". `qty *= factor`; `unit = line.unit ?? dict.defaultUnit`.
3. Sleutel `ing | variant | unitGroup` (variant = kleur/soort uit `qual`: rode ui apart van ui, kruimige apart van vastkokende aardappelen; grootte wordt notitie). Optellen in basis (g/ml/stuk) per sleutel; `sources[]` bewaren (recept, dag, raw, geschaald).
4. Groep-overschrijdend vouwen richting `buyUnit`: stuk↔gram via `gramsPer` (ui 120 g, tomaat 100 g, aardappel 150 g), teen→bol via `per:10`, bosje→stuks via `bunchCount`; volume↔massa alleen met dichtheid (boter). Anders twee eerlijke regels.
5. **Afronden voor weergave:** stuks → ceil; g < 100 → op 5, < 1000 → op 10, ≥ 1000 → "1,3 kg"; ml idem; pinch/pm → geen getal; teentjes → ceil + "(≈1 bol)" bij ≥ 5.
6. Routering: `pantry.inHouse` → **In huis**; `staple` en onder drempel (of pm) → **Voorraadcheck**; `ing:null` → **Controleer zelf**; rest → hoofdlijst.
7. Groeperen per gangpad in de **per-telefoon** volgorde (jouw AH-route, haar Tesco-route), sorteren op naam in de UI-taal, meervoud naar aantal (1 ui / 4 uien; 1 onion / 4 onions).
8. Regenereren: zelfde sleutel → vinkje/in-huis/handmatige correctie behouden; verdwenen sleutel → weg tenzij extra; nieuwe sleutel → badge "nieuw".

**Uitgewerkt op de echte data (×0,5 voor 2 personen daarna):** knoflook `1 teentje`+`4 teentjes`+`1 teen`+`½ teentje` → 6,5 → **"7 teentjes knoflook (≈1 bol)" / "7 cloves garlic (≈1 bulb)"** (unit test). `1 ui`+`1 grote ui`+`2 uien` → "4 uien (1 grote)"; `1 rode ui` apart. `8 tomaten`+`500 g tomaten`+`2 tomaten` → buyUnit stuk → "15 tomaten"; `600 g stukjes tomaat uit blik` en `1 pak (500 g) gezeefde tomaten` zijn andere ids in blik-pot. `50 g boter`+`1 el boter`(14 g)+`Klontje boter`(15 g)+`boter om in te bakken`(pm) → 79 g < drempel 250 g → "Voorraadcheck: boter ≈ 80 g". `½ rode peper`+`1 Spaanse peper` → verse-chili-id in groente → "2 rode pepers", nooit zwarte peper.

### Lijstscherm

- Header "Boodschappen wk 39 · 7 gerechten · 2 pers.", voortgang 14/31, inklapbare gangpaden met tellers, toggle "per gerecht".
- **In de winkel:** hoge rijen, tik = doorstrepen (rij blijft op zijn plek), "Verberg afgevinkt", undo-snackbar, sectie klapt dicht als hij compleet is, elke tik direct naar IndexedDB, wake lock, "Klaar" wist vinkjes maar houdt plan en vaste items.
- Lang drukken: **Heb ik al** (grijs naar "In huis", niet in gedeelde tekst; als tijd over: niet-bederfelijke items (rijst, pasta, blik, sojasaus) onthouden voor N weken en volgende keer voorgemarkeerd; bederfelijke gangpaden nooit), Aantal aanpassen, **Waarvoor is dit?** ("3 uien: 2× Pasta met spek (di), 1× Erwtensoep (do)" + Recept openen), Verwijder.
- **Extra's:** snelvak "+ wc-papier, melk…" met autocomplete uit woordenboek en eerdere extra's; "elke week" pint een vast item.
- **Stale banner** "Weekplan gewijzigd · Bijwerken" als het plan na genereren is veranderd; nooit automatisch regenereren (vinkjes springen anders).
- **Voorraadcheck** onderaan ingeklapt (zout, peper, olie, boter, suiker, bloem, azijn, sojasaus, kruiden, bouillon); auto-promotie boven drempel; per huishouden eigen staple-set.
- **Controleer zelf** met **Koppel** (§5): de plek waar ingrediënten "gecodeerd" raken zonder formulierdwang; mapping reist mee in het volgende token.
- **Is op** (lang drukken op een ingrediënt in kookstand) wist de in-huis-vlag.

### Delen van de lijst

**"Deel lijst"** → platte tekst, verzonden met `navigator.share({text})` (Kopieer en wa.me als fallback):

```
Boodschappen wk 39 · 7 gerechten · 2 pers.
Groente & fruit
☐ 4 uien (1 grote)
☐ 7 teentjes knoflook (≈1 bol)
Vlees & vis
☐ 500 g kipfilet
…
Controleer zelf
☐ Rookworst en/of braadworst (NL)
— Dahl, Klassieke lasagne, Schelvis in ratatouillesaus, …
```

Taalschakelaar op het deelscherm rendert de hele lijst via het woordenboek in de andere taal ("Shopping wk 39 … ☐ 7 cloves garlic"); afgevinkt, in-huis en verborgen staples worden overgeslagen; onbegrepen regels gaan mee met "(NL)". De lijst onthoudt "Gedeeld 10:12" en toont "gewijzigd sinds delen". **"Deel weekplan"** stuurt daarnaast een `#w=`-token (ids, dagen, porties, types; ontbrekende eigen recepten ingesloten) zodat haar app dezelfde week toont en lokaal kan genereren, vertalen en afvinken. Vinkjes worden bewust niet gesynchroniseerd. **Print**: printstylesheet als de oude A4 (gangpadkolommen, hokjes, gerechten bovenaan) — de printer uit het verhaal.

### Kookkringloop

"Vandaag koken"-kaart op Home/Week met porties al uit het slot → Koken (kookstand) → "Gekookt!" → kooklog (datum, wie, sterren, notitie) → voedt "lang niet gegeten", Verras me, statistieken en "Samen al N van de 196". Morgen: "uit de vriezer halen?" als het woordenboek een diepvriesingrediënt markeert.

---

## 9. Alle functies

Gededupliceerd uit de zes brainstorm-lenzen; zwakke of dubbele ideeën zijn weggelaten. Effort: S/M/L. De roadmap (§10) verdeelt Must en Should in "kern" en "als tijd over" per fase.

### Must

- **Recept-schema v2**: stabiele ids, `rev`, `origin`, per-veld `{nl,en}`, onbekende keys bewaard, `schema`-versie met "Update de app eerst" (M).
- **Gestructureerde ingrediëntregels** met `raw` voor altijd, plus `units.json`, `ingredients.json`, `prep-phrases.json`, `qualifiers.json`, `categories.json` (L).
- **Migratiepijplijn**: regelparser → LLM-pass (met of zonder sleutel) → review-pagina onder `/review/` met lokaal bewaarde correcties en `.txt`-patch-export → `apply-review`; golden fixture (parse + gerenderde NL/EN) en `validate:data` incl. stap-telling per taal; Dexie v2-migratie herparseert eigen regels uit `raw` (L).
- **Smart line entry** met chips, tweetalige autocomplete, "Bewaar als tekst" / "Nieuw ingrediënt"; Engelse parsertabellen (M). *Bulk-plakken: als tijd over.*
- **Exportknop in Recepten2** (dag 0, als tekst/klembord) en import van het legacy-formaat met naam→id-matching voor favorieten (S).
- **Twee profielen** (naam, kleur, taal, device-id), favorieten per persoon, "wij"-badge, filters Klassiekers / Van Stijn / Van <naam> / Nieuw van <naam> (M).
- **Taal per profiel** met NL\|EN-pil, andere taal als fallback met chip, lang-drukken-peek, **NL/EN/beide**-modus per recept (M).
- **Engelse eenheden en temperaturen** (namen-only, dl→ml, °C/°F-tabel) (M).
- **Portie-schaler** met eenheid-bewuste afronding, origineel in grijs, steptekst nooit herschreven (M).
- **Bottom-nav Home · Zoeken · Week · Boodschappen · Meer**; alles hash-routes; zichtbare terugknop op iOS (M).
- **Categorieën** uit de data (9 uit het verhaal + Vis + Wok & noedels) met schap van tegels en tellers; hercategoriseren vanaf de detailpagina (M).
- **Tweetalig, accent-ongevoelig, typo-tolerant zoeken** via het woordenboek; gegroepeerde resultaten; recente zoekopdrachten (M).
- **"Alle recepten"** met plakkende letterkoppen, A-Z-rail, bijgerechten onder hun hoofdgerecht (S).
- **Recept-token `#r=`** en **"Deel via WhatsApp"** (tekst-only, wa.me + Kopieer fallback, meerdere tokens tot ±3,5 KB, daarboven bestand) (M).
- **Import-scherm** (textarea, klembord, bestand, share_target, multi-token regex, legacy-formaat) met preview Nieuw/Bijgewerkt/Al aanwezig/Conflict (M).
- **`boot.ts`-regel + landingspagina** als aparte mini-bundel: viewer + "Copy recipe code" + hand-off-kaart + installhint; nooit opslaan op iOS; volledige app in elke andere situatie (M).
- **Inbox + merge-regels + conflictkaart + undo per import** (M).
- **Woordenboek-delta's** in tokens (M).
- **Back-up & herstel** via deelmenu (Files/Drive/WhatsApp-naar-jezelf), merge met tellers, 30-dagen-badge (M).
- **Installatie & opslaggezondheid**: install-kaart met iOS-screenshots, permanente niet-standalone-waarschuwing, `persist()` elke start, Opslag-paneel, **Apparaatcheck-pagina** (standalone, persisted, share-, plak- en timerresultaat als kopieerbare tekst) (S).
- **Manifest/iconen/splash/safe-area**, geen 2 s-splash, cover naar WebP; dark mode drieweg (S).
- **Service worker** (injectManifest, één POST-share_target, `share/index.html`-fallback), expliciete update-prompt, `/next/`-kanaal met eigen database en manifest (M).
- **Weekplanner "Deze week"** met **Kies 7** als held, pool, slot-types, porties (M). *Kook dubbel, Verras me: als tijd over.*
- **Huishoudgrootte** en porties per slot (S).
- **Boodschappenlijst-engine** (aggregatie, afrondtabel, buy-units, gangpaden, Voorraadcheck, Controleer zelf) (L).
- **Gangpadvolgorde per telefoon** (S). **Afvinken in de winkel** (S). **Heb ik al** (S; *carry-over van niet-bederfelijke items: als tijd over*). **Extra's + vaste items** (S).
- **Deel lijst als tekst** NL/EN (S).
- **Repo, CI (één artefact voor main+next), GitHub Pages, CLAUDE.md, CONTRIBUTING.md, ADR's 0001-0007, tests die ertoe doen, Playwright-smoketest (WebKit, iPhone-breedte, landing-regel)** (M).
- **Kookstand basis**: stappen, wake lock, ingrediënten afvinken (M).

### Should

- **Kookstand volledig**: één stap per scherm, groot lettertype, tikzones, "tegelijk"-tag, per-stap-ingrediënten, prep-checklist (stap 0) uit de [haaknoten], "Gekookt!" aan het eind (L).
- **Timers uit de tekst, ontworpen op het slechtste geval**: chips met wall-clock `endAt`, meerdere tegelijk, **in-app aftelling + geluid + trilling zolang de app open is**; wat op de achtergrond kan (Notification API zonder push) is UNKNOWN en wordt alleen ingeschakeld voor wat fase 0 op dát toestel bewezen heeft; knop **"Zet ook een timer op je telefoon"**: op Android proberen we een `intent:`-URL naar `android.intent.action.SET_TIMER` (UNKNOWN, fase-0-test), op iOS is een link naar de Klok-app niet mogelijk en zegt de app dat eerlijk ("Zet 25 min op je Klok-app of vraag het Siri"). Achtergrond-alarm staat op de verlieslijst in §3b (M).
- **Stappen-splitser** met fix-it-editor (splits/voeg samen/herorden) (M).
- **Override-laag voor ingebouwde recepten** met "aangepast"-badge, **"Toon origineel"** en "Herstel origineel"; "Dupliceer als eigen recept" voor echte varianten (M).
- **"Bij dit gerecht"** (goesWith) uit de `(voor bij …)`-namen; bijgerechten mee in planner en lijst (S).
- **Kooklog** (datum, wie, sterren, notitie) met "Laatst gekookt", "lang niet gegeten"-sortering, één smaakvolle mijlpaal-toast (10e/25e/50e/100e keer, eerste stamppot, 50 van de 196) (M).
- **Home "Vanavond?"**: deze week, dobbelsteen met constraints (chips, niet in 14 dagen, niet in plan, pantry-constraint), categorieschap, eigen recepten, laatst gekookt, favorieten (M).
- **Filterchips** Vegetarisch / Snel / Oven / Vis / Kip / Wereldkeuken (tijden uit de verrijkingspass, inline te corrigeren; Kids start leeg) (M).
- **Verras me** met variatieregels, herrol/lock per slot (M).
- **Restjes / vrij / kook dubbel** (S). **Kookgeschiedenis & statistieken** (M). **Deel weekplan `#w=`** (M). **Koppel ingrediënt** (M). **Vandaag koken-kaart** (S). **Waarvoor is dit?** + stale banner (S).
- **Delta-share "Stuur nieuwe naar <naam>"** (M). **Bundel als bestand** (multi-select, categorie, deze week) (M). **Android share_target + link capture verfijning** (S). **Deel als tekst** (S).
- **Bulk-plakken** (M). **Language-pair editor** + "Kopieer voor vertaling / Plak vertaling" (M).
- **Curator-scherm** voor haar Engelse editie met JSON-patch-export (M).
- **Persoonlijke notities** (gesigneerd, gedateerd, nooit vertaald, optioneel mee in share) (S).
- **Het verhaal / The Book**-pagina: cover, verhaal NL/EN, editielijn, "Samen al N van de 196", categorie-illustraties, credits (M).
- **Visuele identiteit** uit de cover (palet, display-font, 44 px targets, 16 px inputs tegen Safari-zoom) (M).
- **Empty states & onboarding** in cover-stijl (S). **Toegankelijkheid** (rem, contrast, `lang`-attributen, reduced motion) (S).
- **Feature flags + verborgen Experimenten-paneel** (S). **Twee-telefoon dev-loop** (`next`-kanaal, Chrome-flag voor LAN, optioneel mkcert met CA-handleiding, `npm run check`, `.claude/skills`) (S). **Print** (recept, lijst, hele boek tweetalig in hoofdstukken) (M).
- **Keukenwoordenboek** (S). **Plan-vooruit-waarschuwing** (24 uur marineren) (S). **Sorteer-sheet** (S).

### Could

- Categorie-illustraties (±12 in de stijl van de cover) en eigen foto's per recept (WebP ≤ 1024 px in IndexedDB, nooit in het token) (M).
- QR tonen/scannen (experimenteel; iOS-camera in standalone onbevestigd) (M). Import-historie (S). Terugkerende favorieten & weeksjablonen (S). Bijgerecht-suggesties bij inplannen (S). Pantry-zoeken "Wat heb ik in huis" (M). Gebruikers-tags met autocomplete (S). Gebaren & haptics (M). Kook hoofd- en bijgerecht samen (tabs, gedeelde timers) (L). Alternatief-swap ("of kabeljauw") (M). Kitchen-readability (A−/A+, landscape) (S). Sectiekoppen in ingrediëntenlijst (S). Bewerkbaar, deelbaar woordenboek-scherm (M). Print de lijst (S). Nieuwe-week-nudge in-app (S). Jaaroverzicht in december (S). Standaard-export schema.org JSON-LD (S).

### Later

- Seizoensschap; manifest-shortcuts (Android); hetelucht/gas mark; multi-winkel-splitsing; import van website-URL (paste-route eerst; later stateless proxy); OCR in-app (Tesseract WASM; Live Text/Lens + plakken volstaat nu); optionele persoonlijke LLM-sleutel in Settings; versleutelde relay-sync (Cloudflare Worker + KV, alleen ciphertext); optionele TWA-APK voor Android-vrienden; Capacitor-schil met AlarmManager-timers en "Openen met" (jouw Kotlin); betaalde native iOS (€99/jaar, ADR-0008).

### Anti-features (bewust niet bouwen)

- Backend, accounts, cloud-sync (Firebase/Supabase/Dexie Cloud), analytics, telemetrie.
- Een iPhone-flow die doet alsof de WhatsApp-link de app opent, of opslaan vanuit de Safari-landingspagina, of de 2021 Cache-API-truc, of Web Share Target/push op iOS.
- Een timer die belooft af te gaan terwijl de app dicht is, zolang fase 0 dat niet op dat toestel bewezen heeft.
- Twee `share_target`-entries of een GET-target voor bestanden (ongeldig manifest; Chrome negeert het stil).
- Een `/next/`-kanaal dat dezelfde database gebruikt als `main`.
- Native iOS, TWA of Capacitor **nu** ("voor beter delen"): geen functionele winst, wel Mac/€99/keystore/verificatie-gedoe.
- Recepten2 naast de webapp levend houden als tweede codebase.
- Push-notificaties, streaks/punten, sociale functies, publieke pagina's.
- Runtime machinevertaling in de app (geen API op telefoons; geen sleutel in een statische app).
- Parallelle taalbestanden; vertaalde ingrediëntregels als tekst opslaan; numerieke/UUID-ids; raw-regel weggooien; samengestelde regels automatisch splitsen; imperial/US-cups; voeding/calorieën; barcode-scannen; volledige voorraadadministratie; supermarkt-API's; prijzen.
- Custom `.recept`-extensie; foto's in het token; tombstones/verwijderingen via share in v1; korte links via Gist/dpaste/bit.ly; realtime gedeeld afvinken; CRDT-libraries.
- Auto-schalen van getallen in stapteksten; auto-startende timers; rich-text-editor; PDF-libraries; auto-verweven van hoofd- en bijgerecht. (Voorlezen en spraakcommando's zijn wél gewenst — zie §0 "Spraak in de kookstand".)
- Paginatie/virtualisatie; hamburger-menu; nep-iOS/Material You-mimicry; grote tag-taxonomie; desktop-layouts als v1-doel; "snel"-badge uit minuten-optelling; de 2 s-splash; foto's van alle 196 gerechten als standaardlook.
- Zware webstack (Next.js/SSR, GraphQL, Redux, monorepo-tooling); verplichte reviews voor twee personen.

---

## 10. Roadmap

**Een hobby-dag = ±3 geconcentreerde uren met Claude Code** (een avond of een halve weekenddag). Elke fase heeft een **kern** (moet af voordat de fase telt) en een lijst **als tijd over** (schuift door zonder dat de fase onbruikbaar wordt). Kern in totaal ±49 hobby-dagen; kern + als-tijd-over ±66; **reken op 60-80** inclusief tegenvallers. `main` blijft altijd bruikbaar; half werk staat achter een flag op `/next/`.

| Fase | Dagen (kern + als tijd over) | Doel | Kern | Als tijd over | Bruikbaar aan het eind |
|---|---|---|---|---|---|
| **0 — Go/no-go & fundament** | 4 | Het riskantste eerst bewijzen, op de echte telefoons, en niets verliezen. | Exportknop in Recepten2 (tekst + klembord) en export van jouw telefoon; map `RutgersRecepten`, git, publieke repo, Vite+Preact-skelet, `pages.yml` (één artefact voor `main` + `next`), `.nojekyll`, manifest met juiste `id`/`start_url`/`scope` en **één** POST-`share_target` + `share/index.html`, `sw.ts` met share-handler; `tools/measure-parse.ts`; **realistische testpagina**: 196 namen met plakkende letterkoppen + A-Z-rail, één receptdetail met lange scroll, toevoegformulier met meerdere velden, deelknop met 2 KB `#r=`-testlink, plakknop + textarea, testtimer (voorgrond/vergrendeld/achtergrond), `persist()`- en standalone-status, en de **Apparaatcheck-pagina** die resultaten als kopieerbare tekst teruggeeft; checklist §3b op jouw Android en de iPhone-rij (zelf of door haar via de checklistpagina); `CLAUDE.md` met invarianten; ADR-0001 (checklist + besluit), 0002-0006. | — | Testpagina op beide telefoons; jouw data veilig; **jouw D2-besluit gevallen op meetbare punten.** |
| **1 — Recepten2 op beide telefoons** | 12 | Vervang de oude app, in het Nederlands, met een eerste deelmogelijkheid. | Schema v2 met raw-only regels en stappen gesplitst op `\n\n`; Dexie v1 + repository (dbName uit BASE_URL); profielen (naam, taal, kleur) en install-kaart; Home (placeholder), Alle recepten, zoeken, detail, favorieten per persoon, eigen recept toevoegen/bewerken/verwijderen (vrije regels), legacy-import van jouw export, kookstand basis (stappen + wake lock), SW + update-prompt + persist + Opslag-paneel, thema uit de cover, dark mode; **token-codec + "Deel via WhatsApp" + plak/klembord-import (minimaal, zonder merge-preview)**; `boot.ts`-regel met kale landingsviewer; Vitest voor codec en migraties. | Drieweg-thema, recente zoekopdrachten, A-Z-rail-polish. | **Beide installeren en gebruiken het:** het boek in het Nederlands (UI bij haar in het Engels), eigen recepten, favorieten, en jullie kunnen al een recept over WhatsApp uitwisselen. **Beslismoment 2 (±dag 16):** twee weken echt gebruik; route (iii) nog mogelijk zonder verlies van domein/data. |
| **2 — Structuur & Engels** | 8 + 4 | R1 + R3: de data wordt gestructureerd en tweetalig. | `units.json`, `qualifiers.json`, `prep-phrases.json`, `categories.json` handgeschreven; parser + golden fixture; `migrate` → `recipes.json` v2 + `ingredients.json`-concept; LLM-pass (optie a of b); `validate:data`; **Dexie v2-migratie** (eigen regels herparsen uit raw); jij checkt ids (één avond); app rendert uit het woordenboek: Engelse ingrediënten/eenheden/°F, porties-schaler, NL/EN/beide; review-pagina met lokale correcties + `.txt`-patch + `apply-review`. | Categorieschap + filterchips, tweetalig zoeken via woordenboek, smart line entry met chips, bulk-plakken, language-pair editor + kopieer-voor-vertaling. | **Engelse editie op haar telefoon**, schalen naar 2 personen; zij begint aan de Engelse review. |
| **3 — Delen compleet** | 7 + 3 | R2 volledig, eerlijk op beide platforms. | Volledige landingsbundel (viewer + NL/EN + hand-off + installhint); share_target-flow tekst én document end-to-end; import-preview met statussen; merge-regels + conflictkaart + Inbox + undo; woordenboek-delta's; bundels als bestand (.json/.txt); back-up/herstel met tellers en 30-dagen-badge; meerdere tokens per bericht; bevroren tokens; Playwright-smoketest (incl. landing-regel). | Override-patches `t:"p"`; Deel als tekst; delta-share; QR tonen/scannen (flag, experimenteel). | Alle ontvangstflows op iPhone en Android werken en zijn getest; back-ups bestaan. |
| **4 — Kies 7 & boodschappen** | 10 + 4 | R4: het familieritueel, correct voor 2 personen. | Weekbord met Kies 7 als held, pool, slot-types, porties; `aggregate.ts` met test per regel en de uitgewerkte voorbeelden (knoflook, uien, tomaten, boter); afrondtabel en buy-units; gangpadvolgorde per telefoon; Voorraadcheck; Controleer zelf + Koppel; winkelstand met afvinken en wake lock; extra's + vaste items; Deel lijst NL/EN. | Verras me met regels; kook dubbel; Heb ik al met carry-over; Waarvoor is dit?; stale banner; Deel weekplan `#w=`; Vandaag koken-kaart; kooklog + "lang niet gegeten". | **Vrijdagavond: Kies 7 → lijst → delen → zaterdag in de winkel afvinken.** |
| **5 — Koken & afwerking** | 8 + 6 | Het maakt de app van jullie en houdt hem onderhoudbaar. | Kookstand volledig (per-stap-ingrediënten, prep-checklist, tegelijk-tag, timers zoals in fase 0 bewezen, Gekookt!); override-laag met Toon origineel; goesWith in planner/lijst; notities; Curator-scherm; Het verhaal/The Book met "N van de 196"; empty states; toegankelijkheid; changelog; ADR-0007 en jaarlijkse WebKit/Chrome-hercheck in CLAUDE.md. | Stappen-editor; keukenwoordenboek; mijlpalen; print (recept, lijst, boek); categorie-illustraties; flags + Experimenten; `.claude/skills`; optioneel TWA-APK. | Compleet; alles daarna is de "Later"-lijst, alleen als jullie erom vragen. |

Mijlpalen in kern-dagen: testpagina en D2-besluit dag 4 · dagelijkse app op beide telefoons en beslismoment 2 dag 16 · Engels + structuur dag 24 · delen compleet dag 31 · weekplanner dag 41 · kookstand & afwerking dag 49. Met de als-tijd-over-lijsten erbij ±66; plan op 60-80.

---

## 11. Risico's & open vragen aan Stijn

### Risico's

| Risico | Ernst | Mitigatie |
|---|---|---|
| De WebAPK voelt voor jou als een website (D2). | hoog | Fase 0 is de go/no-go met een meetbare checklist op jouw telefoon; beslismoment 2 na fase 1; fallback (iii) precies gespecificeerd; data/parser/token/tools blijven bruikbaar. |
| Kooktimers gaan niet af als de app dicht is; de app voelt daardoor "beperkt". | hoog | UNKNOWN op beide platforms, getest in fase 0; UI ontworpen op het slechtste geval (aftelling + geluid zolang open, "zet ook een timer op je telefoon"); eerlijk op de verlieslijst; later Capacitor-schil met AlarmManager. |
| Kopiëren → app → plakken irriteert haar en ze stopt met importeren. | hoog | Import één tik diep, hele bericht plakbaar, meerdere tokens per bericht, textarea zonder API, wekelijkse delta in tekst i.p.v. bestand, QR als het werkt; na 2 maanden gebruik evalueren tegen ADR-0008 (€99/jaar native iOS). |
| Haar eigen recepten verdwijnen (websitegegevens gewist, icoon verwijderd, iOS-bug). | hoog | Verplichte installatie op het beginscherm + permanente waarschuwing in Safari-tab; `persist()`; back-up met 30-dagen-badge; WhatsApp-geschiedenis als tweede kopie; ingebouwde recepten komen altijd terug. |
| Inspanning loopt uit (hobby-project, grote Must-lijst). | hoog | Hobby-dag gedefinieerd; kern/als-tijd-over per fase; elke fase op zichzelf bruikbaar; `main` altijd werkend. |
| De iPhone is zelden fysiek beschikbaar voor tests. | middel | Apparaatcheck-pagina in de app die resultaten als tekst teruggeeft via WhatsApp; `/next/` als haar testkanaal; Playwright alleen als regressiewacht. |
| 2 KB-link blijft niet tikbaar in WhatsApp (UNKNOWN). | middel | Test op dag 1; importer accepteert het hele bericht; bestand boven ±3,5 KB. |
| Een halve migratie op `/next/` beschadigt jouw echte data (gedeelde origin op Android). | middel | Databasenaam uit BASE_URL (`recepten-next`), eigen manifest-id/naam/icoon; alternatief eigen origin (ADR-0002). |
| `share_target` werkt niet op jouw Samsung/Chrome-combinatie (bekende WebAPK-installfouten met share_target). | middel | Fase-0-test 9; fallback plakken/bestandskiezer werkt altijd; eventueel manifest-veld wisselen om herinstallatie te forceren. |
| Vertaalfouten in de Engelse editie. | middel | Namen/eenheden uit het woordenboek; LLM raakt geen hoeveelheden; review-pagina met lage confidence eerst; Curator; `text.en`-badge. |
| Woordenboek-curatie (400-450 entries, gangpaden, staples, gramsPer) kost meer uren dan begroot. | middel | LLM doet 90%; onbegrepen regels nooit weg; Koppel-flow repareert waar het gevolg zichtbaar is. |
| Twee telefoons bewerken hetzelfde recept → duplicaten. | middel | ids + rev + fingerprint, field-level merge, conflictkaart, undo, invariant in CLAUDE.md. |
| Recepten2 bouwt niet meer op de huidige Android Studio (exportknop). | middel | Fallback via `adb run-as` op een debug-build (§12); anders Gradle/AGP-sync met Claude Code, één avond. |
| Publieke repo toont de recepten en jullie namen. | laag | Recepten staan al in een boek; profielen alleen op het toestel; Cloudflare Pages + privérepo is een uur werk (ADR-0002). |
| Dependency/WebKit-churn over jaren. | laag | Bevroren lijst, lockfile, CI, tests op data/codec/optelling, jaarlijkse hercheck-taak, ADR's. |

### Open vragen (met de aanname die dit plan gebruikt)

| Vraag | Aanname in dit plan |
|---|---|
| **Wonen jullie samen / hoe vaak is haar iPhone fysiek beschikbaar** voor de fase-0-tests en de iPhone-specifieke flows (Plak-callout, standalone, wake lock, timer)? | Wekelijks. Is het minder: fase-0-iPhone-tests doet zij zelf via de Apparaatcheck-pagina en stuurt de tekst terug via WhatsApp. |
| Zijn `AndroidStudioProjects\Recepten` en `\FamilyRecipes` eerdere pogingen met iets bruikbaars (nieuwere `recipes.json`, foto's)? Is Recepten2 de gezaghebbende bron van de 196? | Ja, Recepten2 is de bron; de andere twee worden alleen gediff't op `recipes.json` vóór de migratie. |
| Heeft een van jullie (ooit) toegang tot een Mac? | Nee. Native iOS blijft een betaald cloud-pad (ADR-0008). |
| Is een **publieke** GitHub-repo (en dus publiek leesbare recepten en code) akkoord, of liever Cloudflare Pages met privérepo? | Publiek; GitHub Pages. |
| Wat is je GitHub-gebruikersnaam en mag de repo `recepten` heten (URL `https://<jij>.github.io/recepten/`)? | `recepten`; map `AndroidStudioProjects\RutgersRecepten`. |
| App-naam: "Rutgers' Recepten" (korte naam "Recepten")? | Ja. |
| Wil zij **meebouwen** (Claude Code, `/next/`, issues) of alleen gebruiken en het Engels nakijken? | Nakijken + af en toe een idee; CONTRIBUTING.md in plain English maakt meer mogelijk. |
| Haar iOS-versie (≥ 18.4 voor wake lock, ≥ 17 voor `persist()`, ≥ 16.4 voor CompressionStream)? | iOS 26. |
| Is €99/jaar ooit bespreekbaar als plakken na twee maanden echt irriteert? | Nee, tenzij jullie het zelf aankaarten; wel gedocumenteerd. |
| LLM-pass: een aparte API-sleutel met een paar euro tegoed (optie a), of binnen Claude Code-sessies zonder sleutel (optie b)? Een Claude Code-abonnement geeft geen API-sleutel. | Optie (b) tenzij je een sleutel hebt; keuze bij de start van fase 2. |
| Huishoudgrootte, boodschappendag, supermarkt(en)? | 2 personen; weekstart vrijdag; AH bij jou, Tesco bij haar; volgorde per telefoon instelbaar. |
| Haar naam voor het profiel en de reviewer-credit? | `<naam>` tot je het zegt. |
| Chrome als standaardbrowser op je Android? (Samsung Internet maakt geen WebAPK.) Is de geïnstalleerde Recepten2 een debug-build? | Ja; ja (anders §12-fallback). |
| Wil je in fase 5 de optionele TWA-APK voor Android-vrienden, of is de URL genoeg? | URL is genoeg. |

---

## 12. Volgende stap

Vandaag, in deze Claude Code-sessie, in deze volgorde:

1. **Beveilig je data.** Open Recepten2 in Android Studio; laat Claude Code in `SettingsScreen.kt` twee knoppen toevoegen: **"Exporteer mijn recepten"** = `Intent(ACTION_SEND).setType("text/plain").putExtra(EXTRA_TEXT, json)` met `json = {"userRecipes": <user_recipes_json>, "favoriteNames": [...]}` (deel naar WhatsApp-naar-jezelf of Drive), en **"Kopieer naar klembord"** via `ClipboardManager`. Geen `.json`-bestand delen (FileProvider). Installeer, exporteer naar je pc. **Bouwt het project niet** (Gradle/AGP-sync op de huidige Android Studio): controleer eerst of de geïnstalleerde app een debug-build is met `adb shell dumpsys package <package> | findstr -i debuggable` (of `pkgFlags` bevat `DEBUGGABLE`); zo ja, dan `adb shell run-as <package> ls files/datastore` en `adb shell run-as <package> cat files/datastore/<naam>.preferences_pb > export.pb` — een klein Python-script haalt de JSON-string en de namen uit het protobuf (de tekst staat er leesbaar in). Zo nee: eerst de build repareren met Claude Code (één avond) en dan de knoppen. Recepten2 verder niet aanraken.
2. **Maak de nieuwe map** `C:\Users\srutg\AndroidStudioProjects\RutgersRecepten`: `npm create vite@latest . -- --template preact-ts`, voeg Dexie, fflate, vite-plugin-pwa (injectManifest), Vitest en Playwright toe; `git init`; `.gitignore`. Geen mkcert nu.
3. **Schrijf `CLAUDE.md`** met: de twee gebruikers en telefoons; commando's (`npm run dev -- --host`, `check`, `validate:data`, `test`, `measure-parse`); invarianten (ids wijzigen nooit; raw nooit weg; elk tekstveld `{nl,en}`; token is een versioned contract; iOS heeft geen share target of link capture, de plak-import wordt nooit uit de app gehaald; `src/domain/` importeert geen framework; de landingsbundel schrijft nooit; **`boot.ts`-regel: `#r=` + iOS + niet-standalone → landing, anders volledige app**; `persist()` elke start; `navigator.share` met precies één veld; `id`/`start_url`/`scope` = `/recepten/`; **één** `share_target`, POST multipart; dbName uit BASE_URL; timers beloven niets wat fase 0 niet bewees); definition of done (check groen + Playwright + half werk achter een flag op `/next/`); jaarlijkse hercheck-taak.
4. **Repo + CI:** publieke GitHub-repo `recepten`; `pages.yml` uit §4 (één artefact met `main` én `next`); `.nojekyll`; `manifest.webmanifest` en `manifest.next.webmanifest`; `public/share/index.html`; `sw.ts` met de share-handler uit §4; iconen uit de cover (hercomprimeer `cover.png` naar WebP); `tools/measure-parse.ts` committen.
5. **Fase-0-testpagina** die de 196 namen uit `Recepten2\app\src\main\assets\recipes.json` toont met plakkende letterkoppen en A-Z-rail, één detailpagina met lange scroll, een toevoegformulier met vier velden, "Deel"-knop (`share({text})` met een 2 KB `#r=`-testlink), "Plak van klembord"-knop, textarea, testtimer (30 s; voorgrond/vergrendeld/achtergrond), `persist()`-status, standalone-detectie en de **Apparaatcheck**-pagina met "Kopieer resultaten".
6. **Device-tests** volgens de checklist in §3b op jouw Android en (zelf of op afstand) haar iPhone; resultaten pass/fail in `docs/adr/0001-runtime.md`, inclusief wat de timer op elk toestel in elke toestand deed en jouw D2-besluit.
7. **Bij go:** begin fase 1 met `src/domain/model.ts` (schema v2) en `src/db/schema.ts`. **Bij no-go (route iii):** zelfde map; `android/`-project in Kotlin/Compose voor jouw UI; `web/` wordt de **installeerbare alleen-lezen PWA voor haar** (zelfde manifest, `boot.ts`-regel, plak-import, IndexedDB met `persist()`, favorieten, zoeken, kookstand-basis; geen editor/planner) plus de landingsviewer; `tools/`, `data/` en `src/domain/` blijven; ADR-0001 legt vast dat de LLM-pass en de Engelse editie ongewijzigd doorgaan.
