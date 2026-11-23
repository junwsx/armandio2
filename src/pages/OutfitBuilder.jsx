// Creazione / modifica outfit: scelta guidata a sezioni (GuidedPicker) → Riepilogo → Salva
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, X, Layers } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { TopBar, Field, Toggle, Chip, Empty } from '../components/ui.jsx';
import GuidedPicker, { ChosenBySection } from '../components/GuidedPicker.jsx';

const DEFAULT_TAGS = ['Casual', 'Lavoro', 'Uscita', 'Elegante', 'Sport'];

export default function OutfitBuilder() {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const [sp] = useSearchParams();
  const { data, itemBy, saveOutfit, notify, canEditOutfit } = useStore();
  const orig = id ? data.outfits.find((x) => x.id === id) : null;
  const blocked = orig && !canEditOutfit(orig);
  const preset = sp.get('capi')?.split(',').filter((x) => itemBy[x]) || [];

  const [o, setO] = useState(() => orig ? { ...orig, tags: orig.tags || [] } : { name: '', item_ids: preset, tags: [], favorite: false, notes: '' });
  const [view, setView] = useState(() => (orig || preset.length ? 'summary' : 'picker'));
  const set = (p) => setO((x) => ({ ...x, ...p }));
  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  const toggleItem = (iid) => setO((x) => ({ ...x, item_ids: x.item_ids.includes(iid) ? x.item_ids.filter((y) => y !== iid) : [...x.item_ids, iid] }));
  const n = o.item_ids.filter((x) => itemBy[x]).length;

  const leave = () => (location.key !== 'default' ? nav(-1) : nav('/outfit', { replace: true }));
  const back = () => {
    if (view === 'summary' && !orig && !preset.length) return setView('picker');
    if (view === 'picker' && (orig || preset.length)) return setView('summary');
    return leave();
  };

  const save = async () => {
    if (blocked) return notify('Puoi modificare solo i tuoi outfit', 'err');
    if (!o.item_ids.length) { notify('Scegli almeno un capo', 'err'); return setView('picker'); }
    if (!o.name.trim()) return notify('Dai un nome all\'outfit', 'err');
    const saved = await saveOutfit({ ...o, name: o.name.trim() });
    if (orig) leave();
    else nav(`/outfit/${saved.id}`, { replace: true });
  };

  /* ---------- 1. scelta guidata dei capi ---------- */
  if (view === 'picker') {
    return (
      <GuidedPicker title={orig ? 'Modifica outfit' : 'Nuovo outfit'} onBack={back} selected={o.item_ids} onToggle={toggleItem}
        cta={{ disabled: !n, onClick: () => setView('summary'), label: n ? `Continua al riepilogo · ${n} ${n === 1 ? 'capo' : 'capi'}` : 'Scegli almeno un capo' }} />
    );
  }

  /* ---------- 2. riepilogo ---------- */
  return (
    <div className="page page--form">
      <TopBar title={orig ? 'Modifica outfit' : 'Riepilogo outfit'} back={back} />
      <ChosenBySection ids={o.item_ids} onRemove={toggleItem} />
      {!n && <Empty icon={<Layers size={26} />} title="Nessun capo" text="Aggiungi i capi dalle sezioni." />}
      <button className="btn btn--block mt" onClick={() => setView('picker')}><Plus size={18} />Aggiungi o cambia capi</button>

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
