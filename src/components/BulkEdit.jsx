import { useState } from 'react';
import { ChevronRight, ChevronDown, Archive, ArchiveRestore, Trash2, Loader2, X } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { Sheet, Segmented, Field } from './ui.jsx';
import { CategoryPicker, AttrField } from './pickers.jsx';
import { asArray, cx } from '../lib/utils.js';

const MULTI_MODES = [['add', 'Aggiungi'], ['remove', 'Togli'], ['set', 'Sostituisci'], ['clear', 'Svuota']];
const SINGLE_MODES = [['set', 'Imposta'], ['clear', 'Svuota']];

const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);

// applica le modifiche scelte a un capo
export function applyOps(item, ops, attrBy) {
  const next = { ...item, attrs: { ...(item.attrs || {}) } };
  if (ops.category !== undefined) next.category_id = ops.category;
  if (ops.favorite !== undefined) next.favorite = ops.favorite;
  for (const [aid, op] of Object.entries(ops.attrs)) {
    const a = attrBy[aid]; if (!a) continue;
    if (op.mode === 'clear') { delete next.attrs[aid]; continue; }
    if (a.type === 'multiselect') {
      const cur = asArray(next.attrs[aid]);
      const val = asArray(op.value);
      if (op.mode === 'add') next.attrs[aid] = [...new Set([...cur, ...val])];
      else if (op.mode === 'remove') next.attrs[aid] = cur.filter((x) => !val.includes(x));
      else next.attrs[aid] = val;
      if (!next.attrs[aid].length) delete next.attrs[aid];
    } else if (!isEmpty(op.value)) next.attrs[aid] = op.value;
  }
  return next;
}

