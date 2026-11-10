-- D-39 (Victor, 10 November 2026): AI fills and publishes the catalogue; staff edit any dish at any time, published or
-- not. A picture and local names are no longer needed to publish (the app shows a placeholder until a picture lands).
create or replace function public.publish_blockers(c public.components) returns text[]
language sql stable security invoker set search_path = '' as $$
  select array_remove(array[
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

-- A published dish can be edited in place, but never into a state that couldn't be published. Any change to a
-- published dish bumps the snapshot so the app reloads the catalogue.
create or replace function private.guard_component() returns trigger
language plpgsql security definer set search_path = '' as $$
declare missing text[];
begin
  if new.status = 'published' then
    missing := public.publish_blockers(new);
    if cardinality(missing) > 0 then
      raise exception 'Not ready to publish: %', array_to_string(missing, ', ') using errcode = 'check_violation';
    end if;
    if old.status is distinct from 'published' then
      new.published_at := now();
      new.reviewed_by := auth.uid();
    end if;
  end if;
  if old.status = 'published' or new.status = 'published' then
    insert into public.snapshot_version (id, version) values (1, 2)
    on conflict (id) do update set version = public.snapshot_version.version + 1;
  end if;
  return new;
end $$;

-- Lines and steps of a published dish can change too. Checked at commit, so apply_method can replace every step in
-- one go; the dish must still pass publish_blockers when the transaction ends.
create or replace function private.guard_child() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cid text; c public.components; missing text[];
begin
  if tg_op = 'DELETE' then cid := old.component_id; else cid := new.component_id; end if;
  select * into c from public.components where id = cid;
  if found and c.status = 'published' then
    missing := public.publish_blockers(c);
    if cardinality(missing) > 0 then
      raise exception 'A published dish still needs: %', array_to_string(missing, ', ') using errcode = 'check_violation';
    end if;
    insert into public.snapshot_version (id, version) values (1, 2)
    on conflict (id) do update set version = public.snapshot_version.version + 1;
  end if;
  return null;
end $$;
drop trigger guard_child on public.component_ingredients;
drop trigger guard_child on public.component_steps;
create constraint trigger guard_child after insert or update or delete on public.component_ingredients
  deferrable initially deferred for each row execute function private.guard_child();
create constraint trigger guard_child after insert or update or delete on public.component_steps
  deferrable initially deferred for each row execute function private.guard_child();
