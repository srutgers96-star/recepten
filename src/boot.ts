// Boot rule (invariant, see CLAUDE.md):
//   a share link (#r=…/#p=…/#w=…/#b=…, or a member card #f=…) opened on iOS OUTSIDE the installed
//   home-screen app gets the tiny, storage-free landing viewer (Safari's storage is invisible to the
//   installed app, so saving there would be a lie). Everything else gets the full app, with the
//   import preview opened when a token is present (Android Chrome tab shares storage with the WebAPK).
const hasToken = /^#(r|p|w|b|f)=/.test(location.hash);
const standalone =
  matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
const isIOS =
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

if (hasToken && isIOS && !standalone) {
  import('./landing');
} else {
  import('./main').then((m) => m.start({ openImportFromHash: hasToken }));
}
