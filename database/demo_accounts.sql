do $$
begin
  if not exists (
    select 1 from auth.users
    where lower(email) = 'kaokutoro@gmail.com'
      and email_confirmed_at is not null
  ) then
    raise exception 'Create and confirm kaokutoro@gmail.com in Supabase Authentication → Users first.';
  end if;

  if not exists (
    select 1 from auth.users
    where lower(email) = 'mayhambug@gmail.com'
      and email_confirmed_at is not null
  ) then
    raise exception 'Create and confirm mayhambug@gmail.com in Supabase Authentication → Users first.';
  end if;
end;
$$;

insert into public.employees (
  employee_number, first_name, last_name, email, department, job_title
)
values
  ('KAO-001', 'Kao', 'User', 'kaokutoro@gmail.com', 'Operations', 'Manager'),
  ('BUYG-001', 'Buyg', 'User', 'mayhambug@gmail.com', 'Operations', 'Employee')
on conflict (email) do nothing;

insert into public.user_profiles (user_id, employee_id, role, is_active)
select
  auth_user.id,
  employee.id,
  case lower(auth_user.email)
    when 'kaokutoro@gmail.com' then 'management'::public.app_role
    else 'employee'::public.app_role
  end,
  true
from auth.users as auth_user
join public.employees as employee
  on lower(employee.email) = lower(auth_user.email)
where lower(auth_user.email) in ('kaokutoro@gmail.com', 'mayhambug@gmail.com')
on conflict (user_id) do update
set employee_id = excluded.employee_id,
    role = excluded.role,
    is_active = true;