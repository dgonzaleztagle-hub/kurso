alter table public.payments add column if not exists student_name text;
alter table public.payments add column if not exists month_period text;

notify pgrst, 'reload schema';
