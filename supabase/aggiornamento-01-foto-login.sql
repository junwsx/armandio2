-- =====================================================================
--  AGGIORNAMENTO 01 — spazio pubblico per la foto a cuore della pagina di login
--  Da eseguire UNA volta: Supabase → SQL Editor → New query → incolla → Run
--  (chi installa da zero con schema.sql lo ha già incluso)
-- =====================================================================

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
