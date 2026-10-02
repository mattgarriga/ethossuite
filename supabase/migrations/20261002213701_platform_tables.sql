-- Group 1: shared platform tables, indexes, triggers.

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          text not null default 'public' check (role in ('public', 'internal')),
  email         text,
  full_name     text,
  company_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_profiles_internal on public.profiles (id) where role = 'internal';

create table public.tools (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  icon        text,
  visibility  text not null default 'public' check (visibility in ('public', 'internal')),
  status      text not null default 'active' check (status in ('active', 'beta', 'disabled')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- user_id is nullable so runs (and cost history) survive user deletion.
create table public.runs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles (id) on delete set null,
  tool_id      uuid not null references public.tools (id),
  status       text not null default 'pending'
                 check (status in ('pending','running','completed','failed','cancelled')),
  error        text,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index idx_runs_user_created on public.runs (user_id, created_at desc);
create index idx_runs_tool_id      on public.runs (tool_id);
create index idx_runs_created_at   on public.runs (created_at desc);
create index idx_runs_status       on public.runs (status) where status in ('pending','running');

-- Cost ledger. Runs are never deleted, so no cascade.
create table public.usage_costs (
  id                    uuid primary key default gen_random_uuid(),
  run_id                uuid not null references public.runs (id),
  file_name             text,
  model                 text not null,
  input_tokens          integer not null default 0,
  output_tokens         integer not null default 0,
  cache_read_tokens     integer not null default 0,
  cache_creation_tokens integer not null default 0,
  cost_usd              numeric(12,6) not null default 0,
  created_at            timestamptz not null default now()
);
create index idx_usage_costs_run_id     on public.usage_costs (run_id);
create index idx_usage_costs_created_at on public.usage_costs (created_at desc);

-- One lead per user per tool. Persists after the user is deleted.
create table public.leads (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles (id) on delete set null,
  source_tool_id uuid not null references public.tools (id),
  email          text not null,
  full_name      text not null,
  company_name   text,
  notes          text,
  created_at     timestamptz not null default now(),
  unique (user_id, source_tool_id)
);
create index idx_leads_email          on public.leads (email);
create index idx_leads_source_tool_id on public.leads (source_tool_id);

-- Anti-abuse state, all in Postgres.
create table public.platform_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (key, value) values
  ('daily_spend_cap_usd', '1'::jsonb),
  ('tools_paused',        'false'::jsonb);

-- Event log for rate limiting. scope = 'user' | 'ip'; key = user id or hashed IP.
create table public.rate_limit_events (
  id         bigint generated always as identity primary key,
  scope      text not null check (scope in ('user','ip')),
  key        text not null,
  tool_id    uuid references public.tools (id),
  created_at timestamptz not null default now()
);
create index idx_rate_limit_lookup on public.rate_limit_events (scope, key, created_at desc);

-- Triggers
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_tools_updated_at before update on public.tools
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, company_name)
  values (new.id, new.email,
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'company_name');
  return new;
end; $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger trg_on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
