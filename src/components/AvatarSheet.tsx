// The avatar maker (docs/specs/badges-avatar.md §1b, block 6D-3, builder B; tabs since block 6D-UI,
// builder UI-B). A bottom sheet through SheetPortal with the head `.sheet-head.with-actions`:
// Annuleer left, "Jouw avatar" in the middle, Bewaar right. Under the head the preview (160 px, on
// the profile colour, with the ring of the level); it stays in view while the panel below scrolls,
// so every pick shows at once (DEVICE-TEST 96 step 6). Then, at the top of the scrolling body as
// before, the colour hint and "🎲 Verras me" (randomAvatar over the unlocked parts, seed
// Date.now()), and a horizontally scrolling tab strip (role="tablist") with one tab per row in the
// order of ROWS; it sticks under the preview while the panel scrolls. The active tab has the
// profile colour as underline; a tab gets a cobalt dot while its layer has unlocked parts not yet
// in `avatar.seen`. Arrow keys / Home / End move between tabs (roving tabindex). The sheet always
// opens on Gezicht. One panel per tab (role="tabpanel"): the tiles as a wrapping grid of 64 px
// tiles (role="radiogroup"); skin and hair colour are colour circles in the same grid (all free);
// the optional layers start with a "geen" tile. Each tile shows its part alone on a neutral light
// circle. Locked parts are grey with 🔒 and "Lv n" or the badge icon (❓ for a secret badge); a
// tap changes nothing and explains under the grid how the part unlocks. A saved part that is
// locked on this phone (a restore on a phone with less XP) stays selected and drawn, with its
// explanation under its grid from the start. Unlocked parts not in `avatar.seen` get a dot until
// the sheet closes; closing (any way) marks as seen the unlocked parts of the tabs opened in this
// opening (Gezicht always; decision Fable 30 Oct), so a skipped tab keeps its dot. At the bottom of the
// panel area (outside the grid) "Terug naar de beginletter" (Bewaar then stores `avatar: null`)
// and the "Alleen Bewaar bewaart" line.
// Bewaar → updateProfile({ ...p, avatar }); a failure keeps the sheet open with `common.error`.
// Annuleer, swiping down (grab bar / head), tapping beside the sheet and Escape save nothing (13J).
// Who may open it (level ≥ AVATAR_MAKER_LEVEL, the active profile, badges on) is up to the caller.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { SheetPortal } from '@/components/SheetPortal';
import { avatarParts, avatarUid, markPartsSeen, partBadge, unlockContext, unseenParts, type UnlockContext } from '@/avatar';
import {
  AVATAR_HAIR,
  AVATAR_TONES,
  LAYER_ORDER,
  defaultAvatar,
  isComplete,
  isUnlocked,
  makerTileName,
  normalizeAvatarSpec,
  randomAvatar,
  renderAvatarSvg,
  type AvatarLayer,
  type AvatarPart,
  type AvatarSpec,
} from '@/domain/avatar';
import type { Profile } from '@/domain/model';
import { lang, t } from '@/i18n';
import { profiles, updateProfile } from '@/profile';

/** How far (px) the sheet must be pulled down before letting go closes it (as CookedSheet). */
const DISMISS_PX = 80;
/** The neutral light circle behind every tile (never the profile colour, so a bg tile stays readable). */
const TILE_BG = '#eef1f5';

/** One tab of the maker: a part layer, or one of the two colour tabs. */
type RowId = AvatarLayer | 'tone' | 'hairColor';
/** The tabs in the order of §1b.3 (block 6D-UI keeps it); the sheet opens on the first (Gezicht). */
const ROWS: readonly RowId[] = ['face', 'tone', 'hair', 'hairColor', 'eyes', 'mouth', 'facial', 'glasses', 'hat', 'body', 'prop', 'pin', 'bg'];
/** The layers whose row starts with the "geen" tile (§1b.3). */
// Hair is optional too (decision Fable 29 Oct: §2f "de rest mag leeg" wins over the §1b.3 list).
const OPTIONAL: ReadonlySet<AvatarLayer> = new Set<AvatarLayer>(['hair', 'facial', 'glasses', 'hat', 'prop', 'pin', 'bg']);

export interface AvatarSheetProps {
  profile: Profile;
  onClose: () => void;
}

