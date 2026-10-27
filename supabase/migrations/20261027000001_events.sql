create table if not exists public.events (
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
  status text not null default 'planning'
    check (status in ('draft', 'planning', 'ready', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_members (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'participant'
    check (role in ('organizer', 'participant')),
  invited_by uuid references auth.users (id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists events_created_by_updated_at_idx
  on public.events (created_by, updated_at desc);
create index if not exists event_members_user_id_idx
  on public.event_members (user_id);

alter table public.events enable row level security;
alter table public.event_members enable row level security;

grant select, insert, update, delete on public.events to authenticated;
grant select on public.event_members to authenticated;

create or replace function public.is_event_member(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    where e.id = target_event_id
      and e.created_by = (select auth.uid())
  )
  or exists (
    select 1
    from public.event_members m
    where m.event_id = target_event_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_event_organizer(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    where e.id = target_event_id
      and e.created_by = (select auth.uid())
  )
  or exists (
    select 1
    from public.event_members m
    where m.event_id = target_event_id
      and m.user_id = (select auth.uid())
      and m.role = 'organizer'
  );
$$;

revoke all on function public.is_event_member(uuid) from public, anon;
revoke all on function public.is_event_organizer(uuid) from public, anon;
grant execute on function public.is_event_member(uuid) to authenticated;
grant execute on function public.is_event_organizer(uuid) to authenticated;

create policy "Event members can read events"
  on public.events for select
  to authenticated
  using (public.is_event_member(id));

create policy "Users can create their own events"
  on public.events for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

create policy "Event organizers can update events"
  on public.events for update
  to authenticated
  using (public.is_event_organizer(id))
  with check (public.is_event_organizer(id));

create policy "Event organizers can delete events"
  on public.events for delete
  to authenticated
  using (public.is_event_organizer(id));

create policy "Event members can read their memberships"
  on public.event_members for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or public.is_event_organizer(event_id)
  );

create or replace function public.set_updated_at()
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

create trigger set_events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();
