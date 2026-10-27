alter table public.events
  add column if not exists goal text not null default '',
  add column if not exists target_audience text not null default '',
  add column if not exists program jsonb not null default '[]'::jsonb
    check (jsonb_typeof(program) = 'array'),
  add column if not exists risks jsonb not null default '[]'::jsonb
    check (jsonb_typeof(risks) = 'array');

create table if not exists public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Новый диалог',
  created_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  source_message_id text,
  model text,
  tokens_in integer,
  tokens_out integer,
  created_at timestamptz not null default now(),
  unique (thread_id, source_message_id)
);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  thread_id uuid references public.ai_threads (id) on delete set null,
  model text not null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  cost_estimate numeric(12, 6),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_rate_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null default 0
);

create index if not exists ai_threads_user_event_created_idx
  on public.ai_threads (user_id, event_id, created_at desc);
create index if not exists ai_messages_thread_created_idx
  on public.ai_messages (thread_id, created_at);
create index if not exists ai_usage_user_created_idx
  on public.ai_usage (user_id, created_at desc);

alter table public.ai_threads enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_rate_limits enable row level security;

grant select, insert, update, delete on public.ai_threads to authenticated;
grant select, insert on public.ai_messages to authenticated;
grant select, insert on public.ai_usage to authenticated;

create policy "Users can read their AI threads"
  on public.ai_threads for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and (event_id is null or public.is_event_member(event_id))
  );

create policy "Users can create their AI threads"
  on public.ai_threads for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (event_id is null or public.is_event_member(event_id))
  );

create policy "Users can update their AI thread titles"
  on public.ai_threads for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their AI threads"
  on public.ai_threads for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can read their AI messages"
  on public.ai_messages for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.ai_threads t
      where t.id = thread_id
        and t.user_id = (select auth.uid())
    )
  );

create policy "Users can append messages to their AI threads"
  on public.ai_messages for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.ai_threads t
      where t.id = thread_id
        and t.user_id = (select auth.uid())
    )
  );

create policy "Users can read their AI usage"
  on public.ai_usage for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can record their AI usage"
  on public.ai_usage for insert
  to authenticated
  with check (user_id = (select auth.uid()));

revoke all on public.ai_rate_limits from public, anon, authenticated;

create or replace function public.consume_ai_rate_limit(
  maximum_requests integer default 15,
  window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_request_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if maximum_requests < 1 or window_seconds < 1 then
    raise exception 'Rate limit values must be positive';
  end if;

  insert into public.ai_rate_limits (user_id, window_started_at, request_count)
  values (current_user_id, pg_catalog.now(), 1)
  on conflict (user_id) do update
    set window_started_at = case
      when public.ai_rate_limits.window_started_at
        <= pg_catalog.now() - pg_catalog.make_interval(secs => window_seconds)
      then pg_catalog.now()
      else public.ai_rate_limits.window_started_at
    end,
    request_count = case
      when public.ai_rate_limits.window_started_at
        <= pg_catalog.now() - pg_catalog.make_interval(secs => window_seconds)
      then 1
      else public.ai_rate_limits.request_count + 1
    end
  returning request_count into current_request_count;

  return current_request_count <= maximum_requests;
end;
$$;

revoke all on function public.consume_ai_rate_limit(integer, integer) from public, anon;
grant execute on function public.consume_ai_rate_limit(integer, integer) to authenticated;
