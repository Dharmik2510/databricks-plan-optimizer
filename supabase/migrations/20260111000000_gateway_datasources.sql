-- Migration: Add gateway data sources support
-- Description: Adds data_sources table for gateway mode and user_quotas for freemium tiers
-- Author: BrickOptima
-- Date: 2026-01-11

-- Enable UUID extension
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================================
-- data_sources: Gateway data sources (replaces org_connections for gateway mode)
-- ============================================================================
create table if not exists data_sources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Ownership
  user_id uuid not null,
  org_id uuid null,  -- Null for individual users, set for org-level connections

  -- Connection type: gateway_shs or external_mcp
  connection_type text not null default 'gateway_shs'
    check (connection_type in ('gateway_shs', 'external_mcp')),

  -- Display name
  display_name text not null,

  -- For gateway_shs: SHS connection details
  shs_base_url text null,
  shs_auth_scheme text null
    check (shs_auth_scheme in ('none', 'bearer', 'basic', 'header')),
  shs_auth_header_name text null,
  shs_token_encrypted jsonb null,  -- Envelope encrypted
  shs_token_kid text null,

  -- For gateway_shs + private networks: SSH tunnel config
  tunnel_config jsonb null,
  -- Example tunnel_config:
  -- {
  --   "type": "ssh",
  --   "ssh_host": "bastion.company.com",
  --   "ssh_port": 22,
  --   "ssh_user": "brickoptima",
  --   "ssh_private_key_encrypted": "...",
  --   "ssh_private_key_kid": "...",
  --   "remote_host": "10.0.1.100",
  --   "remote_port": 18080,
  --   "local_port": 18080
  -- }

  -- For external_mcp: External MCP server details
  external_mcp_url text null,
  external_mcp_auth_scheme text null
    check (external_mcp_auth_scheme in ('none', 'bearer', 'basic', 'header')),
  external_mcp_auth_header_name text null,
  external_mcp_token_encrypted jsonb null,
  external_mcp_token_kid text null,

  -- Metadata
  is_active boolean not null default true,
  last_validated_at timestamptz null,
  validation_error text null,

  -- Constraints
  constraint data_sources_user_org_active_unique unique (user_id, org_id, is_active),

  -- Validation: gateway_shs requires shs_base_url
  constraint data_sources_gateway_shs_check
    check (
      connection_type != 'gateway_shs' or
      (shs_base_url is not null and shs_auth_scheme is not null)
    ),

  -- Validation: external_mcp requires external_mcp_url
  constraint data_sources_external_mcp_check
    check (
      connection_type != 'external_mcp' or
      external_mcp_url is not null
    )
);

-- Indexes
create index if not exists data_sources_user_id_idx on data_sources (user_id);
create index if not exists data_sources_org_id_idx on data_sources (org_id);
create index if not exists data_sources_active_idx on data_sources (is_active)
  where is_active = true;

-- Comments
comment on table data_sources is 'Gateway data sources - stores SHS connections (gateway mode) or external MCP connections';
comment on column data_sources.connection_type is 'gateway_shs = hosted MCP, external_mcp = org-managed MCP';
comment on column data_sources.tunnel_config is 'SSH tunnel configuration for private SHS endpoints (JSON)';

-- RLS: Users can view their own data sources or org-level sources
alter table data_sources enable row level security;

create policy "data_sources_select_own"
  on data_sources for select
  using (
    user_id = auth.uid() or
    (org_id is not null and org_id = (auth.jwt() ->> 'org_id')::uuid)
  );

-- RLS: Users can insert their own personal data sources
create policy "data_sources_insert_own"
  on data_sources for insert
  with check (user_id = auth.uid() and org_id is null);

-- RLS: Users can update their own personal data sources
create policy "data_sources_update_own"
  on data_sources for update
  using (user_id = auth.uid() and org_id is null)
  with check (user_id = auth.uid() and org_id is null);

