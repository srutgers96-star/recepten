# ADR-0007 — QR on the share screen: the `qrcode` encoder, lazy loaded, encode-only

**Status:** Accepted · **Date:** 2026-10-02

## Context

Flow D in ADR-0006 ("same room, experimental, behind a flag"): Stijn shows a QR of the share link,
the other phone scans it with its **camera app** and lands on the landing page (on iPhone that is
Safari → flow B, copy the code there). Phase 5 block D item 5 puts a "Toon QR" button on the share
screen behind the Experimenten flag, and leaves the choice open: the `qrcode` npm package (encode)
or a small self-written encoder in `src/domain/qr.ts`. A share link is a `#r=`/`#p=` token of up to
~3.5 KB (ADR-0004); a typical one lands at QR version 15-30 at ECC level L — far beyond the
hand-checkable sizes. QR byte mode caps at **2953 bytes** at version 40/L, so the very largest
tokens do not fit in any QR at all.

## Decision

- **Dependency `qrcode` 1.5.x** (plus dev-only `@types/qrcode`) — this ADR is the required line for
  CLAUDE.md invariant 15. **Encode-only**: the app renders a QR, it never scans one. Scanning stays
  the phone's own camera app (ADR-0006 flow D); no in-app scanner, no camera permission.
- **Not self-written.** A QR encoder stacks Reed-Solomon ECC, mask selection, format/version bits
  and byte-mode segmentation; one subtly wrong bit produces a symbol that simply does not scan, and
  nothing in CI can look at a PNG and tell. `qrcode` is the battle-tested reference implementation,
  pure JS, no transitive native code, and it also runs in Node so the output is testable in Vitest.
- **Lazy chunk**: loaded with `import('qrcode')` inside the QR component, so Vite splits it into its
  own chunk that is only fetched on the first tap on "Toon QR". The main bundle does not grow; with
  the Experimenten flag off the code is never even requested.
- `toDataURL` with `errorCorrectionLevel: 'L'` and `margin: 2`: the link is fetched live, so a
  misread fails visibly and you re-scan — the smallest symbol wins over redundancy for ~3.5 KB
  payloads. Colors stay plain `#000` on `#fff` regardless of theme: scanner contrast beats dark mode.

## Consequences

- Adds `qrcode` to dependencies and `@types/qrcode` to devDependencies; the frozen-stack list gains
  one entry, but only as a lazy chunk (~15 KB gzipped) behind an experimental flag.
- `tests/qr.test.ts` pins the contract we rely on: deterministic output, ECC level 'L' accepted,
  data-URL rendering works in Node, and a link beyond the 2953-byte byte-mode capacity **throws**
  — the component catches it and shows the "QR-code kon niet worden gemaakt" line instead of a
  broken image. Recipes that large already travel as a `.json` file (ADR-0004), not as a link.
- The UI stays honest (invariant 13): the hint under the QR says the camera app opens the preview
  page — it never claims the installed iPhone app opens (invariant 5).
- If flow D graduates (in-app scanning via `BarcodeDetector`), that is a **new ADR**; this one only
  covers encoding.
