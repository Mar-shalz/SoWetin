-- A-09 AI admin (doc 02): when each AI call and eval run happened, readable by admins only.
-- The price scout's AI calls are logged too, next to the recipe drafts.
alter table ai_calls add column if not exists created_at timestamptz not null default now();
alter table ai_eval_runs add column if not exists created_at timestamptz not null default now();
create index if not exists ai_calls_created_at on ai_calls (created_at desc);

create policy admin_select on ai_calls for select using ((select private.is_admin()));
create policy admin_select on ai_eval_runs for select using ((select private.is_admin()));

drop policy staff_insert on ai_calls;
create policy staff_insert on ai_calls for insert
  with check ((select private.is_staff()) and task in ('draft', 'scout') and user_id = (select auth.uid()));
