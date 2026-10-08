// Frozen phase-3 tokens (docs/phase-3-spec.md §1): a `#p=` patch envelope and a `#b=` bundle
// envelope, produced ONCE on 2026-09-29 by both compression engines. They must decode forever;
// a codec change gets a NEW fragment key, never a silent reinterpretation of these.
// Phase 4 added a `#w=` week plan and phase 5 block F a `#f=` member card (below), same rule.
import type { Envelope } from '../../src/domain/token';

export const FROZEN_TOKEN_P =
  'dZLNbhshFIVfBZ01tshUimp23VSquugiyaaRF-PhTnxjBhA_VqIR714x0zZuGktI_Fz4OHxixhm6k8jQCJA4vELjLvOzg0TfVjvV3W7UbtPt7m-UVq1tlVI_IRGgZxz6RN8MNA66MLnkqXEirdzQ5-HYtrl-otaTg8bXSG44Cu_YO5F8CagSKVNI0I8zMr3k5YxtYRyHQFEYEo2_hVwZd5YHEvlIKyaJfGRnX7eoVb5DfPf-JDolJnYlXyJ4miiK0ce3atq2LJknimuYiR10pySK4-ajzeu-7quEZUc_zhQjG1o3Rxo4fKCDnaEX6Js2eoJGLM5QPPjC1vqmugTTZzJf3hlXu0vjdS__elwe9vB2w3Wv19GfLtAShodF2ZLwcQabj4K2e2d4R_8X65riT_VANIqU_XBqlZ6TbaunWNiQ26RAA0V-pgY1NPbF5offhi3ab-hDO5BjIYkzPUGPvU10_T2f_1VVJcaSS1xsnYjCyqr1Fw';
export const FROZEN_TOKEN_P_FFLATE =
  'dZBNT8MwDIb_SuVzNoUiIdYbFyTEgQNwAXFIW5eZZUmUjwk09b9jd8DGYGqlOLbz-vWzhQ00tYIMDQRQ0H5wcJ_pzfHFSLbW9cVML2b14uFMN1r-udb6iesBmi20JuFNz41tUwhd8ig6EXe6weRuKW3OrFFOdNx6HdF1y8o78q5KvgQYFaSMIUHzvIWM7zyZ31gx4ygEjFWPlejPWXzSuLfUYZWXuJNJHJKzH3MYR3Ukcev9qqp1tSZX8qEErdesPPi4ryYWYBzEhZ0ZTvMmWkFxJDzkPr7wp8CSw7sNxkg97pojdhT-wUGux3doziR65WIsnIitL2StF9Ql9CZjf3VEXC8OiY8v6ofjtNjjfsJprqelzw-kFfTUTcgmh7wLyRZ_jMrcLXjHJo6LrCEuvqst4lCl7LuVVAwlK9lVLEzLzVLADiO98QsejYMpNj9-EbacStkEeZBjQQUbZE-DsYnjU_tc_kbFM4eSS5xorZAhTVrj-Ak';

export const FROZEN_ENVELOPE_P: Envelope = {
  v: 2,
  t: 'p',
  by: 'Stijn',
  at: '2026-09-29T10:00:00.000Z',
  p: {
    baseId: 'b:uiensoep',
    rev: 2,
    patch: {
      name: { en: 'French onion soup' },
      steps: [
        { text: { nl: 'Snipper de uien.', en: 'Slice the onions thinly.' } },
        { text: { nl: 'Kook 20 minuten.', en: 'Simmer for 20 minutes.' }, timers: [{ min: 20, unit: 'min' }] },
      ],
    },
    lineOverrides: [{ recipeId: 'b:uiensoep', index: 1, ing: 'runderbouillon', updatedAt: '2026-09-29T09:00:00.000Z' }],
    name: { nl: 'Uiensoep', en: 'French onion soup' },
    updatedAt: '2026-09-29T09:30:00.000Z',
  },
  dict: {
    ing: [
      {
        id: 'runderbouillon',
        nl: { one: 'runderbouillon' },
        en: { one: 'beef stock' },
        aisle: 'kruiden-specerijen',
        defaultUnit: 'ml',
        staple: true,
        veg: false,
        updatedAt: '2026-09-29T08:00:00.000Z',
      },
    ],
  },
  future: { keep: true },
};

