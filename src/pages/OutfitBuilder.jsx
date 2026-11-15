// Creazione / modifica outfit a sezioni:
//   «Da dove parti?» (sezioni) → una sezione alla volta (più capi) → si torna alle sezioni → Riepilogo → Salva
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, X, Check, Search, ChevronRight, Layers } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { TopBar, Field, Toggle, Chip, Photo, Empty } from '../components/ui.jsx';
import { cx } from '../lib/utils.js';

const SECTIONS = [
  ['top', 'Parte sopra', '👕'],
  ['bottom', 'Parte sotto', '👖'],
  ['full', 'Completo / abito', '🤵'],
  ['outer', 'Capospalla', '🧥'],
  ['shoes', 'Scarpe', '👟'],
  ['accessory', 'Accessori', '🧢'],
  ['other', 'Altro', '📦'],
];
const DEFAULT_TAGS = ['Casual', 'Lavoro', 'Uscita', 'Elegante', 'Sport'];

export default function OutfitBuilder() {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const [sp] = useSearchParams();
  const { data, items, itemBy, roleOf, saveOutfit, notify, canEditOutfit } = useStore();
  const orig = id ? data.outfits.find((x) => x.id === id) : null;
  const blocked = orig && !canEditOutfit(orig);
  const preset = sp.get('capi')?.split(',').filter((x) => itemBy[x]) || [];

  const [o, setO] = useState(() => orig ? { ...orig, tags: orig.tags || [] } : { name: '', item_ids: preset, tags: [], favorite: false, notes: '' });
  const [view, setView] = useState(() => (orig || preset.length ? 'summary' : 'hub'));
  const set = (p) => setO((x) => ({ ...x, ...p }));
  // ogni schermata riparte dall'alto
  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  const sectionOf = (it) => roleOf(it.category_id) || 'other';
  const bySection = useMemo(() => {
    const m = {};
    items.forEach((it) => { (m[sectionOf(it)] ||= []).push(it); });
    return m;
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = o.item_ids.map((x) => itemBy[x]).filter(Boolean);
  const chosenIn = (sec) => chosen.filter((it) => sectionOf(it) === sec);
  const sections = SECTIONS.filter(([k]) => (bySection[k] || []).length || chosenIn(k).length || !['full', 'other'].includes(k));
  const toggleItem = (iid) => set({ item_ids: o.item_ids.includes(iid) ? o.item_ids.filter((x) => x !== iid) : [...o.item_ids, iid] });

  const leave = () => (location.key !== 'default' ? nav(-1) : nav('/outfit', { replace: true }));
  const back = () => {
    if (SECTIONS.some(([k]) => k === view)) return setView('hub');
    if (view === 'summary' && !orig && !preset.length) return setView('hub');
    if (view === 'hub' && (orig || preset.length)) return setView('summary');
    return leave();
  };

  const save = async () => {
    if (blocked) return notify('Puoi modificare solo i tuoi outfit', 'err');
    if (!o.item_ids.length) { notify('Scegli almeno un capo', 'err'); return setView('hub'); }
    if (!o.name.trim()) return notify('Dai un nome all\'outfit', 'err');
    const saved = await saveOutfit({ ...o, name: o.name.trim() });
    if (orig) leave();
    else nav(`/outfit/${saved.id}`, { replace: true });
  };

  /* ---------- 1. sezioni ---------- */
  if (view === 'hub') {
    return (
      <div className="page page--builder">
        <TopBar title={orig ? 'Modifica outfit' : 'Nuovo outfit'} back={back} sub={chosen.length ? `${chosen.length} ${chosen.length === 1 ? 'capo scelto' : 'capi scelti'}` : null} />
        <h2 className="builder-q">{chosen.length ? 'Che sezione aggiungo?' : 'Da dove parti?'}</h2>
        <div className="sec-list">
          {sections.map(([k, label, icon]) => {
            const sel = chosenIn(k);
            const avail = (bySection[k] || []).length;
            return (
              <button key={k} className={cx('sec', sel.length && 'sec--done')} onClick={() => setView(k)}>
                <span className="sec__icon">{icon}</span>
                <span className="grow">
                  <b>{label}</b>
                  <span className="muted small block">{sel.length ? `${sel.length} ${sel.length === 1 ? 'scelto' : 'scelti'}` : avail ? `${avail} ${avail === 1 ? 'capo' : 'capi'}` : 'nessun capo'}</span>
                </span>
                {sel.length > 0 && (
                  <span className="sec__thumbs">{sel.slice(0, 3).map((it) => <Photo key={it.id} path={it.thumb_path || it.photo_path} />)}</span>
                )}
                <ChevronRight size={18} className="muted" />
              </button>
            );
          })}
        </div>
        <div className="form-save">
          <button className="btn btn--primary btn--block btn--lg" disabled={!chosen.length} onClick={() => setView('summary')}>
            {chosen.length ? <>Continua al riepilogo · {chosen.length} {chosen.length === 1 ? 'capo' : 'capi'}</> : 'Scegli almeno un capo'}
          </button>
        </div>
      </div>
    );
  }

  /* ---------- 2. una sezione ---------- */
  const sec = SECTIONS.find(([k]) => k === view);
  if (sec) return <SectionPicker sec={sec} list={bySection[sec[0]] || []} selected={o.item_ids} onToggle={toggleItem} onDone={() => setView('hub')} />;

  /* ---------- 3. riepilogo ---------- */
  return (
    <div className="page page--form">
      <TopBar title={orig ? 'Modifica outfit' : 'Riepilogo outfit'} back={back} />
      {SECTIONS.map(([k, label, icon]) => {
        const sel = chosenIn(k);
        if (!sel.length) return null;
        return (
          <section key={k} className="sum-sec">
            <h4 className="sheet-sub">{icon} {label}</h4>
            <div className="pick-grid pick-grid--3">
              {sel.map((it) => (
                <div key={it.id} className="pick pick--static">
                  <Photo path={it.thumb_path || it.photo_path} />
                  <span className="pick__name">{it.name}</span>
                  <button type="button" className="pick__x" onClick={() => toggleItem(it.id)} aria-label="Togli"><X size={14} /></button>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {!chosen.length && <Empty icon={<Layers size={26} />} title="Nessun capo" text="Aggiungi i capi dalle sezioni." />}
      <button className="btn btn--block mt" onClick={() => setView('hub')}><Plus size={18} />Aggiungi o cambia capi</button>

      <div className="form-card">
        <Field label="Nome"><input className="input" placeholder="Es. Aperitivo estivo" value={o.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <TagPicker tags={o.tags} onChange={(tags) => set({ tags })} known={data.outfits.flatMap((x) => x.tags || [])} />
        <Toggle label="Preferito" checked={o.favorite} onChange={(v) => set({ favorite: v })} />
        <Field label="Note"><textarea className="input" rows={2} value={o.notes || ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>
      <div className="form-save"><button className="btn btn--primary btn--block btn--lg" onClick={save}>Salva outfit</button></div>
    </div>
  );
}

/* ---------- capi di una sezione, a schermo intero ---------- */
function SectionPicker({ sec, list, selected, onToggle, onDone }) {
  const [, label, icon] = sec;
  const { pathOf } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(null);
  // sottocategorie presenti in questa sezione (es. Magliette, Polo, Felpe…)
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
              <span className="pick__check"><Check size={14} strokeWidth={3} /></span>
            </button>
          ))}
        </div>
      ) : (
        <Empty title={list.length ? 'Nessun capo trovato' : `Nessun capo in «${label}»`} text={list.length ? 'Prova un\'altra ricerca.' : 'Assegna a una categoria il ruolo giusto in Altro → Categorie.'} />
      )}
      <div className="form-save">
        <button className="btn btn--primary btn--block btn--lg" onClick={onDone}>{n ? `Fatto · ${n} ${n === 1 ? 'scelto' : 'scelti'}` : 'Salta questa sezione'}</button>
      </div>
    </div>
  );
}

/* ---------- etichette: esistenti + «＋» per crearne una ---------- */
function TagPicker({ tags, onChange, known }) {
  const [adding, setAdding] = useState(false);
  const [txt, setTxt] = useState('');
  const all = [...new Set([...DEFAULT_TAGS, ...known, ...tags])];
  const toggle = (t) => onChange(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);
  const add = () => {
    const t = txt.trim().replace(/\s+/g, ' ');
    if (!t) return;
    const existing = all.find((x) => x.toLowerCase() === t.toLowerCase());
    const name = existing || t;
    if (!tags.includes(name)) onChange([...tags, name]);
    setTxt(''); setAdding(false);
  };
  return (
    <div className="field">
      <span className="field__label">Etichette</span>
      <div className="chips-wrap">
        {all.map((t) => <Chip key={t} small active={tags.includes(t)} onClick={() => toggle(t)}>{t}</Chip>)}
        {!adding && <Chip small className="chip--add" onClick={() => setAdding(true)} icon={<Plus size={14} />}>Nuova</Chip>}
      </div>
      {adding && (
        <div className="row gap mt-s">
          <input className="input grow" autoFocus placeholder="Nome etichetta" value={txt} onChange={(e) => setTxt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } if (e.key === 'Escape') setAdding(false); }} />
          <button type="button" className="btn btn--primary" disabled={!txt.trim()} onClick={add}>Aggiungi</button>
          <button type="button" className="icon-btn icon-btn--sm" onClick={() => { setAdding(false); setTxt(''); }} aria-label="Annulla"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}
