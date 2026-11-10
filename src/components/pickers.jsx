import { useMemo, useState } from 'react';
import { ChevronRight, Check, Search, Heart } from 'lucide-react';
import { useStore, applyFilter, EMPTY_FILTER } from '../lib/store.jsx';
import { Sheet, Chip, Photo, Stars, Swatch } from './ui.jsx';
import { asArray, cx } from '../lib/utils.js';

/* ---------- selezione categoria ad albero ---------- */
// leafOnly: si possono scegliere solo le categorie finali (senza sottocategorie): quelle «raccoglitore» si aprono e basta
export function CategoryPicker({ open, onClose, value, onPick, allowAny, leafOnly }) {
  const { children, pathOf, catById } = useStore();
  const [at, setAt] = useState(null); // categoria aperta
  const list = children[at || 'root'] || [];
  const crumbs = at ? pathOf(at) : [];
  const close = () => { setAt(null); onClose(); };
  return (
    <Sheet open={open} onClose={close} title={leafOnly && at ? `Scegli in «${catById[at]?.name}»` : 'Scegli categoria'} tall>
      <div className="crumbs">
        <button className={cx(!at && 'on')} onClick={() => setAt(null)}>Tutte</button>
        {crumbs.map((c) => (
          <span key={c.id}><ChevronRight size={14} /><button className={cx(c.id === at && 'on')} onClick={() => setAt(c.id)}>{c.name}</button></span>
        ))}
      </div>
      {at && !leafOnly && (
        <button className="list-row list-row--accent" onClick={() => { onPick(at); close(); }}>
          <span>Usa «{catById[at]?.name}»</span>
          {value === at && <Check size={18} />}
        </button>
      )}
      {allowAny && !at && (
        <button className="list-row" onClick={() => { onPick(null); close(); }}><span>Nessuna categoria</span></button>
      )}
      {list.map((c) => {
        const hasKids = (children[c.id] || []).length > 0;
        return (
          <button key={c.id} className="list-row" onClick={() => (hasKids ? setAt(c.id) : (onPick(c.id), close()))}>
            <span>{c.icon && <span className="emoji">{c.icon}</span>}{c.name}</span>
            <span className="list-row__end">
              {value === c.id && <Check size={18} />}
              {hasKids && <ChevronRight size={18} />}
            </span>
          </button>
        );
      })}
    </Sheet>
  );
}

/* ---------- input per un attributo ---------- */
export function AttrField({ attr, value, onChange }) {
  const v = value;
  switch (attr.type) {
    case 'select':
    case 'multiselect': {
      const sel = asArray(v);
      const toggle = (id) => {
        if (attr.type === 'select') onChange(sel[0] === id ? null : id);
        else onChange(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
      };
      return (
        <div className="chips-wrap">
          {attr.options.map((o) => (
            <Chip key={o.id} active={sel.includes(o.id)} color={o.color} onClick={() => toggle(o.id)}
              icon={attr.system_key === 'color' || isColorish(attr) ? <Swatch color={o.color} /> : null}>
              {o.label}
            </Chip>
          ))}
          {!attr.options.length && <span className="muted small">Nessuna opzione: aggiungile in Impostazioni → Attributi</span>}
        </div>
      );
    }
    case 'number':
      return (
        <div className="input-unit">
          <input className="input" type="number" inputMode="decimal" step="any" value={v ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
          {attr.unit && <span>{attr.unit}</span>}
        </div>
      );
    case 'date':
      return <input className="input" type="date" value={v || ''} onChange={(e) => onChange(e.target.value || null)} />;
    case 'rating':
      return <Stars value={Number(v) || 0} onChange={onChange} />;
    case 'boolean':
      return (
        <div className="chips-wrap">
          <Chip active={v === true} onClick={() => onChange(v === true ? null : true)}>Sì</Chip>
          <Chip active={v === false} onClick={() => onChange(v === false ? null : false)}>No</Chip>
        </div>
      );
    default:
      return <input className="input" value={v || ''} onChange={(e) => onChange(e.target.value || null)} />;
  }
}
const isColorish = (a) => /colou?r/i.test(a.name);

/* ---------- selezione multipla di capi (per gli outfit) ---------- */
export function ItemPicker({ open, onClose, selected, onChange }) {
  const store = useStore();
  const { children, roleOf } = store;
  const [f, setF] = useState(EMPTY_FILTER);
  const list = useMemo(() => applyFilter(store, f), [store, f]);
  const roots = children.root || [];
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <Sheet open={open} onClose={onClose} title={`Scegli i capi (${selected.length})`} tall
      footer={<button className="btn btn--primary btn--block" onClick={onClose}>Fatto</button>}>
      <div className="search">
        <Search size={18} />
        <input placeholder="Cerca un capo…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
      </div>
      <div className="chips-scroll">
        <Chip active={!f.categoryId && !f.favorites} onClick={() => setF({ ...f, categoryId: null, favorites: false })}>Tutti</Chip>
        <Chip active={f.favorites} onClick={() => setF({ ...f, favorites: !f.favorites })} icon={<Heart size={14} />}>Preferiti</Chip>
        {roots.map((c) => (
          <Chip key={c.id} active={f.categoryId === c.id} onClick={() => setF({ ...f, categoryId: f.categoryId === c.id ? null : c.id })}>
            {c.icon} {c.name}
          </Chip>
        ))}
      </div>
      <div className="pick-grid">
        {list.map((it) => (
          <button key={it.id} className={cx('pick', selected.includes(it.id) && 'pick--on')} onClick={() => toggle(it.id)}>
            <Photo path={it.thumb_path || it.photo_path} />
            <span className="pick__name">{it.name}</span>
            <span className="pick__check"><Check size={14} strokeWidth={3} /></span>
            <span className="pick__role">{roleLabel(roleOf(it.category_id))}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export const ROLES = [
  ['', 'Nessuno'], ['top', 'Parte sopra'], ['bottom', 'Parte sotto'], ['full', 'Completo / abito'],
  ['outer', 'Capospalla'], ['shoes', 'Scarpe'], ['accessory', 'Accessorio'],
];
export const roleLabel = (r) => (r ? ROLES.find((x) => x[0] === r)?.[1] : '');
