# ADR-0001 — Runtime: one PWA for both phones, decided by a measurable phase-0 checklist

**Status:** Proposed — becomes Accepted (route ii) or Superseded (route iii) when the Result columns
below are filled in and Stijn has taken decision D2 on them.
**Date:** 2026-09-24 (plan), results pending.

## Context

Two decisions were already taken: **D1** — Recepten2 (Kotlin/Compose, ~500 lines, no architecture) is
replaced by a completely new app; **D2** — Android first, the iPhone only if it costs little. Three
routes were compared in PLAN.md §3b, all buildable from a Windows PC without a Mac or paid accounts:

- **(i)** native Android only (Kotlin/Compose): best Android polish and background alarms, but APK
  sideloading, a keystore, Google developer verification from 2027, and nothing for the iPhone.
- **(ii)** one web app / PWA for both phones: a single small TypeScript codebase, `git push` deploys,
  auto-update, full app in English on the iPhone; costs on Android: no reliable background alarm for
  cooking timers, no "Open with" for `.json`, a less native feel; ~7-10 extra hobby days (±20%).
- **(iii)** native Android + an installable read-only PWA for her: two renderers to keep in sync.

## Decision

Route **(ii)**, on two conditions:

1. **Phase 0 is a go/no-go on the real phones** using the checklist below, filled in pass/fail, not
   on gut feeling. The throw-away test PWA must be realistic enough to judge: the full list of 196
   names with sticky letter headers and an A-Z rail, one long recipe detail, an add form with several
   text fields, a share button, a paste button, a test timer, an install card and the Device-check
   page that returns results as copyable text.
2. **A second decision moment at the end of phase 1** (±day 16) after two weeks of real use. All
   domain and data work (`src/domain/`, `data/`, `tools/`, tests) is reusable one-to-one in route (iii);
   only the screens would be redone in Compose.

## Phase-0 checklist (PLAN.md §3b)

Fill in the Result columns on the phones; the girlfriend can do the iPhone row herself via the Check
tab → "Copy results" (see `docs/DEVICE-TEST.md`).

| # | Test (Stijn's Android unless stated) | Pass criterion | Result Android | Result iPhone |
|---|---|---|---|---|
| 1 | Icon in the app drawer and in Settings → Apps (WebAPK) | yes | | |
| 2 | No address bar; status bar in theme colour; safe-area correct | yes | | |
| 3 | Cold start offline (flight mode, after restarting the phone) | < 2 s to the list | | |
| 4 | List of 196 scrolls smoothly; sticky headers; overscroll does not feel like browser pull-to-refresh | yes | | |
| 5 | Keyboard in the form never covers an input; no zoom on focus (16 px inputs) | yes | | |
| 6 | Back gesture leaves the app only from Home, never mid-recipe | yes | | |
| 7 | Text selection / long-press does nothing browser-like on buttons and list rows | yes | | |
| 8 | 2 KB `#r=` link in WhatsApp is tappable; opens in the app (`adb shell pm get-app-links` = verified) or in a Chrome tab with a working "Save" | note which | | |
| 9 | "Share → Recepten" in the WhatsApp share sheet for a message **and** for a `.json` document (POST target) | both | | |
| 10 | `navigator.share({text})` to WhatsApp; `readText` + paste; textarea paste | yes | | |
| 11 | 30 s timer: (a) app in the foreground, (b) screen locked, (c) app in the background — what fires (notification / sound / vibration)? | note; only (a) is required | | |
| 12 | `persisted()` = true after installation | yes | | |
| **iPhone** | Home Screen install (standalone), `persisted()`, `share({text})` to WhatsApp, `readText` Paste callout, textarea paste, offline start after restart, 2 KB link tappable (opens the Safari landing), **timer (a)/(b)/(c)** | note | — | |

**Go** = 1-7, 9, 10 and 12 pass; 8 at least the Chrome-tab fallback; 11 at least (a).
**No-go** = Stijn says "no" to 2, 4, 5 or 6 → route (iii): the UI becomes Kotlin/Compose, the web app
shrinks to landing page + installable read-only PWA for her, and everything from phases 1-2 (schema,
parser, dictionary, token, migration tools, Node tests) stays usable unchanged.

### Results and D2 decision

| Field | Value |
|---|---|
| Android device / Chrome version | |
| iPhone / iOS version | |
| Date tested | |
| Timer behaviour Android (a)/(b)/(c) | |
| Timer behaviour iPhone (a)/(b)/(c) | |
| Link opens in (Android): WebAPK / Chrome tab | |
| **Decision (go / no-go)** | |

## Consequences

- Honest loss list for route (ii): no background alarm for timers (the timer UI is designed for the
  worst case: countdown and sound only while the app is open, "also set a timer on your phone");
  no "Open with `.json`"; no Material You; no ML Kit; link capture on Android not guaranteed; QR
  scanning on the iPhone uncertain.
- The invariant "timers promise nothing phase 0 did not prove on that device" (CLAUDE.md 13) is
  fed by row 11 and the iPhone row of this table.
- What she gets: the same app as Stijn, UI in British English, the 196 classics translated and
  reviewed by herself, her own recipes, planner, shopping list, cooking mode with wake lock, backup
  to Files, and receiving Stijn's recipes in ~10 s (long-press → Copy → app → Paste).
- Later, not planned (ADR-0007): if pasting irritates after two months, €99/year buys a native iOS
  shell (cloud build + TestFlight) with a Share Extension and Universal Links; the token, data files
  and `src/domain/` go along unchanged. On Android a Capacitor shell could add AlarmManager timers
  and "Open with"; neither changes the web app.
