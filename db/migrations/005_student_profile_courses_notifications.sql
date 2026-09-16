-- SkillForge UX pass: onboarding profile, course notes, student notifications.
alter table public.profiles add column if not exists age integer check (age is null or (age between 13 and 100));
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists birth_year integer check (birth_year is null or (birth_year between 1900 and 2100));
alter table public.profiles add column if not exists onboarding_complete boolean not null default false;

alter table public.programs add column if not exists notes text not null default '';

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null default '',
  type text not null default 'info' check (type in ('info','assessment','result','admin','system')),
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_user_read on public.notifications(user_id, read_at);

alter table public.notifications enable row level security;
drop policy if exists notifications_self_read on public.notifications;
create policy notifications_self_read on public.notifications for select using (user_id = auth.uid());
drop policy if exists notifications_self_update on public.notifications;
create policy notifications_self_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_admin_write on public.notifications;
create policy notifications_admin_write on public.notifications for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name) values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end; $$;
