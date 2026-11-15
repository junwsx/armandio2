import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Heart, Pencil, Trash2, CalendarCheck, Copy, Repeat, Clock, Euro, Archive, ArchiveRestore, ChevronRight, ChevronDown, Info, History } from 'lucide-react';
import { backend } from '../lib/backend.js';
import { usePersonal } from '../lib/personal.js';
import { useStore } from '../lib/store.jsx';
import { TopBar, Photo, Tag, Swatch, Stars, Sheet } from '../components/ui.jsx';
import { asArray, attrText, daysBetween, fmtDate, fmtMoney, isoDate, cx } from '../lib/utils.js';

export default function ItemDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { itemBy, pathOf, attrsFor, wear, lastWorn, isAdmin, toggleFavorite, deleteItem, data, saveLog, sys, notify, setArchived } = useStore();
  const it = itemBy[id];
  if (!it) return <div className="page"><TopBar title="Capo non trovato" back="/" /></div>;
  const path = pathOf(it.category_id);
  const fields = attrsFor(it.category_id);
  const n = wear[it.id] || 0;
  const price = Number(it.attrs?.[sys.price?.id]) || 0;
  const bought = it.attrs?.[sys.purchase_date?.id];
  const outfits = data.outfits.filter((o) => o.item_ids.includes(it.id));
  const [datesOpen, setDatesOpen] = useState(false);

  const wornToday = async () => {
    const today = isoDate();
    const log = data.wear_logs.find((l) => l.worn_on === today);
    if (log?.item_ids.includes(it.id)) { notify('Già segnato per oggi'); return; }
    await saveLog(log ? { ...log, item_ids: [...log.item_ids, it.id] } : { worn_on: today, item_ids: [it.id], outfit_id: null });
  };

  return (
    <div className="page page--detail">
      <TopBar title="" back
        actions={isAdmin && <>
          <button className="icon-btn" onClick={() => nav(`/capo/nuovo?da=${it.id}`)} aria-label="Duplica"><Copy size={20} /></button>
          <Link className="icon-btn" to={`/capo/${it.id}/modifica`} aria-label="Modifica"><Pencil size={20} /></Link>
        </>} />
      <div className="detail-photo">
        <Photo path={it.photo_path || it.thumb_path} alt={it.name} />
        <button className={cx('fav fav--lg', it.favorite && 'fav--on')} onClick={() => isAdmin && toggleFavorite(it)} aria-label="Preferito">
          <Heart size={20} fill={it.favorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      {it.archived && (
        <div className="archived-note"><Archive size={16} /><span>Capo archiviato: non compare nell'armadio, nelle idee e nelle statistiche.</span></div>
      )}
      <div className="detail-head">
        {path.length > 0 && <p className="crumb-text">{path.map((c) => c.name).join(' › ')}</p>}
        <h1>{it.name}</h1>
      </div>

      <div className="mini-stats">
        <button className="mini-stats__btn" disabled={!n} onClick={() => setDatesOpen(true)} aria-label="Vedi tutte le date">
          <Repeat size={16} /><b>{n}</b><span>{n === 1 ? 'volta' : 'volte'}{n > 0 && <> · date<ChevronRight size={11} /></>}</span>
        </button>
        <div><Clock size={16} /><b>{lastWorn[it.id] ? (daysBetween(lastWorn[it.id]) === 0 ? 'oggi' : `${daysBetween(lastWorn[it.id])}g fa`) : '—'}</b><span>ultima volta indossato</span></div>
        <div><Euro size={16} /><b>{price ? fmtMoney(price / Math.max(1, n)) : '—'}</b><span>per utilizzo</span></div>
      </div>

      {isAdmin && !it.archived && (
        <button className="btn btn--primary btn--block" onClick={wornToday}><CalendarCheck size={18} />L'ho indossato oggi</button>
      )}

      <div className="form-card">
        {fields.map((a) => {
          const v = it.attrs?.[a.id];
          if (v == null || v === '' || (Array.isArray(v) && !v.length)) return null;
          let body;
          if (a.type === 'select' || a.type === 'multiselect') {
            body = <div className="badges">{asArray(v).map((x) => a.options.find((o) => o.id === x)).filter(Boolean).map((o) =>
              a.system_key === 'color'
                ? <span key={o.id} className="swatches"><Swatch color={o.color} size={14} />{o.label}</span>
                : <Tag key={o.id} color={o.color}>{o.label}</Tag>)}</div>;
          } else if (a.type === 'rating') body = <Stars value={Number(v)} size={18} />;
          else body = <span>{attrText(a, v)}</span>;
          return <div className="kv" key={a.id}><span className="kv__k">{a.name}</span><span className="kv__v">{body}</span></div>;
        })}
        {bought && <div className="kv"><span className="kv__k">Nel tuo armadio da</span><span className="kv__v">{ageText(bought)}</span></div>}
        {it.notes && <div className="kv kv--block"><span className="kv__k">Note</span><p>{it.notes}</p></div>}
        {lastWorn[it.id] && <div className="kv"><span className="kv__k">Ultima volta indossato</span><span className="kv__v">{fmtDate(lastWorn[it.id], { weekday: 'short', day: 'numeric', month: 'long' })}</span></div>}
      </div>

      {outfits.length > 0 && (
        <>
          <h3 className="section-title">Negli outfit</h3>
          <div className="h-scroll">
            {outfits.map((o) => (
              <Link key={o.id} to={`/outfit/${o.id}`} className="mini-outfit">
                <OutfitCollage ids={o.item_ids} />
                <span>{o.name}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <ItemInfo item={it} />

      {isAdmin && (
        <div className="detail-actions mt">
          <button className="btn btn--block" onClick={() => setArchived(it, !it.archived)}>
            {it.archived ? <><ArchiveRestore size={18} />Ripristina nell'armadio</> : <><Archive size={18} />Archivia (non lo metto più)</>}
          </button>
          <button className="btn btn--danger btn--block" onClick={async () => {
            if (!window.confirm(`Eliminare per sempre «${it.name}»? L'operazione non si può annullare.\n\nSe vuoi solo toglierlo di mezzo, usa «Archivia».`)) return;
            await deleteItem(it);
            if (location.key !== 'default') nav(-1); else nav('/', { replace: true });
          }}><Trash2 size={18} />Elimina per sempre</button>
        </div>
      )}
      {datesOpen && <WearDates item={it} onClose={() => setDatesOpen(false)} />}
    </div>
  );
}

/* ---------- elenco di tutte le volte che è stato indossato ---------- */
function WearDates({ item, onClose }) {
  const { data } = useStore();
  const logs = data.wear_logs.filter((l) => asArray(l.item_ids).includes(item.id)).sort((a, b) => b.worn_on.localeCompare(a.worn_on));
  const outfitName = (id) => data.outfits.find((o) => o.id === id)?.name;
  return (
    <Sheet open onClose={onClose} title={`Indossato ${logs.length} ${logs.length === 1 ? 'volta' : 'volte'}`} tall>
      <ul className="dates">
        {logs.map((l) => {
          const d = daysBetween(l.worn_on);
          return (
            <li key={l.id}>
              <span className="dates__day">{fmtDate(l.worn_on, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span className="muted small">{d === 0 ? 'oggi' : d === 1 ? 'ieri' : `${d} giorni fa`}{l.outfit_id && outfitName(l.outfit_id) ? ` · outfit «${outfitName(l.outfit_id)}»` : ''}</span>
              {l.note && <span className="small">{l.note}</span>}
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

/* ---------- Info e cronologia ---------- */
function ItemInfo({ item }) {
  const { attrBy, pathOf } = useStore();
  const personal = usePersonal();
  const [open, setOpen] = useState(false);
  const [hist, setHist] = useState(undefined); // undefined = caricamento, null = non attiva
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setHist(undefined);
    backend.db.history(item.id).then((h) => alive && setHist(h)).catch(() => alive && setHist(null));
    return () => { alive = false; };
  }, [open, item.id, item.updated_at]);

  const when = (s) => s ? new Date(s).toLocaleString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const who = (r) => (r === 'viewer' ? personal.viewerName : r === 'admin' ? personal.adminName : '');
  const catName = (id) => (id ? pathOf(id).map((c) => c.name).join(' › ') || 'categoria eliminata' : 'nessuna');
  const line = (key, [a, b]) => {
    if (key === 'name') return a == null ? 'Capo creato' : <>Nome: <s>{a}</s> → <b>{b}</b></>;
    if (key === 'category_id') return <>Categoria: {catName(a)} → <b>{catName(b)}</b></>;
    if (key === 'photo_path') return a && b ? 'Foto cambiata' : b ? 'Foto aggiunta' : 'Foto rimossa';
    if (key === 'favorite') return b ? 'Aggiunto ai preferiti' : 'Tolto dai preferiti';
    if (key === 'archived') return b ? 'Archiviato' : 'Ripristinato dall\'archivio';
    if (key === 'notes') return 'Note modificate';
    if (key.startsWith('attr:')) {
      const at = attrBy[key.slice(5)];
      if (!at) return 'Attributo (eliminato) modificato';
      const fmt = (v) => attrText(at, v) || '—';
      return <>{at.name}: {fmt(a)} → <b>{fmt(b)}</b></>;
    }
    return key;
  };

  return (
    <div className={cx('info-box', open && 'info-box--open')}>
      <button className="info-box__head" onClick={() => setOpen(!open)}>
        <Info size={18} /><span className="grow"><b>Info e cronologia</b></span>{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>
      {open && (
        <div className="info-box__body">
          <div className="kv"><span className="kv__k">Creato</span><span className="kv__v">{when(item.created_at)}</span></div>
          <div className="kv"><span className="kv__k">Ultima modifica</span><span className="kv__v">{when(item.updated_at)}</span></div>
          <div className="kv"><span className="kv__k">Codice</span><span className="kv__v mono">{item.id.slice(0, 8)}</span></div>
          <h4 className="sheet-sub"><History size={14} /> Modifiche</h4>
          {hist === undefined && <p className="muted small">Carico…</p>}
          {hist === null && <p className="muted small">La cronologia non è ancora attiva: va eseguito su Supabase lo script <b>aggiornamento-03-cronologia-capi.sql</b>.</p>}
          {hist && !hist.length && <p className="muted small">Nessuna modifica registrata da quando è attiva la cronologia.</p>}
          {hist && hist.length > 0 && (
            <ul className="history">
              {hist.map((h) => (
                <li key={h.id}>
                  <span className="history__when">{when(h.at)}{who(h.user_role) && <> · {who(h.user_role)}</>}</span>
                  {Object.entries(h.changes || {}).map(([k, v]) => <span key={k} className="history__line">{line(k, v)}</span>)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ageText(d) {
  const days = daysBetween(d);
  if (days < 31) return `${days} giorni`;
  const m = Math.floor(days / 30.4);
  if (m < 12) return `${m} ${m === 1 ? 'mese' : 'mesi'}`;
  const y = Math.floor(m / 12), r = m % 12;
  return `${y} ${y === 1 ? 'anno' : 'anni'}${r ? ` e ${r} ${r === 1 ? 'mese' : 'mesi'}` : ''}`;
}

export function OutfitCollage({ ids, className }) {
  const { itemBy } = useStore();
  const items = ids.map((i) => itemBy[i]).filter(Boolean).slice(0, 4);
  return (
    <div className={cx('collage', `collage--${Math.max(1, items.length)}`, className)}>
      {items.map((it) => <Photo key={it.id} path={it.thumb_path || it.photo_path} />)}
      {!items.length && <Photo path={null} />}
    </div>
  );
}
