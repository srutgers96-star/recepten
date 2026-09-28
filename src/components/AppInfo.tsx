// Build-time constants injected by vite.config.ts `define`. Declared here (module-scoped ambient)
// so no other file needs a global declaration.
declare const __APP_CHANNEL__: string;
declare const __APP_VERSION__: string;
declare const __GIT_SHA__: string;

function safe(read: () => string, fallback: string): string {
  try {
    return read();
  } catch {
    return fallback;
  }
}

export const appInfo = {
  channel: safe(() => __APP_CHANNEL__, 'dev'),
  version: safe(() => __APP_VERSION__, '0.0.0'),
  sha: safe(() => __GIT_SHA__, 'local'),
  base: import.meta.env.BASE_URL,
  /** Absolute app URL for share links, e.g. https://x.github.io/recepten/ */
  get appUrl(): string {
    return location.origin + import.meta.env.BASE_URL;
  },
};

export const isNextChannel = appInfo.channel === 'next';

export function ChannelBadge() {
  if (!isNextChannel) return null;
  return <span class="badge badge-next">NEXT</span>;
}

export function isIOS(): boolean {
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