export const FROZEN_TOKEN_B =
  'bVNdb9QwEPwr1j67Jydtkeo3EDwgxIdEERLVPewl28Q0sU28uVKd8t_ROrkQWqQ8xOvxeGbWe4Ij2FIDg4UDaDg8gYWv7H560IBSLU356sLcXJQ3t4Wx5toaszPG_BAw2BOw447AwidH46NKztdJJYpM_YEG0JCcr2jDY4pbY2z-zjwDVS5SAnt3glS11GPW5GqwMFo8VEV5eXWdgUewlxqqgZCpfr3VV5isb8s7xvoFrHwJC4NrnBcvD87nO1NWjiO3YVjzmDR47ElwvgMLXzAxqkiJA2ggLyVZqCgbAmdsxBQkTx3sNSQajs5LrdTQOb9YHvBxJb0yRjULw0K6LU0afvGToHtRfGXMpGH0Thw2oMH5Biycsf9SFyoGXvROK1SWF-3oEkyikCnOoph-83r0QwgPqqZZxO4s7E1wneJ2LU_C0ARK3x23YO_2GrBzmLLNvciZ84PPY00qBYqz4oFqR55zVIUaHWgoVKcekWmQ2JxPPIwVu-DTWQx2HaWdekesQtxl7RG5apdID5jovbTyYGtsu_PTKRaUGFuaceviavMjsfKIfnUoRpbK9Lz9b2fejMv_07SfNNSuyrnleO9O8yPepKzz6RMEL0lIqaEe8YHpb2vIbxChpx7rzS66lAcuHGlw0vSa7nHs-Nv8DGJgmTrGKKh77BJpOFIDloeR_j8UxfWzmZz20_QH';
export const FROZEN_TOKEN_B_FFLATE =
  'bVNNj9MwFPwrls_dyslukTY3EBwQAlaiCAm0Byd5m5i6doidFhT1vzPP-VDZRcrBfh5PZuY9j_Iki3wjoyxkKTey_IPFl2h-Omw0V3OVv7pR9zf5_T5ThdoVSm2VUt8ZLItRRhMtAffJ0HAWwbg6iEBdpGNJPUCoVHy-8Khsr8DD38LTU2U6CrL4McpQtXTUSZOpcW0odFll-e3dLgGh9nYjq550pPr1tb5MJX3XvENXv4DlL2G-N41x7OUA9fzPkJTrIba-X_O4bKTTR1gZpbOoPugQtYDu6AEmEMgH3oiODxgedcOmZHBk5SOioP5kHNfgzho3W-71eSW9U0o0M8NMel0C6a-IFo3yyIpxhMrgDDtscAHsWC3Yf6kz0fk468WtGcrbm3YwQV5YYaRuEhXpN0jnqx-8P4iaJhHbRdgbb6yI7Vq-MEPjKXwzsQUJdtoaHZLNR5Yz5Sc_D-AKnrpJcU-1IRdTVJkYDKqZsOKM3vUcm3Eh9kMVjXfATGK0tRS24h1F4Tv8GrBOR8zOpL7EX99zK8ui1q1dRiebUWxsbsbedKvNj2BzWrvVIRuZK5fn7X878SZcWsM-MLWpUm4pXihJQ3yVMlhwe5TecRJcajDv-hAR49Ia5lwR_ohzzn451SakB-dPhMEFYU1PerDx6zQGaDK_uqg7Rj1pG2gjTwQ1CBHL_z2KbPfsTcLK5S8';

