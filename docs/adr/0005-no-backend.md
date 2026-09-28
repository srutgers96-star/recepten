# ADR-0005 — No backend, no accounts, no analytics

**Status:** Accepted · **Date:** 2026-09-24

## Context

The app is for two people (later perhaps a handful of family and friends) and is maintained by two
hobbyists with an AI assistant. A backend would add hosting cost or a free tier that can vanish,
secrets to manage, accounts and password resets, a privacy policy, and a second codebase to keep alive
for years. The data is small (196 recipes plus own recipes, well under a megabyte without photos) and
the phones already share a channel both people use daily: WhatsApp.

## Decision

- **No server, no database in the cloud, no accounts, no analytics, no push.** GitHub Pages serves
  static files only (ADR-0002).
- All state lives in the phone's IndexedDB (ADR-0003); the phones **converge through WhatsApp**:
  a share token per recipe (ADR-0004), a weekly "send new to <name>" delta, and files for bundles.
- **Backup** is one tap to Files/Drive/WhatsApp and is the only durability guarantee; the app nags
  after 30 days of un-backed-up changes.
- Translation of the 196 classics is a one-off pass on the PC (Claude Code sessions or an API key),
  committed as data; there is **no LLM and no translation API in the app**. The later "photo import"
  hands the user a prompt to paste into ChatGPT/Claude themselves.

## Consequences

- Zero running cost and nothing that can be shut off remotely; the site keeps working as long as the
  static files exist.
- No real-time sync: two phones editing the same recipe is handled by ids + `rev` + fingerprint and a
  conflict card, deletions never travel (no tombstones in v1), and undo per import.
- No cooking-timer push notifications; timers are limited to what the browser can do while the app
  is open (ADR-0001, row 11).
- Personal data (profiles, notes, cook log) never leaves the phones except inside a share or backup
  the user sends deliberately; a public repo therefore exposes only the recipes and the code.
