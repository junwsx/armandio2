import { useEffect, useState } from 'react';
import { backend } from './lib/backend.js';
import { HeartPhoto } from './components/personal.jsx';
import { HashRouter, NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { Shirt, Layers, Sparkles, BarChart3, Settings as Cog, Loader2, LockKeyhole, Eye, EyeOff } from 'lucide-react';
import { StoreProvider, useStore } from './lib/store.jsx';
import { Toast } from './components/ui.jsx';
import Wardrobe from './pages/Wardrobe.jsx';
import ItemDetail from './pages/ItemDetail.jsx';
import ItemEdit from './pages/ItemEdit.jsx';
import Outfits, { OutfitDetail, OutfitEdit } from './pages/Outfits.jsx';
import Inspiration from './pages/Inspiration.jsx';
import Stats from './pages/Stats.jsx';
import ImportWhering from './pages/ImportWhering.jsx';
import Settings, { PersonalSettings, FieldsSettings, CategoriesSettings, AttributesSettings, GridSettings, FiltersSettings, SearchSettings, AppearanceSettings } from './pages/Settings.jsx';

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </StoreProvider>
  );
}

function Shell() {
  const { session, data, role, error, demo, signOut } = useStore();
  if (session === undefined || (session && !data && !error && role !== 'pending')) return <Splash />;
  if (!session) return <Login />;
  if (role === 'pending') return (
    <div className="center-screen">
      <LockKeyhole size={36} />
      <h2>Accesso non abilitato</h2>
      <p className="muted">Il tuo utente esiste ma non ha ancora un ruolo. L'amministratore deve assegnarlo da Supabase.</p>
      <button className="btn" onClick={signOut}>Esci</button>
    </div>
  );
  if (error) return (
    <div className="center-screen">
      <h2>Qualcosa non va</h2><p className="muted">{error}</p>
      <button className="btn" onClick={() => location.reload()}>Riprova</button>
    </div>
  );
  return (
    <>
      {demo && <div className="demo-banner">Modalità demo · i dati restano in questo browser</div>}
      <main className="app">
        <Routes>
          <Route path="/" element={<Wardrobe />} />
          <Route path="/capo/nuovo" element={<ItemEdit />} />
          <Route path="/capo/:id" element={<ItemDetail />} />
          <Route path="/capo/:id/modifica" element={<ItemEdit />} />
          <Route path="/outfit" element={<Outfits />} />
          <Route path="/outfit/nuovo" element={<OutfitEdit />} />
          <Route path="/outfit/:id" element={<OutfitDetail />} />
          <Route path="/outfit/:id/modifica" element={<OutfitEdit />} />
          <Route path="/ispirazioni" element={<Inspiration />} />
          <Route path="/statistiche" element={<Stats />} />
          <Route path="/impostazioni" element={<Settings />} />
          <Route path="/impostazioni/categorie" element={<CategoriesSettings />} />
          <Route path="/impostazioni/attributi" element={<AttributesSettings />} />
          <Route path="/impostazioni/griglia" element={<GridSettings />} />
          <Route path="/impostazioni/filtri" element={<FiltersSettings />} />
          <Route path="/impostazioni/ricerche" element={<SearchSettings />} />
          <Route path="/impostazioni/aspetto" element={<AppearanceSettings />} />
          <Route path="/impostazioni/personalizza" element={<PersonalSettings />} />
          <Route path="/impostazioni/campi" element={<FieldsSettings />} />
          <Route path="/impostazioni/importa-whering" element={<ImportWhering />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
      <Toast />
    </>
  );
}

function BottomNav() {
  const loc = useLocation();
  const hide = /\/(nuovo|modifica)$/.test(loc.pathname);
  if (hide) return null;
  const tabs = [
    ['/', <Shirt size={22} />, 'Armadio', (p) => p === '/' || p.startsWith('/capo')],
    ['/outfit', <Layers size={22} />, 'Outfit', (p) => p.startsWith('/outfit')],
    ['/ispirazioni', <Sparkles size={22} />, 'Idee', (p) => p.startsWith('/ispirazioni')],
    ['/statistiche', <BarChart3 size={22} />, 'Statistiche', (p) => p.startsWith('/statistiche')],
    ['/impostazioni', <Cog size={22} />, 'Altro', (p) => p.startsWith('/impostazioni')],
  ];
  return (
    <nav className="bottom-nav">
      {tabs.map(([to, icon, label, match]) => (
        <NavLink key={to} to={to} className={() => (match(loc.pathname) ? 'on' : '')}>
          {icon}<span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function Splash() {
  return <div className="center-screen"><HangerLogo size={56} /><Loader2 className="spin muted" size={22} /></div>;
}

export function HangerLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M26 17a6 6 0 1 1 9.5 4.9c-2 1.4-3.5 2.6-3.5 5.1v1.5" />
      <path d="M32 28.5 7.5 44.5a3 3 0 0 0 1.6 5.5h45.8a3 3 0 0 0 1.6-5.5Z" />
    </svg>
  );
}

function Login() {
  const { signIn } = useStore();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [look, setLook] = useState(() => { try { return JSON.parse(localStorage.getItem('armadio-login')); } catch { return null; } });
  useEffect(() => {
    backend.pub?.json('login.json').then((j) => { if (j) { setLook(j); try { localStorage.setItem('armadio-login', JSON.stringify(j)); } catch { /* */ } } });
  }, []);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await signIn(u, p); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="login">
      <div className="login__brand">
        <HangerLogo size={44} />
        <h1>{look?.title || <>Armadio<br />Digitale</>}</h1>
        <p>{look?.subtitle || 'Il tuo guardaroba, sempre con te.'}</p>
      </div>
      {look?.photo && <HeartPhoto src={`${backend.pub.url('login.webp')}?v=${look.photo}`} size={230} className="login__heart" />}
      <form className="login__form" onSubmit={submit}>
        <label className="field"><span className="field__label">Utente o email</span>
          <input className="input input--lg" autoComplete="username" autoCapitalize="none" value={u} onChange={(e) => setU(e.target.value)} required /></label>
        <label className="field"><span className="field__label">Password</span>
          <span className="input-unit">
            <input className="input input--lg" type={show ? 'text' : 'password'} autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} required />
            <button type="button" className="icon-btn icon-btn--sm" onClick={() => setShow(!show)} aria-label="Mostra password">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </span></label>
        {err && <p className="login__err">{err}</p>}
        <button className="btn btn--primary btn--block btn--lg" disabled={busy}>{busy ? <Loader2 className="spin" size={18} /> : 'Entra'}</button>
      </form>
    </div>
  );
}
