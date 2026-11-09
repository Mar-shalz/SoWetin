-- A-04 price scout (doc 04, section 6): only admins manage price sources and see scout runs, through their own
-- session with the second factor (D-32). Source changes are audited, like every other price change.
create policy admin_select on price_sources for select using ((select private.is_admin()));
create policy admin_insert on price_sources for insert with check ((select private.is_admin()));
create policy admin_update on price_sources for update using ((select private.is_admin())) with check ((select private.is_admin()));

create policy admin_select on scout_runs for select using ((select private.is_admin()));
create policy admin_insert on scout_runs for insert with check ((select private.is_admin()));
create policy admin_update on scout_runs for update using ((select private.is_admin())) with check ((select private.is_admin()));

create trigger audit after insert or update or delete on price_sources for each row execute function private.audit();
