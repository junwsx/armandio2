import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderTree, Tags, LayoutGrid, Bookmark, Palette, User, Download, ChevronRight, Plus, Trash2, ArrowUp, ArrowDown,
  GripVertical, LogOut, Search, RotateCcw, Lock,
} from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { TopBar, Sheet, Field, Toggle, Chip, Segmented, Swatch } from '../components/ui.jsx';
import { CategoryPicker, ROLES, roleLabel } from '../components/pickers.jsx';
import ItemCard from '../components/ItemCard.jsx';
import { uid, cx } from '../lib/utils.js';

/* ---------------- menu ---------------- */
export default function Settings() {
  const { isAdmin, session, role, signOut, demo, resetDemo, data } = useStore();
  const rows = [
    isAdmin && ['categorie', <FolderTree size={20} />, 'Categorie', `${data.categories.length} categorie, a più livelli`],
    isAdmin && ['attributi', <Tags size={20} />, 'Attributi', 'Campi personalizzati, opzioni e colori'],
    isAdmin && ['griglia', <LayoutGrid size={20} />, 'Visualizzazione griglia', 'Cosa mostrare sotto ogni foto'],
    isAdmin && ['filtri', <Bookmark size={20} />, 'Filtri fissi', `${data.saved_filters.length} scorciatoie salvate`],
    isAdmin && ['ricerche', <Search size={20} />, 'Ricerche negozi', 'Preferenze per le Ispirazioni'],
    ['aspetto', <Palette size={20} />, 'Aspetto', 'Tema chiaro, scuro o automatico'],
  ].filter(Boolean);
  return (
    <div className="page">
      <header className="hero"><div className="hero__row"><div><h1 className="hero__title">Impostazioni</h1><p className="hero__sub">Personalizza il tuo armadio</p></div></div></header>
      <div className="account">
        <span className="account__avatar"><User size={20} /></span>
        <span className="grow"><b>{session?.user?.email}</b><span className="muted small block">{role === 'admin' ? 'Amministratore · lettura e scrittura' : 'Visualizzatore · solo lettura'}{demo ? ' · demo locale' : ''}</span></span>
        {!demo && <button className="icon-btn icon-btn--soft" onClick={signOut} aria-label="Esci"><LogOut size={18} /></button>}
      </div>
      <div className="menu">
        {rows.map(([to, icon, title, sub]) => (
          <Link key={to} to={`/impostazioni/${to}`} className="menu__row">
            <span className="menu__icon">{icon}</span>
            <span className="grow"><b>{title}</b><span className="muted small block">{sub}</span></span>
            <ChevronRight size={18} className="muted" />
          </Link>
        ))}
        {isAdmin && (
          <button className="menu__row" onClick={() => exportJson(data)}>
            <span className="menu__icon"><Download size={20} /></span>
            <span className="grow"><b>Esporta backup</b><span className="muted small block">Tutti i dati in un file JSON (le foto restano su Supabase)</span></span>
          </button>
        )}
        {demo && (
          <button className="menu__row" onClick={() => window.confirm('Ripristinare i dati demo?') && resetDemo()}>
            <span className="menu__icon"><RotateCcw size={20} /></span>
            <span className="grow"><b>Ripristina demo</b><span className="muted small block">Cancella i dati salvati in questo browser</span></span>
          </button>
        )}
      </div>
      {!isAdmin && <p className="muted small center pad"><Lock size={12} /> Sei in sola lettura: categorie e attributi li gestisce l'amministratore.</p>}
      <p className="muted small center">Armadio Digitale · v1.0</p>
    </div>
  );
}

function exportJson(data) {
  const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), ...data }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `armadio-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
}

/* ---------------- categorie ---------------- */
export function CategoriesSettings() {
  const { children, items, saveCategory, deleteCategory, descendants, notify } = useStore();
  const [edit, setEdit] = useState(null);
  const count = (id) => { const s = new Set(descendants(id)); return items.filter((i) => s.has(i.category_id)).length; };

  const move = async (c, dir) => {
    const sibs = children[c.parent_id || 'root'] || [];
    const i = sibs.findIndex((x) => x.id === c.id), j = i + dir;
    if (j < 0 || j >= sibs.length) return;
    const reordered = [...sibs]; [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    await Promise.all(reordered.map((x, k) => (x.sort !== k ? saveCategory({ ...x, sort: k }) : null)));
  };

  const Tree = ({ parent, depth }) => (children[parent] || []).map((c) => (
    <div key={c.id}>
      <div className="tree-row" style={{ '--d': depth }}>
        <button className="grow tree-row__main" onClick={() => setEdit(c)}>
          {c.icon ? <span className="emoji">{c.icon}</span> : <span className="tree-dot" />}
          <span className="grow"><b>{c.name}</b>{c.role && depth === 0 && <span className="muted small block">{roleLabel(c.role)}</span>}</span>
          <span className="muted small">{count(c.id)}</span>
        </button>
        <button className="icon-btn icon-btn--sm" onClick={() => move(c, -1)} aria-label="Su"><ArrowUp size={15} /></button>
        <button className="icon-btn icon-btn--sm" onClick={() => move(c, 1)} aria-label="Giù"><ArrowDown size={15} /></button>
        <button className="icon-btn icon-btn--sm" onClick={() => setEdit({ parent_id: c.id, name: '', icon: '', role: c.role, sort: (children[c.id] || []).length })} aria-label="Sottocategoria"><Plus size={16} /></button>
      </div>
      <Tree parent={c.id} depth={depth + 1} />
    </div>
  ));

  return (
    <div className="page">
      <TopBar title="Categorie" back="/impostazioni" sub="Tocca per modificare, + per aggiungere una sottocategoria" />
      <div className="tree"><Tree parent="root" depth={0} /></div>
      <button className="btn btn--block mt" onClick={() => setEdit({ parent_id: null, name: '', icon: '', role: '', sort: (children.root || []).length })}><Plus size={18} />Nuova categoria principale</button>
      {edit && <CategorySheet cat={edit} onClose={() => setEdit(null)} onSave={async (c) => { await saveCategory(c); notify('Categoria salvata'); setEdit(null); }}
        onDelete={async (c) => {
          const n = count(c.id);
          if (!window.confirm(`Eliminare «${c.name}» e tutte le sue sottocategorie?${n ? `\n${n} capi resteranno senza categoria.` : ''}`)) return;
          await deleteCategory(c.id); setEdit(null);
        }} />}
    </div>
  );
}

const EMOJI = ['👕', '👔', '👖', '🩳', '🧥', '🥼', '👗', '👟', '👞', '🥾', '🧢', '🎩', '🧣', '🧤', '🧦', '👜', '🎒', '⌚', '🕶️', '💍', '🩱', '🩲', '🏃', '💼'];

function CategorySheet({ cat, onClose, onSave, onDelete }) {
  const { catById, descendants } = useStore();
  const [c, setC] = useState(cat);
  const [pick, setPick] = useState(false);
  const parent = c.parent_id ? catById[c.parent_id] : null;
  return (
    <Sheet open onClose={onClose} title={cat.id ? 'Modifica categoria' : 'Nuova categoria'} tall
      footer={<div className="row gap">
        {cat.id && <button className="btn btn--danger" onClick={() => onDelete(cat)}><Trash2 size={18} /></button>}
        <button className="btn btn--primary grow" disabled={!c.name.trim()} onClick={() => onSave({ ...c, name: c.name.trim(), role: c.role || null, icon: c.icon || null })}>Salva</button>
      </div>}>
      <Field label="Nome"><input className="input" autoFocus value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="Es. Camicie a maniche corte" /></Field>
      <Field label="Dentro a">
        <button type="button" className="input input--btn" onClick={() => setPick(true)}><span>{parent ? parent.name : 'Nessuna (categoria principale)'}</span><ChevronRight size={18} /></button>
      </Field>
      <Field label="Icona">
        <div className="emoji-grid">
          <button type="button" className={cx(!c.icon && 'on')} onClick={() => setC({ ...c, icon: '' })}>–</button>
          {EMOJI.map((e) => <button type="button" key={e} className={cx(c.icon === e && 'on')} onClick={() => setC({ ...c, icon: e })}>{e}</button>)}
        </div>
      </Field>
      <Field label="Ruolo nell'outfit" hint="Serve alle Ispirazioni per comporre abbinamenti (sopra + sotto + scarpe…). Le sottocategorie ereditano il ruolo.">
        <div className="chips-wrap">{ROLES.map(([v, l]) => <Chip small key={v} active={(c.role || '') === v} onClick={() => setC({ ...c, role: v })}>{l}</Chip>)}</div>
      </Field>
      <CategoryPicker open={pick} onClose={() => setPick(false)} value={c.parent_id} allowAny
        onPick={(pid) => { if (cat.id && pid && descendants(cat.id).includes(pid)) return; setC({ ...c, parent_id: pid }); }} />
    </Sheet>
  );
}

/* ---------------- attributi ---------------- */
const TYPES = [
  ['select', 'Scelta singola'], ['multiselect', 'Scelta multipla'], ['text', 'Testo'], ['number', 'Numero'],
  ['date', 'Data'], ['rating', 'Stelle 1–5'], ['boolean', 'Sì / No'],
];
export function AttributesSettings() {
  const { attrs, saveAttribute, deleteAttribute } = useStore();
  const [edit, setEdit] = useState(null);
  const move = async (a, dir) => {
    const i = attrs.findIndex((x) => x.id === a.id), j = i + dir;
    if (j < 0 || j >= attrs.length) return;
    const r = [...attrs]; [r[i], r[j]] = [r[j], r[i]];
    await Promise.all(r.map((x, k) => (x.sort !== k ? saveAttribute({ ...x, sort: k }) : null)));
  };
  return (
    <div className="page">
      <TopBar title="Attributi" back="/impostazioni" sub="I campi che descrivono ogni capo" />
      <div className="menu">
        {attrs.map((a) => (
          <div key={a.id} className="menu__row">
            <button className="grow menu__btn" onClick={() => setEdit(a)}>
              <span className="grow">
                <b>{a.name}</b>{a.system_key && <span className="pill">base</span>}
                <span className="muted small block">{TYPES.find((t) => t[0] === a.type)?.[1]}{a.options?.length ? ` · ${a.options.length} opzioni` : ''}{a.category_ids?.length ? ' · solo alcune categorie' : ''}</span>
              </span>
              {a.options?.length > 0 && <span className="swatch-row">{a.options.slice(0, 5).map((o) => <Swatch key={o.id} color={o.color} />)}</span>}
            </button>
            <button className="icon-btn icon-btn--sm" onClick={() => move(a, -1)}><ArrowUp size={15} /></button>
            <button className="icon-btn icon-btn--sm" onClick={() => move(a, 1)}><ArrowDown size={15} /></button>
          </div>
        ))}
      </div>
      <button className="btn btn--block mt" onClick={() => setEdit({ name: '', type: 'select', options: [], category_ids: null, show_in_grid: false, filterable: true, sort: attrs.length, unit: null })}><Plus size={18} />Nuovo attributo</button>
      {edit && <AttributeSheet attr={edit} onClose={() => setEdit(null)}
        onSave={async (a) => { await saveAttribute(a); setEdit(null); }}
        onDelete={async (a) => { if (!window.confirm(`Eliminare «${a.name}»? I valori già inseriti nei capi verranno ignorati.`)) return; await deleteAttribute(a.id); setEdit(null); }} />}
    </div>
  );
}

const PALETTE = ['#111111', '#6b7280', '#e5484d', '#d9622b', '#e8a317', '#22a06b', '#12a594', '#3d7be0', '#5b5bd6', '#7c5cbf', '#d6409f', '#d8c3a0', '#7a4e2d', '#ffffff'];

function AttributeSheet({ attr, onClose, onSave, onDelete }) {
  const { cats, pathOf } = useStore();
  const [a, setA] = useState({ ...attr, options: attr.options || [] });
  const [newOpt, setNewOpt] = useState('');
  const hasOpts = a.type === 'select' || a.type === 'multiselect';
  const setOpt = (i, patch) => setA({ ...a, options: a.options.map((o, k) => (k === i ? { ...o, ...patch } : o)) });
  const moveOpt = (i, d) => { const j = i + d; if (j < 0 || j >= a.options.length) return; const o = [...a.options]; [o[i], o[j]] = [o[j], o[i]]; setA({ ...a, options: o }); };
  const addOpt = () => {
    if (!newOpt.trim()) return;
    setA({ ...a, options: [...a.options, { id: uid().slice(0, 8), label: newOpt.trim(), color: PALETTE[a.options.length % PALETTE.length] }] });
    setNewOpt('');
  };
  const scoped = !!a.category_ids?.length;
  const toggleCat = (id) => {
    const cur = a.category_ids || [];
    setA({ ...a, category_ids: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };
  return (
    <Sheet open onClose={onClose} title={attr.id ? 'Modifica attributo' : 'Nuovo attributo'} tall
      footer={<div className="row gap">
        {attr.id && !attr.system_key && <button className="btn btn--danger" onClick={() => onDelete(attr)}><Trash2 size={18} /></button>}
        <button className="btn btn--primary grow" disabled={!a.name.trim()} onClick={() => { const { _scoped, ...rest } = a; onSave({ ...rest, name: a.name.trim(), category_ids: scoped ? a.category_ids : null }); }}>Salva</button>
      </div>}>
      <Field label="Nome"><input className="input" autoFocus={!attr.id} value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder="Es. Materiale, Vestibilità, Occasione…" /></Field>
      <Field label="Tipo" hint={attr.id ? 'Cambiare tipo può rendere illeggibili i valori già inseriti.' : null}>
        <select className="input" value={a.type} disabled={!!attr.system_key} onChange={(e) => setA({ ...a, type: e.target.value })}>
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      {a.type === 'number' && <Field label="Unità"><input className="input" value={a.unit || ''} onChange={(e) => setA({ ...a, unit: e.target.value || null })} placeholder="Es. €, cm, kg" /></Field>}

      {hasOpts && (
        <Field label={`Opzioni (${a.options.length})`}>
          <div className="opts">
            {a.options.map((o, i) => (
              <div key={o.id} className="opt">
                <GripVertical size={16} className="muted" />
                <label className="opt__color" style={{ background: o.color }}>
                  <input type="color" value={o.color || '#888888'} onChange={(e) => setOpt(i, { color: e.target.value })} />
                </label>
                <input className="input grow" value={o.label} onChange={(e) => setOpt(i, { label: e.target.value })} />
                <button type="button" className="icon-btn icon-btn--sm" onClick={() => moveOpt(i, -1)}><ArrowUp size={14} /></button>
                <button type="button" className="icon-btn icon-btn--sm" onClick={() => moveOpt(i, 1)}><ArrowDown size={14} /></button>
                <button type="button" className="icon-btn icon-btn--sm" onClick={() => setA({ ...a, options: a.options.filter((_, k) => k !== i) })}><Trash2 size={14} /></button>
              </div>
            ))}
            <div className="row gap">
              <input className="input grow" placeholder="Nuova opzione" value={newOpt} onChange={(e) => setNewOpt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOpt())} />
              <button type="button" className="btn" onClick={addOpt} disabled={!newOpt.trim()}><Plus size={16} /></button>
            </div>
          </div>
        </Field>
      )}

      <Toggle label="Mostra nella griglia" hint="Compare come etichetta sotto la foto" checked={a.show_in_grid} onChange={(v) => setA({ ...a, show_in_grid: v })} />
      {['select', 'multiselect', 'rating', 'boolean'].includes(a.type) && <Toggle label="Usa come filtro" checked={a.filterable} onChange={(v) => setA({ ...a, filterable: v })} />}
      <Toggle label="Solo per alcune categorie" hint="Altrimenti vale per tutti i capi" checked={scoped} onChange={(v) => setA({ ...a, category_ids: v ? (a.category_ids?.length ? a.category_ids : []) : null, _scoped: v })} />
      {(scoped || a._scoped) && (
        <div className="cat-checks">
          {cats.map((c) => {
            const depth = pathOf(c.id).length - 1;
            return (
              <Chip small key={c.id} active={a.category_ids?.includes(c.id)} onClick={() => toggleCat(c.id)} className="cat-check" >
                <span style={{ paddingLeft: depth * 10 }}>{c.icon} {c.name}</span>
              </Chip>
            );
          })}
          <p className="field__hint">Selezionando una categoria, l'attributo vale anche per tutte le sue sottocategorie.</p>
        </div>
      )}
    </Sheet>
  );
}

/* ---------------- griglia ---------------- */
export function GridSettings() {
  const { grid, setSetting, attrs, saveAttribute, items } = useStore();
  const set = (p) => setSetting('grid', { ...grid, ...p });
  const sample = items[0];
  return (
    <div className="page">
      <TopBar title="Visualizzazione griglia" back="/impostazioni" />
      {sample && (
        <div className={cx('grid', `grid--${grid.columns}`, 'grid--preview')}>
          <ItemCard item={sample} />
          {items[1] && <ItemCard item={items[1]} />}
          {grid.columns === 3 && items[2] && <ItemCard item={items[2]} />}
        </div>
      )}
      <div className="form-card">
        <Field label="Colonne"><Segmented value={grid.columns || 2} onChange={(v) => set({ columns: v })} options={[[2, '2 per riga'], [3, '3 per riga']]} /></Field>
        <Toggle label="Nome del capo" checked={grid.showName} onChange={(v) => set({ showName: v })} />
        <Toggle label="Categoria" hint="Solo l'ultimo livello, es. «Polo»" checked={grid.showCategory} onChange={(v) => set({ showCategory: v })} />
        <Toggle label="Percorso completo" hint="Es. «Parte sopra › Polo»" checked={grid.showPath} onChange={(v) => set({ showPath: v })} />
      </div>
      <h3 className="section-title">Attributi sotto la foto</h3>
      <div className="form-card">
        {attrs.map((a) => <Toggle key={a.id} label={a.name} checked={a.show_in_grid} onChange={(v) => saveAttribute({ ...a, show_in_grid: v })} />)}
      </div>
      <p className="muted small center pad">Spegni tutto per una griglia di sole foto.</p>
    </div>
  );
}

/* ---------------- filtri salvati ---------------- */
export function FiltersSettings() {
  const { data, saveFilter, deleteFilter } = useStore();
  const list = [...data.saved_filters].sort((a, b) => a.sort - b.sort);
  const move = async (f, d) => {
    const i = list.findIndex((x) => x.id === f.id), j = i + d; if (j < 0 || j >= list.length) return;
    const r = [...list]; [r[i], r[j]] = [r[j], r[i]];
    await Promise.all(r.map((x, k) => (x.sort !== k ? saveFilter({ ...x, sort: k }) : null)));
  };
  return (
    <div className="page">
      <TopBar title="Filtri fissi" back="/impostazioni" sub="Si creano dal pannello Filtri nella griglia" />
      {list.length ? (
        <div className="menu">
          {list.map((f) => (
            <div key={f.id} className="menu__row">
              <input className="input grow" defaultValue={f.name} onBlur={(e) => e.target.value.trim() && e.target.value !== f.name && saveFilter({ ...f, name: e.target.value.trim() })} />
              <Toggle checked={f.pinned} onChange={(v) => saveFilter({ ...f, pinned: v })} label="" />
              <button className="icon-btn icon-btn--sm" onClick={() => move(f, -1)}><ArrowUp size={15} /></button>
              <button className="icon-btn icon-btn--sm" onClick={() => move(f, 1)}><ArrowDown size={15} /></button>
              <button className="icon-btn icon-btn--sm" onClick={() => deleteFilter(f.id)}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      ) : <p className="muted center pad">Nessun filtro fisso. Apri <b>Filtri</b> nella griglia, scegli cosa vedere e tocca «Salva questi filtri».</p>}
    </div>
  );
}

/* ---------------- ricerche ---------------- */
export function SearchSettings() {
  const { settingsBy, setSetting } = useStore();
  const v = settingsBy.search || {};
  return (
    <div className="page">
      <TopBar title="Ricerche negozi" back="/impostazioni" />
      <div className="form-card">
        <Field label="Reparto" hint="Viene aggiunto alle ricerche su Zalando, Google e Pinterest dalle Ispirazioni.">
          <Segmented value={v.gender || ''} onChange={(g) => setSetting('search', { ...v, gender: g })} options={[['uomo', 'Uomo'], ['donna', 'Donna'], ['', 'Nessuno']]} />
        </Field>
      </div>
    </div>
  );
}

/* ---------------- aspetto ---------------- */
export function AppearanceSettings() {
  const [t, setT] = useState(() => { try { return localStorage.getItem('armadio-theme') || 'auto'; } catch { return 'auto'; } });
  const apply = (v) => {
    setT(v);
    try { localStorage.setItem('armadio-theme', v); } catch { /* */ }
    if (v === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v);
  };
  return (
    <div className="page">
      <TopBar title="Aspetto" back="/impostazioni" />
      <div className="form-card"><Field label="Tema"><Segmented value={t} onChange={apply} options={[['auto', 'Automatico'], ['light', 'Chiaro'], ['dark', 'Scuro']]} /></Field></div>
    </div>
  );
}
