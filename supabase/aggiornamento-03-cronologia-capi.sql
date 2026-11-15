-- =====================================================================
--  AGGIORNAMENTO 03 — cronologia delle modifiche dei capi
--  Da eseguire UNA volta: Supabase → SQL Editor → New query → incolla → Run
--  Da quel momento il database registra da solo ogni creazione e modifica
--  di un capo (nome, categoria, foto, preferito, archivio, note, attributi).
--  Le modifiche fatte prima di questo aggiornamento non sono recuperabili.
-- =====================================================================

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
