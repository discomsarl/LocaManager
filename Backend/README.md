# Architecture Backend - LocaManager (DISCOM SaaS)

Tous les services et fichiers du backend sont centralisés dans le dossier `Backend/`.

## Stack Technique Backend
- **ORM** : **Prisma ORM** (Client v6.4.1 Next-Gen pour Node.js et TypeScript avec typage complet et relations)
- **Base de Données** : PostgreSQL hébergé sur Google Cloud SQL (connexion directe poolée avec prise en charge Unix Socket Cloud Run)
- **Serveur API** : Node.js avec Express 5 & TypeScript (exécution `tsx` en dev, bundle `esbuild` en prod)
- **Sécurité & Authentification** :
  - **Better Auth** : authentification e-mail/mot de passe, sessions PostgreSQL et OAuth Google optionnel.
  - Le middleware `requireAuth` vérifie la session Better Auth (cookie HTTP-only ou Bearer token).
  - **Prisma** associe l'identifiant Better Auth aux profils, rôles (RBAC), abonnements, biens, locataires, baux et paiements.

## Structure des Dossiers

```
Backend/
├── auth.ts                   # Configuration Better Auth et adaptateur Prisma
├── db/
│   ├── index.ts              # Client singleton PrismaClient avec gestion d'URL Cloud SQL
│   ├── users.ts              # Opérations CRUD Prisma pour les utilisateurs et abonnements
│   ├── properties.ts         # Opérations CRUD Prisma pour les biens et logements
│   └── tenants.ts            # Opérations CRUD Prisma pour les locataires, baux et paiements
├── middleware/
│   └── auth.ts               # Middleware requireAuth validant les sessions Better Auth
├── prisma/
│   └── schema.prisma         # Schéma déclaratif Prisma (User, Subscription, Bien, Logement, Locataire, Bail, Paiement)
├── routes/
│   ├── auth.ts               # Endpoints /api/auth (sync, me, profile)
│   ├── properties.ts         # Endpoints /api/biens et logements
│   ├── locataires.ts         # Endpoints /api/locataires (GET, POST, PUT, DELETE)
│   ├── baux.ts               # Endpoints /api/baux (GET, POST, PATCH /resilier)
│   ├── paiements.ts          # Endpoints /api/paiements (GET, POST)
│   └── subscriptions.ts      # Endpoints /api/subscription/plans
├── server.ts                 # Serveur Express principal
└── README.md                 # Documentation
```

## Endpoints API Disponibles

| Ressource | Méthode | Endpoint | Description |
|---|---|---|---|
| **Health** | GET | `/api/health` | Statut serveur, base de données et ORM |
| **Auth** | POST | `/api/auth/sync` | Création / synchronisation du profil PostgreSQL post-connexion |
| **Auth** | GET | `/api/auth/me` | Profil utilisateur et abonnement actif |
| **Auth** | PUT | `/api/auth/profile` | Mise à jour des coordonnées et infos légales (RCS, Contribuable) |
| **Abonnements**| GET | `/api/subscription/plans` | Liste des forfaits DISCOM (Starter, Pro, Entreprise) |
| **Biens** | GET | `/api/biens` | Liste des immeubles/villas et logements du propriétaire |
| **Biens** | POST | `/api/biens` | Création d'un nouvel immeuble/villa |
| **Logements** | POST | `/api/biens/:id/logements` | Création d'une unité locative dans un bien |
| **Locataires** | GET | `/api/locataires` | Liste des locataires du propriétaire |
| **Locataires** | POST | `/api/locataires` | Enregistrement d'un nouveau locataire |
| **Locataires** | PUT | `/api/locataires/:id` | Modification de la fiche locataire |
| **Locataires** | DELETE | `/api/locataires/:id` | Suppression d'un locataire |
| **Baux** | GET | `/api/baux` | Liste des contrats de bail actifs avec historique |
| **Baux** | POST | `/api/baux` | Création d'un contrat de bail (passe le logement à "occupé") |
| **Baux** | PATCH | `/api/baux/:id/resilier` | Résiliation d'un bail (libère le logement) |
| **Paiements** | GET | `/api/paiements` | Historique de tous les loyers collectés |
| **Paiements** | POST | `/api/paiements` | Enregistrement d'un loyer et génération de la quittance |
