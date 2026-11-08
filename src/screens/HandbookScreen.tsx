// '#/more/handbook' — the handbook (docs/specs/handbook.md, block Z §1 + §3): Meer → Hulp & over →
// 📖 Handleiding. A search field (16 px, filters on every letter) and a row of topic chips in the
// header; below, the topics in their fixed order with their intro and their rows. Without a search
// a row is folded (title + first sentence of "Wat het doet"); a tap unfolds it. With a search only
// the matching rows show, unfolded, grouped per topic. An unfolded row shows "Wat het doet" · "Waar
// je tikt" (numbered steps) · "Wat je dan ziet" · optionally "Goed om te weten" and an "Open" button
// for the row's route. A row that exists on one platform only carries an "Android"/"iPhone" chip.
//
// The texts come from data/handbook/*.json, loaded lazily (src/handbook.ts); this screen itself is a
// separate chunk too (src/app.tsx imports it on demand), so the main bundle does not grow. The only
// markup in the texts is **bold** around button and screen names.
import { signal } from '@preact/signals';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { boldParts, firstSentence, searchHandbook, type HandbookEntry, type HandbookSection } from '@/domain/handbook';
import { loadHandbook } from '@/handbook';
import { lang, t } from '@/i18n';
import { navigate } from '@/router';

/** The search text survives "Open" → Back (the screen remounts; the query stays). */
const query = signal('');

/** Text with `**bold**` names → plain text and <strong>. */
function Rich(props: { text: string }) {
  const parts = boldParts(props.text);
  return <>{parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p))}</>;
}

function PlatformChip(props: { platform: HandbookEntry['platform'] }) {
  if (props.platform === 'all') return null;
  return <span class="hb-platform">{t(props.platform === 'android' ? 'handbook.platform.android' : 'handbook.platform.ios')}</span>;
}

function Row(props: { entry: HandbookEntry; open: boolean }) {
  const e = props.entry;
  const l = lang.value;
  const know = e.know?.[l];
  return (
    <details class="hb-row" open={props.open}>
      <summary class="hb-sum">
        <span class="hb-sum-title">
          <Rich text={e.title[l]} />
          <PlatformChip platform={e.platform} />
        </span>
        <span class="hb-sum-what">
          <Rich text={firstSentence(e.what[l])} />
        </span>
      </summary>
      <div class="hb-body">
        <h3>{t('handbook.what')}</h3>
        <p>
          <Rich text={e.what[l]} />
        </p>
        <h3>{t('handbook.where')}</h3>
        <ol>
          {e.where[l].map((step, i) => (
            <li key={i}>
              <Rich text={step} />
            </li>
          ))}
        </ol>
        <h3>{t('handbook.see')}</h3>
        <p>
          <Rich text={e.see[l]} />
        </p>
        {know && (
          <>
            <h3>{t('handbook.know')}</h3>
            <p>
              <Rich text={know} />
            </p>
          </>
        )}
        {e.route && (
          <button type="button" class="btn btn-link" onClick={() => navigate(e.route!)}>
            {t('handbook.open')}
          </button>
        )}
      </div>
    </details>
  );
}

function scrollToSection(id: string) {
  document.getElementById(`hb-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function HandbookScreen() {
  const [sections, setSections] = useState<HandbookSection[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadHandbook().then(
      (s) => alive && setSections(s),
      (e: unknown) => {
        console.error('handbook', e);
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const q = query.value;
  const l = lang.value;
  const searching = q.trim() !== '';
  const shown = useMemo(() => (sections ? searchHandbook(sections, q, l) : []), [sections, q, l]);

  return (
    <>
      <Header title={t('handbook.title')} back backLabel={t('common.back')}>
        <div class="hb-search">
          <input
            class="input"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autocomplete="off"
            placeholder={t('handbook.search')}
            aria-label={t('handbook.search')}
            value={q}
            onInput={(ev) => (query.value = (ev.currentTarget as HTMLInputElement).value)}
          />
          {q !== '' && (
            <button type="button" class="hb-clear" aria-label={t('inbox.clear')} onClick={() => (query.value = '')}>
              ×
            </button>
          )}
        </div>
        {shown.length > 0 && (
          <div class="chips hb-chips">
            {shown.map((s) => (
              <button key={s.id} type="button" class="chip" onClick={() => scrollToSection(s.id)}>
                {s.title[l]}
              </button>
            ))}
          </div>
        )}
      </Header>
      <div class="screen handbook">
        <p class="muted hb-intro">{t('handbook.intro')}</p>
        {failed && <p class="muted">{t('common.error')}</p>}
        {!failed && !sections && <p class="muted">{t('common.loading')}</p>}
        {sections && searching && shown.length === 0 && <p class="hb-none">{t('handbook.none', { q: q.trim() })}</p>}
        {/* Keyed on the mode so rows fold again when the search is cleared and unfold when one starts. */}
        <div key={searching ? 'search' : 'all'}>
          {shown.map((s) => (
            <section key={s.id} id={`hb-${s.id}`} class="hb-section">
              <h2>{s.title[l]}</h2>
              {!searching && s.intro[l] && (
                <p class="hb-section-intro">
                  <Rich text={s.intro[l]} />
                </p>
              )}
              {s.entries.map((e) => (
                <Row key={e.id} entry={e} open={searching} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