-- RLS: Users can delete their own personal data sources
create policy "data_sources_delete_own"
  on data_sources for delete
  using (user_id = auth.uid() and org_id is null);

-- RLS: Admins can insert/update/delete org-level data sources
create policy "data_sources_org_admin_insert"
  on data_sources for insert
  with check (
    org_id is not null and
    org_id = (auth.jwt() ->> 'org_id')::uuid and
    (auth.jwt() ->> 'role') in ('ADMIN', 'SUPER_ADMIN', 'admin')
  );

create policy "data_sources_org_admin_update"
  on data_sources for update
  using (
    org_id is not null and
    org_id = (auth.jwt() ->> 'org_id')::uuid and
    (auth.jwt() ->> 'role') in ('ADMIN', 'SUPER_ADMIN', 'admin')
  )
  with check (
    org_id is not null and
    org_id = (auth.jwt() ->> 'org_id')::uuid and
    (auth.jwt() ->> 'role') in ('ADMIN', 'SUPER_ADMIN', 'admin')
  );

create policy "data_sources_org_admin_delete"
  on data_sources for delete
  using (
    org_id is not null and
    org_id = (auth.jwt() ->> 'org_id')::uuid and
    (auth.jwt() ->> 'role') in ('ADMIN', 'SUPER_ADMIN', 'admin')
  );

-- ============================================================================
-- user_quotas: Track usage and enforce tier limits
-- ============================================================================
create table if not exists user_quotas (
  user_id uuid primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Tier
  tier text not null default 'free'
    check (tier in ('free', 'pro', 'team', 'enterprise')),

  -- Usage tracking
  mcp_calls_this_month int not null default 0,
  mcp_calls_reset_at timestamptz not null default date_trunc('month', now() + interval '1 month'),

  -- Tier limits
  mcp_calls_limit int not null default 50,
  concurrent_analyses_limit int not null default 1,
  datasources_max int not null default 1,
  retention_days int not null default 7
);

-- Comments
comment on table user_quotas is 'User quotas for freemium tiers';
comment on column user_quotas.mcp_calls_this_month is 'Number of MCP calls made this month (resets monthly)';
comment on column user_quotas.mcp_calls_limit is 'Max MCP calls allowed per month based on tier';

-- RLS: Users can view their own quota
alter table user_quotas enable row level security;

create policy "user_quotas_select_own"
  on user_quotas for select
  using (user_id = auth.uid());

-- Function to reset monthly quotas
create or replace function reset_monthly_quotas()
returns void
language sql
security definer
as $$
  update user_quotas
  set
    mcp_calls_this_month = 0,
    mcp_calls_reset_at = date_trunc('month', now() + interval '1 month'),
    updated_at = now()
  where mcp_calls_reset_at < now();
$$;

comment on function reset_monthly_quotas is 'Resets monthly quota counters for all users (run via cron)';

-- Function to create default quota for new users
create or replace function create_default_user_quota()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into user_quotas (
    user_id,
    tier,
    mcp_calls_limit,
    concurrent_analyses_limit,
    datasources_max,
    retention_days
  )
  values (
    new.id,
    'free',
    50,
    1,
    1,
    7
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

comment on function create_default_user_quota is 'Auto-creates free tier quota when user signs up';

-- Trigger to auto-create quota when user signs up
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function create_default_user_quota();

-- ============================================================================
-- Update audit_events to track datasource_id
-- ============================================================================
alter table audit_events add column if not exists datasource_id uuid null;

comment on column audit_events.datasource_id is 'ID of the data_source used for this action (if applicable)';

-- ============================================================================
-- Migration helper: Create default quotas for existing users
-- ============================================================================
do $$
begin
  -- Create default quotas for existing users who don't have one
  insert into user_quotas (user_id, tier, mcp_calls_limit, concurrent_analyses_limit, datasources_max, retention_days)
  select
    id,
    'free',
    50,
    1,
    1,
    7
  from auth.users
  where not exists (
    select 1 from user_quotas where user_quotas.user_id = auth.users.id
  );
end $$;
