// The honest QR limit (docs/specs/qr-link.md §1b, block 13Q). A share URL longer than this is
// unreliable to scan with a phone camera (above QR version ~27 at error level L, rendered 320 px wide), so "Toon QR" shows the
// line "Te groot voor een QR-code. Deel de link." instead of a code. Framework-free and pure: the
// limit is a number, not a feeling (§4 rule 4).

/** The longest share URL (in characters) that still gets a QR code. */
export const QR_MAX_URL_CHARS = 1600; // Fable 8 Nov: 1200 → 1600 with ECC L and a 320 px render; most cards, lists and plans fit, about half of the recipes

/** True when `url` is short enough for a reliably scannable QR code. */
export function qrFits(url: string): boolean {
  return typeof url === 'string' && url.length <= QR_MAX_URL_CHARS;
}
