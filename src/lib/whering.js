// Importazione dall'export di Whering (ZIP con whering-capi.json, whering-outfit.json, foto/<id>.webp)

/* ---------------- lettura ZIP (store + deflate) ---------------- */
export async function readZip(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  let e = buf.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('Il file non sembra uno ZIP valido');
  const n = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const dec = new TextDecoder();
  const files = {};
  for (let i = 0; i < n; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + elen + clen;
    if (name.endsWith('/')) continue;
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    files[name.replace(/\\/g, '/')] = { method, raw: buf.subarray(start, start + csize) };
  }
  return files;
}

export async function unzipEntry(entry) {
  if (entry.method === 0) return entry.raw;
  if (entry.method === 8) {
    const ds = new DecompressionStream('deflate-raw');
    return new Uint8Array(await new Response(new Blob([entry.raw]).stream().pipeThrough(ds)).arrayBuffer());
  }
  throw new Error('Compressione ZIP non supportata');
}

const find = (files, suffix) => Object.keys(files).find((k) => k.toLowerCase().endsWith(suffix.toLowerCase()));

export async function loadWheringZip(file) {
  const files = await readZip(file);
  const kp = find(files, 'whering-capi.json');
  if (!kp) throw new Error('Nello ZIP non trovo «whering-capi.json». Usa il file esportato da Whering.');
  const json = (k) => unzipEntry(files[k]).then((u) => JSON.parse(new TextDecoder().decode(u)));
  const pieces = (await json(kp)).pieces || [];
  const ko = find(files, 'whering-outfit.json');
  const outfits = ko ? (await json(ko)).outfits || [] : [];
  const photo = async (id) => {
    const k = find(files, `foto/${id}.webp`) || find(files, `${id}.webp`) || find(files, `${id}.png`);
    if (!k) return null;
    const u = await unzipEntry(files[k]);
    return new Blob([u], { type: k.endsWith('.png') ? 'image/png' : 'image/webp' });
  };
  return { pieces, outfits, photo };
}

/* ---------------- mappature ---------------- */
// tipo Whering → [nome categoria, ruolo, nome del capo]
const TYPES = {
  'trouser-pants': ['Pantaloni', 'bottom', 'Pantaloni'],
  jeans: ['Jeans', 'bottom', 'Jeans'],
  sweatpants: ['Tute', 'bottom', 'Pantaloni tuta'],
  shorts: ['Pantaloncini', 'bottom', 'Pantaloncini'],
  jumper: ['Maglioni', 'top', 'Maglione'],
  cardigan: ['Maglioni', 'top', 'Cardigan'],
  tshirt: ['Magliette', 'top', 'T-shirt'],
  polo: ['Polo', 'top', 'Polo'],
  sweatshirt: ['Felpe', 'top', 'Felpa'],
  hoodie: ['Felpe', 'top', 'Felpa con cappuccio'],
  shirt: ['Camicie', 'top', 'Camicia'],
  'short-sleeved-shirt': ['Camicie', 'top', 'Camicia a maniche corte'],
  'goose-down': ['Giubbotti', 'outer', 'Piumino'],
  pufferjacket: ['Giubbotti', 'outer', 'Piumino'],
  bomberjacket: ['Giubbotti', 'outer', 'Bomber'],
  coat: ['Cappotti', 'outer', 'Cappotto'],
  denimjacket: ['Giacche', 'outer', 'Giacca di jeans'],
  jacket: ['Giacche', 'outer', 'Giacca'],
  blazer: ['Giacche', 'outer', 'Blazer'],
  sneakers: ['Sneakers', 'shoes', 'Sneakers'],
  trainers: ['Sneakers', 'shoes', 'Sneakers'],
  boots: ['Scarpe', 'shoes', 'Stivaletti'],
  cap: ['Cappelli', 'accessory', 'Cappello'],
  belt: ['Cinture', 'accessory', 'Cintura'],
};

export function typeOf(p) {
  const tax = p.tax || '';
  const sub = p.piece_subcategory || '';
  const cols = (p.colours || []).map((c) => c.id);
  if (tax === 'trouser-pants' && (sub === 'jeans' || cols.includes('denim'))) return TYPES.jeans;
  if (tax === 'trouser-pants' && sub === 'sweatpants') return TYPES.sweatpants;
  if (tax === 'tshirt' && sub === 'polo-shirt') return TYPES.polo;
  if (tax === 'jumper' && sub === 'cardigan') return TYPES.cardigan;
  return TYPES[tax] || ['Altro', null, (tax || 'Capo').replace(/-/g, ' ').replace(/^\w/, (m) => m.toUpperCase())];
}

