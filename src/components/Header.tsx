import type { ComponentChildren } from 'preact';
import { lang, setLang, t, type Lang } from '@/i18n';
import { activeProfile, updateProfile } from '@/profile';
import { goBack } from '@/router';
import { ChannelBadge } from './AppInfo';

/** The NL|EN pill: switches the UI language and remembers it on the active profile. */
export function chooseLang(l: Lang) {
  setLang(l);
  const p = activeProfile.value;
  if (p && p.lang !== l) void updateProfile({ ...p, lang: l });
}

export function LangToggle() {
  const l = lang.value;
  return (
    <div class="lang-toggle" role="group" aria-label={t('header.lang')}>
      <button type="button" class={l === 'nl' ? 'on' : ''} onClick={() => chooseLang('nl')}>
        NL
      </button>
      <button type="button" class={l === 'en' ? 'on' : ''} onClick={() => chooseLang('en')}>
        EN
      </button>
    </div>
  );
}

export interface HeaderProps {
  title: string;
  /** Show the on-screen back button (iOS standalone has no back gesture). */
  back?: boolean;
  backLabel?: string;
  /** Right-side action slot, e.g. the editor's sticky "Bewaar" button. Rendered before the pill. */
  action?: ComponentChildren;
  /** Hide the NL|EN pill (tight headers such as the editor). */
  noLang?: boolean;
  /** Second header row (search field, tabs …). */
  children?: ComponentChildren;
}

export function Header(props: HeaderProps) {
  return (
    <header class="header">
      <div class="header-row">
        {props.back && (
          <button type="button" class="icon-btn" onClick={goBack} aria-label={props.backLabel ?? t('common.back')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            <span>{props.backLabel}</span>
          </button>
        )}
        <h1>{props.title}</h1>
        {props.action && <div class="header-action">{props.action}</div>}
        <ChannelBadge />
        {!props.noLang && <LangToggle />}
      </div>
      {props.children && <div class="header-sub">{props.children}</div>}
    </header>
  );
}
