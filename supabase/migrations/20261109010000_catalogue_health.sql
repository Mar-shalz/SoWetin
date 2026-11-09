-- Counts the app shows to prove the database is connected. security invoker: it runs with the caller's
-- own rights, so row-level security applies and it can only count what that caller may already read.
create function public.catalogue_health() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'published', (select count(*) from public.components where status = 'published'),
    'ingredients', (select count(*) from public.ingredients),
    'price_points', (select count(*) from public.price_points)
  )
$$;

revoke all on function public.catalogue_health() from public;
grant execute on function public.catalogue_health() to anon, authenticated;
