-- D-37 (Victor, 10 November 2026): AI drafts, a person checks and publishes; cooking the dish first is no longer required.
-- Same checks as before (doc 05, 5.3) without 'tested'. The kitchen test can still be recorded.
create or replace function public.publish_blockers(c public.components) returns text[]
language sql stable security invoker set search_path = '' as $$
  select array_remove(array[
    case when c.local_names = '{}'::jsonb then 'local_names' end,
    case when c.illustration_path is null then 'illustration' end,
    case when c.prep_minutes is null then 'times' end,
    case when exists (select 1 from public.component_ingredients i
                      where i.component_id = c.id and (i.qty_per_serving is null or i.grp is null)) then 'quantities' end,
    case when not exists (select 1 from public.component_steps s where s.component_id = c.id) then 'steps' end,
    case when exists (select 1 from public.component_steps s
                      where s.component_id = c.id and s.heat is not null and coalesce(s.cue, '') = '') then 'cues' end,
    case when cardinality(c.tips) = 0 then 'tips' end,
    case when cardinality(c.mistakes) = 0 then 'mistakes' end,
    case when coalesce(c.storage, '') = '' then 'storage' end
  ], null)
$$;

-- The table's own publish check asked for the kitchen test too; it keeps only the storage note.
alter table public.components drop constraint components_check;
alter table public.components add constraint components_published_check check (status <> 'published' or storage is not null);
