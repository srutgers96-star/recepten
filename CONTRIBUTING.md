# Contributing to Rutgers' Recipes

This page is written for you, the person who does not build the app but uses it, tests it and has
ideas about it. Nothing here needs a developer. There is a short "if you want to code" section at
the end for anyone who does.

## What the app is

Rutgers' Recipes is the family cookbook as an app on your phone: the 196 classics from the printed
book, in Dutch and English, plus your own recipes, favourites per person, a cooking mode that keeps
the screen on, a weekly planner ("Pick 7") and a shopping list that adds up the ingredients for you.

It is a *web app*: there is nothing in the App Store or Play Store. You open one web address, put it
on your home screen, and from then on it behaves like a normal app, including offline. Everything is
stored on your own phone. There is no server, no account and no tracking; recipes travel between
phones as WhatsApp messages.

The address is `https://srutgers96-star.github.io/recepten/` (Stijn will send you the exact link).

## Installing it on an iPhone

1. Open the link in **Safari** (not in the WhatsApp browser, not in Chrome).
2. Tap the **Share** button (the square with the arrow pointing up).
3. Choose **Add to Home Screen**.
4. Leave **"Open as Web App"** switched **on** (it is on by default on iOS 26) and tap **Add**.
5. From now on, always open the app from the icon on your home screen, not from Safari.

Why the icon matters: Safari can throw away the data of a website you have not visited for seven
days. The home-screen app is exempt from that rule and gets its own, separate storage. If you use
the app inside a Safari tab instead, it shows a permanent warning for exactly this reason.

Two things an iPhone simply cannot do with a web app, so the app does not pretend it can:

- A link in a WhatsApp message always opens Safari, never the installed app. Tapping a shared recipe
  link shows you a preview page with a **Copy recipe code** button; the recipe is saved through the
  app, see "Receiving a recipe" below.
- The app cannot appear in the iPhone share sheet. That is an Apple limitation, not a bug.

## Installing it on Android

1. Open the link in **Chrome**.
2. Tap **Install** in the banner (or the three-dot menu → **Install app** / **Add to Home screen**).
3. The app appears in your app drawer like any other app, and in the WhatsApp share sheet.

Samsung Internet and Firefox can show the app but cannot install it properly (no share sheet, no
link capture); please use Chrome.

## Receiving a recipe

**Android:** tap the link in WhatsApp, or long-press the message → Share → Recipes. Then tap
**Import**.

**iPhone:** long-press the message in WhatsApp → **Copy** → open the Recipes icon → **Import** tab →
**Paste from clipboard** (iOS shows a small "Paste" bubble; tap it) → **Import**. You can also
long-press in the big text box and choose Paste. Whole messages are fine; the app finds the recipe
code by itself.

Larger things (a backup, a bundle of many recipes) arrive as a `.json` or `.txt` file: in WhatsApp
tap the file → Share → **Save to Files**, then in the app: Import → **Choose file**.

## The `/next/` test channel and why it has its own, empty data

Besides the real app there is a second, identical-looking app at `…/recepten/next/`. It is called
**Recipes NEXT**, has an icon with a yellow band, and it is where half-finished features go so you can
try them before they reach the real app.

Install it exactly like the real app (Safari → Share → Add to Home Screen, or Chrome → Install). You
end up with two icons: **Recipes** (your real data) and **Recipes NEXT** (a playground).

NEXT deliberately does **not** see your real recipes:

- On an iPhone every home-screen icon gets its own storage. NEXT starts empty; nothing you do in NEXT
  can touch the real app, and the other way round.
- On Android the two apps share Chrome's storage, so the app itself keeps them apart by using a
  different database name (`recepten-next` instead of `recepten`). A broken experiment on NEXT can
  therefore never damage your real recipes.

So the first thing to do in NEXT, if you want realistic data, is **Settings → Restore from backup**
and pick a backup file you made in the real app (Settings → Backup, then Save to Files). Anything you
add in NEXT stays in NEXT unless you share it to the real app like any other recipe.

## Running the device check and sending the results

The app has a **Check** tab (Settings → Device check). It runs a set of small tests on your phone:
installed as an app or not, storage protected or not, sharing to WhatsApp, pasting, offline start, a
timer in the foreground, with the screen locked, and with the app in the background, and so on.

Step by step (also in `docs/DEVICE-TEST.md`, in Dutch and English):

1. Open the app from its home-screen icon.
2. Go to the **Check** tab and switch the language to English if needed (top of the screen).
3. Go through the items from top to bottom. Some run by themselves; the ones with a button need you to
   do something (for example tap **Share** and pick WhatsApp, or start the 30-second timer and lock
   the phone). After each one, mark it pass, fail, or write what happened.
4. At the bottom tap **Copy results** (Dutch: *Kopieer resultaten*). The whole checklist is now on your
   clipboard as plain text.
5. Open WhatsApp, paste it into your chat with Stijn and send. That is all; he puts the results in
   `docs/adr/0001-runtime.md`.

You do not have to finish everything in one go; the page remembers what you have marked.

## Proposing an idea or reporting something odd

Either works:

- Open an issue on GitHub: go to the repository page, **Issues** → **New issue**, and write in plain
  English what you wanted to do and what happened instead. Screenshots help.
- Or just send Stijn a WhatsApp message. He turns it into an issue.

Ideas about the English text of the recipes (wording, ingredient names, oven temperatures) are
especially welcome; the English edition is reviewed by you and the app credits you for it.

## If you want to code

- Install **Node 22** (nodejs.org, LTS) and **Git**. On Windows you may need to allow scripts once;
  ask Stijn.
- Get the code: `git clone https://github.com/srutgers96-star/recepten.git`, then `cd recepten` and
  `npm install`.
- Run it: `npm run dev -- --host`. Open `http://localhost:5173` on the PC, or the `http://192.168.…`
  address it prints on a phone on the same wifi. (The share sheet and clipboard buttons need HTTPS,
  so on a phone they only work on the real site; everything else works locally.)
- Check your work: `npm run check` (types), `npm test` (unit tests), `npm run build`.
- Where things live: `src/screens/` are the pages you see, `src/domain/` is the logic without any
  framework (parser, scaling, shopping-list maths, the share code), `src/db/` is storage,
  `data/` holds the recipes and the dictionary, `tools/` are scripts, `docs/adr/` explains the big
  decisions and `CLAUDE.md` lists the rules the code must never break.
- Work on a branch, push it, and ask for a merge into `next`. Whatever lands on `next` is live on
  `…/recepten/next/` about two minutes later, on both phones, without any extra steps. `main` is
  the real app and only gets what has been tried on NEXT.
