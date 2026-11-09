-- A-05 videos (doc 05, section 7): staff with the second factor attach, order and hide YouTube videos for any dish;
-- the public still sees only approved videos of published dishes.
drop policy read_approved on videos;
create policy read_videos on videos for select using (
  (status = 'approved' and exists (select 1 from components c where c.id = component_id and c.status = 'published'))
  or (select private.is_staff()));
create policy staff_insert on videos for insert with check ((select private.is_staff()));
create policy staff_update on videos for update using ((select private.is_staff())) with check ((select private.is_staff()));
create policy staff_delete on videos for delete using ((select private.is_staff()));
create trigger audit after insert or update or delete on videos for each row execute function private.audit();
