-- SoWetin initial schema, generated from docs/07-data-model-and-api.md section 1 on 9 November 2026.
-- After this first migration, every schema change is a new migration file and an edit to doc 07.
-- Supabase provides the auth schema; plain Postgres (CI, tests) loads tests/fixtures/auth-stub.sql first.

create table areas (
  id text primary key,                         -- 'lagos', 'oyo', 'fct'…
  name text not null,
  state text not null,
  is_surveyed boolean not null default false,
  state_factor numeric(6,3) not null default 1.0,
  order_partner_enabled boolean not null default false
);

create table ingredients (
  id text primary key,                         -- slug, e.g. 'egusi-ground'
  name text not null,
  local_names jsonb not null default '{}',
  category text not null,
  canonical_unit text not null check (canonical_unit in ('g','ml','piece')),
  allergens text[] not null default '{}',
  may_contain text[] not null default '{}',
  is_animal boolean not null default false,
  is_pork boolean not null default false,
  house_group text check (house_group in ('foodstuff','basic')),  -- D-18; null = not offered in S-024
  retail_factor numeric(4,2)                   -- null = RETAIL_FACTOR_DEFAULT
);

create table market_units (
  id uuid primary key default gen_random_uuid(),
  ingredient_id text not null references ingredients(id),
  area_id text not null references areas(id),
  label text not null,                         -- 'derica', '₦500 wrap'
  canonical_qty numeric(10,2) not null,
  is_minimum boolean not null default false,
  sellable boolean not null default true,
  is_placeholder boolean not null default true,
  unique (ingredient_id, area_id, label)
);

create table price_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,                           -- 'Nairametrics Lagos survey'
  domain text not null unique,
  kind text not null check (kind in ('press_survey','official_stats','online_store')),
  weight numeric(3,2) not null,                 -- doc 04, section 3, step 6
  bias_factor numeric(4,3) not null default 1.0,-- learned, doc 04, section 6.6
  active boolean not null default true,
  terms_checked_at date,
  notes text
);

create table scout_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  searches int not null default 0,
  pages_read int not null default 0,
  kept int not null default 0,
  rejected jsonb not null default '[]',         -- [{url, quote, reason}]
  move_alerts jsonb not null default '[]',
  cost_usd numeric(10,4)
);

create table price_observations (
  id uuid primary key default gen_random_uuid(),
  ingredient_id text not null references ingredients(id),
  area_id text not null references areas(id),
  market_unit_id uuid references market_units(id),
  unit_label text not null,
  unit_canonical_qty numeric(10,2),
  price_ngn integer not null check (price_ngn > 0),
  observed_on date not null,
  market text,
  source text not null check (source in ('retail_survey','wholesale_survey','ai_scout','partner','public_reference','admin')),
  source_id uuid references price_sources(id),  -- required when source = 'ai_scout'
  source_url text,
  source_quote text,                             -- exact text the price was verified against
  scout_run_id uuid references scout_runs(id),
  confirmed_outlier boolean not null default false,
  import_batch_id uuid,
  notes text,
  created_by uuid
);

create table price_points (                    -- derived; rebuilt by recompute-prices
  ingredient_id text references ingredients(id),
  area_id text references areas(id),
  per_unit_low numeric(12,4) not null,
  per_unit_mid numeric(12,4) not null,
  per_unit_high numeric(12,4) not null,
  confidence text not null check (confidence in ('high','medium','low')),
  as_of date not null,
  oldest date not null,
  sample_count int not null,
  is_estimate boolean not null default false,  -- unsurveyed area
  source_count int not null,                   -- distinct sources used after outliers (doc 04, section 3, step 9)
  source_kinds jsonb not null default '{}',    -- {"market_check":2,"press_survey":4,"online_store":2,"official_stats":1}
  sources_shown jsonb not null default '[]',   -- up to PRICE_SOURCES_SHOWN_MAX: [{"name","kind","observed_on","area"}]
  last_market_check date,                      -- null when no market check is in the window
  src_spread numeric(4,3) not null default 0,  -- (high - low) / (2 * mid), doc 04, section 4.3
  primary key (ingredient_id, area_id)
);

