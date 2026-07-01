create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  email text unique,
  plan text default 'free',
  credits integer default 100,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "Users can read own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;

create policy "Users can read own profile" on profiles for select to authenticated using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert to authenticated with check (auth.uid() = id);