/** Loaded once per opening: what this member has unlocked, and which of it is new to this phone. */
interface Ready {
  ctx: UnlockContext;
  free: ReadonlySet<string>;
  unseen: ReadonlySet<string>;
}

/** A part renamed later stays drawable but leaves the maker (`retired`, §5a; none yet). */
function isRetired(p: AvatarPart): boolean {
  return (p as AvatarPart & { retired?: unknown }).retired === true;
}

/** The layer of a part id: from the library, else from its `<layer>-` prefix (a part this app does not know). */
function layerOfId(id: string, parts: ReadonlyMap<string, AvatarPart>): AvatarLayer | undefined {
  return parts.get(id)?.layer ?? LAYER_ORDER.find((l) => id.startsWith(l + '-'));
}

/** The part id the spec has on `layer` (at most one per layer). */
function partOn(spec: AvatarSpec, layer: AvatarLayer, parts: ReadonlyMap<string, AvatarPart>): string | undefined {
  return spec.parts.find((id) => layerOfId(id, parts) === layer);
}

/** The spec with `id` on `layer` instead of what was there (null = the layer empty). */
function withPart(spec: AvatarSpec, layer: AvatarLayer, id: string | null, parts: ReadonlyMap<string, AvatarPart>): AvatarSpec {
  const rest = spec.parts.filter((p) => layerOfId(p, parts) !== layer);
  return { ...spec, parts: id ? [...rest, id] : rest };
}

/**
 * The line under a row for a locked part (§1b.4); a secret badge is never named. A ladder badge's
 * part carries the tier it needs (normalizeAvatarParts copies it from the badge), a one-off's not.
 */
function lockText(part: AvatarPart): string {
  const u = part.unlock;
  if ('level' in u) return t('avatar.lockedLevel', { n: u.level });
  const badge = partBadge(part);
  if (!badge || badge.hidden === true) return t('avatar.lockedSecret');
  const name = badge[lang.value].name;
  if (u.tier !== undefined) return t('avatar.lockedBadgeTier', { badge: name, colour: t('badges.tier.' + u.tier) });
  return t('avatar.lockedBadge', { badge: name });
}

/** The small label on a locked tile: "Lv n", the badge icon, or ❓ for a secret badge. */
function lockLabel(part: AvatarPart): string {
  const u = part.unlock;
  if ('level' in u) return t('avatar.lockLevel', { n: u.level });
  const badge = partBadge(part);
  return !badge || badge.hidden === true ? '❓' : badge.icon;
}

