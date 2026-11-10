// Motore "Ispirazioni": regole locali, nessun costo, nessuna API.
import { asArray, currentSeasonId, daysBetween } from './utils.js';

const NEUTRALS = ['bianco', 'nero', 'grigio', 'navy', 'beige', 'blu', 'azzurro', 'marrone'];

// abbinamenti cromatici classici (id colori del seed; quelli personalizzati vengono ignorati)
const PAIRS = {
  navy: ['beige', 'bianco', 'grigio', 'marrone', 'azzurro'],
  nero: ['bianco', 'grigio', 'beige', 'rosso'],
  beige: ['navy', 'bianco', 'marrone', 'verde', 'azzurro'],
  grigio: ['navy', 'nero', 'bianco', 'rosa', 'azzurro'],
  blu: ['beige', 'bianco', 'grigio', 'marrone'],
  bianco: ['navy', 'beige', 'nero', 'blu', 'verde'],
  verde: ['beige', 'bianco', 'marrone', 'navy'],
  marrone: ['beige', 'azzurro', 'bianco', 'verde'],
  azzurro: ['navy', 'beige', 'grigio', 'bianco'],
  rosso: ['navy', 'grigio', 'bianco', 'nero'],
};

// guardaroba capsula: capi base che coprono quasi ogni occasione
export const ESSENTIALS = [
  { label: 'T-shirt bianca', words: ['t-shirt', 'tshirt', 'maglietta', 'magliette', 'tee'], colors: ['bianco'] },
  { label: 'T-shirt nera', words: ['t-shirt', 'tshirt', 'maglietta', 'magliette', 'tee'], colors: ['nero'] },
  { label: 'Camicia bianca', words: ['camicia', 'camicie'], colors: ['bianco'] },
  { label: 'Camicia azzurra', words: ['camicia', 'camicie', 'oxford'], colors: ['azzurro'] },
  { label: 'Polo', words: ['polo'], colors: null },
  { label: 'Maglione girocollo', words: ['maglione', 'maglioni', 'pullover', 'girocollo'], colors: null },
  { label: 'Felpa neutra', words: ['felpa', 'felpe', 'hoodie'], colors: ['grigio', 'navy', 'nero'] },
  { label: 'Jeans blu', words: ['jeans', 'denim'], colors: ['blu', 'navy'] },
  { label: 'Chino beige', words: ['chino', 'pantalon'], colors: ['beige'] },
  { label: 'Pantaloni eleganti scuri', words: ['pantalon', 'elegant', 'sartorial'], colors: ['grigio', 'navy', 'nero'] },
  { label: 'Blazer o giacca leggera', words: ['blazer', 'giacca', 'giacche'], colors: null },
  { label: 'Cappotto', words: ['cappotto', 'cappotti', 'montgomery', 'trench'], colors: null },
  { label: 'Giubbotto casual', words: ['giubbotto', 'giubbotti', 'bomber', 'piumino', 'parka'], colors: null },
  { label: 'Sneakers bianche', words: ['sneaker', 'scarpe da ginnastica'], colors: ['bianco'] },
  { label: 'Scarpe eleganti', words: ['elegant', 'derby', 'oxford', 'mocassin', 'stringat'], colors: ['marrone', 'nero'], role: 'shoes' },
  { label: 'Cintura in pelle', words: ['cintura', 'cinture'], colors: null },
];

const SEASON_NAMES = { pri: 'primavera', est: 'estate', aut: 'autunno', inv: 'inverno' };

export const searchLinks = (q, gender) => {
  const full = encodeURIComponent([q, gender].filter(Boolean).join(' '));
  return [
    { name: 'Zalando', url: `https://www.zalando.it/catalogo/?q=${full}` },
    { name: 'Vinted', url: `https://www.vinted.it/catalog?search_text=${encodeURIComponent(q)}` },
    { name: 'Google', url: `https://www.google.com/search?tbm=shop&q=${full}` },
    { name: 'Pinterest', url: `https://www.pinterest.it/search/pins/?q=${encodeURIComponent(['outfit', q, gender].filter(Boolean).join(' '))}` },
  ];
};

