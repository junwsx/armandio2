import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store.jsx';
import { Photo, Segmented, Swatch } from '../components/ui.jsx';
import { asArray, daysBetween, fmtMoney, isoDate } from '../lib/utils.js';

export default function Stats() {
  const store = useStore();
  const { items, data, sys, wear, rootOf, children } = store;
  const [range, setRange] = useState('90');

  const s = useMemo(() => {
    const since = range === 'all' ? '0000' : isoDate(new Date(Date.now() - Number(range) * 86400000));
    const logs = data.wear_logs.filter((l) => l.worn_on >= since);
    const w = {}; logs.forEach((l) => asArray(l.item_ids).forEach((id) => { w[id] = (w[id] || 0) + 1; }));
    const price = (it) => Number(it.attrs?.[sys.price?.id]) || 0;
    const value = items.reduce((a, it) => a + price(it), 0);
    const ranked = items.map((it) => ({ it, n: w[it.id] || 0 })).sort((a, b) => b.n - a.n);
    const never = items.filter((it) => !wear[it.id]);
    const cpw = items.filter((it) => price(it) > 0).map((it) => ({ it, v: price(it) / Math.max(1, wear[it.id] || 0), n: wear[it.id] || 0 }))
      .sort((a, b) => a.v - b.v);

    const dist = (attr) => {
      if (!attr) return [];
      const m = {}; items.forEach((it) => asArray(it.attrs?.[attr.id]).forEach((v) => { m[v] = (m[v] || 0) + 1; }));
      return attr.options.map((o) => ({ label: o.label, color: o.color, n: m[o.id] || 0 })).filter((x) => x.n);
    };
    const byRoot = (children.root || []).map((c) => ({ label: `${c.icon || ''} ${c.name}`.trim(), n: items.filter((it) => rootOf(it.category_id)?.id === c.id).length })).filter((x) => x.n);
    const uncategorized = items.filter((it) => !it.category_id).length;
    if (uncategorized) byRoot.push({ label: 'Senza categoria', n: uncategorized });

    // ultime 12 settimane (giorni registrati a settimana)
    const weeks = [];
    const now = new Date(); const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    for (let i = 11; i >= 0; i--) {
      const start = new Date(monday); start.setDate(monday.getDate() - i * 7);
      const end = new Date(start); end.setDate(start.getDate() + 7);
      const a = isoDate(start), b = isoDate(end);
      weeks.push({ label: start.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }), n: new Set(data.wear_logs.filter((l) => l.worn_on >= a && l.worn_on < b).map((l) => l.worn_on)).size });
    }
    const pd = sys.purchase_date?.id;
    const ages = items.map((it) => it.attrs?.[pd]).filter(Boolean).map((d) => daysBetween(d) / 365);
    const avgAge = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null;
    return { logs, value, ranked, never, cpw, byRoot, seasons: dist(sys.season), usage: dist(sys.usage), wearState: dist(sys.wear), colors: dist(sys.color), weeks, avgAge, days: new Set(logs.map((l) => l.worn_on)).size };
  }, [items, data, sys, wear, rootOf, children, range]);

  const top = s.ranked.filter((x) => x.n > 0).slice(0, 5);
  const totalColors = s.colors.reduce((a, b) => a + b.n, 0);

  return (
    <div className="page">
      <header className="hero">
        <div className="hero__row"><div><h1 className="hero__title">Statistiche</h1><p className="hero__sub">Come usi davvero il tuo armadio</p></div></div>
      </header>

      <div className="kpis">
        <div className="kpi"><span>Capi</span><b>{items.length}</b></div>
        <div className="kpi"><span>Valore</span><b>{fmtMoney(s.value)}</b></div>
        <div className="kpi"><span>Outfit salvati</span><b>{data.outfits.length}</b></div>
        <div className="kpi"><span>Mai indossati</span><b>{s.never.length}</b><small>{items.length ? Math.round((s.never.length / items.length) * 100) : 0}% dell'armadio</small></div>
      </div>

      <section className="stat-card">
        <h3>Attività · ultime 12 settimane</h3>
        <p className="muted small">Giorni registrati nel calendario, per settimana</p>
        <Columns rows={s.weeks} max={7} />
      </section>

      <section className="stat-card">
        <div className="stat-card__head">
          <h3>Più indossati</h3>
          <Segmented value={range} onChange={setRange} options={[['30', '30g'], ['90', '90g'], ['all', 'Sempre']]} />
        </div>
        {top.length ? top.map(({ it, n }, i) => (
          <Link key={it.id} to={`/capo/${it.id}`} className="rank">
            <span className="rank__n">{i + 1}</span>
            <Photo path={it.thumb_path || it.photo_path} className="rank__img" />
            <span className="grow"><b>{it.name}</b><Bar n={n} max={top[0].n} /></span>
            <span className="rank__v">{n}×</span>
          </Link>
        )) : <p className="muted small">Registra cosa indossi nel calendario per vedere la classifica.</p>}
      </section>

      {s.cpw.length > 0 && (
        <section className="stat-card">
          <h3>Costo per utilizzo</h3>
          <p className="muted small">Prezzo ÷ volte indossato. Più è basso, meglio hai speso.</p>
          <div className="cpw">
            <div><span className="eyebrow">Miglior investimento</span>{s.cpw.slice(0, 3).map(({ it, v, n }) => <CpwRow key={it.id} it={it} v={v} n={n} />)}</div>
            <div><span className="eyebrow eyebrow--warn">Da sfruttare di più</span>{s.cpw.slice(-3).reverse().map(({ it, v, n }) => <CpwRow key={it.id} it={it} v={v} n={n} />)}</div>
          </div>
        </section>
      )}

      <section className="stat-card"><h3>Per categoria</h3><Bars rows={s.byRoot} /></section>
      {s.seasons.length > 0 && <section className="stat-card"><h3>Per stagione</h3><Bars rows={s.seasons} /></section>}
      {s.usage.length > 0 && <section className="stat-card"><h3>Per uso</h3><Bars rows={s.usage} /></section>}
      {s.wearState.length > 0 && <section className="stat-card"><h3>Stato di usura</h3><Bars rows={s.wearState} /></section>}

      {s.colors.length > 0 && (
        <section className="stat-card">
          <h3>Palette dell'armadio</h3>
          <div className="palette-bar">
            {s.colors.sort((a, b) => b.n - a.n).map((c) => <span key={c.label} title={`${c.label}: ${c.n}`} style={{ flex: c.n, background: c.color }} />)}
          </div>
          <div className="palette-legend">
            {s.colors.map((c) => <span key={c.label}><Swatch color={c.color} />{c.label} <b>{Math.round((c.n / totalColors) * 100)}%</b></span>)}
          </div>
        </section>
      )}

      {s.never.length > 0 && (
        <section className="stat-card">
          <h3>Mai indossati</h3>
          <div className="h-scroll">
            {s.never.map((it) => <Link key={it.id} to={`/capo/${it.id}`} className="mini-outfit"><Photo path={it.thumb_path || it.photo_path} /><span>{it.name}</span></Link>)}
          </div>
        </section>
      )}
      {s.avgAge != null && <p className="muted small center">Età media dei capi: {s.avgAge.toFixed(1).replace('.', ',')} anni</p>}
    </div>
  );
}

