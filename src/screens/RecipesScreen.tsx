// '#/' — all recipes grouped by initial, sticky letter headers, A-Z rail, search.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { t } from '@/i18n';
import { navigate } from '@/router';
import { normalizeText, useAllRecipes, type Recipe } from '@/db/recipes';
import { initialOf } from '@/domain/recipe-source';

interface Group {
  letter: string;
  items: Recipe[];
}

// Scroll position and query survive a trip to a detail screen (feels like an app, not a page).
let savedScroll = 0;
let savedQuery = '';

function groupRecipes(list: Recipe[]): Group[] {
  const map = new Map<string, Recipe[]>();
  for (const r of list) {
    const k = initialOf(r.name);
    const arr = map.get(k);
    if (arr) arr.push(r);
    else map.set(k, [r]);
  }
  const letters = [...map.keys()].sort((a, b) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)));
  return letters.map((letter) => ({
    letter,
    items: (map.get(letter) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' })),
  }));
}

export function RecipesScreen() {
  const all = useAllRecipes();
  const [query, setQuery] = useState(savedQuery);
  const queryRef = useRef(query);
  queryRef.current = query;
  const scroller = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const [railLetter, setRailLetter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = normalizeText(query.trim());
    return q ? all.filter((r) => normalizeText(r.name).includes(q) || (r.nameEn && normalizeText(r.nameEn).includes(q))) : all;
  }, [all, query]);
  const groups = useMemo(() => groupRecipes(filtered), [filtered]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = savedScroll;
    return () => {
      savedScroll = el?.scrollTop ?? 0;
      savedQuery = queryRef.current;
    };
  }, []);

  function jumpTo(letter: string) {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-letter="${letter}"]`);
    if (el && scroller.current) scroller.current.scrollTop = el.offsetTop;
  }

  function pickFromPointer(clientY: number) {
    const el = rail.current;
    if (!el) return;
    let best: { letter: string; d: number } | null = null;
    for (const span of el.querySelectorAll<HTMLElement>('span[data-letter]')) {
      const r = span.getBoundingClientRect();
      const d = Math.abs(clientY - (r.top + r.height / 2));
      if (!best || d < best.d) best = { letter: span.dataset.letter ?? '', d };
    }
    if (best && best.letter !== railLetter) {
      setRailLetter(best.letter);
      jumpTo(best.letter);
    }
  }

  return (
    <>
      <Header title={t('app.title')}>
        <input
          class="input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autocomplete="off"
          placeholder={t('list.search')}
          value={query}
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
        />
      </Header>
      {/* The rail is positioned inside .list-area (list only), so it never overlays the header. */}
      <div class="list-area">
        <div class="screen has-rail" ref={scroller}>
          <div class="muted small" style="padding-top:8px">
            {filtered.length} {t('list.recipes')}
          </div>
          {groups.length === 0 && <div class="empty">{t('list.empty')}</div>}
          {groups.map((g) => (
            <section key={g.letter}>
              <div class="letter" data-letter={g.letter}>
                {g.letter}
              </div>
              <ul class="list">
                {g.items.map((r) => (
                  <li key={r.id}>
                    <a
                      class="row"
                      href={'#/recipe/' + r.id}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/recipe/' + r.id);
                      }}
                    >
                      <span class="name">{r.name}</span>
                      {r.own && <span class="badge">{t('list.own')}</span>}
                      <span class="chev" aria-hidden="true">
                        ›
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {groups.length > 1 && (
          <div
            class={'rail' + (railLetter ? ' active' : '')}
            ref={rail}
            aria-hidden="true"
            onPointerDown={(e) => {
              try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              } catch {
                /* synthetic or already-released pointer */
              }
              pickFromPointer(e.clientY);
            }}
            onPointerMove={(e) => {
              if (railLetter !== null) pickFromPointer(e.clientY);
            }}
            onPointerUp={() => setRailLetter(null)}
            onPointerCancel={() => setRailLetter(null)}
          >
            {groups.map((g) => (
              <span key={g.letter} data-letter={g.letter}>
                {g.letter}
              </span>
            ))}
          </div>
        )}
        {railLetter && <div class="rail-bubble">{railLetter}</div>}
      </div>
    </>
  );
}