// colore Whering → id opzione dell'attributo Colore (o nuova opzione)
const COLORS = {
  navy: 'navy', blue: 'blu', denim: 'blu', white: 'bianco', black: 'nero', grey: 'grigio', gray: 'grigio',
  beige: 'beige', brown: 'marrone', green: 'verde', 'emerald-green': 'verde', 'light-green': 'verde', olive: 'verde',
  multicolor: 'fantasia', purple: 'viola', 'baby-blue': 'azzurro', 'light-blue': 'azzurro', orange: 'arancione',
  coral: 'arancione', copper: 'arancione', red: 'rosso', yellow: 'giallo', mustard: 'giallo', pink: 'rosa', 'light-pink': 'rosa',
};
const NEW_COLORS = { ecru: ['Écru', '#EFE6D2'], khaki: ['Kaki', '#8A8456'], bordeaux: ['Bordeaux', '#6D1A2B'], turquoise: ['Turchese', '#2FB5B0'] };

const SEASONS = { spring: ['pri'], summer: ['est'], autumn: ['aut'], fall: ['aut'], winter: ['inv'], all_year_round: ['pri', 'est', 'aut', 'inv'] };

const WEAR = (s) => {
  const t = (s || '').toLowerCase();
  if (/nuovo|ottim/.test(t)) return 'ottimo';
  if (/met|diciamo|buon/.test(t)) return 'buono';
  if (/consum|vecch|piccol|rovinat/.test(t)) return 'usurato';
  return null;
};

const USAGE = {
  lavoro: ['work', 'office', 'business', 'meeting'],
  sport: ['gym', 'sport', 'workout', 'running', 'hiking', 'yoga'],
  uscita: ['dating', 'date-lunch', 'date-night', 'party', 'night-out', 'wedding', 'dinner', 'drinks', 'cinema', 'meet-up'],
  giorno: ['casual', 'everyday-errands', 'wfh', 'night-in', 'travel', 'weekend'],
};

const STYLES = {
  casual: 'Casual', chic: 'Chic', minimal: 'Minimal', classic: 'Classico', sporty: 'Sportivo', street: 'Street',
  'loungewear-comfies': 'Comodo', 'modern-urban': 'Urban', utilitarian: 'Utility', elegant: 'Elegante', sophisticated: 'Sofisticato',
  boho: 'Boho', vintage: 'Vintage', preppy: 'Preppy',
};
const STYLE_COLORS = ['#6b7280', '#d6409f', '#111111', '#7a4e2d', '#12a594', '#5b5bd6', '#e8a317', '#3d7be0', '#4d7c4f', '#7c5cbf', '#d9622b'];

const cap = (s) => s.replace(/-/g, ' ').replace(/^\w/, (m) => m.toUpperCase());

/* ---------------- analisi (anteprima) ---------------- */
export function preview(pieces, outfits) {
  const byCat = {};
  pieces.forEach((p) => { const [c] = typeOf(p); byCat[c] = (byCat[c] || 0) + 1; });
  return {
    pieces: pieces.length,
    outfits: outfits.length,
    categories: Object.entries(byCat).sort((a, b) => b[1] - a[1]),
    withWear: pieces.filter((p) => (p.statuses || []).some(WEAR)).length,
    withBrand: pieces.filter((p) => p.brand).length,
  };
}