create table components (
  id text primary key,                         -- slug
  name text not null,
  local_names jsonb not null default '{}',
  aliases text[] not null default '{}',
  types text[] not null,
  cuisine_family text not null,
  region text not null,
  meal_times text[] not null,
  effort smallint not null check (effort between 1 and 3),
  total_minutes int not null,
  prep_minutes int,
  spice_level smallint not null check (spice_level between 0 and 3),
  vegetarian_ok boolean not null default false, -- vegetarian as served, once optional animal lines are dropped (BR-31)
  tags text[] not null default '{}',
  protein_included boolean not null default false,
  needs_sauce boolean not null default false,
  forgotten_classic boolean not null default false,
  availability text not null default 'everyday',
  popularity_prior numeric(3,2) not null default 0.5,
  description text,
  illustration_path text,
  servings_base int not null default 4,
  batch_servings_min int not null default 1 check (batch_servings_min >= 1),  -- D-17: smallest sensible pot
  house_chip boolean not null default false,     -- offered in "Cooked and waiting" (S-024)
  equipment text[] not null default '{}',
  tips text[] not null default '{}',             -- up to 3
  mistakes text[] not null default '{}',         -- up to 3, each with its reason
  storage text,
  serving_note text,
  pcm jsonb not null default '{}',               -- Pidgin: {"description","tips":[],"mistakes":[],"storage","serving_note"}
  pcm_reviewed boolean not null default false,   -- BR-117: Pidgin method shown only when true
  tested_by uuid,                                -- cooked from the written steps (doc 05, 5.3 item 10)
  tested_at date,
  status text not null default 'draft' check (status in ('draft','in_review','published','retired')),
  published_at timestamptz,
  reviewed_by uuid,
  check (status <> 'published' or (tested_by is not null and tested_at is not null and storage is not null))
);

create table component_ingredients (
  component_id text references components(id) on delete cascade,
  ingredient_id text references ingredients(id),
  qty_per_serving numeric(10,3),               -- null while draft; A-03 blocks publishing until every line has one
  grp text check (grp in ('base','protein','vegetable','seasoning','oil','garnish')),  -- null while draft
  optional boolean not null default false,
  note text,
  sort int not null default 0,
  primary key (component_id, ingredient_id)
);

create table component_steps (
  component_id text references components(id) on delete cascade,
  step_no int not null,
  text text not null,                          -- one action; may contain {ing:egusi-ground} tokens for live quantities
  cue text,                                    -- how you know it's done; required on cooking steps (doc 05, section 10)
  heat text check (heat in ('low','medium','high')),
  timer_seconds int,
  tip text,
  text_pcm text,                               -- Pidgin versions, shown when components.pcm_reviewed
  cue_pcm text,
  tip_pcm text,
  primary key (component_id, step_no)
);

create table videos (
  id uuid primary key default gen_random_uuid(),
  component_id text references components(id) on delete cascade,
  youtube_id text not null,
  title text not null,
  channel_title text not null,
  duration_seconds int,
  thumbnail_url text,
  language text not null default 'en' check (language in ('en','pcm','yo','ig','ha','other')),
  style text not null default 'full' check (style in ('full','quick')),
  rank smallint,                                -- 1 = primary; null for candidates
  is_primary boolean generated always as (rank = 1) stored,
  status text not null default 'candidate' check (status in ('candidate','approved','hidden','rejected')),
  hidden_reason text,
  last_checked_at timestamptz,
  approved_by uuid,
  unique (component_id, youtube_id)
);
-- A trigger rejects approving more than MAX_VIDEOS_PER_COMPONENT (5) videos per component (FR-032),
-- and re-ranks the remaining approved videos when one is hidden (BR-50b).

create table plate_templates (
  key text primary key,
  name text not null,
  meal_times text[] not null,
  main_slot text not null,
  slots jsonb not null                          -- as in catalogue-seed.json
);

create table pairing_defaults (
  type_a text, type_b text, score numeric(3,2) not null,
  primary key (type_a, type_b)
);

create table pairings (
  component_a text references components(id),
  component_b text references components(id),
  score numeric(3,2) not null check (score between 0 and 1),
  note text,
  status text not null default 'draft' check (status in ('draft','approved')),
  primary key (component_a, component_b),
  check (component_a < component_b)            -- store each pair once, sorted
);

