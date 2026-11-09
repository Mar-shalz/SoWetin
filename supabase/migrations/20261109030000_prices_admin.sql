-- A-04 prices (doc 04, sections 3 and 7). Only admins, not editors, import market checks and rebuild price
-- points, through their own session with the second factor, like the rest of the admin (D-32).

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal' = 'aal2', false)
     and exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

create policy admin_select on price_observations for select using ((select private.is_admin()));
create policy admin_insert on price_observations for insert with check ((select private.is_admin()) and created_by = (select auth.uid()));
create policy admin_insert on price_points for insert with check ((select private.is_admin()));
create policy admin_update on price_points for update using ((select private.is_admin())) with check ((select private.is_admin()));
create policy admin_delete on price_points for delete using ((select private.is_admin()));
create policy admin_update on market_units for update using ((select private.is_admin())) with check ((select private.is_admin()));

-- The audit trail now covers prices too, so the entity id is whichever key the row has (doc 04, section 9).
create or replace function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  if tg_op = 'DELETE' then r := to_jsonb(old); else r := to_jsonb(new); end if;
  insert into public.audit_log (actor, action, entity, entity_id, before, after)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce(r ->> 'component_id', r ->> 'ingredient_id', r ->> 'user_id', r ->> 'id'),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then r end);
  return null;
end $$;
revoke all on function private.audit() from public;

do $$
declare t text;
begin
  foreach t in array array['price_observations','price_points','market_units'] loop
    execute format('create trigger audit after insert or update or delete on %I for each row execute function private.audit()', t);
  end loop;
end $$;
