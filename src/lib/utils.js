export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));

export const slugify = (s = '') =>
  s.toString().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const isoDate = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

export const fmtDate = (s, opts = { day: '2-digit', month: 'short', year: 'numeric' }) => {
  if (!s) return '';
  const d = new Date(s.length === 10 ? s + 'T12:00:00' : s);
  return d.toLocaleDateString('it-IT', opts);
};

export const fmtMoney = (n) =>
  n == null || n === '' || isNaN(n) ? '—' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: Number(n) % 1 ? 2 : 0 });

export const daysBetween = (a, b = new Date()) => Math.floor((new Date(b) - new Date(a)) / 86400000);

export const currentSeasonId = (d = new Date()) => {
  const m = d.getMonth(); // 0-11
  if (m >= 2 && m <= 4) return 'pri';
  if (m >= 5 && m <= 7) return 'est';
  if (m >= 8 && m <= 10) return 'aut';
  return 'inv';
};

export const asArray = (v) => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v]);

// testo leggibile per il valore di un attributo
export function attrText(attr, value) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return '';
  switch (attr.type) {
    case 'select':
    case 'multiselect':
      return asArray(value).map((v) => attr.options.find((o) => o.id === v)?.label).filter(Boolean).join(', ');
    case 'date': return fmtDate(value);
    case 'number': return attr.unit === '€' ? fmtMoney(value) : `${value}${attr.unit ? ' ' + attr.unit : ''}`;
    case 'rating': return '★'.repeat(Number(value) || 0);
    case 'boolean': return value ? attr.name : '';
    default: return String(value);
  }
}

// contrasto testo su colore
export function onColor(hex = '#888') {
  const h = hex.replace('#', '');
  if (h.length < 6) return '#111';
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111' : '#fff';
}

export const cx = (...a) => a.filter(Boolean).join(' ');
