-- =====================================================================
--  AGGIORNAMENTO 02 — l'ospite può creare outfit
--  Da eseguire UNA volta: Supabase → SQL Editor → New query → incolla → Run
--  L'ospite crea outfit e può modificare/cancellare SOLO i suoi.
--  L'admin continua a poter fare tutto su tutti.
-- =====================================================================

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
