# Rutgers' Recepten · Rutgers' Recipes

**NL** — Het familiekookboek van Rutgers als webapp: de 196 klassiekers uit het boek, tweetalig
(Nederlands/Engels), met eigen recepten, favorieten per persoon, kookstand, weekplanner ("Kies 7") en
een samengevoegde boodschappenlijst. Eén URL voor Android (Chrome → Installeren) en iPhone (Safari →
Zet op beginscherm); recepten wisselen jullie uit via WhatsApp. Geen server, geen accounts: alles staat
op je eigen telefoon, back-up is één tik. Het volledige ontwerp staat in `PLAN.md`, de besluiten in
`docs/adr/`.

**EN** — The Rutgers family cookbook as a web app: the 196 classics from the printed book, bilingual
(Dutch/English), plus your own recipes, favourites per person, a cooking mode, a weekly planner
("Pick 7") and a merged shopping list. One URL for Android (Chrome → Install) and iPhone (Safari →
Add to Home Screen); recipes travel between phones through WhatsApp. No server, no accounts: everything
lives on your own phone and backup is one tap. See `CONTRIBUTING.md` for installing, testing and
proposing ideas, `PLAN.md` for the full design and `docs/adr/` for the decisions.

## Quick start (developers)

```
npm install
npm run dev          # http://localhost:5173, also reachable from phones on the same wifi
npm run check        # TypeScript
npm test             # Vitest
npm run build        # production build, base /recepten/
```

Deploys happen automatically: a push to `main` goes to `/recepten/`, a push to `next` to
`/recepten/next/` (the test channel with its own data). See `.github/workflows/pages.yml`.
