import { Link } from 'react-router-dom';
import { Heart, Check } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { Photo, Tag, Swatch } from './ui.jsx';
import { asArray, attrText, cx } from '../lib/utils.js';

// valori di un attributo (più valori → vanno a capo)
function AttrValues({ attr, value }) {
  if (attr.type === 'select' || attr.type === 'multiselect') {
    const opts = asArray(value).map((x) => attr.options.find((o) => o.id === x)).filter(Boolean);
    if (!opts.length) return null;
    if (attr.system_key === 'color') {
      return opts.map((o) => <span key={o.id} className="color-val"><Swatch color={o.color} size={11} />{o.label}</span>);
    }
    return opts.map((o) => <Tag key={o.id} color={o.color}>{o.label}</Tag>);
  }
  const t = attrText(attr, value);
  return t ? <span className="plain-val">{t}</span> : null;
}

// righe «Nome attributo | valori»
export function AttrRows({ item, attrs }) {
  const rows = attrs.filter((a) => {
    const v = item.attrs?.[a.id];
    return !(v == null || v === '' || (Array.isArray(v) && !v.length));
  });
  if (!rows.length) return null;
  return (
    <dl className="attr-rows">
      {rows.map((a) => (
        <div key={a.id} className="attr-row">
          <dt>{a.name}</dt>
          <dd><AttrValues attr={a} value={item.attrs[a.id]} /></dd>
        </div>
      ))}
    </dl>
  );
}

export default function ItemCard({ item, selecting, selected, onToggle }) {
  const { grid, pathOf, attrs, isAdmin, toggleFavorite } = useStore();
  const path = pathOf(item.category_id);
  const leaf = path[path.length - 1];
  const shown = attrs.filter((a) => a.show_in_grid);
  const bare = !grid.showName && !grid.showCategory && !grid.showPath && !shown.length;
  const onClick = (e) => { if (selecting) { e.preventDefault(); onToggle?.(item.id); } };
  return (
    <Link to={`/capo/${item.id}`} onClick={onClick} className={cx('card', bare && 'card--bare', selecting && 'card--selecting', selected && 'card--selected')}>
      <div className="card__media">
        <Photo path={item.thumb_path || item.photo_path} alt={item.name} />
        {selecting ? (
          <span className="sel-check"><Check size={15} strokeWidth={3} /></span>
        ) : (isAdmin || item.favorite) && (
          <button
            className={cx('fav', item.favorite && 'fav--on')}
            aria-label="Preferito"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (isAdmin) toggleFavorite(item); }}
          >
            <Heart size={16} fill={item.favorite ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
      {!bare && (
        <div className="card__body">
          {grid.showName && <h3 className="card__name">{item.name}</h3>}
          {grid.showPath && path.length > 0 && <p className="card__cat">{path.map((c) => c.name).join(' › ')}</p>}
          {!grid.showPath && grid.showCategory && leaf && <p className="card__cat">{leaf.name}</p>}
          <AttrRows item={item} attrs={shown} />
        </div>
      )}
    </Link>
  );
}
