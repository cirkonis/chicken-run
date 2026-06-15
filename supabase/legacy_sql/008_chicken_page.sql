-- ============================================================
-- Chicken Run - Chicken Page: Budget, Expenses, Arrivals
--
--   1) Add budget column to hunts
--   2) Create hunt_expenses table
--   3) Create hunt_arrivals table
--   4) RLS policies for both new tables
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. ADD budget TO hunts
-- ════════════════════════════════════════════════════════════

alter table public.hunts
  add column if not exists budget integer default null;


-- ════════════════════════════════════════════════════════════
-- 2. HUNT EXPENSES — individual spend entries by chickens
-- ════════════════════════════════════════════════════════════

create table if not exists public.hunt_expenses (
  id uuid primary key default gen_random_uuid(),
  hunt_id uuid not null references public.hunts(id) on delete cascade,
  amount integer not null,
  note text default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz default now()
);

create index if not exists idx_hunt_expenses_hunt_id on public.hunt_expenses(hunt_id);

-- Enable RLS
alter table public.hunt_expenses enable row level security;

-- SELECT: any hunt participant can read expenses
create policy "Hunt participants can read expenses"
  on public.hunt_expenses for select
  using (
    exists (
      select 1 from public.hunt_participants hp
      where hp.hunt_id = hunt_expenses.hunt_id
        and hp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.hunts h
      where h.id = hunt_expenses.hunt_id
        and h.creator_id = auth.uid()
    )
  );

-- INSERT: chickens or hunt creator can add expenses
create policy "Chickens and creator can add expenses"
  on public.hunt_expenses for insert
  with check (
    exists (
      select 1 from public.hunt_participants hp
      where hp.hunt_id = hunt_expenses.hunt_id
        and hp.user_id = auth.uid()
        and hp.role = 'chicken'
    )
    or exists (
      select 1 from public.hunts h
      where h.id = hunt_expenses.hunt_id
        and h.creator_id = auth.uid()
    )
  );

-- DELETE: only the expense author or hunt creator
create policy "Expense author or creator can delete"
  on public.hunt_expenses for delete
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.hunts h
      where h.id = hunt_expenses.hunt_id
        and h.creator_id = auth.uid()
    )
  );


-- ════════════════════════════════════════════════════════════
-- 3. HUNT ARRIVALS — which teams found the chickens, in order
-- ════════════════════════════════════════════════════════════

create table if not exists public.hunt_arrivals (
  id uuid primary key default gen_random_uuid(),
  hunt_id uuid not null references public.hunts(id) on delete cascade,
  team_id uuid not null references public.hunt_teams(id) on delete cascade,
  arrived_at timestamptz default now(),
  unique(hunt_id, team_id)
);

create index if not exists idx_hunt_arrivals_hunt_id on public.hunt_arrivals(hunt_id);

-- Enable RLS
alter table public.hunt_arrivals enable row level security;

-- SELECT: any hunt participant can read arrivals
create policy "Hunt participants can read arrivals"
  on public.hunt_arrivals for select
  using (
    exists (
      select 1 from public.hunt_participants hp
      where hp.hunt_id = hunt_arrivals.hunt_id
        and hp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.hunts h
      where h.id = hunt_arrivals.hunt_id
        and h.creator_id = auth.uid()
    )
  );

-- INSERT: chickens or hunt creator can record arrivals
create policy "Chickens and creator can add arrivals"
  on public.hunt_arrivals for insert
  with check (
    exists (
      select 1 from public.hunt_participants hp
      where hp.hunt_id = hunt_arrivals.hunt_id
        and hp.user_id = auth.uid()
        and hp.role = 'chicken'
    )
    or exists (
      select 1 from public.hunts h
      where h.id = hunt_arrivals.hunt_id
        and h.creator_id = auth.uid()
    )
  );

-- DELETE: chickens or hunt creator can undo arrivals
create policy "Chickens and creator can delete arrivals"
  on public.hunt_arrivals for delete
  using (
    exists (
      select 1 from public.hunt_participants hp
      where hp.hunt_id = hunt_arrivals.hunt_id
        and hp.user_id = auth.uid()
        and hp.role = 'chicken'
    )
    or exists (
      select 1 from public.hunts h
      where h.id = hunt_arrivals.hunt_id
        and h.creator_id = auth.uid()
    )
  );


-- ════════════════════════════════════════════════════════════
-- 4. Reload PostgREST schema cache
-- ════════════════════════════════════════════════════════════
notify pgrst, 'reload schema';