create table classic_plates (
  plate_key text primary key,
  title text,
  sort int not null default 0
);

create table content_drafts (
  id uuid primary key default gen_random_uuid(),
  component_id text references components(id),
  kind text not null,                           -- 'full_recipe','pairings','local_names'
  payload jsonb not null,
  model text not null,
  status text not null default 'needs_review' check (status in ('needs_review','accepted','rejected')),
  reviewed_by uuid
);

create table snapshot_version (id int primary key default 1, version bigint not null default 1);

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_anonymous boolean not null default true,
  area_id text references areas(id) default 'lagos',
  household_size int not null default 1,
  default_budget_ngn int,
  default_mode text not null default 'cook',
  avoid_ingredients text[] not null default '{}',
  spice_max smallint,
  vegetarian boolean not null default false,
  cuisines_liked text[] not null default '{}',
  motion_pref text not null default 'auto',
  haptics boolean not null default true,
  sound boolean not null default false,
  data_saver text not null default 'auto',
  ui_language text not null default 'en-NG' check (ui_language in ('en-NG','pcm')),
  pidgin_offer_snoozed_until timestamptz,
  last_signin_prompt_at timestamptz,
  signin_prompt_snoozed_until timestamptz,
  visits int not null default 0,
  last_active_at timestamptz not null default now()
);

create table consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('analytics','marketing','allergy_storage','waitlist_share','age_18')),
  granted boolean not null,
  policy_version text not null,
  source_screen text not null,
  recorded_at timestamptz not null default now()
);

create table profile_allergies (                -- sensitive personal data: express consent required
  user_id uuid primary key references profiles(user_id) on delete cascade,
  allergens text[] not null default '{}',
  ingredients text[] not null default '{}',
  seasoning_cubes_ok boolean not null default false,
  consent_id uuid not null references consents(id)
);

create table taste_affinities (
  user_id uuid references profiles(user_id) on delete cascade,
  tag text not null,
  score real not null check (score between -1 and 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, tag)
);

create table user_component_stats (
  user_id uuid references profiles(user_id) on delete cascade,
  component_id text references components(id),
  first_seen_at timestamptz,
  last_positive_at timestamptz,                -- saved, cooked, ordered, ate
  last_ate_at timestamptz,
  disliked_until timestamptz,
  seen_count int not null default 0,
  primary key (user_id, component_id)
);

create table saved_plates (
  user_id uuid references profiles(user_id) on delete cascade,
  plate_key text not null,
  people int not null default 1,
  saved_at timestamptz not null default now(),
  primary key (user_id, plate_key)
);

create table events (
  id bigint generated always as identity primary key,
  user_id uuid,                                 -- null for partner events with partner_profile_id
  partner_profile_id uuid,
  type text not null,                           -- doc 14 taxonomy
  request_id uuid,
  plate_key text,
  component_id text,
  props jsonb not null default '{}',
  occurred_at timestamptz not null
);
create index on events (user_id, occurred_at desc);

create table suggestion_requests (               -- debug and quality, 30-day retention
  id uuid primary key,
  user_id uuid,
  partner_id uuid,
  params jsonb not null,
  plate_keys text[] not null,
  latency_ms int not null,
  ai_used boolean not null default false,
  snapshot_version bigint not null
);

create table shares (
  id text primary key,                          -- short id, 8 chars
  user_id uuid,
  plate_key text not null,
  people int not null,
  area_id text not null,
  budget_band text,
  card_name text,
  image_path text
);

create table votes (                             -- Ask the group (F28); deleted VOTE_RESULTS_DAYS after closing (BR-143)
  id text primary key,                          -- short id, 8 chars, same generator as shares
  user_id uuid not null references profiles(user_id) on delete cascade,
  question text not null,                       -- length checked against VOTE_QUESTION_MAX_CHARS in the route
  asker_name text,                              -- optional, shown as typed (BR-142)
  area_id text not null references areas(id),
  people int not null,
  plate_keys text[] not null check (array_length(plate_keys, 1) between 2 and 3),
  created_at timestamptz not null default now(),
  closes_at timestamptz not null,               -- created_at + VOTE_TTL_HOURS
  closed_at timestamptz,
  winner_index int,
  settled_by_tie boolean not null default false -- BR-144
);

