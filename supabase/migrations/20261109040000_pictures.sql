-- Dish pictures (BR-41, BR-43): a public bucket people can read, that only staff with the second factor can write.
-- Plain Postgres in the tests has no storage schema, so this only runs where Supabase Storage exists.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('illustrations', 'illustrations', true, 2097152, array['image/webp', 'image/png', 'image/jpeg', 'image/avif'])
    on conflict (id) do nothing;
    execute $p$create policy staff_upload on storage.objects for insert to authenticated
      with check (bucket_id = 'illustrations' and (select private.is_staff()))$p$;
    execute $p$create policy staff_remove on storage.objects for delete to authenticated
      using (bucket_id = 'illustrations' and (select private.is_staff()))$p$;
  end if;
end $$;
