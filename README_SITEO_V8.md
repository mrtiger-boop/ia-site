# Siteo V8 Complet

Version complète du projet Siteo avec :

- Accueil premium complet
- Bouton feuilles qui tombent ON/OFF
- Générateur avec aperçu iframe
- Mode améliorer un site existant
- Modèles prêts à cliquer
- Dashboard profil
- Boutique crédits + Pro 4,99€
- Galerie communauté avec image, likes et commentaires
- Stripe Checkout
- Webhook Stripe
- Portail client Stripe
- SEO : sitemap, robots, manifest
- Supabase SQL inclus

## Installation locale

```bash
npm install
npm start
```

Puis ouvrir :

```txt
http://localhost:3000
```

## Fichier .env

Créer un fichier `.env` à la racine avec les variables de `.env.example`.

Ne jamais envoyer `.env` sur GitHub.

## Render

Ajouter les variables d'environnement suivantes dans Render :

- OPENROUTER_API_KEY
- PUBLIC_SITE_URL=https://siteo.studio
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- PRICE_PRO
- PRICE_100
- PRICE_1000

## Stripe Webhook

Créer un endpoint Stripe :

```txt
https://siteo.studio/api/stripe-webhook
```

Événements :

- checkout.session.completed
- customer.subscription.updated
- customer.subscription.deleted

## Supabase

Exécuter le fichier :

```txt
supabase.sql
```

dans Supabase SQL Editor.

## Important

La galerie est actuellement en localStorage côté navigateur pour une V1 visuelle.
Pour une vraie galerie publique entre tous les utilisateurs, il faudra ajouter des tables Supabase :
community_sites, community_likes, community_comments.
