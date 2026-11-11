import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, Heart, Plus, X, Bookmark, ChevronRight, Shirt, Archive, ListChecks, Pencil } from 'lucide-react';
import BulkEdit from '../components/BulkEdit.jsx';
import { useStore, applyFilter, EMPTY_FILTER, filterCount, SORTS } from '../lib/store.jsx';
import ItemCard from '../components/ItemCard.jsx';
import { Chip, Sheet, Empty, Swatch, Stars, Field } from '../components/ui.jsx';
import { asArray, cx } from '../lib/utils.js';
import { usePersonal } from '../lib/personal.js';
import { PhraseBanner } from '../components/personal.jsx';

const KEY = 'armadio-filter';
const loadF = () => { try { return { ...EMPTY_FILTER, ...JSON.parse(sessionStorage.getItem(KEY)) }; } catch { return EMPTY_FILTER; } };

export default function Wardrobe() {
  const store = useStore();
  const { children, catById, pathOf, attrs, data, isAdmin, saveFilter, deleteFilter, grid } = store;
  const personal = usePersonal();
  const [f, setF] = useState(loadF);
  const [showSearch, setShowSearch] = useState(!!f.q);
  const [sheet, setSheet] = useState(false);
  const [activeSaved, setActiveSaved] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(f)); } catch { /* */ } }, [f]);

  const list = useMemo(() => applyFilter(store, f), [store, f]);
  const roots = children.root || [];
  const sel = f.categoryId ? catById[f.categoryId] : null;
  const selPath = sel ? pathOf(sel.id) : [];
  const subs = sel ? (children[sel.id] || []) : [];
  const siblingsParent = sel && !subs.length ? sel.parent_id : null;
  const subRow = subs.length ? subs : siblingsParent ? (children[siblingsParent] || []) : [];
  const subRowParent = subs.length ? sel : siblingsParent ? catById[siblingsParent] : null;
  const pinned = (data.saved_filters || []).filter((s) => s.pinned).sort((a, b) => a.sort - b.sort);
  const nActive = filterCount(f);
  const nArchived = store.archivedItems.length;
  const selectedItems = list.filter((it) => selected.has(it.id));
  const toggleSel = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const stopSelecting = () => { setSelecting(false); setSelected(new Set()); };

  const set = (patch) => { setActiveSaved(null); setF((x) => ({ ...x, ...patch })); };
  const applySaved = (s) => {
    if (activeSaved === s.id) { setActiveSaved(null); setF({ ...EMPTY_FILTER, q: f.q }); return; }
    setActiveSaved(s.id); setF({ ...EMPTY_FILTER, ...s.filter, q: f.q });
  };

  const activeChips = [];
  Object.entries(f.attrs || {}).forEach(([aid, vals]) => {
    const a = store.attrBy[aid]; if (!a) return;
    asArray(vals).forEach((v) => {
      const label = a.type === 'rating' ? `${a.name} ≥ ${'★'.repeat(v)}` : a.type === 'boolean' ? a.name : a.options.find((o) => o.id === v)?.label;
      if (label) activeChips.push({ key: aid + v, label, remove: () => set({ attrs: { ...f.attrs, [aid]: asArray(f.attrs[aid]).filter((x) => x !== v) } }) });
    });
  });

  return (
    <div className="page page--wardrobe">
      <header className="hero">
        <div className="hero__row">
          <div>
            <h1 className="hero__title">{personal.title}</h1>
            <p className="hero__sub">Ciao {personal.me} {personal.isViewer ? '💛' : '👋'} · {list.length} {list.length === 1 ? 'capo' : 'capi'}{sel ? ` · ${selPath.map((c) => c.name).join(' › ')}` : ''}</p>
          </div>
          <div className="hero__actions">
            <button className={cx('icon-btn icon-btn--soft', showSearch && 'on')} onClick={() => { setShowSearch(!showSearch); if (showSearch) set({ q: '' }); }} aria-label="Cerca">
              {showSearch ? <X size={20} /> : <Search size={20} />}
            </button>
            {isAdmin && (
              <button className={cx('icon-btn icon-btn--soft', selecting && 'on')} onClick={() => (selecting ? stopSelecting() : setSelecting(true))} aria-label="Seleziona più capi">
                {selecting ? <X size={20} /> : <ListChecks size={20} />}
              </button>
            )}
            <button className="icon-btn icon-btn--soft" onClick={() => setSheet(true)} aria-label="Filtri">
              <SlidersHorizontal size={20} />
              {nActive > 0 && <span className="dot-count">{nActive}</span>}
            </button>
          </div>
        </div>
        {showSearch && (
          <div className="search">
            <Search size={18} />
            <input autoFocus placeholder="Cerca per nome, marca, colore…" value={f.q} onChange={(e) => set({ q: e.target.value })} />
          </div>
        )}
      </header>
      <PhraseBanner />

      <div className="sticky-filters">
        <div className="chips-scroll">
          <Chip active={!f.categoryId && !f.favorites && !nActive && !activeSaved && !f.archived} onClick={() => { setActiveSaved(null); setF({ ...EMPTY_FILTER, q: f.q, sort: f.sort }); }}>Tutti</Chip>
          <Chip active={f.favorites && !activeSaved} onClick={() => set({ favorites: !f.favorites })} icon={<Heart size={14} fill={f.favorites ? 'currentColor' : 'none'} />}>Preferiti</Chip>
          {pinned.map((s) => (
            <Chip key={s.id} active={activeSaved === s.id} onClick={() => applySaved(s)} icon={<Bookmark size={14} />} className="chip--saved">{s.name}</Chip>
          ))}
          <span className="chips-sep" />
          {roots.map((c) => (
            <Chip key={c.id} active={selPath[0]?.id === c.id} onClick={() => set({ categoryId: selPath[0]?.id === c.id ? null : c.id })}>
              {c.icon && <span className="emoji">{c.icon}</span>}{c.name}
            </Chip>
          ))}
          {(nArchived > 0 || f.archived) && <>
            <span className="chips-sep" />
            <Chip active={f.archived} onClick={() => { set({ archived: !f.archived }); setSelected(new Set()); }} icon={<Archive size={14} />}>Archivio · {nArchived}</Chip>
          </>}
        </div>
        {subRow.length > 0 && (
          <div className="chips-scroll chips-scroll--sub">
            <Chip small active={sel?.id === subRowParent?.id} onClick={() => set({ categoryId: subRowParent.id })}>Tutti · {subRowParent?.name}</Chip>
            {subRow.map((c) => (
              <Chip small key={c.id} active={selPath.some((p) => p.id === c.id)} onClick={() => set({ categoryId: c.id })}>
                {c.name}{(children[c.id] || []).length > 0 && <ChevronRight size={12} />}
              </Chip>
            ))}
          </div>
        )}
        {activeChips.length > 0 && (
          <div className="chips-scroll chips-scroll--sub">
            {activeChips.map((c) => <Chip small key={c.key} active onClick={c.remove}>{c.label}<X size={12} /></Chip>)}
            <button className="link-btn" onClick={() => set({ attrs: {}, favorites: false })}>Azzera</button>
          </div>
        )}
      </div>

      {f.archived && (
        <div className="archived-note"><Archive size={16} /><span>Stai guardando l'<b>archivio</b>: capi che non metti più. Non compaiono nell'armadio, nelle idee e nelle statistiche.</span>
          <button className="link-btn" onClick={() => set({ archived: false })}>Esci</button></div>
      )}
      {list.length ? (
        <div className={cx('grid', `grid--${grid.columns || 2}`, selecting && 'grid--selecting')}>
          {list.map((it) => <ItemCard key={it.id} item={it} selecting={selecting} selected={selected.has(it.id)} onToggle={toggleSel} />)}
          {isAdmin && !selecting && !f.archived && (
            <Link to="/capo/nuovo" className="card card--add">
              <span className="card--add__icon"><Plus size={22} /></span>
              <span>Aggiungi un capo</span>
            </Link>
          )}
        </div>
      ) : (
        <Empty icon={f.archived ? <Archive size={28} /> : <Shirt size={28} />}
          title={f.archived ? 'L\'archivio è vuoto' : store.items.length ? 'Nessun capo con questi filtri' : 'Il tuo armadio è vuoto'}
          text={store.items.length ? 'Prova a togliere qualche filtro.' : isAdmin ? 'Aggiungi il primo capo con una foto.' : 'L\'amministratore non ha ancora aggiunto capi.'}
          action={isAdmin && !store.items.length ? <Link className="btn btn--primary" to="/capo/nuovo"><Plus size={18} />Aggiungi capo</Link> : store.items.length ? <button className="btn" onClick={() => setF({ ...EMPTY_FILTER })}>Azzera filtri</button> : null} />
      )}

      {isAdmin && !selecting && !f.archived && <Link to="/capo/nuovo" className="fab" aria-label="Nuovo capo"><Plus size={26} /></Link>}

      {selecting && (
        <div className="select-bar">
          <button className="icon-btn icon-btn--sm" onClick={stopSelecting} aria-label="Annulla selezione"><X size={18} /></button>
          <span className="grow"><b>{selectedItems.length}</b> {selectedItems.length === 1 ? 'selezionato' : 'selezionati'}</span>
          <button className="link-btn" onClick={() => setSelected(selectedItems.length === list.length ? new Set() : new Set(list.map((i) => i.id)))}>
            {selectedItems.length === list.length && list.length ? 'Nessuno' : `Tutti (${list.length})`}
          </button>
          <button className="btn btn--primary" disabled={!selectedItems.length} onClick={() => setBulkOpen(true)}><Pencil size={16} />Modifica</button>
        </div>
      )}
      <BulkEdit open={bulkOpen} onClose={() => setBulkOpen(false)} items={selectedItems} inArchive={f.archived}
        onDone={() => { setBulkOpen(false); stopSelecting(); }} />

      <FilterSheet open={sheet} onClose={() => setSheet(false)} f={f} set={set} attrs={attrs} isAdmin={isAdmin}
        count={list.length} onSave={async (name) => { await saveFilter({ name, filter: { ...f, q: '' }, pinned: true, sort: pinned.length }); }}
        saved={data.saved_filters} onDeleteSaved={deleteFilter} onReset={() => setF({ ...EMPTY_FILTER, q: f.q })} />
    </div>
  );
}

