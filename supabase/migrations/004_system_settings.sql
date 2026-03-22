-- ============================================================
-- Expense Kiosk — Migration v4
-- Adds: system_settings table for admin-managed configuration
-- ============================================================

create table system_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references admins(id) on delete set null
);

alter table system_settings enable row level security;

-- Everyone can read settings
create policy "settings_read_all"
  on system_settings for select
  using (true);

-- Only admins can update settings
create policy "settings_update_admins"
  on system_settings for update
  using (exists (select 1 from admins where auth_user_id = auth.uid()));

create policy "settings_insert_admins"
  on system_settings for insert
  with check (exists (select 1 from admins where auth_user_id = auth.uid()));

-- Seed default: use qwen (with gemini fallback)
insert into system_settings (key, value) values
  ('ocr_model', 'qwen');
