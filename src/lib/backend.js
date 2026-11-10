// Livello dati: Supabase in produzione, oppure "demo" locale nel browser
// quando le variabili VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY non sono impostate.
import { createClient } from '@supabase/supabase-js';
import { buildSeed } from './seed.js';
import { uid } from './utils.js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const DEMO = !URL_ || !KEY || new URLSearchParams(location.search).has('demo');

export const TABLES = ['categories', 'attributes', 'items', 'outfits', 'wear_logs', 'saved_filters', 'wishlist', 'settings'];
const BUCKET = 'photos';

// Chi non scrive la mail per intero ("ospite") viene completato con questo dominio.
export const USERNAME_DOMAIN = 'armadio.app';
export const toEmail = (u) => (u.includes('@') ? u.trim() : `${u.trim().toLowerCase()}@${USERNAME_DOMAIN}`);

/* ------------------------------------------------------------------ */
/*  SUPABASE                                                           */
/* ------------------------------------------------------------------ */
function supabaseBackend() {
  const sb = createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  const urlCache = new Map(); // path -> { url, exp }
  let queue = new Map(); // path -> [resolve]
  let timer = null;

  const flush = async () => {
    const batch = queue; queue = new Map(); timer = null;
    const paths = [...batch.keys()];
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 6);
    const exp = Date.now() + 1000 * 60 * 60 * 5;
    paths.forEach((p, i) => {
      const url = !error && data?.[i]?.signedUrl ? data[i].signedUrl : null;
      if (url) urlCache.set(p, { url, exp });
      batch.get(p).forEach((r) => r(url));
    });
  };

  const unwrap = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

  return {
    demo: false,
    auth: {
      async session() { return (await sb.auth.getSession()).data.session; },
      async signIn(user, password) {
        const { data, error } = await sb.auth.signInWithPassword({ email: toEmail(user), password });
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Utente o password errati' : error.message);
        return data.session;
      },
      async signOut() { await sb.auth.signOut(); urlCache.clear(); },
      onChange(cb) { const { data } = sb.auth.onAuthStateChange((_e, s) => cb(s)); return () => data.subscription.unsubscribe(); },
      async role(session) {
        const { data } = await sb.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        return data?.role || 'pending';
      },
    },
    db: {
      async list(table) {
        // paginazione per superare il limite di 1000 righe
        let all = [], from = 0;
        for (;;) {
          const page = unwrap(await sb.from(table).select('*').range(from, from + 999));
          all = all.concat(page);
          if (page.length < 1000) return all;
          from += 1000;
        }
      },
      async insert(table, row) { return unwrap(await sb.from(table).insert(row).select().single()); },
      async update(table, id, patch) { return unwrap(await sb.from(table).update(patch).eq('id', id).select().single()); },
      async remove(table, id) { unwrap(await sb.from(table).delete().eq('id', id)); },
      async setSetting(key, value) { return unwrap(await sb.from('settings').upsert({ key, value }).select().single()); },
    },
    storage: {
      async upload(path, blob) {
        unwrap(await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: true, cacheControl: '31536000' }));
        return path;
      },
      async remove(paths) { if (paths.length) await sb.storage.from(BUCKET).remove(paths); paths.forEach((p) => urlCache.delete(p)); },
      url(path) {
        const c = urlCache.get(path);
        if (c && c.exp > Date.now()) return Promise.resolve(c.url);
        return new Promise((resolve) => {
          if (!queue.has(path)) queue.set(path, []);
          queue.get(path).push(resolve);
          if (!timer) timer = setTimeout(flush, 20);
        });
      },
      cached(path) { const c = urlCache.get(path); return c && c.exp > Date.now() ? c.url : null; },
    },
  };
}

/* ------------------------------------------------------------------ */
/*  DEMO (localStorage + IndexedDB, nessun server)                     */
/* ------------------------------------------------------------------ */
function demoBackend() {
  const LS = 'armadio-demo-v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(LS)); } catch { return null; } };
  let state = load();
  if (!state) { state = buildSeed(); save(); }
  function save() { try { localStorage.setItem(LS, JSON.stringify(state)); } catch { /* quota */ } }

  // foto in IndexedDB
  const idb = new Promise((res, rej) => {
    try {
      const r = indexedDB.open('armadio-demo-photos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('p');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
  const tx = async (mode, fn) => { const db = await idb; return new Promise((res, rej) => { const t = db.transaction('p', mode); const s = t.objectStore('p'); const r = fn(s); t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); }); };
  const urls = new Map();
  const clone = (x) => JSON.parse(JSON.stringify(x));

  return {
    demo: true,
    auth: {
      async session() { return { user: { id: 'demo', email: 'demo@armadio.app' } }; },
      async signIn() { return this.session(); },
      async signOut() {},
      onChange() { return () => {}; },
      async role() { return new URLSearchParams(location.search).get('ruolo') === 'viewer' ? 'viewer' : 'admin'; },
    },
    db: {
      async list(t) { return clone(state[t] || []); },
      async insert(t, row) {
        const r = { id: uid(), created_at: new Date().toISOString(), ...row };
        if (t === 'items') r.updated_at = r.created_at;
        state[t] = [...(state[t] || []), r]; save(); return clone(r);
      },
      async update(t, id, patch) {
        let out; state[t] = state[t].map((r) => (r.id === id ? (out = { ...r, ...patch, ...(t === 'items' ? { updated_at: new Date().toISOString() } : {}) }) : r));
        save(); return clone(out);
      },
      async remove(t, id) { state[t] = state[t].filter((r) => r.id !== id); save(); },
      async setSetting(key, value) {
        const others = state.settings.filter((s) => s.key !== key);
        state.settings = [...others, { key, value }]; save(); return { key, value };
      },
    },
    storage: {
      async upload(path, blob) { await tx('readwrite', (s) => s.put(blob, path)); urls.delete(path); return path; },
      async remove(paths) { for (const p of paths) await tx('readwrite', (s) => s.delete(p)); },
      async url(path) {
        if (urls.has(path)) return urls.get(path);
        const blob = await tx('readonly', (s) => s.get(path));
        const u = blob ? URL.createObjectURL(blob) : null;
        if (u) urls.set(path, u);
        return u;
      },
      cached(path) { return urls.get(path) || null; },
    },
    reset() { localStorage.removeItem(LS); indexedDB.deleteDatabase('armadio-demo-photos'); location.reload(); },
  };
}

export const backend = DEMO ? demoBackend() : supabaseBackend();