export default function BulkEdit({ open, onClose, items, inArchive, onDone }) {
  const { attrs, attrBy, pathOf, saveItemsBulk, deleteItemsBulk } = useStore();
  const [ops, setOps] = useState({ category: undefined, favorite: undefined, attrs: {} });
  const [openAttr, setOpenAttr] = useState(null);
  const [catPick, setCatPick] = useState(false);
  const [progress, setProgress] = useState(null);
  const n = items.length;

  const setAttrOp = (aid, patch) => setOps((o) => {
    const a = attrBy[aid];
    const cur = o.attrs[aid] || { mode: a.type === 'multiselect' ? 'add' : 'set', value: null };
    return { ...o, attrs: { ...o.attrs, [aid]: { ...cur, ...patch } } };
  });
  const dropAttrOp = (aid) => setOps((o) => { const x = { ...o.attrs }; delete x[aid]; return { ...o, attrs: x }; });

  // un'operazione conta solo se è completa
  const validAttrOps = Object.fromEntries(Object.entries(ops.attrs).filter(([, op]) => op.mode === 'clear' || !isEmpty(op.value)));
  const changes = (ops.category !== undefined ? 1 : 0) + (ops.favorite !== undefined ? 1 : 0) + Object.keys(validAttrOps).length;

  const run = async (fn) => {
    setProgress({ done: 0, total: n });
    try { await fn((done, total) => setProgress({ done, total })); } finally { setProgress(null); }
    reset(); onDone();
  };
  const reset = () => { setOps({ category: undefined, favorite: undefined, attrs: {} }); setOpenAttr(null); };

  const apply = () => run((p) => saveItemsBulk(items.map((it) => applyOps(it, { ...ops, attrs: validAttrOps }, attrBy)), p));
  const archive = (v) => run((p) => saveItemsBulk(items.map((it) => ({ ...it, archived: v })), p));
  const remove = () => {
    if (!window.confirm(`Eliminare per sempre ${n} ${n === 1 ? 'capo' : 'capi'}? Foto comprese. Non si può annullare.\n\nSe vuoi solo toglierli di mezzo, usa «Archivia».`)) return;
    run((p) => deleteItemsBulk(items, p));
  };

  const summary = (a) => {
    const op = ops.attrs[a.id]; if (!op) return null;
    if (op.mode === 'clear') return 'svuota';
    if (isEmpty(op.value)) return 'scegli un valore…';
    const label = (a.type === 'select' || a.type === 'multiselect')
      ? asArray(op.value).map((v) => a.options.find((o) => o.id === v)?.label).filter(Boolean).join(', ')
      : a.type === 'rating' ? '★'.repeat(op.value) : a.type === 'boolean' ? (op.value ? 'Sì' : 'No') : String(op.value);
    const verb = { add: 'aggiungi', remove: 'togli', set: a.type === 'multiselect' ? 'sostituisci con' : 'imposta' }[op.mode];
    return `${verb} ${label}`;
  };

  if (!open) return null;
  return (
    <Sheet open onClose={progress ? undefined : onClose} title={`Modifica ${n} ${n === 1 ? 'capo' : 'capi'}`} tall
      footer={progress ? (
        <div className="progress">
          <div className="progress__bar"><span style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
          <span className="small"><Loader2 className="spin" size={13} /> {progress.done}/{progress.total} · non chiudere la pagina</span>
        </div>
      ) : (
        <button className="btn btn--primary btn--block btn--lg" disabled={!changes || !n} onClick={apply}>
          {changes ? `Applica ${changes} ${changes === 1 ? 'modifica' : 'modifiche'} a ${n} capi` : 'Scegli cosa cambiare'}
        </button>
      )}>
      <p className="muted small">Cambia solo quello che tocchi qui sotto: il resto di ogni capo rimane com'è.</p>

      <div className="bulk-row">
        <span className="bulk-row__label">Categoria</span>
        <button className={cx('input input--btn', ops.category === undefined && 'muted')} onClick={() => setCatPick(true)}>
          <span>{ops.category === undefined ? 'Non cambiare' : ops.category === null ? 'Nessuna categoria' : pathOf(ops.category).map((c) => c.name).join(' › ')}</span>
          <ChevronRight size={18} />
        </button>
        {ops.category !== undefined && <button className="icon-btn icon-btn--sm" onClick={() => setOps({ ...ops, category: undefined })} aria-label="Annulla"><X size={16} /></button>}
      </div>

      <div className="bulk-row">
        <span className="bulk-row__label">Preferito</span>
        <Segmented value={ops.favorite === undefined ? 'keep' : ops.favorite ? 'yes' : 'no'}
          onChange={(v) => setOps({ ...ops, favorite: v === 'keep' ? undefined : v === 'yes' })}
          options={[['keep', 'Non cambiare'], ['yes', 'Sì'], ['no', 'No']]} />
      </div>

      <h4 className="sheet-sub">Attributi</h4>
      <div className="bulk-attrs">
        {attrs.map((a) => {
          const op = ops.attrs[a.id];
          const isOpen = openAttr === a.id;
          const modes = a.type === 'multiselect' ? MULTI_MODES : SINGLE_MODES;
          return (
            <div key={a.id} className={cx('bulk-attr', op && 'bulk-attr--on', isOpen && 'bulk-attr--open')}>
              <button className="bulk-attr__head" onClick={() => { setOpenAttr(isOpen ? null : a.id); if (!op) setAttrOp(a.id, {}); }}>
                <span className="grow"><b>{a.name}</b>{op && <span className="small block bulk-attr__sum">{summary(a)}</span>}</span>
                {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
              {isOpen && op && (
                <div className="bulk-attr__body">
                  <Segmented value={op.mode} onChange={(m) => setAttrOp(a.id, { mode: m, value: a.type === 'multiselect' || m === 'clear' ? op.value : op.value })} options={modes} />
                  {op.mode !== 'clear' && (
                    <AttrField attr={a} value={op.value} onChange={(v) => setAttrOp(a.id, { value: v })} />
                  )}
                  {op.mode === 'remove' && <p className="field__hint">Toglie i valori scelti solo dai capi che li hanno.</p>}
                  {op.mode === 'set' && a.type === 'multiselect' && <p className="field__hint">Sostituisce tutti i valori attuali con quelli scelti.</p>}
                  <button className="link-btn" onClick={() => { dropAttrOp(a.id); setOpenAttr(null); }}>Non cambiare {a.name.toLowerCase()}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h4 className="sheet-sub">Altre azioni</h4>
      <div className="row gap wrap">
        <button className="btn grow" disabled={!!progress || !n} onClick={() => archive(!inArchive)}>
          {inArchive ? <><ArchiveRestore size={17} />Ripristina {n}</> : <><Archive size={17} />Archivia {n}</>}
        </button>
        <button className="btn btn--danger grow" disabled={!!progress || !n} onClick={remove}><Trash2 size={17} />Elimina {n}</button>
      </div>

      <CategoryPicker open={catPick} onClose={() => setCatPick(false)} value={ops.category ?? null} leafOnly allowAny onPick={(cid) => setOps({ ...ops, category: cid })} />
    </Sheet>
  );
}

export { Field };
