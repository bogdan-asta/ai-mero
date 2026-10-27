create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  address text not null check (char_length(address) between 2 and 300),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.venue_rooms (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  capacity integer not null check (capacity between 1 and 100000),
  hourly_rate numeric(12, 2) check (hourly_rate is null or hourly_rate >= 0),
  equipment text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  room_id uuid not null references public.venue_rooms (id) on delete restrict,
  requested_by uuid not null references auth.users (id) on delete cascade,
  event_title text not null,
  guest_count integer,
  event_date date,
  venue_name text not null,
  room_name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  organizer_note text not null default '' check (char_length(organizer_note) <= 1000),
  admin_note text not null default '' check (char_length(admin_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists venues_active_name_idx
  on public.venues (active, name);
create index if not exists venue_rooms_venue_active_capacity_idx
  on public.venue_rooms (venue_id, active, capacity);
create index if not exists event_bookings_room_time_status_idx
  on public.event_bookings (room_id, starts_at, ends_at, status);
create index if not exists event_bookings_event_created_idx
  on public.event_bookings (event_id, created_at desc);

alter table public.venues enable row level security;
alter table public.venue_rooms enable row level security;
alter table public.event_bookings enable row level security;

create or replace function public.has_venue_admin_role()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('venue_admin', 'super_admin')
  );
$$;

create or replace function public.is_venue_owner(target_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_venue_admin_role()
    and exists (
      select 1
      from public.venues v
      where v.id = target_venue_id
        and (
          v.created_by = (select auth.uid())
          or exists (
            select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.role = 'super_admin'
          )
        )
    );
$$;

revoke all on function public.has_venue_admin_role() from public, anon;
revoke all on function public.is_venue_owner(uuid) from public, anon;
grant execute on function public.has_venue_admin_role() to authenticated;
grant execute on function public.is_venue_owner(uuid) to authenticated;

grant select, insert, update, delete on public.venues to authenticated;
grant select, insert, update, delete on public.venue_rooms to authenticated;
grant select on public.event_bookings to authenticated;

create policy "Users can read active venues"
  on public.venues for select
  to authenticated
  using (active or created_by = (select auth.uid()) or public.has_venue_admin_role());

create policy "Venue admins can create venues"
  on public.venues for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and public.has_venue_admin_role()
  );

create policy "Venue admins can update their venues"
  on public.venues for update
  to authenticated
  using (public.is_venue_owner(id))
  with check (public.is_venue_owner(id));

create policy "Venue admins can delete their venues"
  on public.venues for delete
  to authenticated
  using (public.is_venue_owner(id));

create policy "Users can read rooms in active venues"
  on public.venue_rooms for select
  to authenticated
  using (
    active
    and exists (
      select 1 from public.venues v
      where v.id = venue_id and v.active
    )
    or public.is_venue_owner(venue_id)
  );

create policy "Venue admins can create rooms"
  on public.venue_rooms for insert
  to authenticated
  with check (public.is_venue_owner(venue_id));

create policy "Venue admins can update rooms"
  on public.venue_rooms for update
  to authenticated
  using (public.is_venue_owner(venue_id))
  with check (public.is_venue_owner(venue_id));

create policy "Venue admins can delete rooms"
  on public.venue_rooms for delete
  to authenticated
  using (public.is_venue_owner(venue_id));

create policy "Event members and venue admins can read bookings"
  on public.event_bookings for select
  to authenticated
  using (
    requested_by = (select auth.uid())
    or public.is_event_member(event_id)
    or exists (
      select 1
      from public.venue_rooms r
      where r.id = room_id and public.is_venue_owner(r.venue_id)
    )
  );

create trigger set_venues_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

create trigger set_venue_rooms_updated_at
  before update on public.venue_rooms
  for each row execute function public.set_updated_at();

create trigger set_event_bookings_updated_at
  before update on public.event_bookings
  for each row execute function public.set_updated_at();

create or replace function public.book_event_room(
  target_event_id uuid,
  target_room_id uuid,
  target_starts_at timestamptz,
  target_ends_at timestamptz,
  target_organizer_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  room_capacity integer;
  room_name_snapshot text;
  venue_name_snapshot text;
  guest_count integer;
  event_title_snapshot text;
  event_date_snapshot date;
  booking_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if target_ends_at <= target_starts_at then
    raise exception 'Booking end must be after its start';
  end if;
  if char_length(coalesce(target_organizer_note, '')) > 1000 then
    raise exception 'Booking note is too long';
  end if;
  if not public.is_event_organizer(target_event_id) then
    raise exception 'Only event organizers can request a booking';
  end if;

  select r.capacity, r.name, v.name
    into room_capacity, room_name_snapshot, venue_name_snapshot
  from public.venue_rooms r
  join public.venues v on v.id = r.venue_id
  where r.id = target_room_id and r.active and v.active;

  if room_capacity is null then
    raise exception 'Room is unavailable';
  end if;

  select e.title, e.guests_count, e.event_date
    into event_title_snapshot, guest_count, event_date_snapshot
  from public.events e
  where e.id = target_event_id;

  if event_title_snapshot is null then
    raise exception 'Event not found';
  end if;
  if guest_count is not null and guest_count > room_capacity then
    raise exception 'Room capacity is below the event guest count';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_room_id::text, 0)
  );

  if exists (
    select 1
    from public.event_bookings b
    where b.room_id = target_room_id
      and b.status in ('pending', 'approved')
      and b.starts_at < target_ends_at
      and b.ends_at > target_starts_at
  ) then
    raise exception 'Room is already requested or booked for that time';
  end if;

  insert into public.event_bookings (
    event_id, room_id, requested_by, event_title, guest_count, event_date,
    venue_name, room_name,
    starts_at, ends_at, organizer_note
  )
  values (
    target_event_id,
    target_room_id,
    current_user_id,
    event_title_snapshot,
    guest_count,
    event_date_snapshot,
    venue_name_snapshot,
    room_name_snapshot,
    target_starts_at,
    target_ends_at,
    coalesce(target_organizer_note, '')
  )
  returning id into booking_id;

  return booking_id;
end;
$$;

create or replace function public.review_event_booking(
  target_booking_id uuid,
  decision text,
  response_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room_id uuid;
  target_venue_id uuid;
  target_event_id uuid;
  current_status text;
  booked_venue_name text;
begin
  if not public.has_venue_admin_role() then
    raise exception 'Only venue admins can review booking requests';
  end if;
  if decision is null or decision not in ('approved', 'rejected') then
    raise exception 'Invalid booking decision';
  end if;
  if char_length(coalesce(response_note, '')) > 1000 then
    raise exception 'Response note is too long';
  end if;

  select b.room_id into target_room_id
  from public.event_bookings b
  where b.id = target_booking_id;
  if target_room_id is null then
    raise exception 'Booking not found';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_room_id::text, 0)
  );

  select v.id, b.status, b.event_id, b.venue_name
    into target_venue_id, current_status, target_event_id, booked_venue_name
  from public.event_bookings b
  join public.venue_rooms r on r.id = b.room_id
  join public.venues v on v.id = r.venue_id
  where b.id = target_booking_id
  for update of b;

  if not public.is_venue_owner(target_venue_id) then
    raise exception 'You cannot review requests for this venue';
  end if;
  if current_status <> 'pending' then
    raise exception 'Only pending requests can be reviewed';
  end if;

  if decision = 'approved' and exists (
    select 1
    from public.event_bookings b
    where b.room_id = target_room_id
      and b.id <> target_booking_id
      and b.status = 'approved'
      and b.starts_at < (
        select target.ends_at from public.event_bookings target
        where target.id = target_booking_id
      )
      and b.ends_at > (
        select target.starts_at from public.event_bookings target
        where target.id = target_booking_id
      )
  ) then
    raise exception 'Another booking is already approved for that time';
  end if;

  update public.event_bookings
  set status = decision, admin_note = coalesce(response_note, '')
  where id = target_booking_id;

  if decision = 'approved' then
    update public.events
    set venue_name = booked_venue_name
    where id = target_event_id;
  end if;
