-- ============================================================
-- Expense Kiosk — Migration v3
-- Adds: expense categories, admins table, better indexes
-- ============================================================

-- 1. EXPENSE CATEGORIES
create type expense_category as enum (
  'food_dining',
  'transportation',
  'office_supplies',
  'travel',
  'accommodation',
  'utilities',
  'entertainment',
  'software_subscriptions',
  'equipment',
  'healthcare',
  'education',
  'other'
);

-- Add category column to expenses
alter table expenses add column category expense_category default 'other';

-- 2. ADMINS TABLE (super admin / IT godmode)
create table admins (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  email text unique not null,
  created_at timestamptz not null default now()
);

create index idx_admins_auth on admins(auth_user_id);

-- 3. RLS for admins
alter table admins enable row level security;

-- Admins can read their own record
create policy "admins_read_own"
  on admins for select
  using (auth_user_id = auth.uid());

-- Admins can read ALL managers
create policy "admins_read_all_managers"
  on managers for select
  using (
    exists (select 1 from admins where auth_user_id = auth.uid())
  );

-- Admins can read ALL employees
create policy "admins_read_all_employees"
  on employees for select
  using (
    exists (select 1 from admins where auth_user_id = auth.uid())
  );

-- Admins can read ALL expenses
create policy "admins_read_all_expenses"
  on expenses for select
  using (
    exists (select 1 from admins where auth_user_id = auth.uid())
  );

-- Admins can update ALL expenses (approve/reject anyone)
create policy "admins_update_all_expenses"
  on expenses for update
  using (
    exists (select 1 from admins where auth_user_id = auth.uid())
  )
  with check (
    exists (select 1 from admins where auth_user_id = auth.uid())
  );

-- Admins can insert employees and managers
create policy "admins_insert_managers"
  on managers for insert
  with check (
    exists (select 1 from admins where auth_user_id = auth.uid())
  );

create policy "admins_insert_employees"
  on employees for insert
  with check (
    exists (select 1 from admins where auth_user_id = auth.uid())
  );

-- Admins can update managers and employees
create policy "admins_update_managers"
  on managers for update
  using (
    exists (select 1 from admins where auth_user_id = auth.uid())
  );

create policy "admins_update_employees"
  on employees for update
  using (
    exists (select 1 from admins where auth_user_id = auth.uid())
  );

-- 4. BETTER INDEXES for filtering
create index idx_expenses_category on expenses(category);
create index idx_expenses_merchant on expenses using gin (to_tsvector('simple', coalesce(merchant, '')));
create index idx_expenses_date_range on expenses(expense_date);
create index idx_expenses_total on expenses(total_price);

-- 5. SEED: create an admin user (run after creating auth user)
-- insert into admins (auth_user_id, name, email) values
--   ('paste-admin-auth-uuid', 'Super Admin', 'admin@company.com');