function Bar({ n, max }) { return <span className="bar"><span style={{ width: `${max ? (n / max) * 100 : 0}%` }} /></span>; }

function Bars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="bars">
      {rows.map((r) => (
        <div key={r.label} className="bars__row" title={`${r.label}: ${r.n}`}>
          <span className="bars__label">{r.label}</span>
          <Bar n={r.n} max={max} />
          <span className="bars__v">{r.n}</span>
        </div>
      ))}
    </div>
  );
}

function Columns({ rows, max }) {
  return (
    <div className="cols">
      {rows.map((r, i) => (
        <div key={i} className="cols__c" title={`Settimana del ${r.label}: ${r.n} ${r.n === 1 ? 'giorno' : 'giorni'}`}>
          <span className="cols__v">{r.n || ''}</span>
          <span className="cols__bar"><span style={{ height: `${(r.n / max) * 100}%` }} /></span>
          <span className="cols__l">{i % 3 === 0 || i === rows.length - 1 ? r.label : ''}</span>
        </div>
      ))}
    </div>
  );
}

function CpwRow({ it, v, n }) {
  return (
    <Link to={`/capo/${it.id}`} className="cpw__row">
      <Photo path={it.thumb_path || it.photo_path} className="rank__img" />
      <span className="grow"><b>{it.name}</b><span className="muted small block">{n} {n === 1 ? 'uso' : 'usi'}</span></span>
      <b>{fmtMoney(v)}</b>
    </Link>
  );
}