end;
$$;

create or replace function public.cancel_event_booking(target_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room_id uuid;
  target_event_id uuid;
  current_status text;
begin
  select b.room_id, b.event_id into target_room_id, target_event_id
  from public.event_bookings b
  where b.id = target_booking_id;
  if target_room_id is null then
    raise exception 'Booking not found';
  end if;

  if not public.is_event_organizer(target_event_id) then
    raise exception 'Only event organizers can cancel bookings';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_room_id::text, 0)
  );

  select b.status into current_status
  from public.event_bookings b
  where b.id = target_booking_id
  for update;

  if current_status not in ('pending', 'approved') then
    raise exception 'This booking cannot be cancelled';
  end if;

  update public.event_bookings
  set status = 'cancelled'
  where id = target_booking_id;
end;
$$;

revoke all on function public.book_event_room(uuid, uuid, timestamptz, timestamptz, text)
  from public, anon;
revoke all on function public.review_event_booking(uuid, text, text)
  from public, anon;
revoke all on function public.cancel_event_booking(uuid)
  from public, anon;
grant execute on function public.book_event_room(uuid, uuid, timestamptz, timestamptz, text)
  to authenticated;
grant execute on function public.review_event_booking(uuid, text, text)
  to authenticated;
grant execute on function public.cancel_event_booking(uuid)
  to authenticated;
