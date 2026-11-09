-- A-10 audit log (doc 02): admins with the second factor can read it; nobody can change it through the API.
create policy admin_select on audit_log for select using ((select private.is_admin()));
