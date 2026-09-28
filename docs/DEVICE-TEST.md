# Apparaatcheck / Device check

Fase-0-test op de echte telefoons. Resultaten komen in `docs/adr/0001-runtime.md`.
Phase-0 test on the real phones. Results go into `docs/adr/0001-runtime.md`.

- [Nederlands](#nederlands)
- [English](#english)

---

## Nederlands

### Wat je nodig hebt

- De link naar de app (Stijn stuurt hem; hij eindigt op `/recepten/`).
- WhatsApp met een chat naar jezelf of naar elkaar.
- Ongeveer 20 minuten. Je hoeft niet alles in één keer te doen: de Check-pagina onthoudt wat je al
  hebt aangevinkt.

### Stap 1 — installeer de app

**Android (Stijn):** open de link in Chrome → **Installeren** (of menu ⋮ → App installeren). Daarna
altijd openen via het icoon in de app-lade.

**iPhone:** open de link in **Safari** → deelknop (vierkant met pijl omhoog) → **Zet op beginscherm**
→ laat "Open als webapp" aan staan → **Voeg toe**. Daarna altijd openen via het icoon op het
beginscherm, nooit in Safari.

### Stap 2 — open het tabblad Check

Open de app via het icoon. Tik onderaan op het tabblad **Check** (kop: *Apparaatcheck*). Kies
rechtsboven je taal (**NL / EN**). De pagina toont de lijst hieronder; sommige regels vullen zichzelf
in, bij andere staat een knop en doe jij iets. Vink na elke regel **pass** of **fail** aan, of typ
kort wat er gebeurde.

> **Testversie (NEXT):** krijg je een link die eindigt op `/recepten/next/`, open die dan eerst één
> keer in een gewone browsertab (Chrome of Safari) zodat de NEXT-app zijn eigen service worker en
> icoon kan installeren; installeer daarna vanuit die tab. NEXT heeft een eigen icoon en eigen
> opslag en raakt je echte recepten niet.

### Stap 3 — loop de lijst af

| # | Wat je doet | Wat "goed" is |
|---|---|---|
| 1 | *Android:* kijk of het icoon in de app-lade staat en of de app in Instellingen → Apps voorkomt. | Ja. |
| 2 | Kijk naar het scherm: geen adresbalk; statusbalk in de kleur van de app; niets valt onder de notch of de onderrand. | Ja. |
| 3 | Zet vliegtuigmodus aan, herstart de telefoon, open de app via het icoon. | De lijst staat er binnen 2 seconden. |
| 4 | Scroll snel door de lijst van 196 recepten; trek bovenaan verder naar beneden. | Vloeiend; letterkoppen blijven plakken; geen "vernieuw pagina"-gevoel. |
| 5 | Open het toevoegformulier, tik in elk veld, typ iets. | Toetsenbord bedekt geen invoerveld; het scherm zoomt niet in. |
| 6 | Open een recept, gebruik het terug-gebaar (of de terugknop) een paar keer. | Je gaat terug naar de lijst; de app sluit pas als je vanaf Home teruggaat. |
| 7 | Druk lang op een knop en op een lijstregel. | Er verschijnt geen tekstselectie of browser-menu. |
| 8 | Tabblad **Delen**: vul je naam in, vink **Tweetalig (test 2 KB)** aan (het langste recept staat al gekozen; kijk naar **URL-lengte**), tik op **Deel via WhatsApp**, stuur het naar jezelf, tik dan op de link in WhatsApp. | Eén klikbare link. *Android:* opent in de app, of in een Chrome-tab met werkende "Bewaar in mijn recepten" — noteer welke. *iPhone:* opent een voorproefpagina in Safari met "Copy recipe code". |
| 9 | *Android:* druk lang op de WhatsApp-bubbel uit test 8 → Delen → **Recepten**. Daarna met een document: maak op de pc een bestand `test.json` met de inhoud `{"name":"Test","ingredients":["1 ei"],"instructions":"Kook."}`, stuur het via WhatsApp (paperclip → Document) naar jezelf, druk lang op het document → Delen → **Recepten**. | Beide keren opent de app op het Import-scherm met "Ontvangen via het deelmenu" en een voorproefje. |
| 10 | Tik op **Deel via WhatsApp** (moet WhatsApp openen met tekst). Kopieer een bericht in WhatsApp, terug in de app: **Plak van klembord** (*iPhone:* tik op de "Plak"-ballon). Plak ook een keer met lang drukken in het grote tekstvak. | Alle drie werken. |
| 11 | Start de **timer van 30 s** drie keer: (a) app open laten; (b) scherm vergrendelen; (c) naar een andere app gaan. Schrijf per keer op: melding? geluid? trilling? niets? | Alleen (a) hoeft te werken. De rest is informatie, geen fout. |
| 12 | Kijk op de Check-pagina onder *Automatisch gemeten* naar de regel **storage.persisted()**. | ja (na installatie). |

### Stap 4 — kopieer en verstuur

Onderaan de Check-pagina staat **Kopieer resultaten**. Tik erop: de hele lijst met jouw antwoorden
staat nu als tekst op je klembord. Open WhatsApp, plak het in de chat met Stijn en verstuur. Stijn zet
het in `docs/adr/0001-runtime.md`. Vermeld ook je telefoonmodel en iOS/Android-versie (de Check-pagina
zet die er zelf bij).

### Extra voor Stijn (Android, alleen met pc)

`adb shell pm get-app-links <webapk-pakketnaam>` laat zien of de links van de site aan de WebAPK zijn
gekoppeld ("verified"). Noteer de uitkomst bij test 8.

---

## English

### What you need

- The link to the app (Stijn sends it; it ends in `/recepten/`).
- WhatsApp with a chat to yourself or to each other.
- About 20 minutes. You do not have to do everything at once: the Check page remembers what you have
  ticked so far.

### Step 1 — install the app

**Android (Stijn):** open the link in Chrome → **Install** (or menu ⋮ → Install app). From then on
always open it from the icon in the app drawer.

**iPhone:** open the link in **Safari** → Share button (the square with the arrow pointing up) →
**Add to Home Screen** → leave "Open as Web App" on → **Add**. From then on always open it from the
icon on your home screen, never in Safari.

### Step 2 — open the Check tab

Open the app from its icon. Tap the **Check** tab at the bottom (heading: *Device check*). Pick your
language at the top right (**NL / EN**). The page shows the list below; some rows fill themselves in,
others have a button and need you to do something. After each row tick **pass** or **fail**, or type
a few words about what happened.

> **Test version (NEXT):** if your link ends in `/recepten/next/`, first open it once in a normal
> browser tab (Chrome or Safari) so the NEXT app can install its own service worker and icon; then
> install from that tab. NEXT has its own icon and its own storage and never touches your real
> recipes.

### Step 3 — go through the list

| # | What you do | What "good" looks like |
|---|---|---|
| 1 | *Android:* check that the icon is in the app drawer and that the app appears in Settings → Apps. | Yes. |
| 2 | Look at the screen: no address bar; the status bar has the app's colour; nothing sits under the notch or the bottom edge. | Yes. |
| 3 | Turn on flight mode, restart the phone, open the app from its icon. | The list is there within 2 seconds. |
| 4 | Scroll fast through the list of 196 recipes; at the top, keep pulling down. | Smooth; letter headers stick; no "refresh the page" feeling. |
| 5 | Open the add form, tap into every field, type something. | The keyboard never covers an input; the screen does not zoom in. |
| 6 | Open a recipe, use the back gesture (or back button) a few times. | You go back to the list; the app only closes when you go back from Home. |
| 7 | Long-press a button and a list row. | No text selection or browser menu appears. |
| 8 | **Share** tab: enter your name, tick **Bilingual (2 KB test)** (the longest recipe is preselected; look at **URL length**), tap **Share via WhatsApp**, send it to yourself, then tap the link in WhatsApp. | One tappable link. *Android:* opens in the app, or in a Chrome tab with a working "Save to my recipes" — note which. *iPhone:* opens a preview page in Safari with "Copy recipe code". |
| 9 | *Android only:* long-press the WhatsApp bubble from test 8 → Share → **Recepten**. Then with a document: on a PC create a file `test.json` containing `{"name":"Test","ingredients":["1 ei"],"instructions":"Kook."}`, send it to yourself in WhatsApp (paperclip → Document), long-press the document → Share → **Recepten**. | Both times the app opens on the Import screen with "Received via the share sheet" and a preview. |
| 10 | Tap **Share via WhatsApp** (should open WhatsApp with text). Copy a message in WhatsApp, back in the app: **Paste from clipboard** (*iPhone:* tap the "Paste" bubble). Also paste once by long-pressing in the big text box. | All three work. |
| 11 | Start the **30-second timer** three times: (a) keep the app open; (b) lock the screen; (c) switch to another app. Each time write down: notification? sound? vibration? nothing? | Only (a) has to work. The rest is information, not a failure. |
| 12 | On the Check page, under *Detected automatically*, look at the row **storage.persisted()**. | yes (after installation). |

### Step 4 — copy and send

At the bottom of the Check page is **Copy results** (Dutch: *Kopieer resultaten*). Tap it: the whole
list with your answers is now on your clipboard as text. Open WhatsApp, paste it into your chat with
Stijn and send. Stijn puts it into `docs/adr/0001-runtime.md`. Your phone model and iOS/Android version
are added by the Check page itself.

### Extra for Stijn (Android, PC only)

`adb shell pm get-app-links <webapk-package>` shows whether the site's links are bound to the WebAPK
("verified"). Note the outcome next to test 8.
