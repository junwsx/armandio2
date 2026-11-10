import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, ImagePlus, Wand2, ChevronRight, Undo2, Loader2 } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { TopBar, Field, Toggle, Photo } from '../components/ui.jsx';
import { CategoryPicker, AttrField } from '../components/pickers.jsx';
import { prepare, removeBackground } from '../lib/images.js';
import { uid } from '../lib/utils.js';
import { backend } from '../lib/backend.js';

export default function ItemEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const { itemBy, attrsFor, pathOf, saveItem, upload, notify, isAdmin } = useStore();
  const orig = id ? itemBy[id] : null;
  const dupFrom = new URLSearchParams(location.hash.split('?')[1] || '').get('da');
  const base = orig || (dupFrom && itemBy[dupFrom] ? { ...itemBy[dupFrom], id: undefined, name: itemBy[dupFrom].name + ' (copia)', photo_path: null, thumb_path: null } : null);

  const [item, setItem] = useState(() => base || { name: '', category_id: null, favorite: false, attrs: {}, notes: '' });
  const [file, setFile] = useState(null);         // blob originale scelto
  const [preview, setPreview] = useState(null);   // blob mostrato (eventualmente senza sfondo)
  const [bgDone, setBgDone] = useState(false);
  const [busy, setBusy] = useState('');
  const [catOpen, setCatOpen] = useState(false);
  const camRef = useRef(); const galRef = useRef();
  const previewUrl = usePreviewUrl(preview);

  useEffect(() => { if (!isAdmin) nav('/', { replace: true }); }, [isAdmin, nav]);
  if (id && !orig) return <div className="page"><TopBar title="Capo non trovato" back /></div>;

  const set = (patch) => setItem((x) => ({ ...x, ...patch }));
  const setAttr = (aid, v) => setItem((x) => ({ ...x, attrs: { ...x.attrs, [aid]: v } }));
  const path = pathOf(item.category_id);
  const fields = attrsFor(item.category_id);

  const pick = (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setFile(f); setPreview(f); setBgDone(false);
  };

  const doBg = async () => {
    try {
      setBusy('Preparo la rimozione sfondo…');
      const out = await removeBackground(file, (m) => setBusy(m));
      setPreview(out); setBgDone(true);
    } catch (e) {
      console.error(e);
      notify('Rimozione sfondo non riuscita', 'err');
    } finally { setBusy(''); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!item.name.trim()) { notify('Dai un nome al capo', 'err'); return; }
    try {
      let next = { ...item, name: item.name.trim() };
      if (preview) {
        setBusy('Comprimo la foto…');
        const { full, thumb } = await prepare(preview, bgDone);
        setBusy('Carico la foto…');
        const key = uid();
        const ext = full.type === 'image/jpeg' ? 'jpg' : 'webp';
        const [p1, p2] = await Promise.all([upload(`items/${key}.${ext}`, full), upload(`items/${key}_t.${ext}`, thumb)]);
        const old = [orig?.photo_path, orig?.thumb_path].filter(Boolean);
        next = { ...next, photo_path: p1, thumb_path: p2 };
        if (old.length) backend.storage.remove(old).catch(() => {});
      }
      setBusy('Salvo…');
      const saved = await saveItem(next);
      nav(`/capo/${saved.id}`, { replace: true });
    } catch (err) { console.error(err); } finally { setBusy(''); }
  };

  return (
    <form className="page page--form" onSubmit={submit}>
      <TopBar title={orig ? 'Modifica capo' : 'Nuovo capo'} back />

      <div className="photo-edit">
        {previewUrl ? (
          <div className={`photo ${bgDone ? 'photo--cut' : ''}`}><img src={previewUrl} alt="" /></div>
        ) : item.photo_path ? (
          <Photo path={item.photo_path} />
        ) : (
          <div className="photo-edit__empty">
            <ImagePlus size={34} strokeWidth={1.4} />
            <span>Aggiungi una foto del capo</span>
          </div>
        )}
        {busy && <div className="photo-edit__busy"><Loader2 className="spin" size={22} /><span>{busy}</span></div>}
      </div>
      <div className="photo-actions">
        <button type="button" className="btn" onClick={() => camRef.current.click()}><Camera size={18} />Scatta</button>
        <button type="button" className="btn" onClick={() => galRef.current.click()}><ImagePlus size={18} />Galleria</button>
        {file && !bgDone && <button type="button" className="btn btn--accent" disabled={!!busy} onClick={doBg}><Wand2 size={18} />Rimuovi sfondo</button>}
        {bgDone && <button type="button" className="btn" onClick={() => { setPreview(file); setBgDone(false); }}><Undo2 size={18} />Originale</button>}
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
        <input ref={galRef} type="file" accept="image/*" hidden onChange={pick} />
      </div>
      {file && !bgDone && <p className="field__hint center">La prima rimozione scarica un modello (~40 MB) che poi resta in cache.</p>}

      <div className="form-card">
        <Field label="Nome">
          <input className="input" placeholder="Es. Polo blu navy" value={item.name} onChange={(e) => set({ name: e.target.value })} required />
        </Field>
        <Field label="Categoria">
          <button type="button" className="input input--btn" onClick={() => setCatOpen(true)}>
            <span className={path.length ? '' : 'muted'}>{path.length ? path.map((c) => c.name).join(' › ') : 'Scegli…'}</span>
            <ChevronRight size={18} />
          </button>
        </Field>
        <Toggle label="Preferito" checked={item.favorite} onChange={(v) => set({ favorite: v })} />
      </div>

      <div className="form-card">
        <h3 className="form-card__title">Dettagli</h3>
        {fields.map((a) => (
          <Field key={a.id} label={a.name}>
            <AttrField attr={a} value={item.attrs?.[a.id]} onChange={(v) => setAttr(a.id, v)} />
          </Field>
        ))}
        <Field label="Note">
          <textarea className="input" rows={3} placeholder="Lavaggio, dove l'hai comprato, abbinamenti…" value={item.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>

      <div className="form-save">
        <button className="btn btn--primary btn--block btn--lg" disabled={!!busy}>{busy ? busy : orig ? 'Salva modifiche' : 'Aggiungi all\'armadio'}</button>
      </div>

      <CategoryPicker open={catOpen} onClose={() => setCatOpen(false)} value={item.category_id} onPick={(cid) => set({ category_id: cid })} allowAny />
    </form>
  );
}

function usePreviewUrl(blob) {
  const [u, setU] = useState(null);
  useEffect(() => {
    if (!blob) { setU(null); return; }
    const x = URL.createObjectURL(blob); setU(x);
    return () => URL.revokeObjectURL(x);
  }, [blob]);
  return u;
}

