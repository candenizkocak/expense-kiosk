-- ============================================================
-- Expense Kiosk System — Clean Schema (v2)
-- No self-referencing tables.
-- ============================================================

-- 0. DROP EVERYTHING FROM v1 (safe to run even if nothing exists)
drop trigger if exists trg_expense_status_change on expenses;
drop function if exists set_payment_date_on_approval();
drop function if exists calculate_payment_date();
drop table if exists expenses cascade;
drop table if exists employees cascade;
drop table if exists managers cascade;
drop type if exists expense_status cascade;

-- 1. ENUMS
create type expense_status as enum ('pending', 'approved', 'rejected');

-- 2. MANAGERS TABLE
create table managers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  rfid_uid text unique not null,
  name text not null,
  email text unique not null,
  created_at timestamptz not null default now()
);

create index idx_managers_rfid on managers(rfid_uid);
create index idx_managers_auth on managers(auth_user_id);

-- 3. EMPLOYEES TABLE
-- manager_id points to a separate managers table — no self-reference.
create table employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  rfid_uid text unique not null,
  name text not null,
  email text unique not null,
  manager_id uuid not null references managers(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index idx_employees_rfid on employees(rfid_uid);
create index idx_employees_auth on employees(auth_user_id);
create index idx_employees_manager on employees(manager_id);

-- 4. EXPENSES TABLE
create table expenses (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  merchant text,
  expense_date date,
  net_price numeric(12,2),
  tax_rate numeric(5,4),         -- e.g. 0.2000 for 20%
  tax_amount numeric(12,2),
  total_price numeric(12,2),
  currency text not null default 'TRY',
  receipt_image_path text,       -- Storage path: receipts/{employee_id}/{expense_id}.jpg
  raw_ocr_json jsonb,
  status expense_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references managers(id) on delete set null,
  rejection_reason text,
  payment_date date,             -- Auto-set to last day of approval month
  notes text
);

create index idx_expenses_employee on expenses(employee_id);
create index idx_expenses_status on expenses(status);
create index idx_expenses_submitted on expenses(submitted_at desc);

-- 5. ROW-LEVEL SECURITY

alter table managers enable row level security;
alter table employees enable row level security;
alter table expenses enable row level security;

-- Managers: can read their own record
create policy "managers_read_own"
  on managers for select
  using (auth_user_id = auth.uid());

-- Employees: can read their own record
create policy "employees_read_own"
  on employees for select
  using (auth_user_id = auth.uid());

-- Employees: managers can read their direct reports
create policy "managers_read_their_employees"
  on employees for select
  using (
    manager_id in (
      select id from managers where auth_user_id = auth.uid()
    )
  );

-- Expenses: employees can read their own expenses
create policy "expenses_read_own"
  on expenses for select
  using (
    employee_id in (
      select id from employees where auth_user_id = auth.uid()
    )
  );

-- Expenses: managers can read their direct reports' expenses
create policy "expenses_read_as_manager"
  on expenses for select
  using (
    employee_id in (
      select e.id from employees e
      where e.manager_id in (
        select m.id from managers m where m.auth_user_id = auth.uid()
      )
    )
  );

-- Expenses: managers can update status on their reports' expenses
create policy "expenses_update_as_manager"
  on expenses for update
  using (
    employee_id in (
      select e.id from employees e
      where e.manager_id in (
        select m.id from managers m where m.auth_user_id = auth.uid()
      )
    )
  )
  with check (
    employee_id in (
      select e.id from employees e
      where e.manager_id in (
        select m.id from managers m where m.auth_user_id = auth.uid()
      )
    )
  );

-- 6. HELPER: calculate payment date (last day of current month)
create or replace function calculate_payment_date()
returns date as $$
begin
  return (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date;
end;
$$ language plpgsql;

-- 7. TRIGGER: auto-set payment_date on approval, clear on rejection
create or replace function set_payment_date_on_approval()
returns trigger as $$
begin
  if NEW.status = 'approved' and (OLD.status is null or OLD.status != 'approved') then
    NEW.payment_date := calculate_payment_date();
    NEW.reviewed_at := now();
  end if;
  if NEW.status = 'rejected' and (OLD.status is null or OLD.status != 'rejected') then
    NEW.reviewed_at := now();
    NEW.payment_date := null;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_expense_status_change
  before update on expenses
  for each row
  when (OLD.status is distinct from NEW.status)
  execute function set_payment_date_on_approval();

-- 8. STORAGE BUCKET (run via Supabase dashboard or uncomment below)
-- insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false);

-- 9. SEED DATA (for development — adjust auth_user_ids after creating users in Supabase Auth)
--
-- insert into managers (rfid_uid, name, email) values
--   ('RFID_MGR_001', 'Alice Manager', 'alice@company.com');
--
-- insert into employees (rfid_uid, name, email, manager_id) values
--   ('RFID_EMP_001', 'Bob Employee', 'bob@company.com',
--     (select id from managers where email = 'alice@company.com')),
--   ('RFID_EMP_002', 'Carol Employee', 'carol@company.com',
--     (select id from managers where email = 'alice@company.com'));
