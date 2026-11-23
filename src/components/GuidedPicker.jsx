// Scelta dei capi guidata a sezioni, usata sia per creare gli outfit sia per il calendario.
//   Sezioni («Da dove parti?» / «Che sezione aggiungo?») → una sezione a schermo intero (più capi) → di nuovo le sezioni
//   Filtri (stagione, uso, stato di usura… tutti gli attributi filtrabili + preferiti) validi per tutte le sezioni.
//   Sotto ogni capo: quando è stato indossato l'ultima volta.
import { useEffect, useMemo, useState } from 'react';
import { Search, X, Check, ChevronRight, SlidersHorizontal, Heart } from 'lucide-react';
import { useStore, applyFilter, EMPTY_FILTER } from '../lib/store.jsx';
import { TopBar, Chip, Photo, Empty, Sheet, Swatch } from './ui.jsx';
import { asArray, cx, lastWornText, ratingText } from '../lib/utils.js';

export const SECTIONS = [
  ['top', 'Parte sopra', '👕'],
  ['bottom', 'Parte sotto', '👖'],
  ['full', 'Completo / abito', '🤵'],
  ['outer', 'Capospalla', '🧥'],
  ['shoes', 'Scarpe', '👟'],
  ['accessory', 'Accessori', '🧢'],
  ['other', 'Altro', '📦'],
];

export function useSectionOf() {
  const { roleOf } = useStore();
  return (it) => roleOf(it.category_id) || 'other';
}

const NO_FILTER = { favorites: false, attrs: {} };
const countFilters = (f) => (f.favorites ? 1 : 0) + Object.values(f.attrs).filter((v) => asArray(v).length).length;

