import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// -------------------------------------------------------------
// USERS & RBAC TABLE
// -------------------------------------------------------------
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Better Auth user ID
  email: text('email').notNull().unique(),
  nom: text('nom').notNull(),
  phone: text('phone'),
  role: text('role').notNull().default('PROPRIETAIRE'), // 'SUPER_ADMIN' | 'PROPRIETAIRE' | 'GERANT' | 'LOCATAIRE'
  nomEntreprise: text('nom_entreprise'),
  numeroRcs: text('numero_rcs'),
  numeroContribuable: text('numero_contribuable'),
  pays: text('pays').default('Cameroun'),
  ville: text('ville'),
  adresse: text('adresse'),
  avatarUrl: text('avatar_url'),
  mustChangePassword: boolean('must_change_password').default(false),
  isVerified: boolean('is_verified').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// -------------------------------------------------------------
// SUBSCRIPTION PLANS (DISCOM SaaS)
// -------------------------------------------------------------
export const subscriptionPlans = pgTable('subscription_plans', {
  id: text('id').primaryKey(), // 'starter', 'pro', 'enterprise'
  nom: text('nom').notNull(),
  maxBiens: integer('max_biens').default(5),
  maxLogements: integer('max_logements').default(20),
  prixMensuel: integer('prix_mensuel').notNull().default(15000), // En FCFA
  prixAnnuel: integer('prix_annuel').notNull().default(150000), // En FCFA
  description: text('description'),
});

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  planId: text('plan_id').references(() => subscriptionPlans.id).notNull(),
  status: text('status').notNull().default('ACTIVE'), // 'TRIAL', 'ACTIVE', 'PAST_DUE', 'EXPIRED'
  startDate: timestamp('start_date').defaultNow(),
  endDate: timestamp('end_date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// -------------------------------------------------------------
// IMMOBILIER (BIENS & LOGEMENTS)
// -------------------------------------------------------------
export const biens = pgTable('biens', {
  id: serial('id').primaryKey(),
  proprietaireId: integer('proprietaire_id').references(() => users.id).notNull(),
  nom: text('nom').notNull(),
  type: text('type').notNull().default('immeuble'),
  adresse: text('adresse').notNull(),
  ville: text('ville').notNull(),
  pays: text('pays').default('Cameroun'),
  nombreEtages: integer('nombre_etages').default(1),
  aLogementsRdc: boolean('a_logements_rdc').default(true),
  aSousSol: boolean('a_sous_sol').default(false),
  nombreSousSols: integer('nombre_sous_sols').default(0),
  description: text('description'),
  photo: text('photo'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const logements = pgTable('logements', {
  id: serial('id').primaryKey(),
  bienId: integer('bien_id').references(() => biens.id).notNull(),
  numero: text('numero').notNull(),
  nom: text('nom').notNull(),
  type: text('type').notNull().default('appartement'),
  nombrePieces: integer('nombre_pieces').default(2),
  etage: integer('etage').default(0),
  superficie: integer('superficie').default(50),
  loyerReference: integer('loyer_reference').notNull().default(100000),
  chargesIncluses: integer('charges_incluses').notNull().default(10000),
  statut: text('statut').default('libre'),
  description: text('description'),
  photo: text('photo'),
  createdAt: timestamp('created_at').defaultNow(),
});

// -------------------------------------------------------------
// LOCATAIRES, BAUX & PAIEMENTS
// -------------------------------------------------------------
export const locataires = pgTable('locataires', {
  id: serial('id').primaryKey(),
  proprietaireId: integer('proprietaire_id').references(() => users.id).notNull(),
  nom: text('nom').notNull(),
  telephone: text('telephone').notNull(),
  email: text('email'),
  cni: text('cni'),
  profession: text('profession'),
  contactGarant: text('contact_garant'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const baux = pgTable('baux', {
  id: serial('id').primaryKey(),
  locataireId: integer('locataire_id').references(() => locataires.id).notNull(),
  logementId: integer('logement_id').references(() => logements.id).notNull(),
  loyerMensuel: integer('loyer_mensuel').notNull(),
  chargesMensuelles: integer('charges_mensuelles').default(0),
  depotGarantie: integer('depot_garantie').default(0),
  fraisDossier: integer('frais_dossier').default(0),
  dateDebut: text('date_debut').notNull(),
  dateFin: text('date_fin'),
  statut: text('statut').default('actif'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const paiements = pgTable('paiements', {
  id: serial('id').primaryKey(),
  bailId: integer('bail_id').references(() => baux.id).notNull(),
  locataireId: integer('locataire_id').references(() => locataires.id).notNull(),
  montant: integer('montant').notNull(),
  moisConcerne: text('mois_concerne').notNull(),
  modePaiement: text('mode_paiement').default('especes'),
  statut: text('statut').default('valide'),
  reference: text('reference'),
  datePaiement: text('date_paiement').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// -------------------------------------------------------------
// GÉRANTS ADJOINTS & PERMISSIONS GRANULAIRES
// -------------------------------------------------------------
export const gerantsAdjoints = pgTable('gerants_adjoints', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Unique identifier (e.g. user_gerant_...)
  email: text('email').notNull(),
  name: text('name').notNull(),
  phonenumber: text('phonenumber').notNull(),
  password: text('password'),
  statutCompte: text('statut_compte').default('actif'), // 'actif' | 'inactif' | 'suspendu'
  permissions: jsonb('permissions'), // Granular JSON: { gestion_biens, gestion_logements, gestion_locataires, gestion_baux, enregistrement_paiements, generation_quittances, acces_rapports }
  proprietaireId: integer('proprietaire_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// -------------------------------------------------------------
// JOURNAL D'ACTIVITÉS DES GÉRANTS (AUDIT LOG)
// -------------------------------------------------------------
export const activitesGerant = pgTable('activites_gerant', {
  id: serial('id').primaryKey(),
  gerantId: integer('gerant_id').references(() => gerantsAdjoints.id),
  gerantUid: text('gerant_uid'),
  gerantNom: text('gerant_nom').notNull(),
  bailleurId: integer('bailleur_id').references(() => users.id).notNull(),
  actionType: text('action_type').notNull(), // 'enregistrement_loyer' | 'generation_quittance' | 'creation_bail' | 'creation_locataire' | 'resiliation_bail' | 'connexion' | 'modification_acces'
  titre: text('titre').notNull(),
  description: text('description').notNull(),
  montantFcfa: integer('montant_fcfa'),
  quittanceNumero: text('quittance_numero'),
  reference: text('reference'),
  locataireNom: text('locataire_nom'),
  logementNom: text('logement_nom'),
  date: text('date').notNull(),
  heure: text('heure').notNull(),
  statut: text('statut').default('succes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// -------------------------------------------------------------
// RELATIONS
// -------------------------------------------------------------
export const usersRelations = relations(users, ({ many }) => ({
  biens: many(biens),
  subscriptions: many(subscriptions),
  locataires: many(locataires),
  gerantsAdjoints: many(gerantsAdjoints),
  activitesGerant: many(activitesGerant),
}));

export const biensRelations = relations(biens, ({ one, many }) => ({
  proprietaire: one(users, {
    fields: [biens.proprietaireId],
    references: [users.id],
  }),
  logements: many(logements),
}));

export const logementsRelations = relations(logements, ({ one, many }) => ({
  bien: one(biens, {
    fields: [logements.bienId],
    references: [biens.id],
  }),
  baux: many(baux),
}));

export const locatairesRelations = relations(locataires, ({ one, many }) => ({
  proprietaire: one(users, {
    fields: [locataires.proprietaireId],
    references: [users.id],
  }),
  baux: many(baux),
  paiements: many(paiements),
}));

export const bauxRelations = relations(baux, ({ one, many }) => ({
  locataire: one(locataires, {
    fields: [baux.locataireId],
    references: [locataires.id],
  }),
  logement: one(logements, {
    fields: [baux.logementId],
    references: [logements.id],
  }),
  paiements: many(paiements),
}));

export const gerantsAdjointsRelations = relations(gerantsAdjoints, ({ one, many }) => ({
  proprietaire: one(users, {
    fields: [gerantsAdjoints.proprietaireId],
    references: [users.id],
  }),
  activites: many(activitesGerant),
}));

export const activitesGerantRelations = relations(activitesGerant, ({ one }) => ({
  gerant: one(gerantsAdjoints, {
    fields: [activitesGerant.gerantId],
    references: [gerantsAdjoints.id],
  }),
  bailleur: one(users, {
    fields: [activitesGerant.bailleurId],
    references: [users.id],
  }),
}));
