import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// One codebase, two channels on the same GitHub Pages site:
//   main  -> /recepten/        (the app both phones use)
//   next  -> /recepten/next/   (test channel, own database name, own manifest id + icon)
// The base path is passed with `vite build --base=...`; everything below derives from it.
const isNext = process.env.NEXT_CHANNEL === '1';

/** `vite build --base=/x/` or `--base /x/` on the CLI (the CLI flag overrides `base` in this config,
 *  so the manifest must be derived from the same value or start_url/scope/share_target drift). */
function cliBase(): string | undefined {
  const argv = process.argv;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') return argv[i + 1];
    if (a?.startsWith('--base=')) return a.slice('--base='.length);
  }
  return undefined;
}

export default defineConfig(({ command, isPreview }) => {
  // dev server: '/', build and `vite preview` (serves dist): '/recepten/'
  let base = process.env.BASE_PATH ?? cliBase() ?? (command === 'serve' && !isPreview ? '/' : '/recepten/');
  if (!base.startsWith('/')) base = '/' + base;
  if (!base.endsWith('/')) base += '/';
  const name = isNext ? "Rutgers' Recepten NEXT" : "Rutgers' Recepten";
  const shortName = isNext ? 'Recepten NEXT' : 'Recepten';
  // The next channel has its own icon set so both apps can sit side by side on the home screen.
  const icon = (file: string) => (isNext ? file.replace(/\.png$/, '-next.png') : file);

  return {
    base,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@data': fileURLToPath(new URL('./data', import.meta.url)),
      },
    },
    define: {
      __APP_CHANNEL__: JSON.stringify(isNext ? 'next' : 'main'),
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
      __GIT_SHA__: JSON.stringify((process.env.GITHUB_SHA ?? 'local').slice(0, 7)),
    },
    build: {
      target: 'es2022',
      sourcemap: false,
    },
    plugins: [
      preact(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        injectRegister: null, // registration is done explicitly in src/pwa.ts (update prompt)
        // No `includeAssets`: everything in public/ is copied to dist and picked up by
        // injectManifest.globPatterns below (includeAssets would re-add the 512px icons that
        // globIgnores keeps out of the precache, and duplicate the rest). Same for the manifest
        // icons: the plugin would otherwise append all of them to the precache list.
        includeManifestIcons: false,
        manifest: {
          id: base,
          name,
          short_name: shortName,
          description: 'Het familiekookboek van Rutgers — 196 klassiekers, tweetalig, met weekplanner en boodschappenlijst.',
          lang: 'nl',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#eaf3fb',
          theme_color: '#eaf3fb',
          icons: [
            { src: icon('icons/icon-192.png'), sizes: '192x192', type: 'image/png' },
            { src: icon('icons/icon-512.png'), sizes: '512x512', type: 'image/png' },
            { src: icon('icons/icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          // Exactly ONE share_target per manifest. Text/URL and files share a single POST multipart
          // target (a GET target cannot receive files). The service worker intercepts the POST;
          // public/share/index.html catches any call the SW does not see.
          share_target: {
            action: `${base}share/`,
            method: 'POST',
            enctype: 'multipart/form-data',
            params: {
              title: 'title',
              text: 'text',
              url: 'url',
              files: [
                {
                  name: 'files',
                  accept: ['application/json', '.json', 'text/plain', '.txt', 'application/octet-stream'],
                },
              ],
            },
          },
        } as any,
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,json,png,webp,svg,woff2}'],
          // the 512px icons are only fetched at install time; keep them out of the offline precache
          globIgnores: ['**/icons/icon-512*.png', '**/icons/icon-maskable-512*.png', '**/icons/*-next.png'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
        devOptions: { enabled: false },
      }),
    ],
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  };
});
