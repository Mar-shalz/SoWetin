-- Admin core (doc 15 M1: A-01 to A-03). Staff work through their own signed-in session, and the database checks
-- the admin or editor role plus the authenticator code (aal2) on every row, so the app never holds the service
-- role key (Victor, 9 November 2026). Every change is audited, and BR-41 gates publishing here, not only in the UI.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-- True only for an admin or editor whose session passed the second factor. Security definer so it can read
-- user_roles; it lives outside the API schemas, so nobody can call it over the API.
create function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal' = 'aal2', false)
     and exists (select 1 from public.user_roles where user_id = auth.uid())
$$;
revoke all on function private.is_staff() from public;
grant execute on function private.is_staff() to anon, authenticated;

create policy own_role on user_roles for select using (user_id = (select auth.uid()));

drop policy read_published on components;
create policy read_components on components for select using (status = 'published' or (select private.is_staff()));
create policy staff_update on components for update using ((select private.is_staff())) with check ((select private.is_staff()));

drop policy read_published on component_ingredients;
create policy read_lines on component_ingredients for select using (
  (select private.is_staff()) or exists (select 1 from components c where c.id = component_id and c.status = 'published'));
create policy staff_update on component_ingredients for update using ((select private.is_staff())) with check ((select private.is_staff()));

drop policy read_published on component_steps;
create policy read_steps on component_steps for select using (
  (select private.is_staff()) or exists (select 1 from components c where c.id = component_id and c.status = 'published'));
create policy staff_insert on component_steps for insert with check ((select private.is_staff()));
create policy staff_update on component_steps for update using ((select private.is_staff())) with check ((select private.is_staff()));
create policy staff_delete on component_steps for delete using ((select private.is_staff()));

create policy staff_select on content_drafts for select using ((select private.is_staff()));
create policy staff_insert on content_drafts for insert with check ((select private.is_staff()));
create policy staff_update on content_drafts for update using ((select private.is_staff())) with check ((select private.is_staff()));

create policy staff_insert on ai_calls for insert with check ((select private.is_staff()) and task = 'draft' and user_id = (select auth.uid()));

-- BR-41: what a dish still needs before it may be published; empty means ready. The review screen reads it as a
-- computed column (select=publish_blockers) and the publish guard below calls it, so they can never disagree.
create function public.publish_blockers(c public.components) returns text[]
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
    case when coalesce(c.storage, '') = '' then 'storage' end,
    case when c.tested_by is null or c.tested_at is null then 'tested' end
  ], null)
$$;
revoke all on function public.publish_blockers(public.components) from public, anon;
grant execute on function public.publish_blockers(public.components) to authenticated;

-- A published dish is frozen: unpublish, edit, publish again. Publishing checks BR-41, stamps who and when, and
-- bumps the snapshot version so the app reloads the catalogue (doc 06). Security definer for the version bump only.
create function private.guard_component() returns trigger
language plpgsql security definer set search_path = '' as $$
declare missing text[];
begin
  if old.status = 'published' and new.status = 'published' then
    raise exception 'Unpublish % before editing it', old.id using errcode = 'check_violation';
  end if;
  if new.status = 'published' then
    missing := public.publish_blockers(new);
    if cardinality(missing) > 0 then
      raise exception 'Not ready to publish: %', array_to_string(missing, ', ') using errcode = 'check_violation';
    end if;
    new.published_at := now();
    new.reviewed_by := auth.uid();
  end if;
  if (old.status = 'published') <> (new.status = 'published') then
    insert into public.snapshot_version (id, version) values (1, 2)
    on conflict (id) do update set version = public.snapshot_version.version + 1;
  end if;
  return new;
end $$;
create trigger guard_component before update on components for each row execute function private.guard_component();

-- Ingredient lines and steps of a published dish are frozen too.
create function private.guard_child() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cid text;
begin
  if tg_op = 'DELETE' then cid := old.component_id; else cid := new.component_id; end if;
  if exists (select 1 from public.components c where c.id = cid and c.status = 'published') then
    raise exception 'Unpublish % before editing it', cid using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger guard_child before insert or update or delete on component_ingredients for each row execute function private.guard_child();