export const FROZEN_ENVELOPE_B: Envelope = {
  v: 2,
  t: 'b',
  by: 'Stijn',
  at: '2026-09-29T10:05:00.000Z',
  b: {
    title: 'Nieuw sinds september',
    since: '2026-09-01T00:00:00.000Z',
    recipes: [
      {
        schema: 2,
        id: 'u:abc12345',
        rev: 3,
        createdAt: '2026-09-10T10:00:00.000Z',
        updatedAt: '2026-09-20T10:00:00.000Z',
        origin: { kind: 'user', author: 'Stijn' },
        name: { nl: 'Pasta pesto', en: 'Pesto pasta' },
        tags: ['snel'],
        servings: 2,
        lines: [
          { raw: { nl: '400 g pasta', en: '400 g pasta' }, qty: { min: 400 }, unit: 'g', ing: 'pasta' },
          { raw: { nl: '1 pot pesto' }, ing: 'pesto-huis' },
        ],
        steps: [{ text: { nl: 'Kook de pasta.', en: 'Boil the pasta.' } }],
        goesWith: [],
        aliases: [],
      },
      // A phase-0 shape inside a phase-3 bundle: normalizeRecipe handles it.
      { name: 'Oude soep', ingredients: ['1 ui', '1 l water'], instructions: 'Kook alles. Eet op.' },
    ],
    patches: [{ baseId: 'b:dahl', rev: 1, patch: { servingTip: { nl: 'Met naan.', en: 'With naan.' } }, name: { nl: 'Dahl', en: 'Dahl' } }],
  },
  dict: {
    ing: [
      {
        id: 'pesto-huis',
        nl: { one: 'huisgemaakte pesto' },
        en: { one: 'homemade pesto' },
        aisle: 'overig',
        defaultUnit: 'pot',
        staple: false,
        veg: true,
        updatedAt: '2026-09-15T00:00:00.000Z',
      },
    ],
  },
};

// Phase 4 (docs/phase-4-spec.md §1): a `#w=` week-plan envelope, produced ONCE on 2026-09-29 by
// both engines. Three dishes (two classics, one own recipe embedded) plus the dictionary delta.
export const FROZEN_TOKEN_W =
  'bVLLbtswEPwVYc50QClOgfDWXnspEBcFavhAS2uJtUQyJCU3NfTvxUp-wjlyZnY0s9ojBqhCIEHhAIHtBxTekvljIaAZLWTxZSFfF8XrKi-UlErKJynlbwgcoI4wiboItT4imAoKW1XppoVADAPUchRXojdkoyN_Josr2Su9LfPieflyndwIBCqNp9k-lg11ekr7OBJogHoWKAPpRNXX2-S5XOXyPnnvqwdZ8ShzwdTGcsu9sdM3IwVeTJ8aFy6bGgWs7oh1toXCDx2TzjzF5CBAliF-ZJ4JliddcylESy02ApHCYCxjhUBr7Kly0IeL6VLKrD45nExvoVHgPX2wuuPESylHgd4ablhDwNgaCmftvXWeeZdOeceLlJ-LpjcR_CdiIj-HSvQ3XUa_O7fPKppDPJ2DfXOmzVJzgUd2qB3FXyY1UOuNgG6NjlPNDZPWJZoGXRXLRntPNvunE4VK15ypMuX00Snb-jhfwE1EMcU5wlm2YaimTut9omsvsjcK11GnqxtWm9gy4wYKhjdW0U73bfo579C7xJeZtGfVTreRBAaqoVLo6fOLyl9W8u6ixs0osOtTH6Zj2RP5eX4c_wM';
export const FROZEN_TOKEN_W_FFLATE =
  'bVNNj5swEP0raM5kBWy20nJrr72s1FSVWuXghAm4AZvaJtsW8d_3jQNJVlmJgz3vzfObD0Y6UVmkFKikV0pp9w-Hb0H_NrgoiRZZ8WmVPa-K501elFmG7yHLsp_AX6kcSQfuPJW_RnK6An9XVqppgXoH6fWUXoFBs_GW-wUsruBQqt0-Lx7XT9fMbUqO97rns7zfN9yp6PY-xTFSHlPaO1aBq8-3zvNsk4vtG-dDX93RinuadbrWRqo8ahPf9OykMUNorLt0akrJqI6FZ1pEX5QPKoHvYEFmCNCLXJJeAKEHVUtR5A23hDohe9JGYqiu1WYu2anY4ii6zrKknhVm0dsQRP8EDG-kThwDQmQwWiqskQB1nBbue-k86W2Y_SJrpsp11Qzak0zCB-7PpgL_heic-tXaY1Lx2cTDYuyL1W0Smkt4EoXasv-hQwMR3FSrlY9lbgU0NqB_SLQV5qz6nk3yHyNylarFU6X38dHoDSbiBtxYhALsjGSNyEioxrKoY4CHpS6xdmHYDrgYX1ClfSuIPTGmDsGKD2pow_dzD9Eh2cygemEdVOs5pRPDTXADjh9tVP60iet02ahpi4cOQxhcXJYj41-I-dP0Bg';

