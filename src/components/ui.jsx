import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, X, Shirt, Check } from 'lucide-react';
import { backend } from '../lib/backend.js';
import { cx, onColor } from '../lib/utils.js';
import { useStore } from '../lib/store.jsx';

export function TopBar({ title, back, actions, sub, large }) {
  const nav = useNavigate();
  return (
    <header className={cx('topbar', large && 'topbar--large')}>
      <div className="topbar__row">
        {back && (
          <button className="icon-btn" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))} aria-label="Indietro">
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="topbar__title">
          <h1>{title}</h1>
          {sub && <p>{sub}</p>}
        </div>
        <div className="topbar__actions">{actions}</div>
      </div>
    </header>
  );
}

export function Sheet({ open, onClose, title, children, footer, tall }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', esc); };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="sheet-wrap" onClick={onClose}>
      <div className={cx('sheet', tall && 'sheet--tall')} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet__grab" />
        <div className="sheet__head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Chiudi"><X size={20} /></button>
        </div>
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Chip({ active, onClick, children, color, icon, small, className }) {
  const style = color && active ? { background: color, color: onColor(color), borderColor: color } : undefined;
  return (
    <button type="button" className={cx('chip', active && 'chip--on', small && 'chip--sm', className)} style={style} onClick={onClick}>
      {icon}{children}
    </button>
  );
}

export function Tag({ color, children }) {
  const c = color || '#8a8a8a';
  return (
    <span className="tag" style={{ '--tag': c }}>
      {children}
    </span>
  );
}

export function Swatch({ color, size = 12 }) {
  return <span className="swatch" style={{ background: color, width: size, height: size }} />;
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="toggle-row">
      <span>
        <span className="toggle-row__label">{label}</span>
        {hint && <span className="toggle-row__hint">{hint}</span>}
      </span>
      <span className={cx('toggle', checked && 'toggle--on')}>
        <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
        <span />
      </span>
    </label>
  );
}

export function Empty({ icon, title, text, action }) {
  return (
    <div className="empty">
      <div className="empty__icon">{icon || <Shirt size={28} />}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Photo({ path, alt = '', className, fallback }) {
  const [url, setUrl] = useState(() => (path ? backend.storage.cached(path) : null));
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setLoaded(false); setFailed(false);
    if (!path) { setUrl(null); return; }
    const c = backend.storage.cached(path);
    if (c) { setUrl(c); return; }
    backend.storage.url(path).then((u) => { if (!alive) return; setUrl(u); if (!u) setFailed(true); });
    return () => { alive = false; };
  }, [path]);
  if (!path || failed) {
    return <div className={cx('photo photo--empty', className)}>{fallback || <Shirt size={30} strokeWidth={1.4} />}</div>;
  }
  return (
    <div className={cx('photo', !loaded && 'photo--loading', className)}>
      {url && <img src={url} alt={alt} loading="lazy" decoding="async" onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} />}
    </div>
  );
}

export function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div key={toast.id} className={cx('toast', toast.kind === 'err' && 'toast--err')}>
      {toast.kind !== 'err' && <Check size={16} />}{toast.msg}
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented">
      {options.map(([v, l]) => (
        <button key={v} type="button" className={cx(value === v && 'on')} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

export function Stars({ value = 0, onChange, size = 22 }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} className={cx(n <= value && 'on')} style={{ fontSize: size }}
          onClick={() => onChange?.(n === value ? 0 : n)}>★</button>
      ))}
    </div>
  );
}

export function confirmAsk(msg) { return window.confirm(msg); }
