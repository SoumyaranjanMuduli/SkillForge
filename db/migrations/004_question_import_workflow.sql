-- 004_question_import_workflow.sql
-- Adds a real draft -> in_review -> published lifecycle for questions and a
-- table to track bulk import batches (Excel/CSV) for auditing and rollback.

-- Widen the lifecycle states a question can be in. Existing rows keep
-- whatever status they already have (draft/published/archived).
alter table public.questions drop constraint if exists questions_status_check;
alter table public.questions add constraint questions_status_check
  check (status in ('draft', 'in_review', 'published', 'archived'));

create table if not exists public.question_import_batches (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  uploaded_by uuid not null references auth.users(id),
  row_count integer not null default 0,
  valid_count integer not null default 0,
  error_count integer not null default 0,
  target_status text not null default 'draft' check (target_status in ('draft', 'in_review', 'published')),
  status text not null default 'pending' check (status in ('pending', 'committed', 'discarded')),
  question_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  committed_at timestamptz
);

create index if not exists idx_import_batches_uploaded_by on public.question_import_batches(uploaded_by);

alter table public.question_import_batches enable row level security;

drop policy if exists "admin_manage_import_batches" on public.question_import_batches;
create policy "admin_manage_import_batches" on public.question_import_batches
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