export const FROZEN_ENVELOPE_W: Envelope = {
  v: 2,
  t: 'w',
  by: 'Stijn',
  at: '2026-09-29T12:00:00.000Z',
  w: {
    items: [
      { rid: 'b:dahl', srv: 4 },
      { rid: 'b:uiensoep', srv: 2 },
      { rid: 'u:abc12345', srv: 4 },
    ],
    recipes: [
      {
        schema: 2,
        id: 'u:abc12345',
        rev: 3,
        createdAt: '2026-09-10T10:00:00.000Z',
        updatedAt: '2026-09-20T10:00:00.000Z',
        origin: { kind: 'user', author: 'Stijn' },
        name: { nl: 'Pasta pesto', en: 'Pesto pasta' },
        tags: ['snel'],
        servings: 2,
        lines: [
          { raw: { nl: '400 g pasta', en: '400 g pasta' }, qty: { min: 400 }, unit: 'g', ing: 'pasta' },
          { raw: { nl: '1 pot pesto' }, ing: 'pesto-huis' },
        ],
        steps: [{ text: { nl: 'Kook de pasta.', en: 'Boil the pasta.' } }],
        goesWith: [],
        aliases: [],
      },
    ],
    note: 'Boodschappen zaterdag',
  },
  dict: {
    ing: [
      {
        id: 'pesto-huis',
        nl: { one: 'huisgemaakte pesto' },
        en: { one: 'homemade pesto' },
        aisle: 'overig',
        defaultUnit: 'pot',
        staple: false,
        veg: true,
        updatedAt: '2026-09-15T00:00:00.000Z',
      },
    ],
  },
  future: { keep: true },
};

// Phase 5 block F (docs/phase-5-spec.md): a `#f=` member-card envelope, produced ONCE on
// 2026-10-08 by both engines with encodeToken. The sender as a household member: profile id,
// name, colour, language and the stable id of their phone. Nothing else travels in it.
export const FROZEN_TOKEN_F =
  'TY29DoJAEAbf5bNdzHISxX0Da63sDtgzCBw_OfCH8O7mOpOppphZsUAMIUDgQCg-EFxD_fQg2GgNm2OScsL5LWXhyJ6Z7yA4yIq6gmCQ5vA-v8xoQfC2079K2bf9BMHOFJmzOQit9Q8IfAtCpUtd6iVGKjl12fjN0xIbwc1hnjQeGtUBEqZZt-0H';
export const FROZEN_TOKEN_F_FFLATE =
  'TYzLDoIwEEX_ZdyCGSpRnD9wrSt3BYqplAJNi4-m_-50ZzKLe8_cnAgbkCjAA8EABbQfDlevn5aLzFSgOJYVltjcKiTMt0fEO_8HoAi659FC4-F9folVMrZyUn-Wbjaz474TbT3IhomR9sHAGs692nSnLlnS02mq129TdZBYHnxw7IkwKrUAeRdUSj8';

export const FROZEN_ENVELOPE_F: Envelope = {
  v: 2,
  t: 'f',
  by: 'Stijn',
  at: '2026-10-08T10:00:00.000Z',
  f: {
    id: 'p:k3x9w2qa',
    name: 'Stijn',
    color: '#2b4fa8',
    lang: 'nl',
    deviceId: 'd:7m4qz81c',
  },
  future: { keep: true },
};
