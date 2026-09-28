// '#/recipes' — all recipes (classics + own + received) grouped by initial in the active language,
// sticky letter headers, A-Z rail and search. The rail/scroll logic is the one that passed the
// phone test in phase 0; the data now comes from the repository (schema 2).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { RecipeRow } from '@/components/RecipeRow';
import { TimerBar } from '@/components/TimerBar';
import { useLive } from '@/db/live';
import { allRecipes, listFavorites } from '@/db/repo';
import { pickText, type Lang, type Recipe } from '@/domain/model';
import { foldDiacritics, initialOf } from '@/domain/recipe-source';
import { lang, t } from '@/i18n';
import { activeProfile } from '@/profile';

interface Group {
  letter: string;
  items: Recipe[];
}

// Scroll position and query survive a trip to a detail screen (feels like an app, not a page).
let savedScroll = 0;
let savedQuery = '';

function norm(s: string): string {
  return foldDiacritics(s).toLowerCase();
}

function matches(r: Recipe, q: string): boolean {
  if (r.name.nl && norm(r.name.nl).includes(q)) return true;
  if (r.name.en && norm(r.name.en).includes(q)) return true;
  return r.aliases.some((a) => norm(a).includes(q));
}

function groupRecipes(list: Recipe[], l: Lang): Group[] {
  const map = new Map<string, Recipe[]>();
  for (const r of list) {
    const k = initialOf(pickText(r.name, l));
    const arr = map.get(k);
    if (arr) arr.push(r);
    else map.set(k, [r]);
  }
  const letters = [...map.keys()].sort((a, b) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)));
  const locale = l === 'nl' ? 'nl' : 'en';
  return letters.map((letter) => ({
    letter,
    items: (map.get(letter) ?? []).sort((a, b) => pickText(a.name, l).localeCompare(pickText(b.name, l), locale, { sensitivity: 'base' })),
  }));
}

export function RecipesScreen() {
  const l = lang.value;
  const pid = activeProfile.value?.id ?? '';
  const all = useLive(allRecipes, []);
  const favs = useLive(() => (pid ? listFavorites(pid) : Promise.resolve(new Set<string>())), [pid]);
  const [query, setQuery] = useState(savedQuery);
  const queryRef = useRef(query);
  queryRef.current = query;
  const scroller = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const [railLetter, setRailLetter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = all ?? [];
    const q = norm(query.trim());
    return q ? list.filter((r) => matches(r, q)) : list;
  }, [all, query]);
  const groups = useMemo(() => groupRecipes(filtered, l), [filtered, l]);

  // Remember the position on leave …
  useEffect(() => {
    const el = scroller.current;
    return () => {
      savedScroll = el?.scrollTop ?? 0;
      savedQuery = queryRef.current;
    };
  }, []);

  // … and restore it once the list has rendered (useLive delivers the data after the first paint,
  // so restoring in a mount effect would scroll an empty list).
  const loaded = all !== undefined;
  useEffect(() => {
    if (!loaded) return;
    const el = scroller.current;
    if (el && savedScroll > 0) el.scrollTop = savedScroll;
  }, [loaded]);

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
      <Header title={t('list.title')}>
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
      <TimerBar />
      {/* The rail is positioned inside .az-area (list only), so it never overlays the header. */}
      <div class="az-area">
        <div class="screen has-az" ref={scroller}>
          <div class="muted small list-count">{all ? t('list.count', { n: filtered.length }) : t('common.loading')}</div>
          {all && groups.length === 0 && <div class="empty">{t('list.empty')}</div>}
          {groups.map((g) => (
            <section key={g.letter}>
              <div class="letter" data-letter={g.letter}>
                {g.letter}
              </div>
              <ul class="list">
                {g.items.map((r) => (
                  <li key={r.id}>
                    <RecipeRow recipe={r} favorite={favs?.has(r.id)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {groups.length > 1 && (
          <div
            class={'az-rail' + (railLetter ? ' active' : '')}
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
        {railLetter && <div class="az-bubble">{railLetter}</div>}
      </div>
    </>
  );
}
