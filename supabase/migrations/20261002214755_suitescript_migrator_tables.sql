-- Group 3: SuiteScript Migrator tool tables, RLS, grants, registry row.

create table public.suitescript_migrator_assessments (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid not null unique references public.runs (id),
  file_count    integer not null check (file_count between 1 and 10),
  overall_risk  text check (overall_risk in ('Low','Medium','High','Critical')),  -- null if every file failed
  summary       jsonb,
  created_at    timestamptz not null default now()
);

create table public.suitescript_migrator_findings (
  id                  uuid primary key default gen_random_uuid(),
  assessment_id       uuid not null references public.suitescript_migrator_assessments (id) on delete cascade,
  file_name           text not null,
  status              text not null default 'completed' check (status in ('completed','failed')),
  error               text,
  api_version         text check (api_version in ('1.0','2.0','2.1','unknown')),  -- drives the deadline: 1.0 -> 2027.1, else 2028.2
  script_type         text,
  complexity_score    integer check (complexity_score >= 0),
  complexity_rating   text check (complexity_rating in ('Low','Medium','High','Critical')),
  breaking_changes    jsonb,
  migration_checklist jsonb,
  purpose_summary     text,
  created_at          timestamptz not null default now()
);
create index idx_suitescript_migrator_findings_assessment_id
  on public.suitescript_migrator_findings (assessment_id);

alter table public.suitescript_migrator_assessments enable row level security;
alter table public.suitescript_migrator_findings    enable row level security;

create policy suitescript_migrator_assessments_select_own on public.suitescript_migrator_assessments
  for select to authenticated using (
    exists (select 1 from public.runs r
            where r.id = run_id and r.user_id = (select auth.uid())));
create policy suitescript_migrator_assessments_select_internal on public.suitescript_migrator_assessments
  for select to authenticated using (public.is_internal());

create policy suitescript_migrator_findings_select_own on public.suitescript_migrator_findings
  for select to authenticated using (
    exists (select 1 from public.suitescript_migrator_assessments a
            join public.runs r on r.id = a.run_id
            where a.id = assessment_id and r.user_id = (select auth.uid())));
create policy suitescript_migrator_findings_select_internal on public.suitescript_migrator_findings
  for select to authenticated using (public.is_internal());

-- Default privileges now start locked down, so grant explicitly.
grant select on public.suitescript_migrator_assessments,
                public.suitescript_migrator_findings to authenticated;

-- Registry row for the tool.
insert into public.tools (slug, name, description, icon, visibility, status, sort_order)
values ('suitescript_migrator', 'SuiteScript 2.1 Migrator',
        'Upload up to 10 SuiteScript files and get a free assessment of what needs to change before Oracle''s 2.1 deprecation deadlines.',
        'code', 'public', 'active', 1)
on conflict (slug) do nothing;