create trigger guard_child before insert or update or delete on component_steps for each row execute function private.guard_child();

-- Every change by anyone lands in audit_log with the signed-in person as actor (doc 13).
create function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  if tg_op = 'DELETE' then r := to_jsonb(old); else r := to_jsonb(new); end if;
  insert into public.audit_log (actor, action, entity, entity_id, before, after)
  values (auth.uid(), lower(tg_op), tg_table_name,
          r ->> case tg_table_name when 'components' then 'id' when 'user_roles' then 'user_id' else 'component_id' end,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then r end);
  return null;
end $$;
do $$
declare t text;
begin
  foreach t in array array['components','component_ingredients','component_steps','content_drafts','user_roles'] loop
    execute format('create trigger audit after insert or update or delete on %I for each row execute function private.audit()', t);
  end loop;
end $$;
revoke all on function private.guard_component(), private.guard_child(), private.audit() from public;

-- Writes a method (from the review form or an accepted AI draft) in one transaction. A key that is present is
-- written ('' clears it); a missing key is left alone. Security invoker: row-level security and the guards decide.
-- shortcut: replacing the steps drops their Pidgin text, fine while no step has any; keep it once Pidgin is written.
create function public.apply_method(cid text, m jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.components set
    local_names = case when m ? 'local_names' then m -> 'local_names' else local_names end,
    aliases = case when m ? 'aliases' then array(select jsonb_array_elements_text(m -> 'aliases')) else aliases end,
    description = case when m ? 'description' then nullif(m ->> 'description', '') else description end,
    prep_minutes = case when m ? 'prep_minutes' then nullif(m ->> 'prep_minutes', '')::int else prep_minutes end,
    total_minutes = case when m ? 'total_minutes' then coalesce(nullif(m ->> 'total_minutes', '')::int, total_minutes) else total_minutes end,
    tips = case when m ? 'tips' then array(select jsonb_array_elements_text(m -> 'tips')) else tips end,
    mistakes = case when m ? 'mistakes' then array(select jsonb_array_elements_text(m -> 'mistakes')) else mistakes end,
    storage = case when m ? 'storage' then nullif(m ->> 'storage', '') else storage end,
    serving_note = case when m ? 'serving_note' then nullif(m ->> 'serving_note', '') else serving_note end,
    tested_at = case when m ? 'tested_at' then nullif(m ->> 'tested_at', '')::date else tested_at end,
    tested_by = case when m ? 'tested_at' then case when coalesce(m ->> 'tested_at', '') <> '' then auth.uid() end else tested_by end
  where id = cid;
  if not found then
    raise exception 'Dish % not found', cid using errcode = 'no_data_found';
  end if;
  if m ? 'ingredients' then
    update public.component_ingredients i set
      qty_per_serving = nullif(l ->> 'qty_per_serving', '')::numeric,
      grp = nullif(l ->> 'grp', ''),
      note = case when l ? 'note' then nullif(l ->> 'note', '') else i.note end
    from jsonb_array_elements(m -> 'ingredients') l
    where i.component_id = cid and i.ingredient_id = l ->> 'ingredient_id';
  end if;
  if m ? 'steps' then
    delete from public.component_steps where component_id = cid;
    insert into public.component_steps (component_id, step_no, text, cue, heat, timer_seconds, tip)
    select cid, row_number() over (order by n), s ->> 'text', nullif(s ->> 'cue', ''), nullif(s ->> 'heat', ''),
           nullif(s ->> 'timer_seconds', '')::int, nullif(s ->> 'tip', '')
    from jsonb_array_elements(m -> 'steps') with ordinality as t(s, n)
    where coalesce(s ->> 'text', '') <> '';
  end if;
end $$;
revoke all on function public.apply_method(text, jsonb) from public, anon;
grant execute on function public.apply_method(text, jsonb) to authenticated;
