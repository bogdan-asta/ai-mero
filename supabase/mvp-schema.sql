create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  onboarding_role text check (onboarding_role in ('student', 'teacher', 'staff', 'other')),
  organization text not null default '',
  event_interest text not null default '',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  idea text not null default '',
  description text not null default '',
  event_date date,
  format text not null default '',
  guests_count integer check (guests_count is null or guests_count > 0),
  budget numeric(12, 2) check (budget is null or budget >= 0),
  venue_name text not null default '',
  goal text not null default '',
  target_audience text not null default '',
  program jsonb not null default '[]'::jsonb check (jsonb_typeof(program) = 'array'),
  risks jsonb not null default '[]'::jsonb check (jsonb_typeof(risks) = 'array'),
  status text not null default 'planning'
    check (status in ('draft', 'planning', 'ready', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Новый диалог',
  created_at timestamptz not null default now()
);

create table public.ai_messages (
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

create table public.ai_usage (
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

create table public.ai_rate_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null default 0
);

create index events_owner_updated_idx on public.events (created_by, updated_at desc);
create index ai_threads_user_event_created_idx on public.ai_threads (user_id, event_id, created_at desc);
create index ai_messages_thread_created_idx on public.ai_messages (thread_id, created_at);
create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.ai_threads enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_rate_limits enable row level security;

grant select on public.profiles to authenticated;
grant update (full_name, onboarding_role, organization, event_interest, onboarding_completed)
  on public.profiles to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.ai_threads to authenticated;
grant select, insert on public.ai_messages to authenticated;
grant select, insert on public.ai_usage to authenticated;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Owners can read their events"
  on public.events for select to authenticated
  using (created_by = (select auth.uid()));

create policy "Users can create their own events"
  on public.events for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "Owners can update their events"
  on public.events for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

create policy "Owners can delete their events"
  on public.events for delete to authenticated
  using (created_by = (select auth.uid()));

create policy "Users can read their AI threads"
  on public.ai_threads for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.created_by = (select auth.uid())
    )
  );

create policy "Users can create their AI threads"
  on public.ai_threads for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.created_by = (select auth.uid())
    )
  );

create policy "Users can update their AI threads"
  on public.ai_threads for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their AI threads"
  on public.ai_threads for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can read their AI messages"
  on public.ai_messages for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.ai_threads t
      where t.id = thread_id and t.user_id = (select auth.uid())
    )
  );

create policy "Users can append messages to their AI threads"
  on public.ai_messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.ai_threads t
      where t.id = thread_id and t.user_id = (select auth.uid())
    )
  );

create policy "Users can read their AI usage"
  on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can record their AI usage"
  on public.ai_usage for insert to authenticated
  with check (user_id = (select auth.uid()));

revoke all on public.ai_rate_limits from public, anon, authenticated;

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create function public.consume_ai_rate_limit(
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