export default function GuidedPicker({ title, onBack, selected, onToggle, cta }) {
  const store = useStore();
  const { itemBy, attrBy } = store;
  const sectionOf = useSectionOf();
  const [view, setView] = useState('hub');
  const [f, setF] = useState(NO_FILTER);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  const filtered = useMemo(() => applyFilter(store, { ...EMPTY_FILTER, ...f }), [store, f]);
  const bySection = useMemo(() => {
    const m = {}; filtered.forEach((it) => { (m[sectionOf(it)] ||= []).push(it); }); return m;
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = useMemo(() => { const m = {}; store.items.forEach((it) => { m[sectionOf(it)] = (m[sectionOf(it)] || 0) + 1; }); return m; }, [store.items]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = selected.map((x) => itemBy[x]).filter(Boolean);
  const chosenIn = (k) => chosen.filter((it) => sectionOf(it) === k);
  const sections = SECTIONS.filter(([k]) => total[k] || chosenIn(k).length || !['full', 'other'].includes(k));
  const nf = countFilters(f);

  // chip dei filtri attivi, si tolgono uno per uno
  const activeChips = [];
  if (f.favorites) activeChips.push({ key: 'fav', label: 'Preferiti', remove: () => setF({ ...f, favorites: false }) });
  Object.entries(f.attrs).forEach(([aid, vals]) => {
    const a = attrBy[aid]; if (!a) return;
    asArray(vals).forEach((v) => {
      const label = a.type === 'rating' ? `${a.name} ≥ ${ratingText(v)}` : a.type === 'boolean' ? a.name : a.options.find((o) => o.id === v)?.label;
      if (label) activeChips.push({ key: aid + v, label, remove: () => setF({ ...f, attrs: { ...f.attrs, [aid]: asArray(f.attrs[aid]).filter((x) => x !== v) } }) });
    });
  });
  const filterBar = (
    <div className="gp-filters">
      <button className={cx('chip chip--sm', nf && 'chip--on')} onClick={() => setFiltersOpen(true)}>
        <SlidersHorizontal size={14} />Filtri{nf ? ` · ${nf}` : ''}
      </button>
      {activeChips.map((c) => <Chip small key={c.key} active onClick={c.remove}>{c.label}<X size={12} /></Chip>)}
    </div>
  );
  const filterSheet = filtersOpen && <FilterSheet f={f} setF={setF} onClose={() => setFiltersOpen(false)} count={filtered.length} />;

  /* ---------- una sezione ---------- */
  const sec = SECTIONS.find(([k]) => k === view);
  if (sec) {
    return (
      <>
        <SectionPicker sec={sec} list={bySection[sec[0]] || []} hidden={(total[sec[0]] || 0) - (bySection[sec[0]] || []).length}
          selected={selected} onToggle={onToggle} onDone={() => setView('hub')} filterBar={filterBar} />
        {filterSheet}
      </>
    );
  }

  /* ---------- sezioni ---------- */
  return (
    <div className="page page--builder">
      <TopBar title={title} back={onBack} sub={chosen.length ? `${chosen.length} ${chosen.length === 1 ? 'capo scelto' : 'capi scelti'}` : null} />
      <h2 className="builder-q">{chosen.length ? 'Che sezione aggiungo?' : 'Da dove parti?'}</h2>
      {filterBar}
      <div className="sec-list">
        {sections.map(([k, label, icon]) => {
          const sel = chosenIn(k);
          const avail = (bySection[k] || []).length;
          const tot = total[k] || 0;
          const availText = !tot ? 'nessun capo' : nf ? `${avail} di ${tot} con i filtri` : `${tot} ${tot === 1 ? 'capo' : 'capi'}`;
          return (
            <button key={k} className={cx('sec', sel.length && 'sec--done')} onClick={() => setView(k)}>
              <span className="sec__icon">{icon}</span>
              <span className="grow">
                <b>{label}</b>
                <span className="muted small block">{sel.length ? `${sel.length} ${sel.length === 1 ? 'scelto' : 'scelti'} · ` : ''}{availText}</span>
              </span>
              {sel.length > 0 && <span className="sec__thumbs">{sel.slice(0, 3).map((it) => <Photo key={it.id} path={it.thumb_path || it.photo_path} />)}</span>}
              <ChevronRight size={18} className="muted" />
            </button>
          );
        })}
      </div>
      <div className="form-save">
        <button className="btn btn--primary btn--block btn--lg" disabled={cta.disabled} onClick={cta.onClick}>{cta.label}</button>
      </div>
      {filterSheet}
    </div>
  );
}

/* ---------- capi di una sezione, a schermo intero ---------- */
function SectionPicker({ sec, list, hidden, selected, onToggle, onDone, filterBar }) {
  const [, label, icon] = sec;
  const { pathOf, lastWorn } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(null);
  const cats = useMemo(() => {
    const m = new Map();
    list.forEach((it) => { const leaf = pathOf(it.category_id).slice(-1)[0]; if (leaf) m.set(leaf.id, leaf); });
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [list, pathOf]);
  const shown = list.filter((it) => (!cat || it.category_id === cat) && (!q.trim() || it.name.toLowerCase().includes(q.trim().toLowerCase())));
  const n = list.filter((it) => selected.includes(it.id)).length;
  return (
    <div className="page page--builder">
      <TopBar title={`${icon} ${label}`} back={onDone} sub={n ? `${n} ${n === 1 ? 'scelto' : 'scelti'}` : 'Tocca i capi da aggiungere'} />
      {filterBar}
      {list.length > 6 && (
        <div className="search mb">
          <Search size={18} />
          <input placeholder={`Cerca in ${label.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button className="icon-btn icon-btn--sm" onClick={() => setQ('')} aria-label="Cancella"><X size={16} /></button>}
        </div>
      )}
      {cats.length > 1 && (
        <div className="chips-scroll">
          <Chip small active={!cat} onClick={() => setCat(null)}>Tutti</Chip>
          {cats.map((c) => <Chip small key={c.id} active={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)}>{c.name}</Chip>)}
        </div>
      )}
      {shown.length ? (
        <div className="pick-grid">
          {shown.map((it) => (
            <button key={it.id} className={cx('pick', selected.includes(it.id) && 'pick--on')} onClick={() => onToggle(it.id)}>
              <Photo path={it.thumb_path || it.photo_path} />
              <span className="pick__name">{it.name}</span>
              <span className={cx('pick__worn', !lastWorn[it.id] && 'pick__worn--never')}>{lastWornText(lastWorn[it.id])}</span>
              <span className="pick__check"><Check size={14} strokeWidth={3} /></span>
            </button>
          ))}
        </div>
      ) : (
        <Empty title={list.length || hidden ? 'Nessun capo trovato' : `Nessun capo in «${label}»`}
          text={hidden ? `${hidden} ${hidden === 1 ? 'capo è nascosto' : 'capi sono nascosti'} dai filtri.` : list.length ? 'Prova un\'altra ricerca.' : 'Assegna a una categoria il ruolo giusto in Altro → Categorie.'} />
      )}
      {hidden > 0 && shown.length > 0 && <p className="muted small center pad">{hidden} {hidden === 1 ? 'capo nascosto' : 'capi nascosti'} dai filtri</p>}
      <div className="form-save">
        <button className="btn btn--primary btn--block btn--lg" onClick={onDone}>{n ? `Fatto · ${n} ${n === 1 ? 'scelto' : 'scelti'}` : 'Salta questa sezione'}</button>
      </div>
    </div>
  );
}

/* ---------- filtri: preferiti + ogni attributo filtrabile ---------- */
function FilterSheet({ f, setF, onClose, count }) {
  const { attrs } = useStore();
  const filterable = attrs.filter((a) => a.filterable && ['select', 'multiselect', 'rating', 'boolean'].includes(a.type));
  const toggle = (aid, v, single) => {
    const cur = asArray(f.attrs[aid]);
    const next = single ? (cur[0] === v ? [] : [v]) : cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    setF({ ...f, attrs: { ...f.attrs, [aid]: next } });
  };
  return (
    <Sheet open onClose={onClose} title="Filtri" tall
      footer={<div className="row gap">
        <button className="btn" onClick={() => setF(NO_FILTER)}>Azzera</button>
        <button className="btn btn--primary grow" onClick={onClose}>Mostra {count} {count === 1 ? 'capo' : 'capi'}</button>
      </div>}>
      <p className="muted small">Valgono per tutte le sezioni. I capi già scelti restano scelti.</p>
      <section className="fsec">
        <h4>Preferiti</h4>
        <div className="chips-wrap"><Chip active={f.favorites} onClick={() => setF({ ...f, favorites: !f.favorites })} icon={<Heart size={14} />}>Solo preferiti</Chip></div>
      </section>
      {filterable.map((a) => (
        <section className="fsec" key={a.id}>
          <h4>{a.name}</h4>
          <div className="chips-wrap">
            {a.type === 'rating' && [1, 2, 3, 4, 5].map((n) => (
              <Chip key={n} active={asArray(f.attrs[a.id])[0] === n} onClick={() => toggle(a.id, n, true)}>≥ {'★'.repeat(n)}</Chip>
            ))}
            {a.type === 'boolean' && <Chip active={!!asArray(f.attrs[a.id]).length} onClick={() => toggle(a.id, true, true)}>Sì</Chip>}
            {(a.type === 'select' || a.type === 'multiselect') && a.options.map((o) => (
              <Chip key={o.id} active={asArray(f.attrs[a.id]).includes(o.id)} color={o.color} onClick={() => toggle(a.id, o.id)}
                icon={a.system_key === 'color' ? <Swatch color={o.color} /> : null}>{o.label}</Chip>
            ))}
          </div>
        </section>
      ))}
    </Sheet>
  );
}

/* ---------- capi scelti, divisi per sezione (riepilogo outfit e giorno del calendario) ---------- */
export function ChosenBySection({ ids, onRemove }) {
  const { itemBy, lastWorn } = useStore();
  const sectionOf = useSectionOf();
  const chosen = ids.map((x) => itemBy[x]).filter(Boolean);
  return SECTIONS.map(([k, label, icon]) => {
    const sel = chosen.filter((it) => sectionOf(it) === k);
    if (!sel.length) return null;
    return (
      <section key={k} className="sum-sec">
        <h4 className="sheet-sub">{icon} {label}</h4>
        <div className="pick-grid pick-grid--3">
          {sel.map((it) => (
            <div key={it.id} className="pick pick--static">
              <Photo path={it.thumb_path || it.photo_path} />
              <span className="pick__name">{it.name}</span>
              <span className={cx('pick__worn', !lastWorn[it.id] && 'pick__worn--never')}>{lastWornText(lastWorn[it.id])}</span>
              {onRemove && <button type="button" className="pick__x" onClick={() => onRemove(it.id)} aria-label="Togli"><X size={14} /></button>}
            </div>
          ))}
        </div>
      </section>
    );
  });
}
