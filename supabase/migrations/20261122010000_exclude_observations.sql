-- A-04 (doc 04, section 9). An admin can set aside a wrong observation (an imported flour read as local flour) without
-- deleting it, so the rebuild skips it and the row can be put back. Only this column changes; the audit trigger logs it.
alter table price_observations add column excluded_reason text check (excluded_reason is null or length(excluded_reason) between 3 and 200);

create policy admin_update on price_observations for update using ((select private.is_admin())) with check ((select private.is_admin()));
revoke update on price_observations from authenticated;
grant update (excluded_reason) on price_observations to authenticated;
