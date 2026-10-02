// Phase 5 block D.5 (ADR-0007): the 'qrcode' encoder also runs in Node, so the contract the
// QR component relies on is pinned here: ECC level 'L' is accepted, toDataURL/toString give
// non-empty output, and the same input + options always produce the same bytes (deterministic).
import { describe, expect, it } from 'vitest';
import { create, toDataURL, toString as qrToString } from 'qrcode';

// Shape of a real share link (ADR-0004): app URL + #r= + base64url token.
const LINK = 'https://srutgers96-star.github.io/recepten/#r=q1YqUbJSMjQyNjE1M7ewtFLSUUoGAFWqBashSJLrzs3RhIxEVFUhg';

describe('qrcode encoder (ADR-0007)', () => {
  it('toDataURL accepts errorCorrectionLevel L and returns a PNG data URL', async () => {
    const url = await toDataURL(LINK, { errorCorrectionLevel: 'L', margin: 2 });
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    expect(url.length).toBeGreaterThan(100);
  });

  it('is deterministic: same input and options, same output', async () => {
    const opts = { errorCorrectionLevel: 'L', margin: 2 } as const;
    const [a, b] = await Promise.all([toDataURL(LINK, opts), toDataURL(LINK, opts)]);
    expect(a).toBe(b);
    // And the SVG renderer agrees with itself too (cheap cross-check without canvas).
    const [sa, sb] = await Promise.all([qrToString(LINK, { ...opts, type: 'svg' }), qrToString(LINK, { ...opts, type: 'svg' })]);
    expect(sa).toBe(sb);
    expect(sa).toContain('<svg');
  });

  it('create() reports a sane symbol for a share link at ECC L', () => {
    const code = create(LINK, { errorCorrectionLevel: 'L' });
    expect(code.version).toBeGreaterThanOrEqual(1);
    expect(code.version).toBeLessThanOrEqual(40);
    expect(code.modules.size).toBe(code.version * 4 + 17);
  });

  it('a typical ~2 KB share link fits at ECC L; beyond byte-mode capacity it throws', async () => {
    // base64url-ish payload of 2000 chars: a big-but-common link still renders.
    const typical = 'https://srutgers96-star.github.io/recepten/#r=' + 'Ab1-_'.repeat(400);
    const code = create(typical, { errorCorrectionLevel: 'L' });
    expect(code.version).toBeLessThanOrEqual(40);
    const url = await toDataURL(typical, { errorCorrectionLevel: 'L', margin: 2 });
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    // QR byte mode caps at 2953 bytes at ECC L (version 40). The ADR-0004 message limit is
    // ~3.5 KB, so the very largest tokens do NOT fit: the encoder must throw (the component
    // then shows share.qrError instead of a broken image).
    const tooBig = 'https://srutgers96-star.github.io/recepten/#r=' + 'Ab1-_'.repeat(700);
    expect(() => create(tooBig, { errorCorrectionLevel: 'L' })).toThrowError(/too big/i);
    await expect(toDataURL(tooBig, { errorCorrectionLevel: 'L', margin: 2 })).rejects.toThrowError(/too big/i);
  });
});
