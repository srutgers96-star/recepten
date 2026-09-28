# ADR-0002 — Hosting: GitHub Pages from a public repo, one workflow, one artifact for `main` + `next`

**Status:** Accepted · **Date:** 2026-09-28 (decision in PLAN.md §0: public repo + GitHub Pages agreed)

## Context

The app needs free HTTPS hosting (the share sheet and clipboard APIs require a secure origin), a
deploy that is just `git push`, and a second **test channel** where half-finished features can be
tried on both phones without touching real data. GitHub Pages is free for public repos (1 GB,
100 GB/month) but every `actions/deploy-pages` run **replaces the whole site**, so two independent
deploys (one per branch) would wipe each other. The recipes are already in a printed book, so a
public repo exposes nothing new; profiles and personal data live only on the phones.

## Decision

- Public GitHub repo `recepten`; site at `https://srutgers96-star.github.io/recepten/`. Project-site paths, so
  manifest `id`/`start_url`/`scope` are `/recepten/` and `/recepten/next/`, never `/`.
- **One workflow** (`.github/workflows/pages.yml`) triggered by a push to `main` **or** `next` (and
  manually). It checks out both branches, builds `main` with base `/recepten/` (after `check`,
  `validate:data` and `test`), builds `next` with `npm run build:next` (base `/recepten/next/`,
  `NEXT_CHANNEL=1`) and copies `dist-next/*` into `main/dist/next/`, then uploads **one** artifact and
  deploys it. The `next` checkout and build are `continue-on-error`: a missing or broken `next` never
  blocks `main`.
- `public/.nojekyll` so underscore paths and `.well-known/` survive; `__GIT_SHA__` shown in About.
- **Documented alternative:** Cloudflare Pages with a private repo, which gives automatic branch
  previews on their own origin. About an hour of work; switch if privacy becomes a concern or if the
  `/next/` scope wart (below) bites.

## Consequences

- `git push` to `next` is the primary dev loop on the phones (~2 minutes to live, real HTTPS).
- Every push rebuilds **both** channels; nothing overwrites the other.
- Known wart: `/recepten/next/` lies inside the scope of the main WebAPK on Android, so a NEXT link
  tapped in WhatsApp may open in the main app. Acceptable for a test channel (NEXT is opened from its
  own icon); if it bites, `next` moves to its own origin (Cloudflare branch preview or a second repo).
- The `next` channel isolates data by database name on Android and by storage bucket on iOS (ADR-0003).
- CI runs Vitest and, later, the Playwright WebKit smoke test; Playwright is a regression guard, not a
  substitute for the iPhone (it does not emulate storage isolation, the Paste callout or standalone).
