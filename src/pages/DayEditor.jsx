// Un giorno del calendario, a schermo intero: capi indossati, scelta guidata a sezioni,
// outfit salvati, nota, e la possibilità di salvare la combinazione come nuovo outfit.
// Lo possono gestire sia l'admin sia l'ospite.
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Layers, Check } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { TopBar, Field, Toggle, Empty } from '../components/ui.jsx';
import GuidedPicker, { ChosenBySection } from '../components/GuidedPicker.jsx';
import { OutfitCollage } from './ItemDetail.jsx';
import { fmtDate, isoDate, cx } from '../lib/utils.js';

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

export default function DayEditor() {
  const { giorno } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { data, itemBy, canEditCalendar, saveLog, deleteLog, saveOutfit, notify } = useStore();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(giorno || '') ? giorno : isoDate();
  const log = data.wear_logs.find((l) => l.worn_on === day);

  const [ids, setIds] = useState(log?.item_ids || []);
  const [outfitId, setOutfitId] = useState(log?.outfit_id || null);
  const [note, setNote] = useState(log?.note || '');
  const [asOutfit, setAsOutfit] = useState(false);
  const [outfitName, setOutfitName] = useState('');
  const [view, setView] = useState('day');
  const [busy, setBusy] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  const title = fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long' });
  const linked = outfitId ? data.outfits.find((o) => o.id === outfitId) : null;
  // l'outfit collegato vale solo se i capi sono ancora quelli
  const linkedOk = linked && sameSet(linked.item_ids, ids);
  const n = ids.filter((x) => itemBy[x]).length;

  const toggleItem = (iid) => setIds((x) => (x.includes(iid) ? x.filter((y) => y !== iid) : [...x, iid]));
  const chooseOutfit = (o) => {
    if (outfitId === o.id && linkedOk) { setOutfitId(null); return; }
    setOutfitId(o.id); setIds(o.item_ids); setAsOutfit(false);
  };
  const leave = () => (location.key !== 'default' ? nav(-1) : nav('/outfit?vista=calendario', { replace: true }));

  const save = async () => {
    if (!canEditCalendar) return;
    setBusy(true);
    try {
      if (!n) { if (log) await deleteLog(log.id); leave(); return; }
      let oid = linkedOk ? outfitId : null;
      if (asOutfit && !linkedOk) {
        const name = outfitName.trim() || `Outfit del ${fmtDate(day, { day: 'numeric', month: 'long' })}`;
        const o = await saveOutfit({ name, item_ids: ids, tags: [], favorite: false, notes: null });
        oid = o.id;
      }
      await saveLog({ ...(log || {}), worn_on: day, item_ids: ids, outfit_id: oid, note: note.trim() || null });
      leave();
    } catch { /* l'avviso d'errore lo mostra lo store */ } finally { setBusy(false); }
  };

  /* ---------- scelta guidata ---------- */
  if (view === 'picker') {
    return (
      <GuidedPicker title={title} onBack={() => setView('day')} selected={ids} onToggle={toggleItem}
        cta={{ disabled: false, onClick: () => setView('day'), label: n ? `Fatto · ${n} ${n === 1 ? 'capo' : 'capi'}` : 'Torna al giorno' }} />
    );
  }

  /* ---------- il giorno ---------- */
  return (
    <div className="page page--form">
      <TopBar title={title.charAt(0).toUpperCase() + title.slice(1)} back={leave}
        sub={day === isoDate() ? 'Oggi' : log ? 'Giorno registrato' : 'Nessun capo registrato'} />

      {n ? <ChosenBySection ids={ids} onRemove={canEditCalendar ? toggleItem : null} />
        : <Empty icon={<Layers size={26} />} title="Cosa hai indossato?" text="Scegli i capi sezione per sezione, oppure un outfit salvato." />}
      {linkedOk && <p className="day-linked"><Check size={14} /> Outfit «{linked.name}»</p>}

      {canEditCalendar && (
        <>
          <button className="btn btn--primary btn--block mt" onClick={() => setView('picker')}><Plus size={18} />{n ? 'Aggiungi o cambia capi' : 'Scegli i capi'}</button>

          {data.outfits.length > 0 && (
            <>
              <h4 className="sheet-sub mt">Oppure scegli un outfit salvato</h4>
              <div className="h-scroll">
                {[...data.outfits].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((o) => (
                  <button key={o.id} className={cx('mini-outfit', outfitId === o.id && linkedOk && 'mini-outfit--on')} onClick={() => chooseOutfit(o)}>
                    <OutfitCollage ids={o.item_ids} />
                    <span>{o.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="form-card">
            {n > 0 && !linkedOk && (
              <>
                <Toggle label="Salva anche come nuovo outfit" hint="Lo ritrovi nella sezione Outfit per riusarlo" checked={asOutfit} onChange={setAsOutfit} />
                {asOutfit && (
                  <Field label="Nome dell'outfit">
                    <input className="input" placeholder={`Outfit del ${fmtDate(day, { day: 'numeric', month: 'long' })}`} value={outfitName} onChange={(e) => setOutfitName(e.target.value)} />
                  </Field>
                )}
              </>
            )}
            <Field label="Nota"><input className="input" placeholder="Es. matrimonio di Luca, pioveva…" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </div>

          <div className="form-save row gap">
            {log && (
              <button className="btn btn--danger" disabled={busy} aria-label="Cancella il giorno" onClick={async () => {
                if (!window.confirm('Cancellare cosa hai indossato in questo giorno?')) return;
                await deleteLog(log.id); notify('Giorno cancellato'); leave();
              }}><Trash2 size={18} /></button>
            )}
            <button className="btn btn--primary btn--lg grow" disabled={busy} onClick={save}>{busy ? 'Salvo…' : 'Salva giornata'}</button>
          </div>
        </>
      )}
      {!canEditCalendar && log?.note && <div className="form-card"><p>{log.note}</p></div>}
    </div>
  );
}
