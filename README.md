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

1. Configurez `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `FRONTEND_URL` et `SUPERADMIN_EMAIL` depuis `.env.example`.
2. Exécutez `npm run db:generate`, puis `npx prisma db push --schema=prisma/schema.prisma` pour créer les tables Better Auth dans votre base PostgreSQL.
3. Lancez `npm run dev`.

L'authentification e-mail/mot de passe est active. Pour Google, renseignez également `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`, puis déclarez l'URL de rappel Better Auth (`/api/auth/callback/google`) dans Google Cloud.

### Production

Utilisez une valeur longue et aléatoire pour `BETTER_AUTH_SECRET`, et définissez `BETTER_AUTH_URL` sur l'URL publique de l'API. Les cookies de session sont envoyés avec les requêtes API; aucun secret d'authentification ne doit être exposé au navigateur.
