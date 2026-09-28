# ADR-0001 — Runtime: one PWA for both phones, decided by a measurable phase-0 checklist

**Status:** **Accepted (route ii)** — Android results filled in on 2026-09-28; iPhone row still pending.
**Date:** 2026-09-24 (plan), 2026-09-28 (Android results, decision).

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
| 1 | Icon in the app drawer and in Settings → Apps (WebAPK) | yes | PASS | |
| 2 | No address bar; status bar in theme colour; safe-area correct | yes | PASS | |
| 3 | Cold start offline (flight mode, after restarting the phone) | < 2 s to the list | PASS | |
| 4 | List of 196 scrolls smoothly; sticky headers; overscroll does not feel like browser pull-to-refresh | yes | PASS | |
| 5 | Keyboard in the form never covers an input; no zoom on focus (16 px inputs) | yes | PASS (inputs) — but the keyboard covered the **Save button**; fixed in phase 1 (save action in the header + `interactive-widget=resizes-content`) | |
| 6 | Back gesture leaves the app only from Home, never mid-recipe | yes | PASS | |
| 7 | Text selection / long-press does nothing browser-like on buttons and list rows | yes | PASS | |
| 8 | 2 KB `#r=` link in WhatsApp is tappable; opens in the app (`adb shell pm get-app-links` = verified) or in a Chrome tab with a working "Save" | note which | PASS (shared with himself; link tappable) | |
| 9 | "Share → Recepten" in the WhatsApp share sheet for a message **and** for a `.json` document (POST target) | both | PASS | |
| 10 | `navigator.share({text})` to WhatsApp; `readText` + paste; textarea paste | yes | PASS | |
| 11 | 30 s timer: (a) app in the foreground, (b) screen locked, (c) app in the background — what fires (notification / sound / vibration)? | note; only (a) is required | PASS — (a) sound; (c) **sound, 3 beeps, even with the phone on silent**; (b) not recorded; notification permission not granted (untested) | |
| 12 | `persisted()` = true after installation | yes | PASS | |
| 13 | **Phase 1, 10-minute timer in the background** (DEVICE-TEST.md row 13): the per-minute "N min left" notification and the done beep/notification come from the page's own interval, not from the service worker. Chrome on Android may freeze a hidden WebAPK after ~5 minutes (intensive throttling), in which case the silent updates stop and the beep/notification arrive on resume. Does the countdown keep going and does the timer fire on time after 10 min? | note | **open** (30 s proven on 2026-09-28; 10 min not yet tested) | Until proven, the UI only promises updates "while the app is open" (`timer.askBody`). |
| **iPhone** | Home Screen install (standalone), `persisted()`, `share({text})` to WhatsApp, `readText` Paste callout, textarea paste, offline start after restart, 2 KB link tappable (opens the Safari landing), **timer (a)/(b)/(c)** | note | — | pending (she was not available on 2026-09-28) |

**Go** = 1-7, 9, 10 and 12 pass; 8 at least the Chrome-tab fallback; 11 at least (a).
**No-go** = Stijn says "no" to 2, 4, 5 or 6 → route (iii): the UI becomes Kotlin/Compose, the web app
shrinks to landing page + installable read-only PWA for her, and everything from phases 1-2 (schema,
parser, dictionary, token, migration tools, Node tests) stays usable unchanged.

### Results and D2 decision

| Field | Value |
|---|---|
| Android device / Chrome version | Android 10, Chrome 153, viewport 448×907 @3x, dark mode, device language en-NL |
| iPhone / iOS version | pending |
| Date tested | 2026-09-28 (Android) |
| Timer behaviour Android (a)/(b)/(c) | (a) sound; (b) not recorded; (c) sound (3 beeps) with the app in the background, phone on silent |
| Timer behaviour iPhone (a)/(b)/(c) | pending |
| Link opens in (Android): WebAPK / Chrome tab | tappable and working; which of the two was not noted (both are acceptable) |
| **Decision (go / no-go)** | **GO — route (ii) accepted by Stijn on 2026-09-28.** Wishes recorded: save button must not sit under the keyboard; show the remaining minutes of a running timer outside the app (Android notification). |

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
