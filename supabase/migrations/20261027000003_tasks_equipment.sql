create table if not exists public.event_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  due_date date,
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_equipment (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  quantity integer not null default 1 check (quantity between 1 and 10000),
  notes text not null default '' check (char_length(notes) <= 1000),
  status text not null default 'needed'
    check (status in ('needed', 'acquired', 'rented', 'not_needed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_tasks_event_status_due_idx
  on public.event_tasks (event_id, status, due_date);
create index if not exists event_equipment_event_status_name_idx
  on public.event_equipment (event_id, status, name);

alter table public.event_tasks enable row level security;
alter table public.event_equipment enable row level security;

grant select, insert, update, delete on public.event_tasks to authenticated;
grant select, insert, update, delete on public.event_equipment to authenticated;

create policy "Event members can read tasks"
  on public.event_tasks for select
  to authenticated
  using (public.is_event_member(event_id));

create policy "Event organizers can create tasks"
  on public.event_tasks for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and public.is_event_organizer(event_id)
  );

create policy "Event organizers can update tasks"
  on public.event_tasks for update
  to authenticated
  using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));

create policy "Event organizers can delete tasks"
  on public.event_tasks for delete
  to authenticated
  using (public.is_event_organizer(event_id));

create policy "Event members can read equipment"
  on public.event_equipment for select
  to authenticated
  using (public.is_event_member(event_id));

create policy "Event organizers can create equipment"
  on public.event_equipment for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and public.is_event_organizer(event_id)
  );

create policy "Event organizers can update equipment"
  on public.event_equipment for update
  to authenticated
  using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));

create policy "Event organizers can delete equipment"
  on public.event_equipment for delete
  to authenticated
  using (public.is_event_organizer(event_id));

create trigger set_event_tasks_updated_at
  before update on public.event_tasks
  for each row execute function public.set_updated_at();

create trigger set_event_equipment_updated_at
  before update on public.event_equipment
  for each row execute function public.set_updated_at();
