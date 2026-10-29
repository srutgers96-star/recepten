// The avatar maker (docs/specs/badges-avatar.md §1b, block 6D-3, builder B). A bottom sheet through
// SheetPortal with the head `.sheet-head.with-actions`: Annuleer left, "Jouw avatar" in the middle,
// Bewaar right. Under the head the preview (120 px, on the profile colour, with the ring of the
// level); it stays in view while the rows below scroll, so every pick shows at once (DEVICE-TEST 96
// step 6). Then the colour hint, "🎲 Verras me" (randomAvatar over the unlocked parts, seed
// Date.now()) and one row per layer in the order of §1b.3: horizontally scrolling strips of 56 px
// tiles (role="radiogroup"); skin and hair colour are colour circles (all free); the optional
// layers start with a "geen" tile. Each tile shows its part alone on a neutral light circle.
// Locked parts are grey with 🔒 and "Lv n" or the badge icon (❓ for a secret badge); a tap
// changes nothing and explains under the row how the part unlocks. A saved part that is locked on
// this phone (a restore on a phone with less XP) stays selected and drawn, with its explanation
// under the row from the start. Unlocked parts not in `avatar.seen` get a dot until the sheet
// closes; closing (any way) marks every unlocked part as seen. At the bottom "Terug naar de
// beginletter" (Bewaar then stores `avatar: null`) and the "Alleen Bewaar bewaart" line.
// Bewaar → updateProfile({ ...p, avatar }); a failure keeps the sheet open with `common.error`.
// Annuleer, swiping down (grab bar / head), tapping beside the sheet and Escape save nothing (13J).
// Who may open it (level ≥ AVATAR_MAKER_LEVEL, the active profile, badges on) is up to the caller.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
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

/** One row of the maker: a part layer, or one of the two colour rows. */
type RowId = AvatarLayer | 'tone' | 'hairColor';
/** The rows in the order of §1b.3. */
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
  // Per layer the part whose lock is explained under the row (tapped, or saved but locked here).
  const [notes, setNotes] = useState<Partial<Record<AvatarLayer, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; id: number; dy: number } | null>(null);
  // The unlocked part ids shown in this opening: marked as seen when the sheet goes away.
  const shownFree = useRef<string[]>([]);

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

  // Closing in any way: every unlocked part this opening showed counts as seen (§1b.5).
  useEffect(
    () => () => {
      if (shownFree.current.length > 0) void markPartsSeen(shownFree.current);
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

  function partRow(layer: AvatarLayer, r: Ready): JSX.Element {
    const list = byLayer.get(layer) ?? [];
    const selected = spec ? partOn(spec, layer, parts) : undefined;
    const noteId = notes[layer];
    const notePart = noteId ? parts.get(noteId) : undefined;
    const labelId = `${uid}-row-${layer}`;
    return (
      <section key={layer} class="avatar-row">
        <h3 class="avatar-row-label" id={labelId}>
          {t('avatar.layer.' + layer)}
        </h3>
        <div class="avatar-strip" role="radiogroup" aria-labelledby={labelId}>
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
          <p class="muted small avatar-row-note" role="status">
            {lockText(notePart)}
          </p>
        )}
      </section>
    );
  }

  function colourRow(row: 'tone' | 'hairColor'): JSX.Element {
    const palette: readonly string[] = row === 'tone' ? AVATAR_TONES : AVATAR_HAIR;
    const current = row === 'tone' ? tone : hair;
    const label = t('avatar.layer.' + row);
    const labelId = `${uid}-row-${row}`;
    return (
      <section key={row} class="avatar-row">
        <h3 class="avatar-row-label" id={labelId}>
          {label}
        </h3>
        <div class="avatar-strip" role="radiogroup" aria-labelledby={labelId}>
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
      </section>
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
          <div class="sheet-body avatar-body">
            <p class="muted small avatar-color-hint">{t('avatar.colorHint')}</p>
            <button type="button" class="btn avatar-random" disabled={busy || !ready} onClick={surprise}>
              {t('avatar.random')}
            </button>
            {ready ? (
              ROWS.map((row) => (row === 'tone' || row === 'hairColor' ? colourRow(row) : partRow(row, ready)))
            ) : loadFailed ? (
              <p class="avatar-error" role="alert">
                {t('common.error')}
              </p>
            ) : (
              <p class="muted avatar-loading">{t('common.loading')}</p>
            )}
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
