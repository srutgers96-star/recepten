// The household (src/domain/household.ts): members from profiles + the stored setting, lookup by
// name, and the block-F member cards (`#f=`): card <-> member, matching and upsert rules, the
// sender -> member mapping by name.
import { describe, expect, it } from 'vitest';
import {
  cardFromMember,
  matchMemberForCard,
  memberByName,
  memberFromCard,
  membersFrom,
  normalizeHousehold,
  putMember,
  upsertMemberFromCard,
  type HouseholdSetting,
  type Member,
  type MemberCard,
} from '../src/domain/household';
import type { Profile } from '../src/domain/model';

const STIJN: Profile = { id: 'p:stijn0001', name: 'Stijn', lang: 'nl', color: '#2b4fa8', createdAt: '2026-09-01T00:00:00.000Z' };
const GABI_CARD: MemberCard = { id: 'p:gabi00001', name: 'Gabi', color: '#d9402b', lang: 'en', deviceId: 'd:iphone01' };

function setting(members: Member[] = [], name = ''): HouseholdSetting {
  return { name, members };
}

describe('member cards', () => {
  it('cardFromMember builds the travelling card from a profile (+ the phone id)', () => {
    expect(cardFromMember(STIJN, 'd:pixel001')).toEqual({ id: 'p:stijn0001', name: 'Stijn', color: '#2b4fa8', lang: 'nl', deviceId: 'd:pixel001' });
    // No device id → no key at all (keeps the token small and the shape honest).
    expect(cardFromMember(STIJN)).not.toHaveProperty('deviceId');
    expect(cardFromMember({ id: 'm:x', name: '  Oma ', color: '' })).toEqual({ id: 'm:x', name: 'Oma', color: '#2b4fa8', lang: 'nl' });
  });

  it('memberFromCard stores a non-local member with the card fields', () => {
    expect(memberFromCard(GABI_CARD)).toEqual({ id: 'p:gabi00001', name: 'Gabi', color: '#d9402b', lang: 'en', local: false, deviceId: 'd:iphone01' });
    const bare = memberFromCard({ id: 'p:x', name: ' Tom ', color: ' ', lang: 'nl' });
    expect(bare).toEqual({ id: 'p:x', name: 'Tom', color: '#2b4fa8', lang: 'nl', local: false });
  });

  it('card -> member -> card round-trips and survives normalizeHousehold', () => {
    const h = upsertMemberFromCard(setting(), GABI_CARD);
    const stored = normalizeHousehold(JSON.parse(JSON.stringify(h)));
    expect(stored.members).toHaveLength(1);
    expect(cardFromMember(stored.members[0]!, stored.members[0]!.deviceId)).toEqual(GABI_CARD);
  });
});

