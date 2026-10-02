# Architecture decision records

Short records, Nygard style: **Context** (what forced the decision), **Decision** (what we chose),
**Consequences** (what we gain and pay). One file per decision, numbered, never edited into something
else: a reversed decision gets a new ADR that supersedes the old one.

| # | Title | Status |
|---|---|---|
| [0001](0001-runtime.md) | Runtime: one PWA for both phones, with the phase-0 go/no-go checklist | Proposed (awaiting phase-0 results) |
| [0002](0002-hosting.md) | Hosting: GitHub Pages from a public repo, one artifact for `main` + `next` | Accepted |
| [0003](0003-dexie.md) | Storage: IndexedDB via Dexie, database name from `BASE_URL`, backups mandatory | Accepted |
| [0004](0004-share-token.md) | Share token: `#r=` deflate-raw + base64url, ≤ ~3.5 KB per message, files above that | Accepted |
| [0005](0005-no-backend.md) | No backend, no accounts, no analytics | Accepted |
| [0006](0006-ios-receive-is-pull-based.md) | iOS receiving is pull-based: flows A, B and C | Accepted |
| [0007](0007-qr-encode.md) | QR on the share screen: the `qrcode` encoder, lazy loaded, encode-only (behind the Experimenten flag) | Accepted |
| 0008 | Paid native iOS path (TestFlight + Share Extension) — not planned, documented in PLAN.md §3b | Not started |

Adding one: copy the shape of 0005 (the shortest), give it the next number, add a row here, and if it
adds an npm dependency say so in the ADR (CLAUDE.md invariant 15). Platform facts with their
VERIFIED / LIKELY / UNKNOWN status live in `PLAN.md` §3; ADRs reference them rather than repeat them.