/* ---------------- importazione ---------------- */
// api: { cats, attrs, sys, saveCategory, saveAttribute, insert(table,row), upload(path,blob), prepare(blob,transparent), getMap(), setMap(map) }
export async function importWhering(data, api, { withOutfits = true, onProgress = () => {} } = {}) {
  const { pieces, outfits, photo } = data;
  const map = { ...(api.getMap() || {}) }; // wheringId -> itemId
  const log = { created: 0, skipped: 0, errors: [] };

  /* 1. categorie */
  const cats = [...api.cats];
  const findCat = (name) => cats.find((c) => c.name.toLowerCase() === name.toLowerCase());
  const rootFor = (role) => cats.find((c) => !c.parent_id && c.role === role);
  const ensureCat = async (name, role) => {
    let c = findCat(name);
    if (c) return c.id;
    const parent = role ? rootFor(role) : null;
    c = await api.saveCategory({ name, role, parent_id: parent?.id || null, icon: parent ? null : '📦', sort: 99 });
    cats.push(c);
    return c.id;
  };

  /* 2. attributi: colore (nuove opzioni) e stile (nuovo attributo) */
  const sys = api.sys;
  let colorAttr = sys.color;
  if (colorAttr) {
    const needed = new Set(pieces.flatMap((p) => (p.colours || []).map((c) => c.id)).filter((id) => !COLORS[id]));
    const opts = [...colorAttr.options];
    needed.forEach((id) => {
      const [label, hex] = NEW_COLORS[id] || [cap(id), (pieces.flatMap((p) => p.colours || []).find((c) => c.id === id)?.hexCode) || '#999999'];
      if (!opts.some((o) => o.id === id || o.label.toLowerCase() === label.toLowerCase())) opts.push({ id, label, color: hex });
    });
    if (opts.length !== colorAttr.options.length) colorAttr = await api.saveAttribute({ ...colorAttr, options: opts });
  }
  const colorId = (wid) => {
    if (COLORS[wid]) return COLORS[wid];
    const lbl = (NEW_COLORS[wid]?.[0] || cap(wid)).toLowerCase();
    return colorAttr?.options.find((o) => o.id === wid || o.label.toLowerCase() === lbl)?.id || null;
  };

  const styleAttr = null; // attributo «Stile» non importato (scelta di Ciro)

  /* 3. capi (categorie create prima, una alla volta, per non duplicarle) */
  const catIds = {};
  for (const p of pieces) { const [n, r] = typeOf(p); if (!catIds[n]) catIds[n] = await ensureCat(n, r); }
  const total = pieces.length;
  let done = 0;
  const work = pieces.map((p) => async () => {
    try {
      if (map[p.id]) { log.skipped++; return; }
      const [catName, role, typeName] = typeOf(p);
      const category_id = catIds[catName] || await ensureCat(catName, role);
      const cols = [...new Set((p.colours || []).map((c) => colorId(c.id)).filter(Boolean))];
      const firstColor = colorAttr?.options.find((o) => o.id === cols[0])?.label;
      const name = [typeName, firstColor?.toLowerCase()].filter(Boolean).join(' ');

      const attrs = {};
      if (sys.season) { const s = [...new Set((p.season || []).flatMap((x) => SEASONS[x] || []))]; if (s.length) attrs[sys.season.id] = s; }
      if (sys.usage) {
        const occ = p.occasions || [];
        const u = Object.entries(USAGE).filter(([, words]) => occ.some((o) => words.includes(o))).map(([k]) => k);
        if (u.length) attrs[sys.usage.id] = u;
      }
      if (sys.wear) { const w = (p.statuses || []).map(WEAR).find(Boolean); if (w) attrs[sys.wear.id] = w; }
      if (sys.color && cols.length) attrs[sys.color.id] = cols;
      if (sys.brand && p.brand) attrs[sys.brand.id] = p.brand.trim();
      if (sys.size) { const s = (p.size || []).map((x) => x.size).filter(Boolean).join(', '); if (s) attrs[sys.size.id] = s; }
      if (sys.price && p.price) attrs[sys.price.id] = Number(p.price) || null;
      if (styleAttr && p.styles?.length) attrs[styleAttr.id] = p.styles.filter((s) => styleAttr.options.some((o) => o.id === s));

      let photo_path = null, thumb_path = null;
      const blob = await photo(p.id);
      if (blob) {
        const { full, thumb } = await api.prepare(blob, true);
        const key = `whering/${p.id}`;
        const ext = full.type === 'image/jpeg' ? 'jpg' : 'webp';
        [photo_path, thumb_path] = await Promise.all([api.upload(`items/${key}.${ext}`, full), api.upload(`items/${key}_t.${ext}`, thumb)]);
      }
      const ms = p.date_added || p.created_at;
      const item = await api.insert('items', {
        name, slug: null, category_id, photo_path, thumb_path, favorite: !!p.is_favorite, archived: !!p.archived,
        attrs, notes: p.comments || null, ...(ms ? { created_at: new Date(ms).toISOString() } : {}),
      });
      map[p.id] = item.id;
      log.created++;
    } catch (e) {
      log.errors.push(`${p.id}: ${e.message}`);
    } finally {
      done++;
      onProgress({ done, total, phase: 'capi' });
      if (done % 10 === 0) await api.setMap(map);
    }
  });
  // 3 alla volta
  const queue = [...work];
  await Promise.all(Array.from({ length: 3 }, async () => { while (queue.length) await queue.shift()(); }));
  await api.setMap(map);

  /* 4. outfit */
  let outfitsCreated = 0;
  if (withOutfits && outfits.length) {
    const doneOutfits = new Set(api.getMap()?.__outfits || []);
    for (const [i, o] of outfits.entries()) {
      if (doneOutfits.has(o.id)) continue;
      const ids = (o.piece_ids || (o.pieces || []).map((x) => x.id)).map((w) => map[w]).filter(Boolean);
      if (!ids.length) continue;
      try {
        await api.insert('outfits', {
          name: o.name || `Outfit Whering ${i + 1}`, item_ids: ids, tags: ['Whering'], favorite: !!o.is_favorite,
          notes: o.comments || null, ...(o.created_at ? { created_at: new Date(o.created_at).toISOString() } : {}),
        });
        doneOutfits.add(o.id); outfitsCreated++;
      } catch (e) { log.errors.push(`outfit ${o.id}: ${e.message}`); }
      onProgress({ done: i + 1, total: outfits.length, phase: 'outfit' });
    }
    map.__outfits = [...doneOutfits];
    await api.setMap(map);
  }
  return { ...log, outfits: outfitsCreated };
}
