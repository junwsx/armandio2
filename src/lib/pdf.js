// Esportazione del guardaroba in PDF (A4), creata nel browser.
// Impaginazione come la griglia dell'app: 3 capi per riga, foto, nome, categoria, attributi con etichette.
import { backend } from './backend.js';
import { asArray, fmtDate } from './utils.js';

const PAGE = { w: 210, h: 297, m: 12 };
const COLS = 3, GAP = 5;
const CARD_W = (PAGE.w - PAGE.m * 2 - GAP * (COLS - 1)) / COLS; // ~58,7 mm
const PHOTO_H = 46;
const PAD = 2.6;
const LABEL_W = 15;

// i font standard dei PDF non hanno emoji né simboli speciali: li tolgo
const clean = (s) => String(s ?? '')
  .replace(/★/g, '*').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...')
  .replace(/[^ -ÿ–—€›]/g, '')
  .replace(/\s+/g, ' ').trim();

const hex = (h) => { const x = (h || '#888888').replace('#', ''); const v = x.length === 3 ? x.split('').map((c) => c + c).join('') : x.padEnd(6, '8'); return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) || 0); };
const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
const WHITE = [255, 255, 255], BLACK = [17, 17, 17];
const INK = [18, 18, 18], MUTED = [138, 138, 133], LINE = [232, 232, 228], PHOTO_BG = [244, 244, 241], ACCENT = [37, 99, 235];

const rating = (v) => { const n = Number(v) || 0; return n ? `${String(n).replace('.', ',')} / 5` : ''; };

// foto → JPEG (i PDF non supportano WebP); sfondo chiaro come nella griglia
async function loadPhoto(path) {
  if (!path) return null;
  try {
    const url = await backend.storage.url(path);
    if (!url) return null;
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    // tela con le stesse proporzioni del riquadro foto della card; il capo è centrato con un margine
    const W = 480, H = Math.round(W * PHOTO_H / (CARD_W - 0.8)), m = 0.07;
    const s = Math.min((W * (1 - 2 * m)) / bmp.width, (H * (1 - 2 * m)) / bmp.height);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = `rgb(${PHOTO_BG.join(',')})`; ctx.fillRect(0, 0, W, H);
    const w = bmp.width * s, h = bmp.height * s;
    ctx.drawImage(bmp, (W - w) / 2, (H - h) / 2, w, h);
    return { data: c.toDataURL('image/jpeg', 0.84), w: W, h: H };
  } catch { return null; }
}

