# Siteo V5 Multi-pages SaaS

Version avec plusieurs pages :

- `index.html` : accueil
- `generate.html` : générateur
- `dashboard.html` : profil utilisateur
- `shop.html` : boutique crédits
- `pricing.html` : abonnement Pro
- `help.html` : aide
- `privacy.html` : confidentialité

## Fonctionnalités

- Compte utilisateur Supabase
- Inscription séparée
- Connexion séparée
- Mot de passe oublié
- Vérification email
- 100 crédits pour les nouveaux utilisateurs
- Boutique crédits :
  - 100 crédits : 1,99€
  - 1000 crédits : 5,99€
- Pro avec 7 jours gratuits via Stripe
- Annulation via portail client Stripe
- Génération IA OpenRouter
- Téléchargement ZIP

## SQL Supabase recommandé

```sql
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  email text unique,
  plan text default 'free',
  credits integer default 100,
  created_at timestamptz default now()
);

alter table profiles
alter column credits set default 100;

alter table profiles
alter column plan set default 'free';

update profiles
set credits = 100
where credits = 0;
```

## Stripe

Dans `public/script.js`, remplace :

```txt
TON_LIEN_STRIPE_100_CREDITS_ICI
TON_LIEN_STRIPE_1000_CREDITS_ICI
TON_LIEN_PORTAIL_CLIENT_STRIPE_ICI
```

Par tes liens Stripe.

Pour l'ajout automatique de crédits après paiement, il faudra ensuite ajouter un webhook Stripe + Supabase.
