-- =====================================================================
--  ARMADIO DIGITALE — schema database Supabase
--  Da incollare UNA volta in: Supabase → SQL Editor → New query → Run
--  È idempotente sulle parti principali, ma pensato per un progetto nuovo.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. PROFILI E RUOLI
--    admin   → legge e scrive tutto
--    viewer  → solo lettura
--    pending → nessun accesso (default per qualsiasi nuovo utente:
--              anche se qualcuno riuscisse a registrarsi, non vede nulla)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  role        text not null default 'pending' check (role in ('admin','viewer','pending')),
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'pending')
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$ select public.my_role() = 'admin' $$;

create or replace function public.is_member()
returns boolean language sql stable as $$ select public.my_role() in ('admin','viewer') $$;

-- ---------------------------------------------------------------------
-- 2. TABELLE DEL GUARDAROBA
-- ---------------------------------------------------------------------

-- Categorie ad albero (livelli illimitati)
-- role: serve alle Ispirazioni per comporre outfit (top, bottom, shoes, outer, full, accessory)
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.categories(id) on delete cascade,
  name        text not null,
  icon        text,
  role        text,
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);

-- Attributi personalizzati
-- type: select | multiselect | text | number | date | rating | boolean
-- options: [{ "id": "...", "label": "...", "color": "#hex" }]
-- category_ids: null = vale per tutte le categorie
-- system_key: attributi "di sistema" usati da statistiche/ispirazioni (rinominabili, non eliminabili)
create table if not exists public.attributes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          text not null check (type in ('select','multiselect','text','number','date','rating','boolean')),
  options       jsonb not null default '[]'::jsonb,
  category_ids  uuid[],
  system_key    text unique,
  unit          text,
  show_in_grid  boolean not null default false,
  filterable    boolean not null default true,
  sort          int not null default 0,
  created_at    timestamptz not null default now()
);