export function analyze(store) {
  const { items, sys, pathOf, roleOf, wear, lastWorn } = store;
  const S = sys.season, U = sys.usage, W = sys.wear, C = sys.color;
  const seasons = (it) => asArray(it.attrs?.[S?.id]);
  const colors = (it) => asArray(it.attrs?.[C?.id]);
  const hay = (it) => [it.name, ...pathOf(it.category_id).map((c) => c.name)].join(' ').toLowerCase();

  // 1. capi da sostituire
  const worn = W ? items.filter((it) => ['usurato', 'sostituire'].includes(it.attrs?.[W.id])) : [];
  const replace = worn.map((it) => {
    const col = colors(it).map((c) => C.options.find((o) => o.id === c)?.label).filter(Boolean)[0] || '';
    const leaf = pathOf(it.category_id).slice(-1)[0]?.name || '';
    return { item: it, query: [leaf || it.name, col].join(' ').trim().toLowerCase(), level: it.attrs?.[W.id] };
  });

  // 2. essenziali capsule
  const essentials = ESSENTIALS.map((e) => {
    const match = items.find((it) => e.words.some((w) => hay(it).includes(w))
      && (!e.colors || colors(it).some((c) => e.colors.includes(c)))
      && (!e.role || roleOf(it.category_id) === e.role));
    return { ...e, match };
  });

  // 3. buchi per stagione × ruolo
  const need = { top: 3, bottom: 2, shoes: 1, outer: 1 };
  const gaps = [];
  if (S) for (const s of ['pri', 'est', 'aut', 'inv']) {
    for (const [role, min] of Object.entries(need)) {
      if (role === 'outer' && s === 'est') continue;
      const n = items.filter((it) => roleOf(it.category_id) === role && (seasons(it).includes(s) || !seasons(it).length)).length;
      if (n < min) gaps.push({
        key: s + role, n, min,
        text: `${n === 0 ? 'Nessun' : 'Solo ' + n} ${ROLE_NAMES[role][n === 1 ? 0 : 1]} per ${SEASON_NAMES[s]}`,
        query: `${ROLE_QUERY[role]} ${SEASON_NAMES[s]}`,
      });
    }
  }
  if (U) U.options.forEach((o) => {
    const n = items.filter((it) => asArray(it.attrs?.[U.id]).includes(o.id)).length;
    if (n < 3) gaps.push({ key: 'u' + o.id, n, min: 3, text: `${n === 0 ? 'Nessun capo' : 'Solo ' + n + (n === 1 ? ' capo' : ' capi')} per «${o.label}»`, query: `outfit ${o.label.toLowerCase()}` });
  });

  // 4. colori
  const colorCount = {};
  items.forEach((it) => colors(it).forEach((c) => { colorCount[c] = (colorCount[c] || 0) + 1; }));
  const dominant = Object.entries(colorCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c);
  const suggestColors = {};
  dominant.forEach((d) => (PAIRS[d] || []).forEach((p) => {
    if ((colorCount[p] || 0) < 2) suggestColors[p] = [...(suggestColors[p] || []), d];
  }));
  const colorIdeas = Object.entries(suggestColors).slice(0, 5).map(([id, withs]) => ({
    color: C?.options.find((o) => o.id === id),
    with: withs.map((w) => C?.options.find((o) => o.id === w)?.label).filter(Boolean),
  })).filter((x) => x.color);

  // 5. da riscoprire (mai indossati o non usati da 60+ giorni, della stagione corrente)
  const cur = currentSeasonId();
  const forgotten = items
    .filter((it) => !seasons(it).length || seasons(it).includes(cur))
    .filter((it) => !lastWorn[it.id] || daysBetween(lastWorn[it.id]) > 60)
    .sort((a, b) => (wear[a.id] || 0) - (wear[b.id] || 0))
    .slice(0, 8);

  return { replace, essentials, gaps, colorIdeas, dominant, forgotten, colorCount };
}

const ROLE_NAMES = { top: ['capo sopra', 'capi sopra'], bottom: ['pantalone', 'pantaloni'], shoes: ['paio di scarpe', 'paia di scarpe'], outer: ['capospalla', 'capispalla'] };
const ROLE_QUERY = { top: 'maglia', bottom: 'pantaloni', shoes: 'scarpe', outer: 'giacca' };

// generatore di outfit: rispetta stagione, uso, evita capi usurati, preferisce ciò che non metti da tempo
export function generateOutfit(store, { season = currentSeasonId(), usage = null, mustInclude = null, seed = Math.random() } = {}) {
  const { items, sys, roleOf, lastWorn } = store;
  const S = sys.season, U = sys.usage, W = sys.wear, C = sys.color;
  let rnd = Math.floor(seed * 2147483646) + 1;
  const rand = () => { rnd = (rnd * 16807) % 2147483647; return (rnd % 10000) / 10000; };

  const ok = (it) => {
    const s = asArray(it.attrs?.[S?.id]);
    if (s.length && !s.includes(season)) return false;
    if (usage) { const u = asArray(it.attrs?.[U?.id]); if (u.length && !u.includes(usage)) return false; }
    if (W && it.attrs?.[W.id] === 'sostituire') return false;
    return true;
  };
  const weight = (it) => {
    const d = lastWorn[it.id] ? Math.min(60, daysBetween(lastWorn[it.id])) : 45;
    return 1 + d / 10 + (it.favorite ? 2 : 0);
  };
  const pick = (cands) => {
    if (!cands.length) return null;
    const tot = cands.reduce((a, c) => a + weight(c), 0);
    let r = rand() * tot;
    for (const c of cands) { r -= weight(c); if (r <= 0) return c; }
    return cands[cands.length - 1];
  };
  const colorsOf = (it) => asArray(it.attrs?.[C?.id]);
  const loud = (it) => colorsOf(it).some((c) => !NEUTRALS.includes(c));

  const byRole = (r) => items.filter((it) => roleOf(it.category_id) === r && ok(it));
  const chosen = [];
  const add = (it) => it && !chosen.includes(it) && chosen.push(it);
  if (mustInclude) add(mustInclude);
  const has = (r) => chosen.some((it) => roleOf(it.category_id) === r);
  const fits = (it) => !(loud(it) && chosen.some(loud)); // max un colore "acceso"

  const fullCands = byRole('full');
  if (!has('full') && !has('top') && !has('bottom') && fullCands.length && rand() < 0.15) add(pick(fullCands.filter(fits)));
  if (!has('full')) {
    if (!has('top')) add(pick(byRole('top').filter(fits)) || pick(byRole('top')));
    if (!has('bottom')) add(pick(byRole('bottom').filter(fits)) || pick(byRole('bottom')));
  }
  if (!has('shoes')) add(pick(byRole('shoes').filter(fits)) || pick(byRole('shoes')));
  if ((season === 'aut' || season === 'inv' || rand() < 0.3) && !has('outer')) add(pick(byRole('outer').filter(fits)));
  if (rand() < 0.4 && !has('accessory')) add(pick(byRole('accessory').filter(fits)));
  return chosen;
}
