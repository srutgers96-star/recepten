import type { ComponentChildren } from 'preact';
import { lang, setLang } from '@/i18n';
import { goBack } from '@/router';
import { ChannelBadge } from './AppInfo';

export function LangToggle() {
  const l = lang.value;
  return (
    <div class="lang-toggle" role="group" aria-label="NL / EN">
      <button type="button" class={l === 'nl' ? 'on' : ''} onClick={() => setLang('nl')}>
        NL
      </button>
      <button type="button" class={l === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
        EN
      </button>
    </div>
  );
}

export function Header(props: { title: string; back?: boolean; backLabel?: string; children?: ComponentChildren }) {
  return (
    <header class="header">
      <div class="header-row">
        {props.back && (
          <button type="button" class="icon-btn" onClick={goBack} aria-label={props.backLabel ?? 'Back'}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            <span>{props.backLabel}</span>
          </button>
        )}
        <h1>{props.title}</h1>
        <ChannelBadge />
        <LangToggle />
      </div>
      {props.children && <div class="header-sub">{props.children}</div>}
    </header>
  );
}
