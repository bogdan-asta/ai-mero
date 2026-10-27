drop policy if exists "Event members can read events" on public.events;
drop policy if exists "Users can create their own events" on public.events;
drop policy if exists "Event organizers can update events" on public.events;
drop policy if exists "Event organizers can delete events" on public.events;
drop policy if exists "Owners can read their events" on public.events;
drop policy if exists "Owners can update their events" on public.events;
drop policy if exists "Owners can delete their events" on public.events;

create policy "Owners can read their events"
  on public.events for select
  to authenticated
  using (created_by = (select auth.uid()));

create policy "Users can create their own events"
  on public.events for insert
  to authenticated
  with check (created_by = (select auth.uid()));

create policy "Owners can update their events"
  on public.events for update
  to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

create policy "Owners can delete their events"
  on public.events for delete
  to authenticated
  using (created_by = (select auth.uid()));

drop policy if exists "Users can read their AI threads" on public.ai_threads;
drop policy if exists "Users can create their AI threads" on public.ai_threads;
drop policy if exists "Users can update their AI thread titles" on public.ai_threads;
drop policy if exists "Users can delete their AI threads" on public.ai_threads;

create policy "Users can read their AI threads"
  on public.ai_threads for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and (
      event_id is null
      or exists (
        select 1
        from public.events e
        where e.id = event_id
          and e.created_by = (select auth.uid())
      )
    )
  );

create policy "Users can create their AI threads"
  on public.ai_threads for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      event_id is null
      or exists (
        select 1
        from public.events e
        where e.id = event_id
          and e.created_by = (select auth.uid())
      )
    )
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

drop policy if exists "Users can read their AI messages" on public.ai_messages;
drop policy if exists "Users can append messages to their AI threads" on public.ai_messages;

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

drop policy if exists "Users can read their AI usage" on public.ai_usage;
drop policy if exists "Users can record their AI usage" on public.ai_usage;

create policy "Users can read their AI usage"
  on public.ai_usage for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can record their AI usage"
  on public.ai_usage for insert
  to authenticated
  with check (user_id = (select auth.uid()));

revoke all on table
  public.event_members,
  public.event_tasks,
  public.event_equipment,
  public.venues,
  public.venue_rooms,
  public.event_bookings,
  public.event_documents,
  public.event_invitations,
  public.notifications,
  public.event_ideas,
  public.event_idea_votes
from public, anon, authenticated;

revoke all on function public.has_venue_admin_role() from public, anon, authenticated;
revoke all on function public.is_venue_owner(uuid) from public, anon, authenticated;
revoke all on function public.book_event_room(uuid, uuid, timestamptz, timestamptz, text)
  from public, anon, authenticated;
revoke all on function public.review_event_booking(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.cancel_event_booking(uuid) from public, anon, authenticated;
revoke all on function public.get_event_team(uuid) from public, anon, authenticated;
revoke all on function public.get_event_ideas(uuid) from public, anon, authenticated;
revoke all on function public.invite_event_member(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.respond_event_invitation(uuid, text)
  from public, anon, authenticated;
revoke all on function public.cancel_event_invitation(uuid)
  from public, anon, authenticated;
revoke all on function public.is_event_member(uuid) from public, anon, authenticated;
revoke all on function public.is_event_organizer(uuid) from public, anon, authenticated;