export function AvatarSheet(props: AvatarSheetProps): JSX.Element {
  const { profile, onClose } = props;
  const parts = avatarParts();
  const [uid] = useState(avatarUid);
  // First time (no usable avatar): start from defaultAvatar(), so Bewaar gives something at once.
  const [initial] = useState<AvatarSpec>(() => normalizeAvatarSpec(profile.avatar) ?? defaultAvatar());
  // null = "Terug naar de beginletter": the preview shows the initial, Bewaar stores avatar: null.
  const [spec, setSpec] = useState<AvatarSpec | null>(initial);
  const [ready, setReady] = useState<Ready | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // Per layer the part whose lock is explained under its grid (tapped, or saved but locked here).
  const [notes, setNotes] = useState<Partial<Record<AvatarLayer, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // The tab in view; every opening starts on Gezicht (block 6D-UI, UI-B.4).
  const [tab, setTab] = useState<RowId>('face');
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  // The scrolling body, the tab strip, and the empty marker right above the strip (where it sticks).
  const bodyRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; id: number; dy: number } | null>(null);
  // The unlocked part ids of this opening; those on an opened tab are marked as seen when the sheet goes away.
  const shownFree = useRef<string[]>([]);
  // The tabs opened in this opening (the first, Gezicht, included); grows on every tab switch.
  const openedTabs = useRef<Set<RowId>>(new Set<RowId>(['face']));

  // The parts of each layer the maker offers, in file order.
  const byLayer = useMemo(() => {
    const out = new Map<AvatarLayer, AvatarPart[]>();
    for (const p of parts.values()) {
      if (isRetired(p)) continue;
      const list = out.get(p.layer);
      if (list) list.push(p);
      else out.set(p.layer, [p]);
    }
    return out;
  }, [parts]);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const ctx = await unlockContext(profile.id);
        const free = new Set([...parts.values()].filter((p) => isUnlocked(p, ctx)).map((p) => p.id));
        const unseen = await unseenParts([...free]);
        if (!live) return;
        shownFree.current = [...free];
        setReady({ ctx, free, unseen });
        // A saved part that is not unlocked on this phone stays selected; say why under its row.
        const start: Partial<Record<AvatarLayer, string>> = {};
        for (const layer of LAYER_ORDER) {
          const id = partOn(initial, layer, parts);
          const part = id ? parts.get(id) : undefined;
          if (part && !isRetired(part) && !free.has(part.id)) start[layer] = part.id;
        }
        setNotes(start);
      } catch (e) {
        console.error('AvatarSheet', e);
        if (live) setLoadFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [profile.id, parts, initial]);

  // Closing in any way: the unlocked parts of the tabs opened this time count as seen (§1b.5,
  // "zichtbaar" = the opened panel; decision Fable 30 Oct). Tone and hair colour have no parts.
  useEffect(
    () => () => {
      const seen = shownFree.current.filter((id) => {
        const layer = parts.get(id)?.layer;
        return layer !== undefined && openedTabs.current.has(layer);
      });
      if (seen.length > 0) void markPartsSeen(seen);
    },
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  // aria-modal moves no focus by itself: put it on Annuleer on open and hand it back on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelBtn.current?.focus({ preventScroll: true });
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  // A new tab: its panel starts at the top (right under the stuck strip), and the tab itself is
  // scrolled into view in the strip. Only the strip and the body scroll, never the page.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const stick = stickRef.current;
    if (body && stick && body.scrollTop > stick.offsetTop) body.scrollTop = stick.offsetTop;
    const strip = stripRef.current;
    const el = strip?.querySelector<HTMLElement>(`[data-row="${tab}"]`);
    if (!strip || !el) return;
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    if (left < strip.scrollLeft) strip.scrollLeft = Math.max(0, left - 16);
    else if (right > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = right - strip.clientWidth + 16;
  }, [tab]);

  const level = ready?.ctx.level ?? 0;
  const tone: string = spec?.tone ?? AVATAR_TONES[1];
  const hair: string = spec?.hair ?? AVATAR_HAIR[0];

  // The SVG strings come only from data/avatar-parts.json (validated by tools/validate-data.ts:
  // no <script, no href, only the two var() styles), never from user input; the spec only picks
  // ids and colours (normalizeAvatarSpec keeps only palette colours). Hence dangerouslySetInnerHTML.
  const previewSvg = useMemo(
    () => (spec && isComplete(spec, parts) ? renderAvatarSvg(spec, parts, { color: profile.color, level, uid: uid + '-p' }) : null),
    [spec, parts, profile.color, level, uid],
  );
  const tileSvgs = useMemo(() => {
    const out = new Map<string, string>();
    for (const list of byLayer.values()) {
      for (const p of list) {
        out.set(p.id, renderAvatarSvg({ v: 1, parts: [p.id], tone, hair }, parts, { color: TILE_BG, level: 0, uid: `${uid}-${p.id}` }));
      }
    }
    return out;
  }, [byLayer, parts, tone, hair, uid]);

  function clearNote(layer: AvatarLayer) {
    setNotes((prev) => {
      if (!(layer in prev)) return prev;
      const next = { ...prev };
      delete next[layer];
      return next;
    });
  }

  /** A tap on a part tile (null = "geen"): a locked part only explains itself, nothing changes. */
  function pickPart(layer: AvatarLayer, part: AvatarPart | null) {
    if (busy || !ready) return;
    if (part && !ready.free.has(part.id)) {
      setNotes((prev) => ({ ...prev, [layer]: part.id }));
      return;
    }
    clearNote(layer);
    setSpec((s) => withPart(s ?? defaultAvatar(), layer, part ? part.id : null, parts));
  }

  function pickTone(hex: string) {
    if (busy) return;
    setSpec((s) => ({ ...(s ?? defaultAvatar()), tone: hex }));
  }

  function pickHair(hex: string) {
    if (busy) return;
    setSpec((s) => ({ ...(s ?? defaultAvatar()), hair: hex }));
  }

  function surprise() {
    if (busy || !ready) return;
    const free = [...parts.values()].filter((p) => !isRetired(p) && ready.free.has(p.id));
    setSpec(randomAvatar(free, Date.now()));
    setNotes({});
  }

  function backToInitial() {
    if (busy) return;
    setSpec(null);
    setNotes({});
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      // The newest copy of the profile (the sheet only changes `avatar`).
      const current = profiles.value.find((p) => p.id === profile.id) ?? profile;
      await updateProfile({ ...current, avatar: spec });
      onClose();
    } catch (e) {
      console.error('AvatarSheet save', e);
      setError(true);
      setBusy(false);
    }
  }

  /** Swipe down / tap beside the sheet: close without saving (only Bewaar saves). */
  function dismiss() {
    if (busy) return;
    onClose();
  }

  // Swipe down on the grab bar / head: the sheet follows the finger; far enough = dismiss().
  function onDragStart(e: PointerEvent) {
    if ((e.target as HTMLElement | null)?.closest('button')) return;
    drag.current = { y: e.clientY, id: e.pointerId, dy: 0 };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // The pointer is already gone (a very short tap): the drag simply works without capture.
    }
  }
  function onDragMove(e: PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    d.dy = Math.max(0, e.clientY - d.y);
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
      sheetRef.current.style.transform = d.dy > 0 ? `translateY(${d.dy}px)` : '';
    }
  }
  function onDragEnd(e: PointerEvent, cancelled: boolean) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform .18s ease-out';
      sheetRef.current.style.transform = '';
    }
    if (!cancelled && d.dy > DISMISS_PX) dismiss();
  }

  const tabId = (row: RowId) => `${uid}-tab-${row}`;
  const panelId = (row: RowId) => `${uid}-panel-${row}`;

  /** Show another tab and remember it was opened (its unlocked parts count as seen on closing). */
  function openTab(row: RowId) {
    openedTabs.current.add(row);
    setTab(row);
  }

  /** Whether a tab gets the cobalt dot: its layer has unlocked parts this phone has not seen yet. */
  function tabHasNew(row: RowId): boolean {
    if (!ready || row === 'tone' || row === 'hairColor') return false;
    return (byLayer.get(row) ?? []).some((p) => ready.free.has(p.id) && ready.unseen.has(p.id));
  }

  /** Arrow keys, Home and End move to (and open) another tab; focus follows (roving tabindex). */
  function onTabKey(e: KeyboardEvent) {
    const i = ROWS.indexOf(tab);
    let j: number;
    if (e.key === 'ArrowRight') j = (i + 1) % ROWS.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + ROWS.length) % ROWS.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = ROWS.length - 1;
    else return;
    const next = ROWS[j];
    if (!next) return;
    e.preventDefault();
    openTab(next);
    stripRef.current?.querySelector<HTMLElement>(`[data-row="${next}"]`)?.focus({ preventScroll: true });
  }

  function partPanel(layer: AvatarLayer, r: Ready): JSX.Element {
    const list = byLayer.get(layer) ?? [];
    const selected = spec ? partOn(spec, layer, parts) : undefined;
    const noteId = notes[layer];
    const notePart = noteId ? parts.get(noteId) : undefined;
    return (
      <>
        <div class="avatar-grid" role="radiogroup" aria-labelledby={tabId(layer)}>
          {OPTIONAL.has(layer) && (
            <button
              type="button"
              role="radio"
              aria-checked={spec !== null && selected === undefined}
              class={'avatar-tile none' + (spec !== null && selected === undefined ? ' on' : '')}
              disabled={busy}
              onClick={() => pickPart(layer, null)}
            >
              <span class="avatar-tile-none">{t('avatar.none')}</span>
            </button>
          )}
          {list.map((p) => {
            const free = r.free.has(p.id);
            const on = selected === p.id;
            // A locked part of a secret badge never carries that badge's name (§1b.4): pin-heart
            // "Hartje" gets no name then, only the secret lock text (makerTileName).
            const name = makerTileName(p, lang.value, free, partBadge(p));
            const label = free ? name : name ? `${name}. ${lockText(p)}` : lockText(p);
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={label}
                title={name || undefined}
                class={'avatar-tile' + (on ? ' on' : '') + (free ? '' : ' locked')}
                disabled={busy}
                onClick={() => pickPart(layer, p)}
              >
                <span class="avatar-tile-art" dangerouslySetInnerHTML={{ __html: tileSvgs.get(p.id) ?? '' }} />
                {!free && (
                  <span class="avatar-tile-lock" aria-hidden="true">
                    🔒 {lockLabel(p)}
                  </span>
                )}
                {free && r.unseen.has(p.id) && <span class="avatar-tile-new" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        {notePart && (
          <p class="muted small avatar-panel-note" role="status">
            {lockText(notePart)}
          </p>
        )}
      </>
    );
  }

  function colourPanel(row: 'tone' | 'hairColor'): JSX.Element {
    const palette: readonly string[] = row === 'tone' ? AVATAR_TONES : AVATAR_HAIR;
    const current = row === 'tone' ? tone : hair;
    const label = t('avatar.layer.' + row);
    return (
      <div class="avatar-grid" role="radiogroup" aria-labelledby={tabId(row)}>
        {palette.map((hex, i) => {
          const on = spec !== null && current === hex;
          return (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${label} ${i + 1}`}
              class={'avatar-tile swatch' + (on ? ' on' : '')}
              disabled={busy}
              onClick={() => (row === 'tone' ? pickTone(hex) : pickHair(hex))}
            >
              <span class="avatar-swatch" style={{ background: hex }} />
            </button>
          );
        })}
      </div>
    );
  }

  const title = t('avatar.title');
  const initialLetter = profile.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <SheetPortal>
      <div class="sheet-backdrop no-print" onClick={dismiss}>
        <div ref={sheetRef} class="sheet avatar-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
          <div
            class="cooked-drag"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={(e) => onDragEnd(e, false)}
            onPointerCancel={(e) => onDragEnd(e, true)}
          >
            <div class="sheet-grab" aria-hidden="true" />
            <div class="sheet-head with-actions">
              <button ref={cancelBtn} type="button" class="sheet-head-btn" disabled={busy} onClick={onClose}>
                {t('common.cancel')}
              </button>
              <h2>{title}</h2>
              <button type="button" class="sheet-head-btn save" disabled={busy} onClick={() => void save()}>
                {t('common.save')}
              </button>
            </div>
          </div>
          <div class="avatar-preview">
            {previewSvg ? (
              <span class="avatar-preview-art" dangerouslySetInnerHTML={{ __html: previewSvg }} />
            ) : (
              <span class="avatar avatar-preview-letter" style={{ background: profile.color }} aria-hidden="true">
                {initialLetter}
              </span>
            )}
          </div>
          <div ref={bodyRef} class="sheet-body avatar-body">
            <p class="muted small avatar-color-hint">{t('avatar.colorHint')}</p>
            <button type="button" class="btn avatar-random" disabled={busy || !ready} onClick={surprise}>
              {t('avatar.random')}
            </button>
            <div ref={stickRef} class="avatar-tabs-stick" aria-hidden="true" />
            {/* The tab strip sticks under the preview; the active tab is underlined in the profile colour. */}
            <div
              ref={stripRef}
              class="avatar-tabs"
              role="tablist"
              aria-label={title}
              style={{ '--avatar-tab-line': profile.color }}
              onKeyDown={onTabKey}
            >
              {ROWS.map((row) => {
                const on = row === tab;
                return (
                  <button
                    key={row}
                    type="button"
                    role="tab"
                    id={tabId(row)}
                    data-row={row}
                    class={'avatar-tab' + (on ? ' on' : '')}
                    aria-selected={on}
                    aria-controls={panelId(row)}
                    tabIndex={on ? 0 : -1}
                    onClick={() => openTab(row)}
                  >
                    {t('avatar.layer.' + row)}
                    {tabHasNew(row) && (
                      <span class="avatar-tab-new">
                        <span class="visually-hidden">{t('avatar.tabNew')}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div class="avatar-panel" role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)}>
              {ready ? (
                tab === 'tone' || tab === 'hairColor' ? (
                  colourPanel(tab)
                ) : (
                  partPanel(tab, ready)
                )
              ) : loadFailed ? (
                <p class="avatar-error" role="alert">
                  {t('common.error')}
                </p>
              ) : (
                <p class="muted avatar-loading">{t('common.loading')}</p>
              )}
            </div>
            <button type="button" class="btn btn-block avatar-reset" disabled={busy || spec === null} onClick={backToInitial}>
              {t('avatar.reset')}
            </button>
            <p class="muted small cooked-dismiss-hint">{t('cooked.dismissHint')}</p>
          </div>
          {error && (
            <div class="avatar-foot">
              <p class="avatar-error" role="alert">
                {t('common.error')}
              </p>
            </div>
          )}
        </div>
      </div>
    </SheetPortal>
  );
}
