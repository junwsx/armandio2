import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight, CalendarDays, LayoutGrid, Heart, Pencil, Trash2, CalendarCheck, X, Layers } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { TopBar, Segmented, Empty, Sheet, Photo, Chip, Field, Toggle } from '../components/ui.jsx';
import { ItemPicker } from '../components/pickers.jsx';
import { OutfitCollage } from './ItemDetail.jsx';
import { fmtDate, isoDate, cx } from '../lib/utils.js';
import { usePersonal } from '../lib/personal.js';

export default function Outfits() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('vista') || 'outfit';
  return (
    <div className="page">
      <header className="hero">
        <div className="hero__row">
          <div>
            <h1 className="hero__title">Outfit</h1>
            <p className="hero__sub">{tab === 'outfit' ? 'I tuoi completi salvati' : 'Cosa hai indossato, giorno per giorno'}</p>
          </div>
        </div>
        <Segmented value={tab} onChange={(v) => setSp({ vista: v }, { replace: true })}
          options={[['outfit', <><LayoutGrid size={16} />Completi</>], ['calendario', <><CalendarDays size={16} />Calendario</>]]} />
      </header>
      {tab === 'outfit' ? <OutfitGrid /> : <Calendar />}
    </div>
  );
}

function OutfitGrid() {
  const { data, userId } = useStore();
  const personal = usePersonal();
  const author = (o) => (o.created_by && o.created_by !== userId) ? (personal.isViewer ? personal.adminName : personal.viewerName) : (o.created_by && personal.isViewer ? personal.viewerName : null);
  const [fav, setFav] = useState(false);
  const [tag, setTag] = useState(null);
  const uses = useMemo(() => {
    const m = {}; data.wear_logs.forEach((l) => { if (l.outfit_id) m[l.outfit_id] = (m[l.outfit_id] || 0) + 1; }); return m;
  }, [data.wear_logs]);
  const tags = [...new Set(data.outfits.flatMap((o) => o.tags || []))].sort();
  const list = data.outfits.filter((o) => (!fav || o.favorite) && (!tag || o.tags?.includes(tag)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <>
      {(tags.length > 0 || data.outfits.length > 0) && (
        <div className="chips-scroll pad-x">
          <Chip active={!fav && !tag} onClick={() => { setFav(false); setTag(null); }}>Tutti</Chip>
          <Chip active={fav} onClick={() => setFav(!fav)} icon={<Heart size={14} />}>Preferiti</Chip>
          {tags.map((t) => <Chip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>{t}</Chip>)}
        </div>
      )}
      {list.length ? (
        <div className="grid grid--2">
          {list.map((o) => (
            <Link key={o.id} to={`/outfit/${o.id}`} className="card">
              <div className="card__media card__media--square">
                <OutfitCollage ids={o.item_ids} />
                {o.favorite && <span className="fav fav--on fav--static"><Heart size={14} fill="currentColor" /></span>}
              </div>
              <div className="card__body">
                <h3 className="card__name">{o.name}</h3>
                <p className="card__cat">{o.item_ids.length} capi · {uses[o.id] || 0} {uses[o.id] === 1 ? 'volta' : 'volte'}</p>
                {(o.tags?.length > 0 || author(o)) && <div className="badges">{author(o) && <span className="tag tag--author">di {author(o)}</span>}{o.tags.slice(0, 3).map((t) => <span key={t} className="tag">{t}</span>)}</div>}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Empty icon={<Layers size={28} />} title="Nessun outfit" text="Combina i tuoi capi e salva i completi che ti piacciono."
          action={<Link className="btn btn--primary" to="/outfit/nuovo"><Plus size={18} />Crea outfit</Link>} />
      )}
      <Link to="/outfit/nuovo" className="fab" aria-label="Nuovo outfit"><Plus size={26} /></Link>
    </>
  );
}

const WD = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

function Calendar() {
  const { data, itemBy } = useStore();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [day, setDay] = useState(null);
  const byDay = useMemo(() => {
    const m = {}; data.wear_logs.forEach((l) => { (m[l.worn_on] ||= []).push(l); }); return m;
  }, [data.wear_logs]);

  const first = (month.getDay() + 6) % 7; // lunedì = 0
  const nDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: nDays }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  const today = isoDate();
  const monthLogs = Object.entries(byDay).filter(([d]) => d.startsWith(isoDate(month).slice(0, 7)));

  return (
    <div className="calendar">
      <div className="cal-head">
        <button className="icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={20} /></button>
        <h2>{month.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</h2>
        <button className="icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={20} /></button>
      </div>
      <div className="cal-grid">
        {WD.map((w, i) => <span key={i} className="cal-wd">{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={'e' + i} />;
          const k = isoDate(d);
          const logs = byDay[k] || [];
          const firstItem = logs.flatMap((l) => l.item_ids).map((x) => itemBy[x]).find(Boolean);
          return (
            <button key={k} className={cx('cal-day', k === today && 'cal-day--today', logs.length && 'cal-day--has')} onClick={() => setDay(k)}>
              {firstItem ? <Photo path={firstItem.thumb_path || firstItem.photo_path} /> : null}
              <span className="cal-day__n">{d.getDate()}</span>
            </button>
          );
        })}
      </div>
      <p className="cal-sum">{monthLogs.length} {monthLogs.length === 1 ? 'giorno registrato' : 'giorni registrati'} questo mese</p>
      <button className="btn btn--block" onClick={() => setDay(today)}><CalendarCheck size={18} />Cosa indosso oggi?</button>
      {day && <DaySheet day={day} logs={byDay[day] || []} onClose={() => setDay(null)} />}
    </div>
  );
}

function DaySheet({ day, logs, onClose }) {
  const { data, itemBy, isAdmin, saveLog, deleteLog } = useStore();
  const log = logs[0];
  const [ids, setIds] = useState(log?.item_ids || []);
  const [outfitId, setOutfitId] = useState(log?.outfit_id || null);
  const [note, setNote] = useState(log?.note || '');
  const [picker, setPicker] = useState(false);
  const os = data.outfits;
  const chooseOutfit = (o) => {
    if (outfitId === o.id) { setOutfitId(null); return; }
    setOutfitId(o.id); setIds(o.item_ids);
  };
  const save = async () => {
    if (!ids.length) { if (log) await deleteLog(log.id); onClose(); return; }
    await saveLog({ ...(log || {}), worn_on: day, item_ids: ids, outfit_id: outfitId, note: note || null });
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long' })} tall
      footer={isAdmin && (
        <div className="row gap">
          {log && <button className="btn btn--danger" onClick={async () => { await deleteLog(log.id); onClose(); }}><Trash2 size={18} /></button>}
          <button className="btn btn--primary grow" onClick={save}>Salva giornata</button>
        </div>
      )}>
      {ids.length ? (
        <div className="pick-grid pick-grid--3">
          {ids.map((id) => itemBy[id]).filter(Boolean).map((it) => (
            <div key={it.id} className="pick pick--static">
              <Photo path={it.thumb_path || it.photo_path} />
              <span className="pick__name">{it.name}</span>
              {isAdmin && <button className="pick__x" onClick={() => { setIds(ids.filter((x) => x !== it.id)); setOutfitId(null); }}><X size={14} /></button>}
            </div>
          ))}
        </div>
      ) : <p className="muted center pad">Nessun capo registrato per questo giorno.</p>}
      {isAdmin && (
        <>
          <button className="btn btn--block" onClick={() => setPicker(true)}><Plus size={18} />Scegli i capi</button>
          {os.length > 0 && (
            <>
              <h4 className="sheet-sub">Oppure scegli un outfit salvato</h4>
              <div className="h-scroll">
                {os.map((o) => (
                  <button key={o.id} className={cx('mini-outfit', outfitId === o.id && 'mini-outfit--on')} onClick={() => chooseOutfit(o)}>
                    <OutfitCollage ids={o.item_ids} />
                    <span>{o.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <Field label="Nota"><input className="input" placeholder="Es. matrimonio di Luca, pioveva…" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </>
      )}
      {!isAdmin && log?.note && <p className="pad">{log.note}</p>}
      <ItemPicker open={picker} onClose={() => setPicker(false)} selected={ids} onChange={(v) => { setIds(v); setOutfitId(null); }} />
    </Sheet>
  );
}

/* ---------------- dettaglio outfit ---------------- */
export function OutfitDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, itemBy, isAdmin, saveLog, deleteOutfit, notify, saveOutfit, canEditOutfit } = useStore();
  const o = data.outfits.find((x) => x.id === id);
  if (!o) return <div className="page"><TopBar title="Outfit non trovato" back /></div>;
  const canEdit = canEditOutfit(o);
  const logs = data.wear_logs.filter((l) => l.outfit_id === o.id).sort((a, b) => b.worn_on.localeCompare(a.worn_on));
  const items = o.item_ids.map((x) => itemBy[x]).filter(Boolean);
  const wornToday = async () => {
    const today = isoDate();
    const ex = data.wear_logs.find((l) => l.worn_on === today);
    if (ex?.outfit_id === o.id) { notify('Già segnato per oggi'); return; }
    await saveLog({ ...(ex || {}), worn_on: today, outfit_id: o.id, item_ids: o.item_ids });
  };
  return (
    <div className="page page--detail">
      <TopBar title={o.name} back sub={o.tags?.join(' · ')}
        actions={canEdit && <>
          <button className="icon-btn" onClick={() => saveOutfit({ ...o, favorite: !o.favorite })}><Heart size={20} fill={o.favorite ? 'currentColor' : 'none'} className={o.favorite ? 'red' : ''} /></button>
          <Link className="icon-btn" to={`/outfit/${o.id}/modifica`}><Pencil size={20} /></Link>
        </>} />
      <OutfitCollage ids={o.item_ids} className="collage--hero" />
      <div className="mini-stats">
        <div><b>{items.length}</b><span>capi</span></div>
        <div><b>{logs.length}</b><span>{logs.length === 1 ? 'volta' : 'volte'}</span></div>
        <div><b>{logs[0] ? fmtDate(logs[0].worn_on, { day: 'numeric', month: 'short' }) : '—'}</b><span>ultima volta</span></div>
      </div>
      {isAdmin && <button className="btn btn--primary btn--block" onClick={wornToday}><CalendarCheck size={18} />Lo indosso oggi</button>}
      <div className="grid grid--2 mt">
        {items.map((it) => (
          <Link key={it.id} to={`/capo/${it.id}`} className="card">
            <div className="card__media"><Photo path={it.thumb_path || it.photo_path} /></div>
            <div className="card__body"><h3 className="card__name">{it.name}</h3></div>
          </Link>
        ))}
      </div>
      {o.notes && <div className="form-card"><p>{o.notes}</p></div>}
      {canEdit && (
        <button className="btn btn--danger btn--block mt" onClick={async () => {
          if (!window.confirm('Eliminare questo outfit?')) return;
          await deleteOutfit(o.id); nav('/outfit', { replace: true });
        }}><Trash2 size={18} />Elimina outfit</button>
      )}
    </div>
  );
}

/* ---------------- crea / modifica outfit ---------------- */
export function OutfitEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { data, itemBy, saveOutfit, notify, canEditOutfit } = useStore();
  const orig = id ? data.outfits.find((x) => x.id === id) : null;
  const blocked = orig && !canEditOutfit(orig);
  const preset = sp.get('capi')?.split(',').filter((x) => itemBy[x]) || [];
  const [o, setO] = useState(() => orig || { name: '', item_ids: preset, tags: [], favorite: false, notes: '' });
  const [picker, setPicker] = useState(!orig && !preset.length);
  const [tag, setTag] = useState('');
  const allTags = [...new Set([...data.outfits.flatMap((x) => x.tags || []), 'Casual', 'Lavoro', 'Uscita', 'Elegante', 'Sport'])];
  const set = (p) => setO((x) => ({ ...x, ...p }));
  const toggleTag = (t) => set({ tags: o.tags.includes(t) ? o.tags.filter((x) => x !== t) : [...o.tags, t] });
  const submit = async (e) => {
    e.preventDefault();
    if (blocked) return notify('Puoi modificare solo i tuoi outfit', 'err');
    if (!o.name.trim()) return notify('Dai un nome all\'outfit', 'err');
    if (!o.item_ids.length) return notify('Scegli almeno un capo', 'err');
    const saved = await saveOutfit({ ...o, name: o.name.trim() });
    nav(`/outfit/${saved.id}`, { replace: true });
  };
  return (
    <form className="page page--form" onSubmit={submit}>
      <TopBar title={orig ? 'Modifica outfit' : 'Nuovo outfit'} back />
      <div className="pick-grid pick-grid--3">
        {o.item_ids.map((x) => itemBy[x]).filter(Boolean).map((it) => (
          <div key={it.id} className="pick pick--static">
            <Photo path={it.thumb_path || it.photo_path} />
            <span className="pick__name">{it.name}</span>
            <button type="button" className="pick__x" onClick={() => set({ item_ids: o.item_ids.filter((y) => y !== it.id) })}><X size={14} /></button>
          </div>
        ))}
        <button type="button" className="pick pick--add" onClick={() => setPicker(true)}><Plus size={22} /><span>Capi</span></button>
      </div>
      <div className="form-card">
        <Field label="Nome"><input className="input" placeholder="Es. Aperitivo estivo" value={o.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Etichette">
          <div className="chips-wrap">
            {allTags.map((t) => <Chip key={t} small active={o.tags.includes(t)} onClick={() => toggleTag(t)}>{t}</Chip>)}
          </div>
          <div className="row gap mt-s">
            <input className="input grow" placeholder="Nuova etichetta" value={tag} onChange={(e) => setTag(e.target.value)} />
            <button type="button" className="btn" disabled={!tag.trim()} onClick={() => { toggleTag(tag.trim()); setTag(''); }}>Aggiungi</button>
          </div>
        </Field>
        <Toggle label="Preferito" checked={o.favorite} onChange={(v) => set({ favorite: v })} />
        <Field label="Note"><textarea className="input" rows={2} value={o.notes || ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>
      <div className="form-save"><button className="btn btn--primary btn--block btn--lg">Salva outfit</button></div>
      <ItemPicker open={picker} onClose={() => setPicker(false)} selected={o.item_ids} onChange={(v) => set({ item_ids: v })} />
    </form>
  );
}
