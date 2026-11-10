// Dati iniziali usati SOLO dalla modalità demo (in produzione li crea schema.sql)
import { uid } from './utils.js';

export function buildSeed() {
  const cats = [];
  const add = (name, icon, role, parent = null, sort = 0) => {
    const c = { id: uid(), parent_id: parent, name, icon, role, sort, created_at: new Date().toISOString() };
    cats.push(c);
    return c.id;
  };
  const sopra = add('Parte sopra', '👕', 'top', null, 1);
  const sotto = add('Parte sotto', '👖', 'bottom', null, 2);
  const cap = add('Capispalla', '🧥', 'outer', null, 3);
  const scarpe = add('Scarpe', '👟', 'shoes', null, 4);
  const acc = add('Accessori', '🧢', 'accessory', null, 5);
  const sub = {};
  [['Magliette', sopra, 'top'], ['Polo', sopra, 'top'], ['Camicie', sopra, 'top'], ['Felpe', sopra, 'top'], ['Maglioni', sopra, 'top'],
   ['Jeans', sotto, 'bottom'], ['Pantaloni', sotto, 'bottom'], ['Pantaloncini', sotto, 'bottom'], ['Tute', sotto, 'bottom'],
   ['Giacche', cap, 'outer'], ['Giubbotti', cap, 'outer'], ['Cappotti', cap, 'outer'],
   ['Sneakers', scarpe, 'shoes'], ['Eleganti', scarpe, 'shoes'], ['Sportive', scarpe, 'shoes'],
   ['Cappelli', acc, 'accessory'], ['Cinture', acc, 'accessory'], ['Orologi', acc, 'accessory'], ['Borse', acc, 'accessory']]
    .forEach(([n, p, r], i) => { sub[n] = add(n, null, r, p, i); });

  const A = (name, type, system_key, show_in_grid, sort, options = [], unit = null) =>
    ({ id: uid(), name, type, system_key, show_in_grid, filterable: true, sort, options, category_ids: null, unit, created_at: new Date().toISOString() });
  const attrs = [
    A('Stagione', 'multiselect', 'season', true, 1, [
      { id: 'pri', label: 'Primavera', color: '#22a06b' }, { id: 'est', label: 'Estate', color: '#e8a317' },
      { id: 'aut', label: 'Autunno', color: '#d9622b' }, { id: 'inv', label: 'Inverno', color: '#3d7be0' }]),
    A('Uso', 'multiselect', 'usage', true, 2, [
      { id: 'giorno', label: 'Tutti i giorni', color: '#6b7280' }, { id: 'lavoro', label: 'Lavoro', color: '#5b5bd6' },
      { id: 'uscita', label: 'Uscita', color: '#d6409f' }, { id: 'sport', label: 'Sport', color: '#12a594' }]),
    A('Stato di usura', 'select', 'wear', false, 3, [
      { id: 'nuovo', label: 'Nuovo', color: '#22a06b' }, { id: 'ottimo', label: 'Ottimo', color: '#4cb782' },
      { id: 'buono', label: 'Buono', color: '#e8a317' }, { id: 'usurato', label: 'Usurato', color: '#d9622b' },
      { id: 'sostituire', label: 'Da sostituire', color: '#e5484d' }]),
    A('Colore', 'multiselect', 'color', false, 4, [
      ['bianco', 'Bianco', '#ffffff'], ['nero', 'Nero', '#111111'], ['grigio', 'Grigio', '#9ca3af'], ['blu', 'Blu', '#2f5bd3'],
      ['navy', 'Blu navy', '#1e2a4a'], ['azzurro', 'Azzurro', '#8ec5ff'], ['beige', 'Beige', '#d8c3a0'], ['marrone', 'Marrone', '#7a4e2d'],
      ['verde', 'Verde', '#4d7c4f'], ['rosso', 'Rosso', '#d33a3a'], ['giallo', 'Giallo', '#f2c94c'], ['rosa', 'Rosa', '#f1a7c1'],
      ['viola', 'Viola', '#7c5cbf'], ['arancione', 'Arancione', '#f08a3c'], ['fantasia', 'Fantasia', '#c084fc'],
    ].map(([id, label, color]) => ({ id, label, color }))),
    A('Taglia', 'text', 'size', false, 5),
    A('Marca', 'text', 'brand', false, 6),
    A('Data di acquisto', 'date', 'purchase_date', false, 7),
    A('Prezzo', 'number', 'price', false, 8, [], '€'),
    A('Gradimento', 'rating', 'rating', false, 9),
  ];
  const k = Object.fromEntries(attrs.map((a) => [a.system_key, a.id]));

  const it = (name, cat, a, extra = {}) => ({
    id: uid(), name, slug: null, category_id: sub[cat], photo_path: null, thumb_path: null,
    favorite: !!extra.fav, archived: false, notes: null,
    attrs: {
      [k.season]: a.s, [k.usage]: a.u, [k.wear]: a.w, [k.color]: a.c,
      [k.size]: a.t, [k.brand]: a.b, [k.purchase_date]: a.d, [k.price]: a.p, [k.rating]: a.r,
    },
    created_at: new Date(Date.now() - Math.random() * 3e9).toISOString(), updated_at: new Date().toISOString(),
  });
  const items = [
    it('T-shirt bianca basic', 'Magliette', { s: ['pri', 'est'], u: ['giorno'], w: 'ottimo', c: ['bianco'], t: 'M', b: 'Uniqlo', d: '2024-06-12', p: 15, r: 5 }, { fav: true }),
    it('Polo blu navy', 'Polo', { s: ['pri', 'est'], u: ['lavoro', 'uscita'], w: 'buono', c: ['navy'], t: 'M', b: 'Ralph Lauren', d: '2023-05-02', p: 89, r: 4 }),
    it('Jeans blu denim', 'Jeans', { s: ['aut', 'inv', 'pri'], u: ['giorno', 'uscita'], w: 'buono', c: ['blu'], t: '32', b: "Levi's", d: '2023-09-10', p: 110, r: 5 }, { fav: true }),
    it('Felpa grigio melange', 'Felpe', { s: ['aut', 'inv'], u: ['giorno', 'sport'], w: 'usurato', c: ['grigio'], t: 'L', b: 'Champion', d: '2022-10-18', p: 55, r: 3 }),
    it('Giacca leggera beige', 'Giacche', { s: ['pri', 'aut'], u: ['uscita'], w: 'ottimo', c: ['beige'], t: 'L', b: 'Zara', d: '2024-04-01', p: 79, r: 4 }),
    it('Chino beige', 'Pantaloni', { s: ['pri', 'est'], u: ['lavoro'], w: 'ottimo', c: ['beige'], t: '32', b: 'Dockers', d: '2024-03-20', p: 69, r: 4 }),
    it('Maglione nero lana', 'Maglioni', { s: ['inv'], u: ['lavoro', 'uscita'], w: 'buono', c: ['nero'], t: 'M', b: 'COS', d: '2023-11-15', p: 95, r: 5 }),
    it('Sneakers bianche', 'Sneakers', { s: ['pri', 'est', 'aut'], u: ['giorno', 'uscita'], w: 'sostituire', c: ['bianco'], t: '43', b: 'Veja', d: '2022-07-05', p: 120, r: 5 }, { fav: true }),
    it('Camicia oxford azzurra', 'Camicie', { s: ['pri', 'aut', 'inv'], u: ['lavoro'], w: 'ottimo', c: ['azzurro'], t: 'M', b: 'Brooks Brothers', d: '2024-01-22', p: 85, r: 4 }),
    it('Pantaloncini sportivi', 'Pantaloncini', { s: ['est'], u: ['sport'], w: 'buono', c: ['nero'], t: 'M', b: 'Nike', d: '2024-05-30', p: 30, r: 3 }),
  ];

  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const outfits = [
    { id: uid(), name: 'Casual estivo', item_ids: [items[0].id, items[5].id, items[7].id], tags: ['Casual'], favorite: true, notes: null, created_at: new Date().toISOString() },
    { id: uid(), name: 'Ufficio', item_ids: [items[8].id, items[5].id, items[7].id], tags: ['Lavoro'], favorite: false, notes: null, created_at: new Date().toISOString() },
    { id: uid(), name: 'Sera d\'inverno', item_ids: [items[6].id, items[2].id, items[4].id], tags: ['Uscita'], favorite: false, notes: null, created_at: new Date().toISOString() },
  ];
  const logs = [];
  for (let i = 1; i < 25; i += 2) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const o = outfits[i % 3];
    logs.push({ id: uid(), worn_on: iso(d), outfit_id: o.id, item_ids: o.item_ids, note: null, created_at: new Date().toISOString() });
  }

  return {
    categories: cats,
    attributes: attrs,
    items,
    outfits,
    wear_logs: logs,
    saved_filters: [],
    wishlist: [],
    settings: [{ key: 'grid', value: { showName: true, showCategory: true, showPath: false, attributeIds: null, columns: 2 } }],
  };
}
