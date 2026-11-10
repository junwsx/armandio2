import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { Photo, Tag, Swatch } from './ui.jsx';
import { asArray, attrText, cx } from '../lib/utils.js';

export function AttrBadges({ item, attrs, max = 6 }) {
  const out = [];
  for (const a of attrs) {
    const v = item.attrs?.[a.id];
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (a.type === 'select' || a.type === 'multiselect') {
      const opts = asArray(v).map((x) => a.options.find((o) => o.id === x)).filter(Boolean);
      if (a.system_key === 'color') {
        out.push(<span key={a.id} className="swatches">{opts.map((o) => <Swatch key={o.id} color={o.color} size={13} />)}<span>{opts.map((o) => o.label).join(', ')}</span></span>);
      } else opts.forEach((o) => out.push(<Tag key={a.id + o.id} color={o.color}>{o.label}</Tag>));
    } else {
      const t = attrText(a, v);
      if (t) out.push(<Tag key={a.id}>{a.type === 'rating' || a.type === 'boolean' ? t : t}</Tag>);
    }
  }
  return out.length ? <div className="badges">{out.slice(0, max)}</div> : null;
}

export default function ItemCard({ item }) {
  const { grid, pathOf, attrs, isAdmin, toggleFavorite } = useStore();
  const path = pathOf(item.category_id);
  const leaf = path[path.length - 1];
  const shown = attrs.filter((a) => a.show_in_grid);
  const bare = !grid.showName && !grid.showCategory && !grid.showPath && !shown.length;
  return (
    <Link to={`/capo/${item.id}`} className={cx('card', bare && 'card--bare')}>
      <div className="card__media">
        <Photo path={item.thumb_path || item.photo_path} alt={item.name} />
        {(isAdmin || item.favorite) && (
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
          <AttrBadges item={item} attrs={shown} />
        </div>
      )}
    </Link>
  );
}
