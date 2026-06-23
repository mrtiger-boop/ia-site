# Siteo Ultra Pro

Version multi-pages premium de Siteo.

Pages : index, generate, dashboard, pricing, help, privacy.

Supabase URL : https://azgahpygwlrrmozbjrqo.supabase.co

Table nécessaire :
```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  email text unique,
  plan text default 'free',
  credits integer default 100,
  created_at timestamptz default now()
);
```

Render : npm install / npm start.