function FilterSheet({ open, onClose, f, set, attrs, isAdmin, count, onSave, onReset }) {
  const [name, setName] = useState('');
  const [naming, setNaming] = useState(false);
  const filterable = attrs.filter((a) => a.filterable && ['select', 'multiselect', 'rating', 'boolean'].includes(a.type));
  const toggle = (aid, v, single) => {
    const cur = asArray(f.attrs?.[aid]);
    const next = single ? (cur[0] === v ? [] : [v]) : cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    set({ attrs: { ...f.attrs, [aid]: next } });
  };
  return (
    <Sheet open={open} onClose={onClose} title="Filtri e ordinamento" tall
      footer={
        <div className="row gap">
          <button className="btn" onClick={onReset}>Azzera</button>
          <button className="btn btn--primary grow" onClick={onClose}>Mostra {count} {count === 1 ? 'capo' : 'capi'}</button>
        </div>
      }>
      <section className="fsec">
        <h4>Ordina per</h4>
        <select className="input" value={f.sort} onChange={(e) => set({ sort: e.target.value })}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </section>
      <section className="fsec">
        <h4>Preferiti</h4>
        <div className="chips-wrap"><Chip active={f.favorites} onClick={() => set({ favorites: !f.favorites })} icon={<Heart size={14} />}>Solo preferiti</Chip></div>
      </section>
      {filterable.map((a) => (
        <section className="fsec" key={a.id}>
          <h4>{a.name}</h4>
          <div className="chips-wrap">
            {a.type === 'rating' && [1, 2, 3, 4, 5].map((n) => (
              <Chip key={n} active={asArray(f.attrs?.[a.id])[0] === n} onClick={() => toggle(a.id, n, true)}>≥ {'★'.repeat(n)}</Chip>
            ))}
            {a.type === 'boolean' && <Chip active={!!asArray(f.attrs?.[a.id]).length} onClick={() => toggle(a.id, true, true)}>Sì</Chip>}
            {(a.type === 'select' || a.type === 'multiselect') && a.options.map((o) => (
              <Chip key={o.id} active={asArray(f.attrs?.[a.id]).includes(o.id)} color={o.color} onClick={() => toggle(a.id, o.id)}
                icon={a.system_key === 'color' ? <Swatch color={o.color} /> : null}>{o.label}</Chip>
            ))}
          </div>
        </section>
      ))}
      {isAdmin && (
        <section className="fsec fsec--save">
          <h4>Filtro fisso</h4>
          {naming ? (
            <div className="row gap">
              <input className="input grow" autoFocus placeholder="Es. Lavoro invernale" value={name} onChange={(e) => setName(e.target.value)} />
              <button className="btn btn--primary" disabled={!name.trim()} onClick={async () => { await onSave(name.trim()); setName(''); setNaming(false); }}>Salva</button>
            </div>
          ) : (
            <button className="btn btn--block" onClick={() => setNaming(true)}><Bookmark size={16} />Salva questi filtri come scorciatoia</button>
          )}
          <p className="field__hint">Diventa un chip fisso in cima alla griglia. Include categoria, preferiti, attributi e ordinamento.</p>
        </section>
      )}
    </Sheet>
  );
}

export { Field, Stars };
