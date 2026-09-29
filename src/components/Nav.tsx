// Bottom nav (phase 4, docs/phase-4-spec.md §3): Home · Recepten · Week · Boodschappen · Meer.
// "Toevoegen" lives in the Recepten header (+) and the Inbox under Meer; the received-&-unseen
// badge therefore sits on the Meer tab.
import { t } from '@/i18n';
import { inboxUnseen } from '@/inbox-badge';
import { navigateTab, route } from '@/router';

const ICONS = {
  home: <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  recipes: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5zM4 20.5A2.5 2.5 0 0 1 6.5 18H20" />,
  week: <path d="M4 5h16v15H4zM4 10h16M8 3v4M16 3v4M8 14h2M14 14h2" />,
  shopping: <path d="M3 4h2l2.5 11h11L21 7H6.5M9 19.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1M17 19.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3.5" />,
};

const TABS: Array<{ path: string; icon: keyof typeof ICONS; key: string }> = [
  { path: '/', icon: 'home', key: 'nav.home' },
  { path: '/recipes', icon: 'recipes', key: 'nav.recipes' },
  { path: '/week', icon: 'week', key: 'nav.week' },
  { path: '/shopping', icon: 'shopping', key: 'nav.shopping' },
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
    case 'add':
    case 'edit':
      return '/recipes';
    case 'week':
      return '/week';
    case 'shopping':
      return '/shopping';
    default:
      // more, inbox/import, story, check, profiles, storage …
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
          {tab.path === '/more' && unseen > 0 && (
            <span class="nav-badge" aria-label={String(unseen)}>
              {unseen > 99 ? '99+' : unseen}
            </span>
          )}
        </a>
      ))}
    </nav>
  );
}
