// Backup photo codec (docs/phase-5-spec.md Block D item 1). Photos travel in backup files as
// base64 entries ({recipeId, memberId, at, type, data}); these tests PIN that codec: byte-exact
// roundtrips (the 0x8000 chunk boundary of bytesToBase64 included), the blob MIME type kept,
// a missing/odd type falling back to image/jpeg, and malformed entries decoding to null so a
// restore never writes garbage rows. Pure functions only — no database is opened here.
import { describe, expect, it } from 'vitest';
import type { Photo } from '../src/db/model';
import { base64ToBytes, bytesToBase64, decodeBundledPhoto, encodeBundledPhoto } from '../src/db/repo';

/** Deterministic pseudo-random bytes (xorshift), so a failure reproduces exactly. */
function fakeBytes(n: number, seed = 42): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(n);
  let x = seed || 1;
  for (let i = 0; i < n; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    out[i] = x & 0xff;
  }
  return out;
}

function photo(blob: Blob, over: Partial<Photo> = {}): Photo {
  return { id: 1, recipeId: 'u:abc', memberId: 'p:stijn', at: '2026-10-02T18:00:00.000Z', blob, ...over };
}

describe('bytesToBase64 / base64ToBytes', () => {
  it('roundtrips byte-exactly across the chunk boundary', () => {
    for (const n of [0, 1, 3, 255, 0x8000 - 1, 0x8000, 0x8000 + 1, 100_000]) {
      const bytes = fakeBytes(n, n + 7);
      const back = base64ToBytes(bytesToBase64(bytes));
      expect(back, `size ${n}`).not.toBeNull();
      expect(Array.from(back as Uint8Array), `size ${n}`).toEqual(Array.from(bytes));
    }
  });

  it('encodes every byte value 0..255', () => {
    const bytes = new Uint8Array(256).map((_, i) => i);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)) as Uint8Array)).toEqual(Array.from(bytes));
  });

  it('returns null for a string that is not base64', () => {
    expect(base64ToBytes('not base64 !!')).toBeNull();
  });
});

describe('encodeBundledPhoto / decodeBundledPhoto', () => {
  it('roundtrips a photo: bytes, type and identity fields', async () => {
    const bytes = fakeBytes(1234);
    const entry = await encodeBundledPhoto(photo(new Blob([bytes], { type: 'image/webp' })));
    expect(entry.recipeId).toBe('u:abc');
    expect(entry.memberId).toBe('p:stijn');
    expect(entry.at).toBe('2026-10-02T18:00:00.000Z');
    expect(entry.type).toBe('image/webp');
    const row = decodeBundledPhoto(entry);
    expect(row).not.toBeNull();
    expect(row!.recipeId).toBe('u:abc');
    expect(row!.memberId).toBe('p:stijn');
    expect(row!.at).toBe('2026-10-02T18:00:00.000Z');
    expect(row!.blob.type).toBe('image/webp');
    expect(Array.from(new Uint8Array(await row!.blob.arrayBuffer()))).toEqual(Array.from(bytes));
  });

  it('keeps image/jpeg and falls back to it for a typeless blob', async () => {
    const jpeg = await encodeBundledPhoto(photo(new Blob([fakeBytes(10)], { type: 'image/jpeg' })));
    expect(jpeg.type).toBe('image/jpeg');
    const untyped = await encodeBundledPhoto(photo(new Blob([fakeBytes(10)])));
    expect(untyped.type).toBe('image/jpeg');
  });

  it('decode falls back to image/jpeg for a non-image or missing type', () => {
    const base = { recipeId: 'u:x', memberId: 'p:y', at: '2026-01-01T00:00:00.000Z', data: bytesToBase64(fakeBytes(4)) };
    expect(decodeBundledPhoto({ ...base, type: 'text/html' })!.blob.type).toBe('image/jpeg');
    expect(decodeBundledPhoto({ ...base })!.blob.type).toBe('image/jpeg');
  });

  it('returns null for malformed entries (a restore must never write garbage)', () => {
    const ok = { recipeId: 'u:x', memberId: 'p:y', at: '2026-01-01T00:00:00.000Z', type: 'image/webp', data: bytesToBase64(fakeBytes(4)) };
    expect(decodeBundledPhoto(ok)).not.toBeNull();
    expect(decodeBundledPhoto(null)).toBeNull();
    expect(decodeBundledPhoto('x')).toBeNull();
    expect(decodeBundledPhoto({ ...ok, recipeId: '' })).toBeNull();
    expect(decodeBundledPhoto({ ...ok, recipeId: undefined })).toBeNull();
    expect(decodeBundledPhoto({ ...ok, memberId: 7 })).toBeNull();
    expect(decodeBundledPhoto({ ...ok, at: '' })).toBeNull();
    expect(decodeBundledPhoto({ ...ok, data: '' })).toBeNull();
    expect(decodeBundledPhoto({ ...ok, data: 'not base64 !!' })).toBeNull();
  });
});
