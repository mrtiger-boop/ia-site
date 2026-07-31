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

-- Sécurité : la policy "update" ci-dessus autorise à modifier N'IMPORTE QUELLE colonne de sa
-- propre ligne, y compris credits/plan. Sans cette restriction, n'importe quel utilisateur
-- connecté peut s'auto-attribuer du Pro et des crédits illimités depuis la console du
-- navigateur. On restreint donc les colonnes réellement modifiables par le rôle "authenticated"
-- (le serveur, lui, utilise la clé service_role qui n'est pas concernée par ce GRANT/REVOKE).
revoke update on profiles from authenticated;
grant update (username) on profiles to authenticated;

-- Idempotence des webhooks Stripe : évite de créditer deux fois si Stripe renvoie le même
-- événement plusieurs fois (retries), ce qui arrive régulièrement.
create table if not exists processed_stripe_events (
  event_id text primary key,
  created_at timestamptz default now()
);

alter table processed_stripe_events enable row level security;
-- Aucune policy créée volontairement : seule la clé service_role (qui bypass RLS) doit pouvoir
-- y écrire/lire, jamais le navigateur.
