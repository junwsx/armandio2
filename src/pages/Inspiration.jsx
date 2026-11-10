import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shuffle, Sparkles, Save, CalendarCheck, ExternalLink, Plus, Check, AlertTriangle, Palette, PackageSearch, Eye, Bookmark, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { analyze, generateOutfit, searchLinks } from '../lib/inspo.js';
import { Chip, Photo, Swatch, Empty } from '../components/ui.jsx';
import { currentSeasonId, isoDate, cx } from '../lib/utils.js';

export default function Inspiration() {
  const store = useStore();
  const { sys, isAdmin, data, saveWish, deleteWish, saveLog, settingsBy } = store;
  const nav = useNavigate();
  const gender = settingsBy.search?.gender || '';
  const [season, setSeason] = useState(currentSeasonId());
  const [usage, setUsage] = useState(null);
  const [seed, setSeed] = useState(Math.random());
  const a = useMemo(() => analyze(store), [store]);
  const outfit = useMemo(() => generateOutfit(store, { season, usage, seed }), [store, season, usage, seed]);
  const [tab, setTab] = useState('idee');

  const wish = async (name, query, reason) => {
    if (data.wishlist.some((w) => w.query === query && !w.done)) return store.notify('Già nella lista desideri');
    await saveWish({ name, query, reason, done: false });
    store.notify('Aggiunto alla lista desideri');
  };

  const essentialsHave = a.essentials.filter((e) => e.match).length;
  const openWish = data.wishlist.filter((w) => !w.done);

  if (!store.items.length) return (
    <div className="page"><Header /><Empty icon={<Sparkles size={28} />} title="Aggiungi qualche capo" text="Le ispirazioni nascono dal tuo armadio: più capi inserisci, più i suggerimenti sono precisi." /></div>
  );

  return (
    <div className="page">
      <Header />
      <div className="chips-scroll pad-x">
        <Chip active={tab === 'idee'} onClick={() => setTab('idee')}>Per te</Chip>
        <Chip active={tab === 'acquisti'} onClick={() => setTab('acquisti')}>Cosa comprare</Chip>
        <Chip active={tab === 'desideri'} onClick={() => setTab('desideri')} icon={<Bookmark size={14} />}>Lista desideri{openWish.length ? ` · ${openWish.length}` : ''}</Chip>
      </div>

      {tab === 'idee' && <>
        {/* ---------- abbinamento del giorno ---------- */}
        <section className="inspo-card inspo-card--hero">
          <div className="inspo-card__head">
            <div><span className="eyebrow"><Sparkles size={14} />Abbinamento suggerito</span><h2>Cosa mettere oggi</h2></div>
            <button className="icon-btn icon-btn--soft" onClick={() => setSeed(Math.random())} aria-label="Rigenera"><Shuffle size={20} /></button>
          </div>
          <div className="chips-scroll">
            {sys.season?.options.map((o) => <Chip small key={o.id} active={season === o.id} color={o.color} onClick={() => setSeason(o.id)}>{o.label}</Chip>)}
            <span className="chips-sep" />
            {sys.usage?.options.map((o) => <Chip small key={o.id} active={usage === o.id} onClick={() => setUsage(usage === o.id ? null : o.id)}>{o.label}</Chip>)}
          </div>
          {outfit.length ? (
            <div className="outfit-row">
              {outfit.map((it) => (
                <Link key={it.id} to={`/capo/${it.id}`} className="outfit-row__item">
                  <Photo path={it.thumb_path || it.photo_path} />
                  <span>{it.name}</span>
                </Link>
              ))}
            </div>
          ) : <p className="muted pad">Non trovo abbastanza capi per questa combinazione. Assegna una categoria e un «ruolo» (sopra, sotto, scarpe…) ai tuoi capi.</p>}
          {isAdmin && outfit.length > 0 && (
            <div className="row gap">
              <button className="btn grow" onClick={() => nav(`/outfit/nuovo?capi=${outfit.map((i) => i.id).join(',')}`)}><Save size={16} />Salva</button>
              <button className="btn btn--primary grow" onClick={async () => {
                const today = isoDate(); const ex = data.wear_logs.find((l) => l.worn_on === today);
                await saveLog({ ...(ex || {}), worn_on: today, item_ids: outfit.map((i) => i.id), outfit_id: null });
              }}><CalendarCheck size={16} />Lo indosso</button>
            </div>
          )}
        </section>

        {/* ---------- da riscoprire ---------- */}
        {a.forgotten.length > 0 && (
          <section className="inspo-card">
            <div className="inspo-card__head"><div><span className="eyebrow"><Eye size={14} />Riscopri</span><h2>Capi dimenticati</h2></div></div>
            <p className="muted small">Di stagione, ma non li metti da più di 60 giorni (o mai). Tocca per un abbinamento costruito attorno a loro.</p>
            <div className="h-scroll">
              {a.forgotten.map((it) => (
                <button key={it.id} className="mini-outfit" onClick={() => {
                  const o = generateOutfit(store, { season, usage, mustInclude: it });
                  nav(`/outfit/nuovo?capi=${o.map((x) => x.id).join(',')}`);
                }}>
                  <Photo path={it.thumb_path || it.photo_path} />
                  <span>{it.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ---------- colori ---------- */}
        {a.colorIdeas.length > 0 && (
          <section className="inspo-card">
            <div className="inspo-card__head"><div><span className="eyebrow"><Palette size={14} />Palette</span><h2>Colori che ti mancano</h2></div></div>
            <p className="muted small">Si abbinano bene ai colori che usi di più, ma nel tuo armadio ce ne sono pochi.</p>
            <div className="color-ideas">
              {a.colorIdeas.map(({ color, with: w }) => (
                <div key={color.id} className="color-idea">
                  <Swatch color={color.color} size={34} />
                  <div className="grow"><b>{color.label}</b><span className="muted small">con {w.join(', ').toLowerCase()}</span></div>
                  <LinkMenu q={`capi ${color.label.toLowerCase()}`} gender={gender} compact
                    onWish={isAdmin ? () => wish(`Qualcosa di ${color.label.toLowerCase()}`, color.label.toLowerCase(), `Si abbina a ${w.join(', ').toLowerCase()}`) : null} />
                </div>
              ))}
            </div>
          </section>
        )}
      </>}

      {tab === 'acquisti' && <>
        {a.replace.length > 0 && (
          <section className="inspo-card">
            <div className="inspo-card__head"><div><span className="eyebrow eyebrow--warn"><AlertTriangle size={14} />Da sostituire</span><h2>Capi a fine vita</h2></div></div>
            {a.replace.map(({ item, query, level }) => (
              <div key={item.id} className="suggest">
                <Link to={`/capo/${item.id}`} className="suggest__img"><Photo path={item.thumb_path || item.photo_path} /></Link>
                <div className="grow">
                  <b>{item.name}</b>
                  <span className={cx('muted small', level === 'sostituire' && 'red')}>{level === 'sostituire' ? 'Da sostituire' : 'Usurato'}</span>
                  <LinkMenu q={query} gender={gender} onWish={isAdmin ? () => wish(`Nuovo: ${item.name}`, query, 'Sostituisce un capo usurato') : null} />
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="inspo-card">
          <div className="inspo-card__head">
            <div><span className="eyebrow"><PackageSearch size={14} />Guardaroba capsula</span><h2>Gli essenziali</h2></div>
            <span className="ring" style={{ '--p': essentialsHave / a.essentials.length }}><b>{essentialsHave}</b>/{a.essentials.length}</span>
          </div>
          <p className="muted small">I capi base che si abbinano a quasi tutto. Li riconosco dal nome, dalla categoria e dal colore dei tuoi capi.</p>
          <ul className="checklist">
            {a.essentials.map((e) => (
              <li key={e.label} className={cx(e.match && 'done')}>
                <span className="checklist__mark">{e.match ? <Check size={14} strokeWidth={3} /> : null}</span>
                <span className="grow">{e.label}{e.match && <Link to={`/capo/${e.match.id}`} className="muted small"> · {e.match.name}</Link>}</span>
                {!e.match && <LinkMenu q={e.label.toLowerCase()} gender={gender} compact onWish={isAdmin ? () => wish(e.label, e.label.toLowerCase(), 'Essenziale del guardaroba capsula') : null} />}
              </li>
            ))}
          </ul>
        </section>

        {a.gaps.length > 0 && (
          <section className="inspo-card">
            <div className="inspo-card__head"><div><span className="eyebrow"><Sparkles size={14} />Analisi</span><h2>Buchi nel guardaroba</h2></div></div>
            <ul className="checklist">
              {a.gaps.slice(0, 10).map((g) => (
                <li key={g.key}>
                  <span className="checklist__mark checklist__mark--warn">!</span>
                  <span className="grow">{g.text}</span>
                  <LinkMenu q={g.query} gender={gender} compact onWish={isAdmin ? () => wish(g.text, g.query, 'Colma un buco nel guardaroba') : null} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </>}

      {tab === 'desideri' && (
        data.wishlist.length ? (
          <section className="inspo-card">
            <ul className="checklist">
              {[...data.wishlist].sort((x, y) => Number(x.done) - Number(y.done) || y.created_at.localeCompare(x.created_at)).map((w) => (
                <li key={w.id} className={cx(w.done && 'done')}>
                  <button className="checklist__mark" disabled={!isAdmin} onClick={() => saveWish({ ...w, done: !w.done })}>{w.done ? <Check size={14} strokeWidth={3} /> : null}</button>
                  <span className="grow"><b>{w.name}</b>{w.reason && <span className="muted small block">{w.reason}</span>}</span>
                  {!w.done && <LinkMenu q={w.query || w.name} gender={gender} compact />}
                  {isAdmin && <button className="icon-btn icon-btn--sm" onClick={() => deleteWish(w.id)}><Trash2 size={16} /></button>}
                </li>
              ))}
            </ul>
          </section>
        ) : <Empty icon={<Bookmark size={26} />} title="Lista desideri vuota" text="Tocca il + accanto a un suggerimento per salvarlo qui." />
      )}
    </div>
  );
}

function Header() {
  return (
    <header className="hero">
      <div className="hero__row"><div>
        <h1 className="hero__title">Ispirazioni</h1>
        <p className="hero__sub">Idee costruite sul tuo armadio</p>
      </div></div>
    </header>
  );
}

function LinkMenu({ q, gender, onWish, compact }) {
  const [open, setOpen] = useState(false);
  const links = searchLinks(q, gender);
  return (
    <div className={cx('linkmenu', compact && 'linkmenu--compact', open && 'linkmenu--open')}>
      {compact && !open ? (
        <button className="icon-btn icon-btn--sm icon-btn--soft" onClick={() => setOpen(true)} aria-label="Cerca online"><ExternalLink size={15} /></button>
      ) : (
        <div className="linkmenu__row">
          {links.map((l) => <a key={l.name} href={l.url} target="_blank" rel="noreferrer" className="chip chip--sm">{l.name}<ExternalLink size={11} /></a>)}
        </div>
      )}
      {onWish && <button className="icon-btn icon-btn--sm icon-btn--soft" onClick={onWish} aria-label="Aggiungi ai desideri"><Plus size={15} /></button>}
    </div>
  );
}
