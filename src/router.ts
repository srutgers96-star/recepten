// Hash router (~60 lines). Routes are '#/…'; share tokens ('#r=…', '#p=…', '#w=…', '#b=…') are
// NEVER routes: when one shows up in the hash (at boot or later) it is moved into `pendingImport`
// and the hash is replaced by '#/import' so a reload never re-imports and the token never sticks
// in the URL bar.
//
// History policy (test 6 in PLAN.md §3b — the Android back gesture must only leave the app from
// Home): detail screens push, tab switches replace (except the first hop away from Home, which
// pushes once so "back" always lands on Home).
import { signal } from '@preact/signals';

export interface Route {
  /** Path without the leading '#', e.g. '/recipe/12'. Always starts with '/'. */
  path: string;
  segments: string[];
  query: URLSearchParams;
}

interface NavState {
  idx: number;
}

const TOKEN_RE = /^#([rpwb])=([A-Za-z0-9_-]+)/;

export function parseHash(hash: string): Route {
  let h = hash.replace(/^#/, '');
  if (!h.startsWith('/')) h = '/';
  const qi = h.indexOf('?');
  const path = qi >= 0 ? h.slice(0, qi) : h;
  const query = new URLSearchParams(qi >= 0 ? h.slice(qi + 1) : '');
  return { path: path || '/', segments: path.split('/').filter(Boolean), query };
}

export const route = signal<Route>(parseHash('#/'));

/**
 * Text (the full URL that carried a share token) waiting for the Import screen to pick up.
 * The Import screen reads and clears it.
 */
export const pendingImport = signal<string | null>(null);

function stateIdx(): number {
  const s = history.state as NavState | null;
  return s && typeof s.idx === 'number' ? s.idx : 0;
}

function handleHash() {
  if (TOKEN_RE.test(location.hash)) {
    pendingImport.value = location.href;
    history.replaceState({ idx: stateIdx() } satisfies NavState, '', location.pathname + location.search + '#/import');
  }
  route.value = parseHash(location.hash);
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const url = location.pathname + location.search + '#' + path;
  if (opts.replace) {
    history.replaceState({ idx: stateIdx() } satisfies NavState, '', url);
  } else {
    history.pushState({ idx: stateIdx() + 1 } satisfies NavState, '', url);
  }
  handleHash();
}

/** Bottom-nav tab switch: replace, except the first hop away from Home (push once). */
export function navigateTab(path: string) {
  const current = route.value.path;
  if (current === path) return;
  if (current === '/' && path !== '/') navigate(path);
  else navigate(path, { replace: true });
}

/** On-screen back button (iOS standalone has no back gesture). */
export function goBack() {
  if (stateIdx() > 0) history.back();
  else navigate('/', { replace: true });
}

let started = false;
export function startRouter() {
  if (started) return;
  started = true;
  window.addEventListener('hashchange', handleHash);
  window.addEventListener('popstate', handleHash);
  handleHash();
}