create table vote_ballots (
  vote_id text not null references votes(id) on delete cascade,
  device_hash text not null,                    -- sha256 of a random first-party cookie, never a fingerprint (BR-141)
  plate_index int not null check (plate_index between 0 and 2),
  voter_name text,                              -- optional (D-26), length checked against VOTE_NAME_MAX_CHARS
  updated_at timestamptz not null default now(),
  primary key (vote_id, device_hash)            -- one ballot per device; voting again updates it
);

create table data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('export','delete')),
  status text not null default 'pending',
  file_path text,
  completed_at timestamptz
);

create table merge_tokens (
  token_hash text primary key,
  anon_user_id uuid not null,
  expires_at timestamptz not null
);

create table house_items (
  user_id uuid not null references profiles(user_id) on delete cascade,
  kind text not null check (kind in ('cooked','foodstuff','basic','custom')),
  component_id text references components(id),   -- kind = cooked
  ingredient_id text references ingredients(id), -- kind = foodstuff or basic
  custom_label text,                             -- kind = custom: typed text the catalogue doesn't know (BR-134); the engine ignores it
  item_id text generated always as (coalesce(component_id, ingredient_id, 'custom:' || lower(custom_label))) stored,
  added_at timestamptz not null default now(),
  confirmed_at timestamptz not null default now(), -- "Still got these?" yes, or re-added
  source text not null default 'chip' check (source in ('chip','text_parse','ate_it_pot','merge')),
  primary key (user_id, kind, item_id),
  check ((kind = 'cooked') = (component_id is not null)),
  check ((kind in ('foodstuff','basic')) = (ingredient_id is not null)),
  check ((kind = 'custom') = (custom_label is not null))
);
-- RLS: owner can select, insert, update, delete; no one else.
-- Nightly job: delete kind = 'cooked' where added_at < now() - HOUSE_COOKED_DAYS.
-- The engine also ignores expired cooked rows at read time, so a late job never serves old soup.

create table ai_calls (
  id uuid primary key default gen_random_uuid(),
  task text not null,                           -- craving_parse, chef, draft, menu_map
  model text not null,
  user_id uuid,
  input_tokens int, output_tokens int, cache_read_tokens int, cache_write_tokens int,
  latency_ms int,
  stop_reason text,
  outcome text not null,                        -- ok, fallback_timeout, fallback_refusal, fallback_schema, quota
  cost_usd numeric(10,6),
  raw_input text,                               -- user text; nulled after LOG_TEXT_RETENTION_DAYS
  raw_output jsonb,
  prompt_version text not null
);

create table ai_eval_runs (
  id uuid primary key default gen_random_uuid(),
  model text not null, prompt_version text not null,
  results jsonb not null, passed boolean not null
);

create table app_config (key text primary key, value jsonb not null, updated_by uuid);
create table user_roles (user_id uuid primary key references auth.users(id), role text not null check (role in ('admin','editor')));
create table audit_log (
  id bigint generated always as identity primary key,
  actor uuid, action text not null, entity text not null, entity_id text,
  before jsonb, after jsonb, at timestamptz not null default now()
);

create table partners (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                    -- 'chopbaze'
  name text not null,
  status text not null default 'active',
  webhook_url text,
  covered_areas text[] not null default '{}'
);

