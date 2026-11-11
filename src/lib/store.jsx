import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { backend, TABLES } from './backend.js';
import { asArray, slugify, uid } from './utils.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const DEFAULT_GRID = { showName: true, showCategory: true, showPath: false, attributeIds: null, columns: 2 };

export function StoreProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = sto caricando
  const [role, setRole] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // ---------- auth ----------
  useEffect(() => {
    backend.auth.session().then(setSession);
    return backend.auth.onChange((s) => setSession(s || null));
  }, []);

  // Avvio rapido: mostro subito l'ultima copia dei dati salvata in questo browser,
  // poi la aggiorno in background (ruolo + tutte le tabelle in parallelo, un solo giro).
  const cacheKey = session?.user?.id ? `armadio-cache-${session.user.id}` : null;
  const loadAll = useCallback(async () => {
    if (!backend.demo && cacheKey) {
      try {
        const c = JSON.parse(localStorage.getItem(cacheKey));
        if (c?.data && c.role) { setRole((r) => r || c.role); setData((d) => d || c.data); }
      } catch { /* */ }
    }
    try {
      const [r, ...lists] = await Promise.all([backend.auth.role(session), ...TABLES.map((t) => backend.db.list(t).catch((e) => { throw e; }))]);
      setRole(r);
      if (r === 'pending') { setData(null); if (cacheKey) localStorage.removeItem(cacheKey); return; }
      const fresh = Object.fromEntries(TABLES.map((t, i) => [t, lists[i]]));
      setData(fresh);
      setError(null);
      if (!backend.demo && cacheKey) { try { localStorage.setItem(cacheKey, JSON.stringify({ role: r, data: fresh, at: Date.now() })); } catch { /* spazio pieno */ } }
    } catch (e) {
      // senza rete ma con una copia salvata: resto sulla copia invece di mostrare l'errore
      setData((d) => { if (!d) setError(e.message); return d; });
    }
  }, [session, cacheKey]);

  useEffect(() => { if (session) loadAll(); else if (session === null) { setData(null); setRole(null); } }, [session, loadAll]);

  // ogni modifica aggiorna anche la copia locale
  useEffect(() => {
    if (backend.demo || !cacheKey || !data || !role || role === 'pending') return;
    const t = setTimeout(() => { try { localStorage.setItem(cacheKey, JSON.stringify({ role, data, at: Date.now() })); } catch { /* */ } }, 800);
    return () => clearTimeout(t);
  }, [data, role, cacheKey]);

  const notify = useCallback((msg, kind = 'ok') => {
    setToast({ msg, kind, id: uid() });
    setTimeout(() => setToast((t) => (t?.msg === msg ? null : t)), 2600);
  }, []);

  // ---------- CRUD generico con aggiornamento ottimistico ----------
  const put = (table, row) => setData((d) => {
    const list = d[table];
    const exists = list.some((r) => r.id === row.id);
    return { ...d, [table]: exists ? list.map((r) => (r.id === row.id ? row : r)) : [...list, row] };
  });
  const drop = (table, id) => setData((d) => ({ ...d, [table]: d[table].filter((r) => r.id !== id) }));

  const guard = async (fn, okMsg) => {
    try { const r = await fn(); if (okMsg) notify(okMsg); return r; }
    catch (e) { notify(e.message || 'Errore', 'err'); throw e; }
  };

  const save = (table, row, okMsg) => guard(async () => {
    const { id, created_at, updated_at, ...rest } = row;
    const out = id ? await backend.db.update(table, id, rest) : await backend.db.insert(table, rest);
    put(table, out); return out;
  }, okMsg);
  const remove = (table, id, okMsg) => guard(async () => { await backend.db.remove(table, id); drop(table, id); }, okMsg);

  // ---------- derivati ----------
  const derived = useMemo(() => {
    if (!data) return null;
    const cats = [...data.categories].sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name));
    const catById = Object.fromEntries(cats.map((c) => [c.id, c]));
    const children = {};
    cats.forEach((c) => { (children[c.parent_id || 'root'] ||= []).push(c); });
    const pathOf = (id) => { const p = []; let c = catById[id]; let g = 0; while (c && g++ < 20) { p.unshift(c); c = catById[c.parent_id]; } return p; };
    const descendants = (id) => { const out = [id]; (children[id] || []).forEach((c) => out.push(...descendants(c.id))); return out; };
    const rootOf = (id) => pathOf(id)[0];
    const roleOf = (id) => { const p = pathOf(id); for (let i = p.length - 1; i >= 0; i--) if (p[i].role) return p[i].role; return null; };

    const attrs = [...data.attributes].sort((a, b) => a.sort - b.sort);
    const attrBy = Object.fromEntries(attrs.map((a) => [a.id, a]));
    const sys = Object.fromEntries(attrs.filter((a) => a.system_key).map((a) => [a.system_key, a]));
    const attrsFor = (catId) => {
      const path = catId ? pathOf(catId).map((c) => c.id) : [];
      return attrs.filter((a) => !a.category_ids?.length || a.category_ids.some((x) => path.includes(x)));
    };

    const items = data.items.filter((i) => !i.archived);
    const archivedItems = data.items.filter((i) => i.archived);
    const itemBy = Object.fromEntries(data.items.map((i) => [i.id, i]));

    // utilizzi
    const wear = {}; const lastWorn = {};
    data.wear_logs.forEach((l) => asArray(l.item_ids).forEach((id) => {
      wear[id] = (wear[id] || 0) + 1;
      if (!lastWorn[id] || lastWorn[id] < l.worn_on) lastWorn[id] = l.worn_on;
    }));

    const grid = { ...DEFAULT_GRID, ...(data.settings.find((s) => s.key === 'grid')?.value || {}) };
    const settingsBy = Object.fromEntries(data.settings.map((s) => [s.key, s.value]));
    return { cats, catById, children, pathOf, descendants, rootOf, roleOf, attrs, attrBy, sys, attrsFor, items, archivedItems, itemBy, wear, lastWorn, grid, settingsBy };
  }, [data]);

  // ---------- azioni di dominio ----------
  const actions = useMemo(() => ({
    saveItem: (item) => save('items', { ...item, slug: slugify(item.name) }, 'Capo salvato'),
    deleteItem: async (item) => {
      await remove('items', item.id, 'Capo eliminato');
      backend.storage.remove([item.photo_path, item.thumb_path].filter(Boolean)).catch(() => {});
    },
    toggleFavorite: (item) => save('items', { ...item, favorite: !item.favorite }),
    setArchived: (item, archived) => save('items', { ...item, archived }, archived ? 'Capo archiviato' : 'Capo ripristinato'),
    // modifica massiva: salva in parallelo (4 alla volta) senza un avviso per ogni capo
    saveItemsBulk: async (rows, onProgress) => {
      let done = 0; const errors = [];
      const queue = [...rows];
      await Promise.all(Array.from({ length: 4 }, async () => {
        while (queue.length) {
          const row = queue.shift();
          try {
            const { id, created_at, updated_at, ...rest } = row;
            put('items', await backend.db.update('items', id, { ...rest, slug: slugify(row.name) }));
          } catch (e) { errors.push(`${row.name}: ${e.message}`); }
          onProgress?.(++done, rows.length);
        }
      }));
      notify(errors.length ? `${rows.length - errors.length} capi aggiornati, ${errors.length} errori` : `${rows.length} capi aggiornati`, errors.length ? 'err' : 'ok');
      return errors;
    },
    deleteItemsBulk: async (list, onProgress) => {
      let done = 0;
      for (const item of list) {
        try {
          await backend.db.remove('items', item.id); drop('items', item.id);
          backend.storage.remove([item.photo_path, item.thumb_path].filter(Boolean)).catch(() => {});
        } catch (e) { notify(e.message, 'err'); break; }
        onProgress?.(++done, list.length);
      }
      notify(`${done} capi eliminati`);
    },
    saveCategory: (c) => save('categories', c),
    deleteCategory: (id) => remove('categories', id, 'Categoria eliminata'),
    saveAttribute: (a) => save('attributes', a, 'Attributo salvato'),
    deleteAttribute: (id) => remove('attributes', id, 'Attributo eliminato'),
    saveOutfit: (o) => save('outfits', o, 'Outfit salvato'),
    deleteOutfit: (id) => remove('outfits', id, 'Outfit eliminato'),
    saveLog: (l) => save('wear_logs', l, 'Giornata salvata'),
    deleteLog: (id) => remove('wear_logs', id),
    saveFilter: (f) => save('saved_filters', f, 'Filtro salvato'),
    deleteFilter: (id) => remove('saved_filters', id),
    saveWish: (w) => save('wishlist', w),
    deleteWish: (id) => remove('wishlist', id),
    setSetting: (key, value) => guard(async () => {
      const r = await backend.db.setSetting(key, value);
      setData((d) => ({ ...d, settings: [...d.settings.filter((s) => s.key !== key), r] }));
    }),
    upload: (path, blob) => guard(() => backend.storage.upload(path, blob)),
    // inserimento diretto (mantiene created_at) — usato dalle importazioni
    insertRaw: (table, row) => guard(async () => { const out = await backend.db.insert(table, row); put(table, out); return out; }),
    reload: loadAll,
    signIn: (u, p) => backend.auth.signIn(u, p).then((s) => { setSession(s); return s; }),
    signOut: async () => { await backend.auth.signOut(); setSession(null); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [loadAll]);

  const value = {
    session, role, isAdmin: role === 'admin', data,
    userId: session?.user?.id,
    // outfit: l'admin modifica tutto, l'ospite solo quelli creati da lui
    canEditOutfit: (o) => role === 'admin' || (!!o?.created_by && o.created_by === session?.user?.id), error, toast, notify, demo: backend.demo, resetDemo: backend.reset,
    ...(derived || {}), ...actions,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ---------------- filtri ---------------- */
export const EMPTY_FILTER = { q: '', categoryId: null, favorites: false, attrs: {}, sort: 'recent', archived: false };

export function filterCount(f) {
  return (f.favorites ? 1 : 0) + Object.values(f.attrs || {}).filter((v) => asArray(v).length).length;
}

export function applyFilter(store, f) {
  const { descendants, attrBy, pathOf, wear, sys } = store;
  const items = f.archived ? store.archivedItems : store.items;
  const catSet = f.categoryId ? new Set(descendants(f.categoryId)) : null;
  const q = f.q?.trim().toLowerCase();
  let out = items.filter((it) => {
    if (catSet && !catSet.has(it.category_id)) return false;
    if (f.favorites && !it.favorite) return false;
    for (const [aid, want] of Object.entries(f.attrs || {})) {
      const w = asArray(want); if (!w.length) continue;
      const a = attrBy[aid]; if (!a) continue;
      const v = it.attrs?.[aid];
      if (a.type === 'rating') { if ((Number(v) || 0) < Number(w[0])) return false; continue; }
      if (a.type === 'boolean') { if (!v) return false; continue; }
      if (!asArray(v).some((x) => w.includes(x))) return false;
    }
    if (q) {
      const hay = [it.name, it.notes, ...pathOf(it.category_id).map((c) => c.name),
        ...Object.entries(it.attrs || {}).map(([k, v]) => {
          const a = attrBy[k]; if (!a) return '';
          if (a.type === 'select' || a.type === 'multiselect') return asArray(v).map((x) => a.options.find((o) => o.id === x)?.label).join(' ');
          return typeof v === 'string' ? v : '';
        })].join(' ').toLowerCase();
      if (!q.split(/\s+/).every((t) => hay.includes(t))) return false;
    }
    return true;
  });
  const pd = sys.purchase_date?.id, pr = sys.price?.id;
  const sorters = {
    recent: (a, b) => b.created_at.localeCompare(a.created_at),
    name: (a, b) => a.name.localeCompare(b.name),
    purchase: (a, b) => String(b.attrs?.[pd] || '').localeCompare(String(a.attrs?.[pd] || '')),
    worn: (a, b) => (wear[b.id] || 0) - (wear[a.id] || 0),
    leastworn: (a, b) => (wear[a.id] || 0) - (wear[b.id] || 0),
    price: (a, b) => (Number(b.attrs?.[pr]) || 0) - (Number(a.attrs?.[pr]) || 0),
  };
  return out.sort(sorters[f.sort] || sorters.recent);
}

export const SORTS = [
  ['recent', 'Aggiunti di recente'], ['name', 'Nome A→Z'], ['purchase', 'Data di acquisto'],
  ['worn', 'Più indossati'], ['leastworn', 'Meno indossati'], ['price', 'Prezzo'],
];
