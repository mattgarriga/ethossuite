@AGENTS.md

# EthosSuite project rules

One login, many tools for Ethos Business Solutions (NetSuite consultancy). Tool 1 is a free,
public SuiteScript 2.1 Migration **Assessment** used for lead generation.

## Hard rules
- **Database changes:** write migrations in `supabase/migrations/` only. Never apply them
  (`supabase db push`), never run `supabase config push`, never edit live data. The lead
  session shows the SQL to Matt and applies it after he approves.
- **Secrets:** never read, print or copy any `.env*` file. `SUPABASE_SECRET_KEY` is
  server-only: import `@/lib/supabase/admin` only from server code (it imports `server-only`).
- **AI is mocked by default.** `AI_MODE=mock` unless explicitly `live`. Nothing may call
  `api.anthropic.com` unless `AI_MODE=live` AND `ANTHROPIC_API_KEY` is set. No tests, scripts
  or dev flows may use live mode.
- **Assessment only.** No live code conversion path in the public tool.
- **Source code is never stored.** Uploaded files live in memory for one request, then are
  dropped. Only structured findings are written.
- **All writes go through the service-role client on the server**, after checking who the user
  is. RLS only governs direct client reads.
- **New tables:** `{tool_slug}_*` prefix, hang off `runs.run_id`, enable RLS, add select
  policies (own + `public.is_internal()`), and explicitly `grant select ... to authenticated`
  (default privileges are locked down).
- **Next.js 16:** read the relevant guide in `node_modules/next/dist/docs/` before using an
  API. `middleware` is now `src/proxy.ts`. `cookies()`, `headers()`, `params`, `searchParams`
  are async.
- `reference/` is read-only material copied from the internal migrator. Never import from it;
  reimplement what you need under `src/lib/`.

## Map
- `src/lib/supabase/{server,client,admin,proxy}.ts`: Supabase clients. Reuse, don't recreate.
- `src/lib/auth.ts`: `safeNext`, `getOrigin`, `MIN_PASSWORD_LENGTH`.
- `src/lib/types.ts`: shared contract between front end and back end. Change it
  deliberately and note it in your report.
- `supabase/migrations/`: schema (profiles, tools, runs, usage_costs, leads,
  platform_settings, rate_limit_events, suitescript_migrator_assessments/_findings).
- `reference/suitescript-2.1-migrator/`: `ANALYZE_SCHEMA` (src/schemas.ts), `DEADLINES`
  (src/config.ts), scoring (inventory/prioritize/phasing.ts), upload safety (upload.ts),
  and the six reference docs for the system prompt.

## Brand (from the Ethos dashboards)
navy `#181B40`, navy2 `#262F8D`, blue2/link `#3041D3`, blue `#5183ED`, cyan `#4CC3EE`,
paper `#E8EAF5`, card `#FFFFFF`, soft `#F1F3FB`, hover `#EEF1FC`, line `#D4D8E6`,
ink `#0D0D0E`, ink2 `#454950`, mute `#596077`. Risk: red `#B3261E`/`#FCE9E8`,
amber `#8A5D00`/`#FFF1CC`, green `#1F6E45`/`#E1F4E9`. Headings: Sora 600/700. Body: Ubuntu.
Header: gradient band `#181B40 → #262F8D → #3041D3` with a 4px cyan→blue strip; the logo
sits in a white rounded pill. Cards use a 14px radius; buttons are pill-shaped.

## Done means
`npm run lint` and `npm run build` are clean, and tests pass. Report what changed, any
contract changes, and anything you could not verify.
