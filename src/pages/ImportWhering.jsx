import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileArchive, Loader2, CheckCircle2, AlertTriangle, Upload } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { TopBar, Toggle } from '../components/ui.jsx';
import { loadWheringZip, preview as makePreview, importWhering } from '../lib/whering.js';
import { prepare } from '../lib/images.js';

export default function ImportWhering() {
  const store = useStore();
  const ref = useRef(store); ref.current = store;
  const inputRef = useRef();
  const [data, setData] = useState(null);
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(null);
  const [withOutfits, setWithOutfits] = useState(true);
  const [result, setResult] = useState(null);

  if (!store.isAdmin) return <div className="page"><TopBar title="Importa da Whering" back="/impostazioni" /><p className="muted pad">Solo l'amministratore può importare.</p></div>;

  const already = Object.keys(store.settingsBy.import_whering || {}).filter((k) => k !== '__outfits').length;

  const pick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setErr(''); setResult(null); setBusy('Leggo il file…');
    try {
      const d = await loadWheringZip(f);
      setData(d); setInfo(makePreview(d.pieces, d.outfits));
    } catch (x) { setErr(x.message); setData(null); } finally { setBusy(''); }
  };

  const run = async () => {
    setBusy('Importo…'); setErr('');
    try {
      const s = ref.current;
      const r = await importWhering(data, {
        cats: s.cats, attrs: s.attrs, sys: s.sys,
        saveCategory: s.saveCategory, saveAttribute: s.saveAttribute,
        insert: s.insertRaw, upload: s.upload, prepare,
        getMap: () => ref.current.settingsBy.import_whering,
        setMap: (m) => ref.current.setSetting('import_whering', m),
      }, { withOutfits, onProgress: setProgress });
      setResult(r);
    } catch (x) { setErr(x.message); } finally { setBusy(''); setProgress(null); }
  };

  return (
    <div className="page">
      <TopBar title="Importa da Whering" back="/impostazioni" sub="Capi, foto e outfit dal tuo vecchio armadio" />

      {!data && !result && (
        <div className="form-card">
          <p>Scegli il file <b>whering-export-con-foto.zip</b>. È nella cartella <i>WEB APP CLOTHING → whering-export</i> sul PC, oppure nei Download.</p>
          <p className="muted small">Sul telefono puoi selezionarlo da File / Google Drive se ce lo hai copiato.</p>
          {already > 0 && <p className="small"><AlertTriangle size={13} /> {already} capi risultano già importati: verranno saltati, quindi puoi rilanciare l'importazione senza creare doppioni.</p>}
          <button className="btn btn--primary btn--block btn--lg" disabled={!!busy} onClick={() => inputRef.current.click()}>
            {busy ? <><Loader2 className="spin" size={18} />{busy}</> : <><FileArchive size={18} />Scegli lo ZIP</>}
          </button>
          <input ref={inputRef} type="file" accept=".zip,application/zip" hidden onChange={pick} />
        </div>
      )}

      {data && info && !result && (
        <>
          <div className="kpis mt">
            <div className="kpi"><span>Capi</span><b>{info.pieces}</b><small>con foto senza sfondo</small></div>
            <div className="kpi"><span>Outfit</span><b>{info.outfits}</b></div>
            <div className="kpi"><span>Con stato di usura</span><b>{info.withWear}</b></div>
            <div className="kpi"><span>Con marca</span><b>{info.withBrand}</b></div>
          </div>
          <div className="stat-card">
            <h3>Dove finiranno</h3>
            <p className="muted small">Le categorie che non esistono ancora vengono create. Puoi rinominarle o spostarle dopo.</p>
            <div className="bars">
              {info.categories.map(([c, n]) => (
                <div key={c} className="bars__row"><span className="bars__label">{c}</span><span className="bar"><span style={{ width: `${(n / info.categories[0][1]) * 100}%` }} /></span><span className="bars__v">{n}</span></div>
              ))}
            </div>
          </div>
          <div className="form-card">
            <p className="small">Verranno compilati anche <b>colori</b>, <b>stagioni</b>, <b>uso</b> (dalle occasioni), <b>stato di usura</b>, <b>marca</b> e <b>taglia</b>. Il nome di ogni capo è generato da tipo + colore, es. «Maglione blu navy».</p>
            <Toggle label="Importa anche gli outfit" checked={withOutfits} onChange={setWithOutfits} />
            {progress ? (
              <div className="progress">
                <div className="progress__bar"><span style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
                <span className="small">{progress.phase === 'capi' ? 'Capi' : 'Outfit'} {progress.done}/{progress.total}{progress.phase === 'capi' ? ' · carico foto e dati' : ''}</span>
              </div>
            ) : null}
            <div className="row gap">
              <button className="btn" disabled={!!busy} onClick={() => { setData(null); setInfo(null); }}>Annulla</button>
              <button className="btn btn--primary grow" disabled={!!busy} onClick={run}>
                {busy ? <><Loader2 className="spin" size={18} />Non chiudere la pagina…</> : <><Upload size={18} />Importa {info.pieces} capi</>}
              </button>
            </div>
          </div>
        </>
      )}

      {result && (
        <div className="form-card mt center">
          <CheckCircle2 size={40} color="#22a06b" style={{ margin: '0 auto' }} />
          <h3>Importazione completata</h3>
          <p>{result.created} capi importati{result.skipped ? `, ${result.skipped} già presenti` : ''}{result.outfits ? `, ${result.outfits} outfit` : ''}.</p>
          {result.errors.length > 0 && (
            <p className="small red">{result.errors.length} errori: puoi rilanciare l'importazione, i capi già caricati verranno saltati.<br />{result.errors.slice(0, 3).join(' · ')}</p>
          )}
          <Link to="/" className="btn btn--primary btn--block">Vai all'armadio</Link>
        </div>
      )}

      {err && <p className="login__err pad">{err}</p>}
    </div>
  );
}
