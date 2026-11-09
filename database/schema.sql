create extension if not exists pgcrypto;

create type public.app_role as enum ('management','employee');
create type public.employee_status as enum ('active','inactive','terminated');
create type public.asset_status as enum ('available','assigned','maintenance','retired','lost');
create type public.record_status as enum ('active','returned','cancelled');
create type public.vehicle_status as enum ('available','assigned','maintenance','retired');
create type public.stock_movement as enum ('purchase','issue','return','adjustment_in','adjustment_out');
create type public.fuel_review_status as enum ('submitted','approved','rejected');

create table public.employees (
 id uuid primary key default gen_random_uuid(),
 employee_number text unique not null,
 first_name text not null, last_name text not null,
 email text unique, phone text, department text, job_title text,
 employment_status public.employee_status not null default 'active',
 start_date date, end_date date,
 created_at timestamptz not null default now(),
 check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.user_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 employee_id uuid unique references public.employees(id),
 role public.app_role not null default 'employee',
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);

create table public.assets (
 id uuid primary key default gen_random_uuid(),
 asset_code text unique not null, name text not null, category text not null,
 serial_number text unique, description text, brand text, model text,
 purchase_date date, purchase_cost numeric(14,2) check (purchase_cost is null or purchase_cost >= 0),
 condition text not null default 'good',
 status public.asset_status not null default 'available',
 created_at timestamptz not null default now()
);

create table public.asset_assignments (
 id uuid primary key default gen_random_uuid(),
 asset_id uuid not null references public.assets(id),
 employee_id uuid not null references public.employees(id),
 assigned_by uuid references auth.users(id),
 assigned_at timestamptz not null default now(),
 employee_acknowledged_at timestamptz,
 returned_at timestamptz, returned_to uuid references auth.users(id),
 employee_return_acknowledged_at timestamptz,
 condition_out text, condition_in text, notes text,
 status public.record_status not null default 'active'
);
create unique index one_active_employee_per_asset
 on public.asset_assignments(asset_id) where status='active';

create table public.inventory_items (
 id uuid primary key default gen_random_uuid(),
 item_code text unique not null, name text not null, category text not null,
 unit text not null default 'each',
 reorder_level numeric(14,3) not null default 0 check (reorder_level >= 0),
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);

