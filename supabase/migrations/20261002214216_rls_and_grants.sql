-- Group 2: RLS policies and grants.

-- 1. Staff check. security definer so policies can call it without
--    triggering RLS on profiles (this is what avoids the recursion bug).
create or replace function public.is_internal() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'internal'
  );
$$;
revoke execute on function public.is_internal() from public, anon;
grant  execute on function public.is_internal() to authenticated;

-- 2. Enable RLS everywhere.
alter table public.profiles          enable row level security;
alter table public.tools             enable row level security;
alter table public.runs              enable row level security;
alter table public.usage_costs       enable row level security;
alter table public.leads             enable row level security;
alter table public.platform_settings enable row level security;
alter table public.rate_limit_events enable row level security;

-- 3. Read policies. No insert/update/delete policies on any table:
--    all writes go through the service role, which bypasses RLS.

-- profiles
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_select_internal on public.profiles
  for select to authenticated using (public.is_internal());

-- tools: signed-out visitors see active/beta public tools; staff see everything.
create policy tools_select_public on public.tools
  for select to anon, authenticated
  using (visibility = 'public' and status <> 'disabled');
create policy tools_select_internal on public.tools
  for select to authenticated using (public.is_internal());

-- runs
create policy runs_select_own on public.runs
  for select to authenticated using (user_id = (select auth.uid()));
create policy runs_select_internal on public.runs
  for select to authenticated using (public.is_internal());

-- staff-only
create policy usage_costs_select_internal on public.usage_costs
  for select to authenticated using (public.is_internal());
create policy leads_select_internal on public.leads
  for select to authenticated using (public.is_internal());
create policy platform_settings_select_internal on public.platform_settings
  for select to authenticated using (public.is_internal());

-- rate_limit_events: RLS on, no policies. Service role only.

-- 4. Grants: strip Supabase's default open privileges, then grant SELECT
--    only where a policy exists.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.tools to anon;
grant select on public.tools, public.profiles, public.runs,
                public.usage_costs, public.leads, public.platform_settings
  to authenticated;

-- 5. Future tables start locked down too. Each new migration must grant
--    SELECT explicitly (and add its policies).
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
