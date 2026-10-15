// Phase 6 (docs/phase-6-spec.md 13B): the browser facts behind the "Je gebruikt de app in de
// browser" notice and its "Open in Chrome" button. These tests pin (1) which user agents count as
// Chrome and which get the button (Stijn's Opera, Samsung Internet, Firefox, Edge, a WebView), and
// (2) the shape of the intent URL: our share token lives in the URL fragment and MUST sit before
// "#Intent;" (Android takes the text after the LAST '#' as the intent spec), the scheme follows the
// URL, and the fallback URL is percent-encoded so its own ';' and '#' cannot break the intent.
import { describe, expect, it } from 'vitest';
import { browserName, chromeIntentUrl, isAndroid } from '../src/pwa';

const UA = {
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  operaAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 OPR/84.0.0.0',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0',
  edgeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 EdgA/129.0.0.0',
  webview: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240905.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36',
  safariIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.0.0 Mobile/15E148 Safari/604.1',
  firefoxIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/130.0 Mobile/15E148 Safari/605.1.15',
  chromeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  edgeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
  vivaldi: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 Vivaldi/6.9',
  curl: 'curl/8.4.0',
};

describe('isAndroid', () => {
  it('is true for Android browsers and the WebView, false elsewhere', () => {
    expect(isAndroid(UA.chromeAndroid)).toBe(true);
    expect(isAndroid(UA.operaAndroid)).toBe(true);
    expect(isAndroid(UA.firefoxAndroid)).toBe(true);
    expect(isAndroid(UA.webview)).toBe(true);
    expect(isAndroid(UA.safariIos)).toBe(false);
    expect(isAndroid(UA.chromeWindows)).toBe(false);
  });
});

describe('browserName', () => {
  it('recognises Chrome on Android, Windows and iOS', () => {
    expect(browserName(UA.chromeAndroid)).toBe('chrome');
    expect(browserName(UA.chromeWindows)).toBe('chrome');
    expect(browserName(UA.chromeIos)).toBe('chrome');
  });

  it("recognises Stijn's Opera (OPR after Chrome) and the other Android browsers", () => {
    expect(browserName(UA.operaAndroid)).toBe('opera');
    expect(browserName(UA.samsung)).toBe('samsung');
    expect(browserName(UA.firefoxAndroid)).toBe('firefox');
    expect(browserName(UA.edgeAndroid)).toBe('edge');
    expect(browserName(UA.edgeWindows)).toBe('edge');
    expect(browserName(UA.firefoxIos)).toBe('firefox');
  });

  it('recognises Safari only when no other engine name is present', () => {
    expect(browserName(UA.safariIos)).toBe('safari');
    expect(browserName(UA.safariMac)).toBe('safari');
  });

  it('counts an Android WebView (own storage), a Chromium fork and unknown agents as other', () => {
    expect(browserName(UA.webview)).toBe('other');
    expect(browserName(UA.vivaldi)).toBe('other');
    expect(browserName(UA.curl)).toBe('other');
  });

  it('gives the "Open in Chrome" button to every Android browser except Chrome itself', () => {
    const needsChrome = (ua: string) => isAndroid(ua) && browserName(ua) !== 'chrome';
    expect(needsChrome(UA.chromeAndroid)).toBe(false);
    expect(needsChrome(UA.operaAndroid)).toBe(true);
    expect(needsChrome(UA.samsung)).toBe(true);
    expect(needsChrome(UA.firefoxAndroid)).toBe(true);
    expect(needsChrome(UA.edgeAndroid)).toBe(true);
    expect(needsChrome(UA.webview)).toBe(true);
    // Never on an iPhone (a link there always opens Safari; CLAUDE.md invariant 5) or a desktop.
    expect(needsChrome(UA.safariIos)).toBe(false);
    expect(needsChrome(UA.firefoxIos)).toBe(false);
    expect(needsChrome(UA.edgeWindows)).toBe(false);
  });
});

describe('chromeIntentUrl', () => {
  const url = 'https://srutgers96-star.github.io/recepten/#r=abcDEF_-123';

  it('keeps the share token (URL fragment) BEFORE #Intent; and uses the https scheme', () => {
    const intent = chromeIntentUrl(url);
    expect(intent.startsWith('intent://srutgers96-star.github.io/recepten/#r=abcDEF_-123#Intent;')).toBe(true);
    expect(intent).toContain(';scheme=https;');
    expect(intent).toContain(';package=com.android.chrome;');
    expect(intent.endsWith(';end')).toBe(true);
    // The intent spec is whatever follows the LAST '#': exactly one "Intent;" block.
    expect(intent.slice(intent.lastIndexOf('#'))).toBe(`#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`);
  });

  it('percent-encodes the fallback URL so its own # and ; cannot break the intent', () => {
    const intent = chromeIntentUrl(url);
    const fallback = /S\.browser_fallback_url=([^;]+);end$/.exec(intent)?.[1];
    expect(fallback).toBeDefined();
    expect(fallback).not.toContain('#');
    expect(decodeURIComponent(fallback!)).toBe(url);
  });

  it('carries host with port, path, query and the http scheme of the dev server', () => {
    const dev = 'http://192.168.1.23:5173/#/inbox?x=1';
    const intent = chromeIntentUrl(dev);
    expect(intent.startsWith('intent://192.168.1.23:5173/#/inbox?x=1#Intent;scheme=http;')).toBe(true);
  });

  it('works for a plain app URL without a fragment', () => {
    const intent = chromeIntentUrl('https://srutgers96-star.github.io/recepten/next/');
    expect(intent.startsWith('intent://srutgers96-star.github.io/recepten/next/#Intent;scheme=https;')).toBe(true);
  });

  it('keeps every token kind (#p=, #w=, #b=, #f=) on the /next/ channel too', () => {
    for (const key of ['p', 'w', 'b', 'f']) {
      const url = `https://srutgers96-star.github.io/recepten/next/#${key}=eJxLTEoGAAJNASc`;
      const intent = chromeIntentUrl(url);
      expect(intent.startsWith(`intent://srutgers96-star.github.io/recepten/next/#${key}=eJxLTEoGAAJNASc#Intent;`)).toBe(true);
      // Still exactly one intent spec: the token's '#' sits before it, the fallback's is encoded.
      expect(intent.split('#Intent;')).toHaveLength(2);
    }
  });
});
