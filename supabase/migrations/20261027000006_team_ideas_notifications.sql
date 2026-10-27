create table if not exists public.event_invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  invitee_id uuid not null references auth.users (id) on delete cascade,
  invited_by uuid not null references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'participant'
    check (role in ('organizer', 'participant')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create unique index if not exists event_invitations_pending_unique_idx
  on public.event_invitations (event_id, invitee_id)
  where status = 'pending';
create index if not exists event_invitations_invitee_created_idx
  on public.event_invitations (invitee_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  related_id uuid,
  notification_type text not null
    check (notification_type in (
      'event_invitation',
      'invitation_response',
      'booking_request',
      'booking_update'
    )),
  title text not null check (char_length(title) between 2 and 160),
  body text not null default '' check (char_length(body) <= 1000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.event_ideas (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_idea_votes (
  event_idea_id uuid not null references public.event_ideas (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_idea_id, user_id)
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists event_ideas_event_created_idx
  on public.event_ideas (event_id, created_at desc);
create index if not exists event_idea_votes_event_idx
  on public.event_idea_votes (event_id, event_idea_id);

alter table public.event_invitations enable row level security;
alter table public.notifications enable row level security;
alter table public.event_ideas enable row level security;
alter table public.event_idea_votes enable row level security;

grant select on public.event_invitations to authenticated;
grant select, update (read_at) on public.notifications to authenticated;
grant select, insert, delete on public.event_ideas to authenticated;
grant update (title, description) on public.event_ideas to authenticated;
grant insert, delete on public.event_idea_votes to authenticated;

create policy "Invited users and event organizers can read invitations"
  on public.event_invitations for select
  to authenticated
  using (
    invitee_id = (select auth.uid())
    or public.is_event_organizer(event_id)
  );

create policy "Users can read their notifications"
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can mark their notifications as read"
  on public.notifications for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Event members can read ideas"
  on public.event_ideas for select
  to authenticated
  using (public.is_event_member(event_id));

create policy "Event members can propose ideas"
  on public.event_ideas for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and public.is_event_member(event_id)
  );

create policy "Authors and organizers can update ideas"
  on public.event_ideas for update
  to authenticated
  using (
    (
      created_by = (select auth.uid())
      and public.is_event_member(event_id)
    )
    or public.is_event_organizer(event_id)
  )
  with check (
    (
      created_by = (select auth.uid())
      and public.is_event_member(event_id)
    )
    or public.is_event_organizer(event_id)
  );

create policy "Authors and organizers can delete ideas"
  on public.event_ideas for delete
  to authenticated
  using (
    (
      created_by = (select auth.uid())
      and public.is_event_member(event_id)
    )
    or public.is_event_organizer(event_id)
  );

create policy "Event members can vote once on ideas"
  on public.event_idea_votes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_event_member(event_id)
    and exists (
      select 1
      from public.event_ideas i
      where i.id = event_idea_votes.event_idea_id
        and i.event_id = event_idea_votes.event_id
    )
  );

create policy "Users can remove their own idea votes"
  on public.event_idea_votes for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and public.is_event_member(event_id)
  );

create trigger set_event_ideas_updated_at
  before update on public.event_ideas
  for each row execute function public.set_updated_at();

create or replace function public.get_event_team(target_event_id uuid)
returns table (
  user_id uuid,
  full_name text,
  role text,
  is_owner boolean,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_event_member(target_event_id) then
    raise exception 'Event membership required';
  end if;

  return query
  select e.created_by, coalesce(nullif(p.full_name, ''), 'Организатор'),
    'organizer'::text, true, e.created_at
  from public.events e
  left join public.profiles p on p.id = e.created_by
  where e.id = target_event_id
  union all
  select m.user_id, coalesce(nullif(p.full_name, ''), 'Участник'),
    m.role, false, m.joined_at
  from public.event_members m
  left join public.profiles p on p.id = m.user_id
  where m.event_id = target_event_id
    and m.user_id <> (
      select e.created_by from public.events e where e.id = target_event_id
    )
  order by 4 desc, 2;
end;
$$;

create or replace function public.get_event_ideas(target_event_id uuid)
returns table (
  id uuid,
  event_id uuid,
  created_by uuid,
  title text,
  description text,
  created_at timestamptz,
  vote_count bigint,
  voted_by_me boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_event_member(target_event_id) then
    raise exception 'Event membership required';
  end if;

  return query
  select i.id, i.event_id, i.created_by, i.title, i.description, i.created_at,
    count(v.event_idea_id),
    coalesce(bool_or(v.user_id = (select auth.uid())), false)
  from public.event_ideas i
  left join public.event_idea_votes v on v.event_idea_id = i.id
  where i.event_id = target_event_id
  group by i.id
  order by count(v.event_idea_id) desc, i.created_at desc;
end;
$$;

create or replace function public.invite_event_member(
  target_event_id uuid,
  target_email text,
  target_role text default 'participant'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_email text := lower(pg_catalog.btrim(coalesce(target_email, '')));
  invitee_id uuid;
  event_title text;
  invitation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_event_organizer(target_event_id) then
    raise exception 'Only event organizers can invite members';
  end if;
  if target_role is null or target_role not in ('organizer', 'participant') then
    raise exception 'Invalid member role';
  end if;
  if pg_catalog.char_length(normalized_email) > 320
    or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  then
    raise exception 'Enter a valid email address';
  end if;

  select u.id into invitee_id
  from auth.users u
  where pg_catalog.lower(u.email) = normalized_email;
  if invitee_id is null then
    raise exception 'This email is not registered in EventAI yet';
  end if;
  if invitee_id = current_user_id then
    raise exception 'You are already the event organizer';
  end if;
  if exists (
    select 1 from public.events e
    where e.id = target_event_id and e.created_by = invitee_id
  ) or exists (
    select 1 from public.event_members m
    where m.event_id = target_event_id and m.user_id = invitee_id
  ) then
    raise exception 'This user is already a member of the event';
  end if;
  if exists (
    select 1 from public.event_invitations i
    where i.event_id = target_event_id
      and i.invitee_id = invitee_id
      and i.status = 'pending'
  ) then
    raise exception 'An invitation is already pending for this user';
  end if;

  select e.title into event_title
  from public.events e where e.id = target_event_id;

  insert into public.event_invitations (
    event_id, invitee_id, invited_by, email, role
  )
  values (
    target_event_id, invitee_id, current_user_id, normalized_email, target_role
  )
  returning id into invitation_id;

  insert into public.notifications (
    user_id, event_id, related_id, notification_type, title, body
  )
  values (
    invitee_id,
    target_event_id,
    invitation_id,
    'event_invitation',
    'Приглашение в команду мероприятия',
    'Вас пригласили в команду «' || event_title || '».'
  );

  return invitation_id;
end;
$$;

create or replace function public.respond_event_invitation(
  target_invitation_id uuid,
  decision text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  invitation public.event_invitations%rowtype;
  event_title text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if decision is null or decision not in ('accepted', 'declined') then
    raise exception 'Invalid invitation response';
  end if;

  select i.* into invitation
  from public.event_invitations i
  where i.id = target_invitation_id
    and i.invitee_id = current_user_id
    and i.status = 'pending'
  for update;
  if invitation.id is null then
    raise exception 'Invitation not found or already answered';
  end if;

  select e.title into event_title
  from public.events e where e.id = invitation.event_id;

  if decision = 'accepted' then
    insert into public.event_members (
      event_id, user_id, role, invited_by
    )
    values (
      invitation.event_id,
      current_user_id,
      invitation.role,
      invitation.invited_by
    )
    on conflict (event_id, user_id) do nothing;
  end if;

  update public.event_invitations
  set status = decision, responded_at = pg_catalog.now()
  where id = invitation.id;

  update public.notifications
  set read_at = pg_catalog.now()
  where user_id = current_user_id
    and related_id = invitation.id
    and notification_type = 'event_invitation';

  insert into public.notifications (
    user_id, event_id, related_id, notification_type, title, body
  )
  values (
    invitation.invited_by,
    invitation.event_id,
    invitation.id,
    'invitation_response',
    case when decision = 'accepted' then 'Приглашение принято' else 'Приглашение отклонено' end,
    coalesce(nullif((select p.full_name from public.profiles p where p.id = current_user_id), ''),
      'Участник') ||
      case when decision = 'accepted'
        then ' присоединился к мероприятию «' || event_title || '».'
        else ' отклонил приглашение в «' || event_title || '».'
      end
  );

  return invitation.event_id;
end;
$$;

create or replace function public.cancel_event_invitation(target_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event_id uuid;
begin
  select i.event_id into target_event_id
  from public.event_invitations i
  where i.id = target_invitation_id
    and i.status = 'pending'
  for update;
  if target_event_id is null then
    raise exception 'Pending invitation not found';
  end if;
  if not public.is_event_organizer(target_event_id) then
    raise exception 'Only event organizers can cancel invitations';
  end if;

  update public.event_invitations
  set status = 'cancelled', responded_at = pg_catalog.now()
  where id = target_invitation_id;

  update public.notifications
  set read_at = pg_catalog.now()
  where related_id = target_invitation_id
    and notification_type = 'event_invitation';
end;
$$;

create or replace function public.notify_venue_booking_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  venue_admin_id uuid;
begin
  select v.created_by into venue_admin_id
  from public.venue_rooms r
  join public.venues v on v.id = r.venue_id
  where r.id = new.room_id;

  if venue_admin_id is not null and venue_admin_id <> new.requested_by then
    insert into public.notifications (
      user_id, event_id, related_id, notification_type, title, body
    )
    values (
      venue_admin_id,
      new.event_id,
      new.id,
      'booking_request',
      'Новый запрос на бронирование',
      'Запрос на зал «' || new.room_name || '» для мероприятия «' || new.event_title || '».'
    );
  end if;

  return new;
end;
$$;

create or replace function public.notify_venue_booking_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
    and new.status in ('approved', 'rejected')
  then
    insert into public.notifications (
      user_id, event_id, related_id, notification_type, title, body
    )
    values (
      new.requested_by,
      new.event_id,
      new.id,
      'booking_update',
      case when new.status = 'approved'
        then 'Бронирование подтверждено'
        else 'Запрос на бронирование отклонён'
      end,
      case when new.admin_note = ''
        then 'Площадка «' || new.venue_name || '» — ' || new.room_name || '.'
        else new.admin_note
      end
    );
  end if;
  return new;
end;
$$;

revoke all on function public.get_event_team(uuid) from public, anon;
revoke all on function public.get_event_ideas(uuid) from public, anon;
revoke all on function public.invite_event_member(uuid, text, text) from public, anon;
revoke all on function public.respond_event_invitation(uuid, text) from public, anon;
revoke all on function public.cancel_event_invitation(uuid) from public, anon;
revoke all on function public.notify_venue_booking_request() from public, anon, authenticated;
revoke all on function public.notify_venue_booking_update() from public, anon, authenticated;
grant execute on function public.get_event_team(uuid) to authenticated;
grant execute on function public.get_event_ideas(uuid) to authenticated;
grant execute on function public.invite_event_member(uuid, text, text) to authenticated;
grant execute on function public.respond_event_invitation(uuid, text) to authenticated;
grant execute on function public.cancel_event_invitation(uuid) to authenticated;

create trigger notify_venue_booking_request_after_insert
  after insert on public.event_bookings
  for each row execute function public.notify_venue_booking_request();

create trigger notify_venue_booking_update_after_update
  after update of status on public.event_bookings
  for each row execute function public.notify_venue_booking_update();
