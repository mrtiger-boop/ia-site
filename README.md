# Siteo AI

Siteo est un générateur de sites web avec IA.

## Fonctionnalités

- Inscription / connexion locale obligatoire pour tester
- 100 crédits gratuits
- 10 crédits par génération
- Mode Pro avec crédits illimités
- Génération HTML/CSS/JS via OpenRouter
- Téléchargement automatique en ZIP
- Explications intégrées : prompt, extraction ZIP, mise en ligne, confidentialité
- Historique local
- Compatible Render

## Installation locale

```bash
npm install
npm start
```

Puis ouvrir :

```txt
http://localhost:3000
```

## Variables d'environnement

Créer un fichier `.env` en local :

```env
OPENROUTER_API_KEY=ta_cle_openrouter
PUBLIC_SITE_URL=http://localhost:3000
```

Sur Render, ajoute ces variables dans Environment Variables.

## Important

Cette version utilise `localStorage` pour les comptes, crédits et historique.
Pour une vraie version commerciale, il faudra connecter une vraie base de données comme Supabase.
