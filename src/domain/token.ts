// Share-token codec (PLAN.md §7): the one contract between the two phones.
//
//   token = base64url( deflate-raw( UTF-8 JSON envelope ) )    // only [A-Za-z0-9_-], no padding
//
// Framework-free: no preact, no dexie. Used by the full app, the tiny Safari landing bundle,
// the Node tools and the tests. Compression uses the native CompressionStream('deflate-raw')
// when available (iOS 16.4+, Chrome 103+, Node 22) and lazily loads fflate otherwise; both
// produce a raw deflate stream (no zlib/gzip wrapper) that the other side can inflate, and both
// are byte-compatible with Kotlin's Deflater(nowrap = true) should a native shell ever exist.

export type TokenKey = 'r' | 'p' | 'w' | 'b';

/** The JSON envelope inside every token. Unknown keys are preserved on decode (PLAN §7). */
export interface Envelope {
  v: 2;
  t: TokenKey;
  by?: string;
  at?: string;
  msg?: string;
  [k: string]: unknown;
}

/** 'auto' picks the native stream when available; 'native' / 'fflate' force one (tests, tools). */
export type CodecEngine = 'auto' | 'native' | 'fflate';

export interface CodecOptions {
  engine?: CodecEngine;
}

export const TOKEN_VERSION = 2 as const;
export const TOKEN_KEYS: readonly TokenKey[] = ['r', 'p', 'w', 'b'];
/** Shortest string extractTokens accepts as a token; a real envelope never deflates below this. */
export const MIN_TOKEN_LENGTH = 20;

const TOKEN_CHARS = /^[A-Za-z0-9_-]+$/;
// Every "#<key>=<token>" (or bare "<key>=<token>") in any pasted text: a WhatsApp bubble, a URL,
// a token someone stripped from its link. The key must not be glued to a preceding token/word
// character, so "user=…" or "foor=…" never match. A prefix group is used instead of a lookbehind
// so that an old engine fails the match, not the module parse.
const TOKEN_RE = /(?:^|[^A-Za-z0-9_-])#?([rpwb])=([A-Za-z0-9_-]{20,})/g;

export function isTokenKey(k: unknown): k is TokenKey {
  return typeof k === 'string' && (TOKEN_KEYS as readonly string[]).includes(k);
}

let nativeAvailable: boolean | undefined;

/** True when CompressionStream/DecompressionStream support 'deflate-raw' (cached). */
export function isCompressionStreamAvailable(): boolean {
  if (nativeAvailable === undefined) {
    try {
      if (typeof CompressionStream !== 'function' || typeof DecompressionStream !== 'function') {
        nativeAvailable = false;
      } else {
        // Old Chrome (80-102) has the classes but throws on 'deflate-raw'.
        new CompressionStream('deflate-raw');
        new DecompressionStream('deflate-raw');
        nativeAvailable = true;
      }
    } catch {
      nativeAvailable = false;
    }
  }
  return nativeAvailable;
}

function useNative(engine: CodecEngine = 'auto'): boolean {
  if (engine === 'fflate') return false;
  if (engine === 'native') {
    if (!isCompressionStreamAvailable()) throw new Error('native-codec-unavailable');
    return true;
  }
  return isCompressionStreamAvailable();
}

async function pipeThroughStream(
  bytes: Uint8Array<ArrayBuffer>,
  transform: CompressionStream | DecompressionStream,
): Promise<Uint8Array<ArrayBuffer>> {
  // Source stream + Response.arrayBuffer(): reads and writes run concurrently, so there is no
  // backpressure deadlock for large inputs (unlike awaiting writer.write() before reading).
  const source = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const buffer = await new Response(source.pipeThrough(transform)).arrayBuffer();
  return new Uint8Array(buffer);
}

/** Raw deflate (no zlib header, no gzip wrapper). Also the byte stream a QR code would carry. */
export async function deflateRaw(
  bytes: Uint8Array<ArrayBuffer>,
  opts: CodecOptions = {},
): Promise<Uint8Array<ArrayBuffer>> {
  if (useNative(opts.engine)) return pipeThroughStream(bytes, new CompressionStream('deflate-raw'));
  const { deflateSync } = await import('fflate'); // lazy: stays out of the landing bundle
  return deflateSync(bytes); // fflate's deflateSync IS raw deflate
}

export async function inflateRaw(
  bytes: Uint8Array<ArrayBuffer>,
  opts: CodecOptions = {},
): Promise<Uint8Array<ArrayBuffer>> {
  if (useNative(opts.engine)) return pipeThroughStream(bytes, new DecompressionStream('deflate-raw'));
  const { inflateSync } = await import('fflate');
  return inflateSync(bytes);
}

/** Standard base64url (RFC 4648 §5) without padding: only [A-Za-z0-9_-]. */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000; // keep String.fromCharCode's argument list within engine limits
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Inverse of toBase64Url. Throws on characters outside the alphabet or an impossible length. */
export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) throw new Error('invalid-base64url');
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** UTF-8 JSON -> deflate-raw -> base64url. */
export async function encodeToken(env: Envelope, opts: CodecOptions = {}): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(env));
  return toBase64Url(await deflateRaw(json, opts));
}

/**
 * base64url -> inflate-raw -> JSON envelope. Throws Error('invalid-token') for anything that is
 * not a well-formed v2 envelope and Error('unsupported-version') when `v` is a number other
 * than 2 (the UI then says "update the app first"). Unknown keys are preserved.
 */
export async function decodeToken(token: string, opts: CodecOptions = {}): Promise<Envelope> {
  if (typeof token !== 'string' || token.length === 0 || !TOKEN_CHARS.test(token)) {
    throw new Error('invalid-token');
  }
  let parsed: unknown;
  try {
    const bytes = await inflateRaw(fromBase64Url(token), opts);
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (cause) {
    throw new Error('invalid-token', { cause });
  }
  return parseEnvelope(parsed);
}

/**
 * Validates an already-parsed JSON value as a v2 envelope (same rules and errors as decodeToken):
 * for raw JSON pasted or shared as a file, so a v3 envelope says "update the app" there too.
 */
export function parseEnvelope(parsed: unknown): Envelope {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('invalid-token');
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.v !== 'number') throw new Error('invalid-token');
  if (obj.v !== TOKEN_VERSION) throw new Error('unsupported-version');
  if (!isTokenKey(obj.t)) throw new Error('invalid-token');
  return obj as Envelope;
}

/**
 * Every "#<key>=<token>" in any pasted text (a WhatsApp message with several links, a bare URL,
 * a bare "r=…"), in order of appearance. Identical key+token pairs (a quoted reply repeating the
 * link) are returned once. The importer still has to check that `decodeToken(token).t === key`.
 */
export function extractTokens(text: string): Array<{ key: TokenKey; token: string }> {
  const found: Array<{ key: TokenKey; token: string }> = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(TOKEN_RE)) {
    const key = match[1] as TokenKey;
    const token = match[2]!;
    const id = key + '=' + token;
    if (seen.has(id)) continue;
    seen.add(id);
    found.push({ key, token });
  }
  return found;
}

/** 'https://x.github.io/recepten/' + 'r' + token -> 'https://x.github.io/recepten/#r=<token>'. */
export function buildShareUrl(appUrl: string, key: TokenKey, token: string): string {
  return appUrl.replace(/#[\s\S]*$/, '') + '#' + key + '=' + token;
}
