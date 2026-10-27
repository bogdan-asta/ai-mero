create table if not exists public.event_documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  document_type text not null
    check (document_type in ('event_order', 'invitation', 'venue_request', 'event_brief')),
  content text not null check (char_length(content) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_documents_event_updated_idx
  on public.event_documents (event_id, updated_at desc);

alter table public.event_documents enable row level security;

grant select, insert, update, delete on public.event_documents to authenticated;

create policy "Event members can read documents"
  on public.event_documents for select
  to authenticated
  using (public.is_event_member(event_id));

create policy "Event organizers can create documents"
  on public.event_documents for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and public.is_event_organizer(event_id)
  );

create policy "Event organizers can update documents"
  on public.event_documents for update
  to authenticated
  using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));

create policy "Event organizers can delete documents"
  on public.event_documents for delete
  to authenticated
  using (public.is_event_organizer(event_id));

create trigger set_event_documents_updated_at
  before update on public.event_documents
  for each row execute function public.set_updated_at();