-- Capi
-- attrs: { "<attribute_id>": valore }   (valore = option id, array di option id, testo, numero, data…)
create table if not exists public.items (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text,
  category_id  uuid references public.categories(id) on delete set null,
  photo_path   text,
  thumb_path   text,
  favorite     boolean not null default false,
  archived     boolean not null default false,
  attrs        jsonb not null default '{}'::jsonb,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Outfit (completi salvati)
create table if not exists public.outfits (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  item_ids    uuid[] not null default '{}',
  tags        text[] not null default '{}',
  favorite    boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now()
);

-- Diario: cosa ho indossato in un giorno
create table if not exists public.wear_logs (
  id          uuid primary key default gen_random_uuid(),
  worn_on     date not null,
  outfit_id   uuid references public.outfits(id) on delete set null,
  item_ids    uuid[] not null default '{}',
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists wear_logs_worn_on_idx on public.wear_logs (worn_on);

-- Filtri salvati ("filtri fissi")
create table if not exists public.saved_filters (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  filter      jsonb not null default '{}'::jsonb,
  pinned      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

-- Lista desideri (alimentata dalle Ispirazioni)
create table if not exists public.wishlist (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  query       text,
  reason      text,
  url         text,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Impostazioni condivise (visualizzazione griglia ecc.)
create table if not exists public.settings (
  key    text primary key,
  value  jsonb not null default '{}'::jsonb
);

-- updated_at automatico sui capi
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 3. SICUREZZA (Row Level Security)
--    Lettura: solo admin e viewer.  Scrittura: solo admin.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
drop policy if exists "profilo: leggo il mio" on public.profiles;
create policy "profilo: leggo il mio" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
-- nessuna policy di insert/update/delete: i ruoli si cambiano solo dal SQL Editor

do $$
declare t text;
begin
  foreach t in array array['categories','attributes','items','outfits','wear_logs','saved_filters','wishlist','settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "lettura membri" on public.%I', t);
    execute format('drop policy if exists "scrittura admin" on public.%I', t);
    execute format('create policy "lettura membri" on public.%I for select to authenticated using (public.is_member())', t);
    execute format('create policy "scrittura admin" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- 3b. Outfit: anche l'ospite può crearli (e gestire solo i suoi)
-- chi ha creato l'outfit (si compila da solo)
alter table public.outfits
  add column if not exists created_by uuid default auth.uid() references auth.users(id) on delete set null;

drop policy if exists "outfit: ospite crea"            on public.outfits;
drop policy if exists "outfit: ospite modifica i suoi" on public.outfits;
drop policy if exists "outfit: ospite cancella i suoi" on public.outfits;

create policy "outfit: ospite crea" on public.outfits
  for insert to authenticated with check (public.is_member() and created_by = auth.uid());
create policy "outfit: ospite modifica i suoi" on public.outfits
  for update to authenticated using (public.is_member() and created_by = auth.uid()) with check (created_by = auth.uid());
create policy "outfit: ospite cancella i suoi" on public.outfits
  for delete to authenticated using (public.is_member() and created_by = auth.uid());

-- 3d. Calendario condiviso: lo gestisce anche l'ospite
drop policy if exists "calendario: scrittura membri" on public.wear_logs;
create policy "calendario: scrittura membri" on public.wear_logs
  for all to authenticated using (public.is_member()) with check (public.is_member());

-- Permessi espliciti: funziona anche con "Automatically expose new tables" DISATTIVATO.
-- anon (chi non ha fatto login) non riceve nulla; authenticated passa comunque dalle regole RLS sopra.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.categories, public.attributes, public.items, public.outfits,
  public.wear_logs, public.saved_filters, public.wishlist, public.settings
  to authenticated;
grant select on public.profiles to authenticated;
revoke all on
  public.profiles, public.categories, public.attributes, public.items, public.outfits,
  public.wear_logs, public.saved_filters, public.wishlist, public.settings
  from anon;
revoke execute on function public.my_role(), public.is_admin(), public.is_member() from public, anon;
grant execute on function public.my_role(), public.is_admin(), public.is_member() to authenticated;

-- 3c. Cronologia delle modifiche dei capi
create table if not exists public.item_history (
  id         bigserial primary key,
  item_id    uuid not null references public.items(id) on delete cascade,
  at         timestamptz not null default now(),
  user_id    uuid default auth.uid(),
  user_role  text default public.my_role(),
  action     text not null check (action in ('create', 'update')),
  changes    jsonb not null default '{}'::jsonb   -- { "campo": [prima, dopo] }  (attributi: "attr:<id>")
);
create index if not exists item_history_item_idx on public.item_history (item_id, at desc);

create or replace function public.log_item_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ch jsonb := '{}'::jsonb;
  k  text;
begin
  if tg_op = 'INSERT' then
    insert into public.item_history (item_id, action, changes)
    values (new.id, 'create', jsonb_build_object('name', jsonb_build_array(null, new.name)));
    return new;
  end if;

  if new.name        is distinct from old.name        then ch := ch || jsonb_build_object('name',        jsonb_build_array(old.name, new.name)); end if;
  if new.category_id is distinct from old.category_id then ch := ch || jsonb_build_object('category_id', jsonb_build_array(old.category_id, new.category_id)); end if;
  if new.photo_path  is distinct from old.photo_path  then ch := ch || jsonb_build_object('photo_path',  jsonb_build_array(old.photo_path is not null, new.photo_path is not null)); end if;
  if new.favorite    is distinct from old.favorite    then ch := ch || jsonb_build_object('favorite',    jsonb_build_array(old.favorite, new.favorite)); end if;
  if new.archived    is distinct from old.archived    then ch := ch || jsonb_build_object('archived',    jsonb_build_array(old.archived, new.archived)); end if;
  if coalesce(new.notes, '') is distinct from coalesce(old.notes, '') then ch := ch || jsonb_build_object('notes', jsonb_build_array(old.notes, new.notes)); end if;

  for k in select distinct jsonb_object_keys(coalesce(old.attrs, '{}'::jsonb) || coalesce(new.attrs, '{}'::jsonb)) loop
    if (old.attrs -> k) is distinct from (new.attrs -> k) then
      ch := ch || jsonb_build_object('attr:' || k, jsonb_build_array(old.attrs -> k, new.attrs -> k));
    end if;
  end loop;

  if ch <> '{}'::jsonb then
    insert into public.item_history (item_id, action, changes) values (new.id, 'update', ch);
  end if;
  return new;
end $$;

drop trigger if exists items_history on public.items;
create trigger items_history after insert or update on public.items
  for each row execute function public.log_item_change();

-- lettura per admin e ospite; nessuno può scriverla o cancellarla a mano
alter table public.item_history enable row level security;
drop policy if exists "cronologia: lettura membri" on public.item_history;
create policy "cronologia: lettura membri" on public.item_history
  for select to authenticated using (public.is_member());
grant select on public.item_history to authenticated;
revoke all on public.item_history from anon;

-- ---------------------------------------------------------------------
-- 4. STORAGE FOTO (bucket PRIVATO: le foto si vedono solo da loggati)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do update set public = false;

drop policy if exists "foto: lettura membri" on storage.objects;
drop policy if exists "foto: scrittura admin" on storage.objects;
drop policy if exists "foto: modifica admin" on storage.objects;
drop policy if exists "foto: cancella admin" on storage.objects;

create policy "foto: lettura membri" on storage.objects
  for select to authenticated using (bucket_id = 'photos' and public.is_member());
create policy "foto: scrittura admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos' and public.is_admin());
create policy "foto: modifica admin" on storage.objects
  for update to authenticated using (bucket_id = 'photos' and public.is_admin());
create policy "foto: cancella admin" on storage.objects
  for delete to authenticated using (bucket_id = 'photos' and public.is_admin());

-- 4b. Spazio PUBBLICO per foto e testi della pagina di login
-- bucket PUBBLICO: contiene SOLO login.webp e login.json (foto e testi della pagina di accesso)
insert into storage.buckets (id, name, public)
values ('pubblico', 'pubblico', true)
on conflict (id) do update set public = true;

drop policy if exists "pubblico: lettura admin"  on storage.objects;
drop policy if exists "pubblico: scrittura admin" on storage.objects;
drop policy if exists "pubblico: modifica admin"  on storage.objects;
drop policy if exists "pubblico: cancella admin"  on storage.objects;

-- chiunque può VEDERE i file (è la pagina d'ingresso), ma solo l'admin può caricarli o cambiarli
create policy "pubblico: lettura admin"  on storage.objects for select to authenticated using (bucket_id = 'pubblico' and public.is_admin());
create policy "pubblico: scrittura admin" on storage.objects for insert to authenticated with check (bucket_id = 'pubblico' and public.is_admin());
create policy "pubblico: modifica admin"  on storage.objects for update to authenticated using (bucket_id = 'pubblico' and public.is_admin());
create policy "pubblico: cancella admin"  on storage.objects for delete to authenticated using (bucket_id = 'pubblico' and public.is_admin());

-- ---------------------------------------------------------------------
-- 5. DATI INIZIALI (categorie e attributi di partenza — tutto modificabile dall'app)
-- ---------------------------------------------------------------------
do $$
declare
  c_sopra uuid; c_sotto uuid; c_scarpe uuid; c_cap uuid; c_acc uuid;
begin
  if exists (select 1 from public.categories) then return; end if;

  insert into public.categories (name, icon, role, sort) values ('Parte sopra','👕','top',1)  returning id into c_sopra;
  insert into public.categories (name, icon, role, sort) values ('Parte sotto','👖','bottom',2) returning id into c_sotto;
  insert into public.categories (name, icon, role, sort) values ('Capispalla','🧥','outer',3)  returning id into c_cap;
  insert into public.categories (name, icon, role, sort) values ('Scarpe','👟','shoes',4)      returning id into c_scarpe;
  insert into public.categories (name, icon, role, sort) values ('Accessori','🧢','accessory',5) returning id into c_acc;

  insert into public.categories (parent_id, name, role, sort) values
    (c_sopra,'Magliette','top',1),(c_sopra,'Polo','top',2),(c_sopra,'Camicie','top',3),
    (c_sopra,'Felpe','top',4),(c_sopra,'Maglioni','top',5),
    (c_sotto,'Jeans','bottom',1),(c_sotto,'Pantaloni','bottom',2),(c_sotto,'Pantaloncini','bottom',3),(c_sotto,'Tute','bottom',4),
    (c_cap,'Giacche','outer',1),(c_cap,'Giubbotti','outer',2),(c_cap,'Cappotti','outer',3),
    (c_scarpe,'Sneakers','shoes',1),(c_scarpe,'Eleganti','shoes',2),(c_scarpe,'Sportive','shoes',3),
    (c_acc,'Cappelli','accessory',1),(c_acc,'Cinture','accessory',2),(c_acc,'Orologi','accessory',3),(c_acc,'Borse','accessory',4);
end $$;

insert into public.attributes (name, type, system_key, show_in_grid, sort, options) values
  ('Stagione','multiselect','season',true,1,
   '[{"id":"pri","label":"Primavera","color":"#22a06b"},{"id":"est","label":"Estate","color":"#e8a317"},{"id":"aut","label":"Autunno","color":"#d9622b"},{"id":"inv","label":"Inverno","color":"#3d7be0"}]'),
  ('Uso','multiselect','usage',true,2,
   '[{"id":"giorno","label":"Tutti i giorni","color":"#6b7280"},{"id":"lavoro","label":"Lavoro","color":"#5b5bd6"},{"id":"uscita","label":"Uscita","color":"#d6409f"},{"id":"sport","label":"Sport","color":"#12a594"}]'),
  ('Stato di usura','select','wear',false,3,
   '[{"id":"nuovo","label":"Nuovo","color":"#22a06b"},{"id":"ottimo","label":"Ottimo","color":"#4cb782"},{"id":"buono","label":"Buono","color":"#e8a317"},{"id":"usurato","label":"Usurato","color":"#d9622b"},{"id":"sostituire","label":"Da sostituire","color":"#e5484d"}]'),
  ('Colore','multiselect','color',false,4,
   '[{"id":"bianco","label":"Bianco","color":"#ffffff"},{"id":"nero","label":"Nero","color":"#111111"},{"id":"grigio","label":"Grigio","color":"#9ca3af"},{"id":"blu","label":"Blu","color":"#2f5bd3"},{"id":"navy","label":"Blu navy","color":"#1e2a4a"},{"id":"azzurro","label":"Azzurro","color":"#8ec5ff"},{"id":"beige","label":"Beige","color":"#d8c3a0"},{"id":"marrone","label":"Marrone","color":"#7a4e2d"},{"id":"verde","label":"Verde","color":"#4d7c4f"},{"id":"rosso","label":"Rosso","color":"#d33a3a"},{"id":"giallo","label":"Giallo","color":"#f2c94c"},{"id":"rosa","label":"Rosa","color":"#f1a7c1"},{"id":"viola","label":"Viola","color":"#7c5cbf"},{"id":"arancione","label":"Arancione","color":"#f08a3c"},{"id":"fantasia","label":"Fantasia","color":"#c084fc"}]'),
  ('Taglia','text','size',false,5,'[]'),
  ('Marca','text','brand',false,6,'[]'),
  ('Data di acquisto','date','purchase_date',false,7,'[]'),
  ('Prezzo','number','price',false,8,'[]'),
  ('Gradimento','rating','rating',false,9,'[]')
on conflict (system_key) do nothing;

update public.attributes set unit = '€' where system_key = 'price';

insert into public.settings (key, value) values
  ('grid', '{"showName":true,"showCategory":true,"showPath":false,"attributeIds":null,"columns":2}')
on conflict (key) do nothing;

-- =====================================================================
--  DOPO aver creato gli utenti (Authentication → Users → Add user),
--  assegna i ruoli con queste due righe (cambia le email):
--
--  update public.profiles set role = 'admin'  where email = 'tua@email.it';
--  update public.profiles set role = 'viewer' where email = 'ospite@armadio.app';
-- =====================================================================
