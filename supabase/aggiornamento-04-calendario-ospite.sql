-- =====================================================================
--  AGGIORNAMENTO 04 — il calendario lo gestisce anche l'ospite
--  Da eseguire UNA volta: Supabase → SQL Editor → New query → incolla → Run
--  Il calendario («cosa ho indossato») è condiviso: admin e ospite possono
--  aggiungere, modificare e cancellare qualsiasi giorno.
--  (Creare outfit dal calendario usa le regole dell'aggiornamento 02.)
-- =====================================================================

drop policy if exists "calendario: scrittura membri" on public.wear_logs;
create policy "calendario: scrittura membri" on public.wear_logs
  for all to authenticated using (public.is_member()) with check (public.is_member());