describe('upsertMemberFromCard', () => {
  it('adds an unknown card', () => {
    const h = upsertMemberFromCard(setting(), GABI_CARD);
    expect(h.members.map((m) => m.id)).toEqual(['p:gabi00001']);
    expect(h.members[0]!.local).toBe(false);
  });

  it('updates the same profile id (new name, colour, language)', () => {
    const h1 = upsertMemberFromCard(setting(), GABI_CARD);
    const h2 = upsertMemberFromCard(h1, { ...GABI_CARD, name: 'Gabriela', color: '#3d7a3a', lang: 'nl' });
    expect(h2.members).toHaveLength(1);
    expect(h2.members[0]).toMatchObject({ id: 'p:gabi00001', name: 'Gabriela', color: '#3d7a3a', lang: 'nl', deviceId: 'd:iphone01' });
  });

  it('a re-made profile on the same phone with the same name replaces the old entry (new id wins)', () => {
    const h1 = upsertMemberFromCard(setting(), GABI_CARD);
    const h2 = upsertMemberFromCard(h1, { ...GABI_CARD, id: 'p:gabi00002' });
    expect(h2.members.map((m) => m.id)).toEqual(['p:gabi00002']);
  });

  it('two different people on one phone are NOT merged', () => {
    const h1 = upsertMemberFromCard(setting(), GABI_CARD);
    const h2 = upsertMemberFromCard(h1, { id: 'p:tom000001', name: 'Tom', color: '#7a3d8a', lang: 'en', deviceId: 'd:iphone01' });
    expect(h2.members.map((m) => m.name)).toEqual(['Gabi', 'Tom']);
  });

  it('completes a hand-typed member with the same name (case/accent-insensitive)', () => {
    const typed = putMember(setting(), { id: 'm:abc12345', name: 'gabi', color: '#2a8a8a', local: false });
    const h = upsertMemberFromCard(typed, GABI_CARD);
    expect(h.members).toHaveLength(1);
    expect(h.members[0]).toMatchObject({ id: 'p:gabi00001', name: 'Gabi', deviceId: 'd:iphone01' });
  });

  it('a same-named card from ANOTHER phone (reset, new phone, /next/) replaces the old entry — the rule membersFrom applies', () => {
    const h1 = upsertMemberFromCard(setting(), GABI_CARD);
    const h2 = upsertMemberFromCard(h1, { ...GABI_CARD, id: 'p:other0001', deviceId: 'd:android9', color: '#3d7a3a', lang: 'nl' });
    expect(h2.members.map((m) => m.id)).toEqual(['p:other0001']);
    // The new colour/language reach the UI: the full list shows exactly one Gabi, the new one.
    const all = membersFrom([STIJN], h2).filter((m) => m.name === 'Gabi');
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: 'p:other0001', color: '#3d7a3a', lang: 'nl', deviceId: 'd:android9' });
    // and the re-sent card is now "known" (update), not "new" again
    expect(matchMemberForCard(membersFrom([STIJN], h2), { ...GABI_CARD, id: 'p:other0001', deviceId: 'd:android9' })?.id).toBe('p:other0001');
  });

  it('ignores an unusable card and keeps the setting untouched', () => {
    const h = setting([], 'Thuis & co');
    expect(upsertMemberFromCard(h, { id: '', name: 'X', color: '#000', lang: 'nl' })).toBe(h);
    expect(upsertMemberFromCard(h, { id: 'p:y', name: '   ', color: '#000', lang: 'nl' })).toBe(h);
  });

  it('never writes a local member: the stored list stays non-local, and membersFrom hides a card of a local profile', () => {
    // A card of a profile that lives on THIS phone (someone shared our own card back to us).
    const h = upsertMemberFromCard(setting(), cardFromMember(STIJN, 'd:pixel001'));
    expect(h.members[0]!.local).toBe(false);
    const all = membersFrom([STIJN], h);
    expect(all).toHaveLength(1);
    expect(all[0]!.local).toBe(true);
    expect(all[0]!.id).toBe(STIJN.id);
  });
});

describe('matchMemberForCard', () => {
  const all = membersFrom([STIJN], upsertMemberFromCard(setting(), GABI_CARD));

  it('finds the local profile for its own card (by id or by name)', () => {
    expect(matchMemberForCard(all, cardFromMember(STIJN))?.local).toBe(true);
    expect(matchMemberForCard(all, { id: 'p:elsewhere', name: 'STIJN', color: '#000', lang: 'en' })?.id).toBe(STIJN.id);
  });

  it('finds the stored member and reports nothing for a stranger', () => {
    expect(matchMemberForCard(all, GABI_CARD)?.id).toBe('p:gabi00001');
    expect(matchMemberForCard(all, { id: 'p:new', name: 'Noor', color: '#000', lang: 'nl', deviceId: 'd:new' })).toBeUndefined();
  });

  it('never matches on deviceId alone: two different people on one phone stay apart', () => {
    expect(matchMemberForCard(all, { id: 'p:tom000001', name: 'Tom', color: '#000', lang: 'en', deviceId: 'd:iphone01' })).toBeUndefined();
  });
});

describe('memberByName (the sender of a received share)', () => {
  const all = membersFrom([STIJN], upsertMemberFromCard(upsertMemberFromCard(setting(), GABI_CARD), { id: 'p:tom000001', name: 'Tom', color: '#7a3d8a', lang: 'en', deviceId: 'd:iphone01' }));

  it('maps `by` to a member by name only (r/p/w/b envelopes carry no device id); a renamed sender is not recognised', () => {
    expect(memberByName(all, 'gabi')?.id).toBe('p:gabi00001');
    expect(memberByName(all, 'Gabi')?.id).toBe('p:gabi00001');
    expect(memberByName(all, 'Tom')?.id).toBe('p:tom000001');
    expect(memberByName(all, 'G.')).toBeUndefined();
    expect(memberByName(all, 'Nobody')).toBeUndefined();
  });
});