export async function exportPdf(store, opts, onProgress = () => {}) {
  const { jsPDF } = await import('jspdf');
  const { cats, children, pathOf, attrs, data, wear, lastWorn } = store;
  const { title, photos = true, archived = false, onlyGrid = false } = opts;

  const all = data.items.filter((i) => archived || !i.archived);
  const shownAttrs = attrs.filter((a) => !onlyGrid || a.show_in_grid);

  /* ---------- foto ---------- */
  const imgs = {};
  if (photos) {
    let done = 0; const queue = [...all];
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const it = queue.shift();
        imgs[it.id] = await loadPhoto(it.thumb_path || it.photo_path);
        onProgress(++done, all.length);
      }
    }));
  }

  /* ---------- raggruppamento per sezioni ---------- */
  const groups = []; // { root, sub, items }
  const byCat = {};
  all.filter((i) => !i.archived).forEach((i) => { (byCat[i.category_id || 'none'] ||= []).push(i); });
  const sortName = (a, b) => a.name.localeCompare(b.name, 'it');
  const walk = (root, node) => {
    const own = (byCat[node.id] || []).sort(sortName);
    if (own.length) groups.push({ root, sub: node.id === root.id ? null : pathOf(node.id).slice(1).map((c) => c.name).join(' › '), items: own });
    (children[node.id] || []).forEach((ch) => walk(root, ch));
  };
  (children.root || []).forEach((r) => walk(r, r));
  if (byCat.none?.length) groups.push({ root: { id: 'none', name: 'Senza categoria' }, sub: null, items: byCat.none.sort(sortName) });
  const arch = all.filter((i) => i.archived).sort(sortName);
  if (arch.length) groups.push({ root: { id: 'archivio', name: 'Archivio' }, sub: 'Capi che non metti più', items: arch });

  /* ---------- documento ---------- */
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: clean(title), creator: 'Armadio Digitale' });
  const bottom = PAGE.h - PAGE.m - 8;
  let y = PAGE.m;
  const font = (size, style = 'normal', color = INK) => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color); };
  const tw = (s) => doc.getTextWidth(s);

  // intestazione
  font(22, 'bold'); doc.text(clean(title) || 'Il mio armadio', PAGE.m, y + 8);
  font(9.5, 'normal', MUTED);
  const today = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`Esportato il ${today} · ${all.filter((i) => !i.archived).length} capi${arch.length ? ` + ${arch.length} in archivio` : ''}`, PAGE.m, y + 14);
  y += 20;
  // riepilogo per sezione
  const roots = [...new Map(groups.map((g) => [g.root.id, g.root])).values()];
  let x = PAGE.m;
  font(8, 'bold');
  roots.forEach((r) => {
    const n = groups.filter((g) => g.root.id === r.id).reduce((s, g) => s + g.items.length, 0);
    const label = `${clean(r.name)}  ${n}`;
    const w = tw(label) + 6;
    if (x + w > PAGE.w - PAGE.m) { x = PAGE.m; y += 8; }
    doc.setFillColor(...PHOTO_BG); doc.roundedRect(x, y, w, 6, 3, 3, 'F');
    doc.setTextColor(...INK); doc.text(label, x + 3, y + 4.1);
    x += w + 2.5;
  });
  y += 12;

  /* ---------- misura e disegno di una card ---------- */
  const lines = (txt, w, max) => { const l = doc.splitTextToSize(txt, w); return max && l.length > max ? [...l.slice(0, max - 1), l[max - 1].replace(/.{2}$/, '') + '...'] : l; };

  // restituisce { h, draw(x,y) }
  const PH = photos ? PHOTO_H : 0; // senza foto: card compatte
  const layoutCard = (it) => {
    const ops = []; // funzioni di disegno relative (dx, dy)
    let h = PH + PAD;
    const innerW = CARD_W - PAD * 2;
    // nome
    font(9, 'bold');
    const nameL = lines(clean(it.name), innerW, 2);
    const nameY = h + 3.2;
    ops.push((X, Y) => { font(9, 'bold'); doc.text(nameL, X + PAD, Y + nameY, { lineHeightFactor: 1.15 }); });
    h += 3.2 + (nameL.length - 1) * 3.9 + 1.2;
    // categoria
    const path = pathOf(it.category_id);
    if (path.length) {
      font(7.2, 'normal', MUTED);
      const catL = lines(clean(path.slice(-1)[0].name), innerW, 1);
      const cy = h + 2.6;
      ops.push((X, Y) => { font(7.2, 'normal', MUTED); doc.text(catL, X + PAD, Y + cy); });
      h += 3.6;
    }
    // stato speciali
    const meta = [it.favorite ? 'Preferito' : null, wear[it.id] ? `Indossato ${wear[it.id]} ${wear[it.id] === 1 ? 'volta' : 'volte'}${lastWorn[it.id] ? ` · ultima ${fmtDate(lastWorn[it.id], { day: '2-digit', month: '2-digit', year: '2-digit' })}` : ''}` : null].filter(Boolean).join(' · ');
    if (meta) {
      const my = h + 2.4;
      ops.push((X, Y) => { font(6.6, 'normal', it.favorite ? [214, 64, 120] : MUTED); doc.text(lines(meta, innerW, 1), X + PAD, Y + my); });
      h += 3.2;
    }
    // attributi: nome a sinistra, valori a destra (chip che vanno a capo), linea tra un attributo e l'altro
    const rows = shownAttrs.map((a) => ({ a, v: it.attrs?.[a.id] })).filter(({ v }) => !(v == null || v === '' || (Array.isArray(v) && !v.length)));
    if (rows.length) h += 1.4;
    rows.forEach(({ a, v }, idx) => {
      const top = h + (idx ? 1.6 : 0);
      const vx = PAD + LABEL_W, vw = innerW - LABEL_W;
      font(6.2, 'normal', MUTED);
      const labL = lines(clean(a.name), LABEL_W - 1.5, 2);
      let rowH = Math.max(3.8, labL.length * 2.6 + 1.2);
      const chips = []; // {x,y,w,txt,col,swatch}
      if (a.type === 'select' || a.type === 'multiselect') {
        font(6.4, 'bold');
        let cx = 0, cy = 0;
        asArray(v).map((id) => a.options.find((o) => o.id === id)).filter(Boolean).forEach((o) => {
          const txt = clean(o.label); const sw = a.system_key === 'color' ? 2.6 : 0;
          const w = Math.min(vw, tw(txt) + 2.6 + sw);
          if (cx > 0 && cx + w > vw) { cx = 0; cy += 4.2; }
          chips.push({ x: cx, y: cy, w, txt, col: hex(o.color), swatch: !!sw });
          cx += w + 1.2;
        });
        rowH = Math.max(rowH, cy + 3.8);
      } else {
        font(7, 'normal');
        const t = a.type === 'rating' ? rating(v) : a.type === 'boolean' ? (v ? 'Sì' : 'No')
          : a.type === 'date' ? fmtDate(v, { day: '2-digit', month: '2-digit', year: 'numeric' })
          : a.type === 'number' && a.unit === '€' ? `${String(v).replace('.', ',')} €` : `${v}${a.unit && a.type === 'number' ? ' ' + a.unit : ''}`;
        const tl = lines(clean(t), vw, 3);
        chips.push({ text: tl });
        rowH = Math.max(rowH, tl.length * 3 + 0.8);
      }
      ops.push((X, Y) => {
        if (idx) { doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(X + PAD, Y + top - 0.8, X + CARD_W - PAD, Y + top - 0.8); }
        font(6.2, 'normal', MUTED); doc.text(labL, X + PAD, Y + top + 2.7, { lineHeightFactor: 1.2 });
        chips.forEach((c) => {
          if (c.text) { font(7, 'normal', [70, 70, 68]); doc.text(c.text, X + vx, Y + top + 2.8, { lineHeightFactor: 1.25 }); return; }
          const cx0 = X + vx + c.x, cy0 = Y + top + c.y;
          if (c.swatch) {
            doc.setFillColor(...PHOTO_BG); doc.roundedRect(cx0, cy0, c.w, 3.6, 0.9, 0.9, 'F');
            doc.setFillColor(...c.col); doc.setDrawColor(200, 200, 196); doc.setLineWidth(0.15); doc.circle(cx0 + 1.9, cy0 + 1.8, 0.85, 'FD');
            font(6.4, 'bold', [70, 70, 68]); doc.text(c.txt, cx0 + 3.4, cy0 + 2.55);
          } else {
            doc.setFillColor(...mix(c.col, WHITE, 0.85)); doc.roundedRect(cx0, cy0, c.w, 3.6, 0.9, 0.9, 'F');
            font(6.4, 'bold', mix(c.col, BLACK, 0.3)); doc.text(c.txt, cx0 + 1.3, cy0 + 2.55);
          }
        });
      });
      h = top + rowH;
    });
    h += PAD + 0.6;
    return {
      h,
      draw: (X, Y, H) => {
        doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.setFillColor(...WHITE);
        doc.roundedRect(X, Y, CARD_W, H, 2.5, 2.5, 'FD');
        if (!photos) { ops.forEach((fn) => fn(X, Y)); return; }
        // foto
        doc.setFillColor(...PHOTO_BG); doc.roundedRect(X + 0.4, Y + 0.4, CARD_W - 0.8, PHOTO_H - 0.4, 2.2, 2.2, 'F');
        doc.rect(X + 0.4, Y + PHOTO_H - 3, CARD_W - 0.8, 3, 'F');
        const im = imgs[it.id];
        if (im) {
          doc.saveGraphicsState();
          doc.roundedRect(X + 0.4, Y + 0.4, CARD_W - 0.8, PHOTO_H + 2, 2.2, 2.2, null);
          doc.clip(); doc.discardPath();
          doc.addImage(im.data, 'JPEG', X + 0.4, Y + 0.4, CARD_W - 0.8, PHOTO_H - 0.4, undefined, 'FAST');
          doc.restoreGraphicsState();
        } else { font(7, 'normal', MUTED); doc.text('nessuna foto', X + CARD_W / 2, Y + PHOTO_H / 2, { align: 'center' }); }
        ops.forEach((fn) => fn(X, Y));
      },
    };
  };

  /* ---------- sezioni e righe ---------- */
  const newPage = () => { doc.addPage(); y = PAGE.m; };
  let lastRoot = null;
  for (const g of groups) {
    const cards = g.items.map(layoutCard);
    const firstRowH = Math.max(...cards.slice(0, COLS).map((c) => c.h));
    const headH = (g.root.id !== lastRoot ? 11 : 0) + (g.sub ? 7 : 0);
    if (y + headH + firstRowH > bottom) newPage();
    if (g.root.id !== lastRoot) {
      const n = groups.filter((x) => x.root.id === g.root.id).reduce((s, x) => s + x.items.length, 0);
      doc.setFillColor(...INK); doc.roundedRect(PAGE.m, y, PAGE.w - PAGE.m * 2, 8, 2, 2, 'F');
      font(11, 'bold', WHITE); doc.text(clean(g.root.name), PAGE.m + 4, y + 5.6);
      font(8.5, 'normal', [200, 200, 200]); doc.text(`${n} ${n === 1 ? 'capo' : 'capi'}`, PAGE.w - PAGE.m - 4, y + 5.6, { align: 'right' });
      y += 11; lastRoot = g.root.id;
    }
    if (g.sub) {
      font(9.5, 'bold', INK); doc.text(clean(g.sub), PAGE.m, y + 4);
      const subW = tw(clean(g.sub));
      font(8, 'normal', MUTED); doc.text(`${g.items.length}`, PAGE.m + subW + 2, y + 4);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(PAGE.m, y + 5.8, PAGE.w - PAGE.m, y + 5.8);
      y += 8.5;
    }
    for (let i = 0; i < cards.length; i += COLS) {
      const row = cards.slice(i, i + COLS);
      const rh = Math.max(...row.map((c) => c.h));
      if (y + rh > bottom) newPage();
      row.forEach((c, j) => c.draw(PAGE.m + j * (CARD_W + GAP), y, rh));
      y += rh + GAP;
    }
    y += 2;
  }
  if (!groups.length) { font(11, 'normal', MUTED); doc.text('Nessun capo da esportare.', PAGE.m, y + 6); }

  /* ---------- piè di pagina ---------- */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    font(7, 'normal', MUTED);
    doc.text(clean(title), PAGE.m, PAGE.h - 7);
    doc.text(`Pagina ${p} di ${pages}`, PAGE.w - PAGE.m, PAGE.h - 7, { align: 'right' });
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(PAGE.m, PAGE.h - 10, PAGE.w - PAGE.m, PAGE.h - 10);
  }
  const name = `armadio-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(name);
  return { pages, items: all.length, name };
}
