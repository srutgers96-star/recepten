// Bottom nav: Home · Recepten · Toevoegen · Inbox (badge = received & unseen) · Meer.
import { t } from '@/i18n';
import { inboxUnseen } from '@/inbox-badge';
import { navigateTab, route } from '@/router';

const ICONS = {
  home: <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  recipes: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5zM4 20.5A2.5 2.5 0 0 1 6.5 18H20" />,
  add: <path d="M12 5v14M5 12h14" />,
  inbox: <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M8 11l4 4 4-4" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3.5" />,
};

const TABS: Array<{ path: string; icon: keyof typeof ICONS; key: string }> = [
  { path: '/', icon: 'home', key: 'nav.home' },
  { path: '/recipes', icon: 'recipes', key: 'nav.recipes' },
  { path: '/add', icon: 'add', key: 'nav.add' },
  { path: '/inbox', icon: 'inbox', key: 'nav.inbox' },
  { path: '/more', icon: 'more', key: 'nav.more' },
];

/** Which tab a route belongs to (pushed detail screens light up their parent tab). */
export function tabFor(segment: string | undefined): string {
  switch (segment) {
    case undefined:
    case '':
      return '/';
    case 'recipes':
    case 'recipe':
    case 'cook':
    case 'share':
      return '/recipes';
    case 'add':
    case 'edit':
      return '/add';
    case 'inbox':
    case 'import':
      return '/inbox';
    default:
      return '/more';
  }
}

export function Nav() {
  const active = tabFor(route.value.segments[0]);
  const unseen = inboxUnseen.value;
  return (
    <nav class="nav" aria-label={t('nav.main')}>
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
          {tab.path === '/inbox' && unseen > 0 && (
            <span class="nav-badge" aria-label={String(unseen)}>
              {unseen > 99 ? '99+' : unseen}
            </span>
          )}
        </a>
      ))}
    </nav>
  );
}
