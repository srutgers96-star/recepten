import { t } from '@/i18n';
import { navigateTab, route } from '@/router';

const ICONS = {
  recipes: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5zM4 20.5A2.5 2.5 0 0 1 6.5 18H20" />,
  add: <path d="M12 5v14M5 12h14" />,
  share: <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 15V3M8 7l4-4 4 4" />,
  import: <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M8 11l4 4 4-4" />,
  check: <path d="M20 6L9 17l-5-5" />,
};

const TABS: Array<{ path: string; icon: keyof typeof ICONS; key: 'nav.recipes' | 'nav.add' | 'nav.share' | 'nav.import' | 'nav.check' }> = [
  { path: '/', icon: 'recipes', key: 'nav.recipes' },
  { path: '/add', icon: 'add', key: 'nav.add' },
  { path: '/share', icon: 'share', key: 'nav.share' },
  { path: '/import', icon: 'import', key: 'nav.import' },
  { path: '/check', icon: 'check', key: 'nav.check' },
];

export function Nav() {
  const seg = route.value.segments[0] ?? '';
  const active = seg === 'recipe' ? '/' : '/' + seg;
  return (
    <nav class="nav" aria-label="Main">
      {TABS.map((tab) => (
        <a
          key={tab.path}
          href={'#' + tab.path}
          class={active === tab.path ? 'on' : ''}
          aria-current={active === tab.path ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            navigateTab(tab.path);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            {ICONS[tab.icon]}
          </svg>
          <span>{t(tab.key)}</span>
        </a>
      ))}
    </nav>
  );
}
