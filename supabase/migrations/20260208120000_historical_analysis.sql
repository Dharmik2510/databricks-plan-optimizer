create extension if not exists "pgcrypto";

create table if not exists historical_analysis (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  mode text not null check (mode in ('single','compare')),
  app_id_a text not null,
  app_id_b text null,
  app_name text null,
  title text null,
  user_question text null,
  evidence_json jsonb not null,
  narrative_md text not null,
  status text not null default 'pending' check (status in ('pending','complete','error')),
  error text null,
  latency_ms int null,
  tags text[] null
);

create index if not exists historical_analysis_user_id_created_at_idx
  on historical_analysis (user_id, created_at desc);
create index if not exists historical_analysis_app_id_a_idx on historical_analysis (app_id_a);
create index if not exists historical_analysis_app_id_b_idx on historical_analysis (app_id_b);
create index if not exists historical_analysis_app_name_idx on historical_analysis (app_name);

alter table historical_analysis enable row level security;

create policy "historical_analysis_select_own" on historical_analysis
  for select using (user_id = auth.uid());
create policy "historical_analysis_insert_own" on historical_analysis
  for insert with check (user_id = auth.uid());
create policy "historical_analysis_update_own" on historical_analysis
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "historical_analysis_delete_own" on historical_analysis
  for delete using (user_id = auth.uid());

create table if not exists org_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  type text not null check (type in ('mcp_shs')),
  mcp_server_url text not null,
  shs_base_url text null,
  auth_scheme text not null default 'bearer' check (auth_scheme in ('none','bearer','basic','header')),
  auth_header_name text null,
  token_encrypted jsonb not null,
  token_kid text not null,
  is_active boolean not null default true,
  last_validated_at timestamptz null,
  validation_error text null
);

create index if not exists org_connections_org_active_idx
  on org_connections (org_id, is_active);
create index if not exists org_connections_created_at_idx
  on org_connections (created_at);

alter table org_connections enable row level security;

create policy "org_connections_select_org" on org_connections
  for select using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy "org_connections_admin_insert" on org_connections
  for insert with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and (auth.jwt() ->> 'role') in ('ADMIN','SUPER_ADMIN','admin')
  );

create policy "org_connections_admin_update" on org_connections
  for update using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and (auth.jwt() ->> 'role') in ('ADMIN','SUPER_ADMIN','admin')
  ) with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and (auth.jwt() ->> 'role') in ('ADMIN','SUPER_ADMIN','admin')
  );

create policy "org_connections_admin_delete" on org_connections
  for delete using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and (auth.jwt() ->> 'role') in ('ADMIN','SUPER_ADMIN','admin')
  );

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  org_id uuid not null,
  user_id uuid not null,
  action text not null,
  target text not null,
  metadata jsonb null
);

create index if not exists audit_events_org_created_at_idx
  on audit_events (org_id, created_at desc);

alter table audit_events enable row level security;

create policy "audit_events_select_org" on audit_events
  for select using (org_id = (auth.jwt() ->> 'org_id')::uuid);
create policy "audit_events_insert_org" on audit_events
  for insert with check (org_id = (auth.jwt() ->> 'org_id')::uuid);

create table if not exists shs_cache (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  cache_key text not null,
  payload jsonb not null,
  expires_at timestamptz not null
);

create unique index if not exists shs_cache_cache_key_idx on shs_cache (cache_key);

alter table shs_cache enable row level security;