create table partner_keys (
  id text primary key,                          -- public key id, e.g. 'pk_live_…'
  partner_id uuid references partners(id),
  secret_ref text not null,                     -- Supabase Vault secret id (HMAC secret, encrypted)
  scopes text[] not null,                       -- suggestions, events, menu_mapping, availability
  status text not null default 'active',
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table partner_profiles (                  -- a Chopbaze user as seen by the engine; no PII
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references partners(id),
  partner_user_ref text not null,
  linked_user_id uuid,                          -- set only after explicit account linking (later phase)
  unique (partner_id, partner_user_ref)
);
-- partner profiles reuse taste_affinities and user_component_stats through a mirror pair of tables
-- partner_taste_affinities and partner_component_stats with partner_profile_id as the key.

create table partner_availability (              -- pushed by the partner (doc 08)
  partner_id uuid references partners(id),
  area_id text references areas(id),
  component_id text references components(id),
  vendor_ref text not null,
  item_ref text not null,
  vendor_name text not null,
  item_name text not null,
  price_ngn int not null,
  delivery_fee_ngn int,
  eta_minutes int,
  deep_link text not null,
  web_link text,
  updated_at timestamptz not null,
  primary key (partner_id, area_id, vendor_ref, item_ref)
);

create table partner_menu_mappings (
  partner_id uuid references partners(id),
  item_ref text not null,
  item_name text not null,
  component_id text references components(id),
  confidence real,
  status text not null default 'proposed' check (status in ('proposed','confirmed','rejected')),
  primary key (partner_id, item_ref)
);

create table order_handoffs (
  ref text primary key,                         -- short random id sent to the partner
  user_id uuid, partner_profile_id uuid,
  partner_id uuid references partners(id),
  plate_key text not null,
  vendor_ref text, item_ref text,
  status text not null default 'handed_off',    -- handed_off, placed, completed, cancelled
  order_value_ngn int
);

create table waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  partner_id uuid references partners(id),
  area_id text not null,
  contact_kind text not null check (contact_kind in ('email','phone')),
  contact text not null,
  plate_key text,
  consent_id uuid not null references consents(id),
  shared_at timestamptz
);

create table demand_signals_weekly (             -- aggregated, no personal data
  week_start date, area_id text, component_id text, mode text, budget_band text,
  commits int not null, waitlist_joins int not null, handoffs int not null,
  primary key (week_start, area_id, component_id, mode, budget_band)
);

-- Partner profiles mirror the personal taste tables (doc 07, section 1.4).
create table partner_taste_affinities (
  partner_profile_id uuid references partner_profiles(id) on delete cascade,
  tag text not null,
  score real not null check (score between -1 and 1),
  updated_at timestamptz not null default now(),
  primary key (partner_profile_id, tag)
);

create table partner_component_stats (
  partner_profile_id uuid references partner_profiles(id) on delete cascade,
  component_id text references components(id),
  first_seen_at timestamptz,
  last_positive_at timestamptz,
  last_ate_at timestamptz,
  disliked_until timestamptz,
  seen_count int not null default 0,
  primary key (partner_profile_id, component_id)
);

-- Every table gets created_at (doc 07, preamble).
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I add column if not exists created_at timestamptz not null default now()', t);
  end loop;
end $$;

-- Tables whose rows change get updated_at, kept by a trigger.
create function set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['areas','ingredients','market_units','price_sources','components','videos','plate_templates','pairings','profiles','app_config','partners','partner_menu_mappings','order_handoffs','data_requests','votes'] loop
    execute format('alter table %I add column if not exists updated_at timestamptz not null default now()', t);
    execute format('create trigger set_updated_at before update on %I for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- Row-level security (doc 07, section 2). On by default everywhere: a table without a policy is server-only.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Catalogue and prices: readable by everyone; written only through server routes with the service role.
do $$
declare t text;
begin
  foreach t in array array['areas','ingredients','market_units','price_points','plate_templates','pairing_defaults','classic_plates','snapshot_version'] loop
    execute format('create policy read_all on %I for select using (true)', t);
  end loop;
end $$;
create policy read_published on components for select using (status = 'published');
create policy read_published on component_ingredients for select using (exists (select 1 from components c where c.id = component_id and c.status = 'published'));
create policy read_published on component_steps for select using (exists (select 1 from components c where c.id = component_id and c.status = 'published'));
create policy read_approved on videos for select using (status = 'approved' and exists (select 1 from components c where c.id = component_id and c.status = 'published'));
create policy read_approved on pairings for select using (status = 'approved');

-- Personal tables: each person sees and changes only their own rows. Anonymous users are 'authenticated' too.
do $$
declare t text;
begin
  foreach t in array array['profiles','profile_allergies','taste_affinities','user_component_stats','saved_plates','house_items','consents','data_requests'] loop
    execute format('create policy own_rows on %I for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;
create policy own_insert on events for insert with check (user_id = (select auth.uid()));
create policy own_select on events for select using (user_id = (select auth.uid()));
create policy own_rows on shares for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_select on votes for select using (user_id = (select auth.uid()));
create policy own_close on votes for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- vote_ballots, partner, AI, audit, config, price observation and scout tables have no policy: server only.
