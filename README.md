<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/cd214ef2-cbdf-48f6-856f-6faef35c0c5f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Authentification Better Auth

L'application utilise Better Auth avec PostgreSQL pour les comptes, sessions et mots de passe. Le profil métier (rôle, abonnement, biens) est créé automatiquement dans `users` lors de la première session.

### Configuration locale

1. Configurez `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `FRONTEND_URL`, `SUPERADMIN_EMAIL` et `SUPERADMIN_BOOTSTRAP_KEY` depuis `.env.example`.
2. Exécutez `npm run db:generate`, puis `npx prisma db push --schema=Backend/prisma/schema.prisma` pour créer les tables Better Auth dans votre base PostgreSQL.
3. Lancez `npm run dev`.

L'authentification e-mail/mot de passe est active. Pour Google, renseignez également `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`, puis déclarez l'URL de rappel Better Auth (`/api/auth/callback/google`) dans Google Cloud.

### Recréer le compte SuperAdmin après un reset

Si la base ne contient aucun utilisateur `SUPER_ADMIN`, ouvrez `/superadmin-setup`. Saisissez le nom, l'e-mail, le mot de passe et la valeur de `SUPERADMIN_BOOTSTRAP_KEY` configurée uniquement côté serveur. La création est refusée dès qu'un SuperAdmin existe déjà. Si la vérification d'e-mail est active, confirmez le lien reçu avant de vous connecter.

### Production

Utilisez une valeur longue et aléatoire pour `BETTER_AUTH_SECRET`, et définissez `BETTER_AUTH_URL` sur l'URL publique de l'API. Les cookies de session sont envoyés avec les requêtes API; aucun secret d'authentification ne doit être exposé au navigateur.

### Déploiement Vercel et Render

Le frontend est servi comme site statique sur Vercel. L'API Express et PostgreSQL doivent être hébergés séparément : `render.yaml` configure le service API sur Render. Vercel ne démarre pas le serveur Express.

1. Importez d'abord le dépôt dans Render en utilisant le Blueprint `render.yaml`. Renseignez `DATABASE_URL` avec une base PostgreSQL accessible depuis Render, puis fournissez les secrets proposés dans le Blueprint. Après création de la base, exécutez une fois `npx prisma db push --schema=Backend/prisma/schema.prisma` avec cette URL pour créer les tables. `BETTER_AUTH_URL` doit être l'URL publique du service Render. `FRONTEND_URL` et `TRUSTED_ORIGINS` doivent contenir l'origine Vercel exacte, par exemple `https://mon-app.vercel.app` (sans chemin; origines multiples séparées par des virgules pour `TRUSTED_ORIGINS`).
2. Importez le même dépôt dans Vercel. La configuration du dépôt lance `npm ci` puis `npm run build:vercel` et publie `dist`. Dans les variables d'environnement Vercel, ajoutez `VITE_API_URL` avec l'URL publique Render, sans `/` final, par exemple `https://locamanager-api.onrender.com`. Cette valeur est intégrée au frontend pendant la build : relancez un déploiement après toute modification.
3. Si Google OAuth est utilisé, configurez `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` sur Render, `VITE_GOOGLE_AUTH_ENABLED=true` sur Vercel, et déclarez l'URL de rappel Better Auth auprès de Google : `https://<api-render>/api/auth/callback/google`.

Variables serveur sensibles (`DATABASE_URL`, `BETTER_AUTH_SECRET`, clés Google, Resend et `SUPERADMIN_BOOTSTRAP_KEY`) à saisir dans Render uniquement. Ne préfixez jamais ces secrets par `VITE_`. Après déploiement, vérifiez `https://<api-render>/api/health` puis l'application Vercel.