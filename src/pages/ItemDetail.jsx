import { Link, useNavigate, useParams } from 'react-router-dom';
import { Heart, Pencil, Trash2, CalendarCheck, Copy, Repeat, Clock, Euro } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { TopBar, Photo, Tag, Swatch, Stars } from '../components/ui.jsx';
import { asArray, attrText, daysBetween, fmtDate, fmtMoney, isoDate, cx } from '../lib/utils.js';

export default function ItemDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { itemBy, pathOf, attrsFor, wear, lastWorn, isAdmin, toggleFavorite, deleteItem, data, saveLog, sys, notify } = useStore();
  const it = itemBy[id];
  if (!it) return <div className="page"><TopBar title="Capo non trovato" back="/" /></div>;
  const path = pathOf(it.category_id);
  const fields = attrsFor(it.category_id);
  const n = wear[it.id] || 0;
  const price = Number(it.attrs?.[sys.price?.id]) || 0;
  const bought = it.attrs?.[sys.purchase_date?.id];
  const outfits = data.outfits.filter((o) => o.item_ids.includes(it.id));

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

      <div className="detail-head">
        {path.length > 0 && <p className="crumb-text">{path.map((c) => c.name).join(' › ')}</p>}
        <h1>{it.name}</h1>
      </div>

      <div className="mini-stats">
        <div><Repeat size={16} /><b>{n}</b><span>{n === 1 ? 'volta' : 'volte'}</span></div>
        <div><Clock size={16} /><b>{lastWorn[it.id] ? `${daysBetween(lastWorn[it.id])}g` : '—'}</b><span>ultimo uso</span></div>
        <div><Euro size={16} /><b>{price ? fmtMoney(price / Math.max(1, n)) : '—'}</b><span>per utilizzo</span></div>
      </div>

      {isAdmin && (
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
        {lastWorn[it.id] && <div className="kv"><span className="kv__k">Ultima volta</span><span className="kv__v">{fmtDate(lastWorn[it.id], { weekday: 'short', day: 'numeric', month: 'long' })}</span></div>}
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

      {isAdmin && (
        <button className="btn btn--danger btn--block mt" onClick={async () => {
          if (!window.confirm(`Eliminare «${it.name}»? L'operazione non si può annullare.`)) return;
          await deleteItem(it); nav('/', { replace: true });
        }}><Trash2 size={18} />Elimina capo</button>
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