create table public.inventory_transactions (
 id uuid primary key default gen_random_uuid(),
 item_id uuid not null references public.inventory_items(id),
 movement_type public.stock_movement not null,
 quantity numeric(14,3) not null check (quantity > 0),
 unit_cost numeric(14,2) check (unit_cost is null or unit_cost >= 0),
 employee_id uuid references public.employees(id),
 reference text, reason text, recorded_by uuid references auth.users(id),
 occurred_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create index inventory_transactions_item_idx on public.inventory_transactions(item_id,occurred_at desc);

create view public.inventory_stock as
select i.id item_id,i.item_code,i.name,i.category,i.unit,i.reorder_level,
 coalesce(sum(case
  when t.movement_type in ('purchase','return','adjustment_in') then t.quantity
  when t.movement_type in ('issue','adjustment_out') then -t.quantity
  else 0 end),0)::numeric(14,3) quantity_on_hand
from public.inventory_items i
left join public.inventory_transactions t on t.item_id=i.id
group by i.id;

create table public.vehicles (
 id uuid primary key default gen_random_uuid(),
 registration_number text unique not null, make text not null, model text not null,
 year integer, vin text unique, fuel_type text not null,
 tank_capacity_litres numeric(10,2) check (tank_capacity_litres is null or tank_capacity_litres > 0),
 status public.vehicle_status not null default 'available',
 current_odometer_km numeric(12,1) not null default 0 check (current_odometer_km >= 0),
 created_at timestamptz not null default now()
);

create table public.vehicle_assignments (
 id uuid primary key default gen_random_uuid(),
 vehicle_id uuid not null references public.vehicles(id),
 employee_id uuid not null references public.employees(id),
 assignment_type text not null check (assignment_type in ('permanent','temporary')),
 purpose text, assigned_by uuid references auth.users(id),
 checked_out_at timestamptz not null default now(), expected_return_at timestamptz,
 checked_in_at timestamptz,
 odometer_out_km numeric(12,1) not null check (odometer_out_km >= 0),
 odometer_in_km numeric(12,1) check (odometer_in_km is null or odometer_in_km >= odometer_out_km),
 fuel_gauge_out_percent integer check (fuel_gauge_out_percent between 0 and 100),
 fuel_gauge_in_percent integer check (fuel_gauge_in_percent between 0 and 100),
 condition_out text, condition_in text, notes text,
 status public.record_status not null default 'active'
);
create unique index one_active_driver_per_vehicle
 on public.vehicle_assignments(vehicle_id) where status='active';

create table public.fuel_allocations (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.employees(id),
 vehicle_id uuid references public.vehicles(id),
 allocated_amount numeric(14,2) not null check (allocated_amount > 0),
 currency char(3) not null default 'BWP' check (currency='BWP'),
 allocation_period_start date not null, allocation_period_end date,
 reference text, notes text, allocated_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 check (allocation_period_end is null or allocation_period_end >= allocation_period_start)
);

create table public.fuel_transactions (
 id uuid primary key default gen_random_uuid(),
 vehicle_id uuid not null references public.vehicles(id),
 driver_employee_id uuid not null references public.employees(id),
 fuel_allocation_id uuid references public.fuel_allocations(id),
 station_name text not null, location_text text not null,
 purchased_at timestamptz not null,
 litres numeric(10,3) not null check (litres > 0),
 amount numeric(14,2) not null check (amount > 0),
 currency char(3) not null default 'BWP' check (currency='BWP'),
 odometer_km numeric(12,1) not null check (odometer_km >= 0),
 receipt_storage_path text,
 status public.fuel_review_status not null default 'submitted',
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
 rejection_reason text, notes text,
 created_at timestamptz not null default now(),
 check (status <> 'rejected' or rejection_reason is not null)
);
create index fuel_vehicle_date_idx on public.fuel_transactions(vehicle_id,purchased_at desc);
create index fuel_driver_date_idx on public.fuel_transactions(driver_employee_id,purchased_at desc);

create table public.vehicle_readings (
 id uuid primary key default gen_random_uuid(),
 vehicle_id uuid not null references public.vehicles(id),
 employee_id uuid not null references public.employees(id),
 recorded_at timestamptz not null default now(),
 odometer_km numeric(12,1) not null check (odometer_km >= 0),
 fuel_gauge_percent integer check (fuel_gauge_percent between 0 and 100),
 notes text
);

create table public.audit_logs (
 id bigint generated always as identity primary key,
 actor_user_id uuid references auth.users(id),
 action text not null, entity_type text not null,
 entity_id uuid, details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

-- RLS policies protect direct access using Supabase user JWTs.
-- Flask uses a privileged DB connection, so every Flask route must also authorize access.
create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path=public as $$
 select role from public.user_profiles
 where user_id=auth.uid() and is_active=true limit 1;
$$;
create or replace function public.current_employee_id()
returns uuid language sql stable security definer set search_path=public as $$
 select employee_id from public.user_profiles
 where user_id=auth.uid() and is_active=true limit 1;
$$;

alter table public.employees enable row level security;
alter table public.user_profiles enable row level security;
alter table public.assets enable row level security;
alter table public.asset_assignments enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_assignments enable row level security;
alter table public.fuel_allocations enable row level security;
alter table public.fuel_transactions enable row level security;
alter table public.vehicle_readings enable row level security;
alter table public.audit_logs enable row level security;

create policy profile_self_or_management on public.user_profiles for select to authenticated
 using (user_id=auth.uid() or public.current_app_role()='management');
create policy employee_self_or_management on public.employees for select to authenticated
 using (id=public.current_employee_id() or public.current_app_role()='management');
create policy assets_assigned_or_management on public.assets for select to authenticated
 using (public.current_app_role()='management' or exists(
  select 1 from public.asset_assignments a where a.asset_id=assets.id
  and a.employee_id=public.current_employee_id() and a.status='active'));
create policy asset_assignments_self_or_management on public.asset_assignments for select to authenticated
 using (employee_id=public.current_employee_id() or public.current_app_role()='management');
create policy inventory_items_read on public.inventory_items for select to authenticated using (true);
create policy inventory_transactions_self_or_management on public.inventory_transactions for select to authenticated
 using (employee_id=public.current_employee_id() or public.current_app_role()='management');
create policy vehicles_assigned_or_management on public.vehicles for select to authenticated
 using (public.current_app_role()='management' or exists(
  select 1 from public.vehicle_assignments a where a.vehicle_id=vehicles.id
  and a.employee_id=public.current_employee_id() and a.status='active'));
create policy vehicle_assignments_self_or_management on public.vehicle_assignments for select to authenticated
 using (employee_id=public.current_employee_id() or public.current_app_role()='management');
create policy fuel_allocations_self_or_management on public.fuel_allocations for select to authenticated
 using (employee_id=public.current_employee_id() or public.current_app_role()='management');
create policy fuel_transactions_self_or_management on public.fuel_transactions for select to authenticated
 using (driver_employee_id=public.current_employee_id() or public.current_app_role()='management');
create policy vehicle_readings_self_or_management on public.vehicle_readings for select to authenticated
 using (employee_id=public.current_employee_id() or public.current_app_role()='management');
create policy audit_logs_management_read on public.audit_logs for select to authenticated
 using (public.current_app_role()='management');

-- Intentionally no public INSERT/UPDATE/DELETE policies. Mutations go through Flask.
