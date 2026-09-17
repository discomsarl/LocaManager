import { prisma } from './index.ts';

export interface GerantPermissions {
  gestion_biens?: boolean;
  gestion_logements?: boolean;
  gestion_locataires?: boolean;
  gestion_baux?: boolean;
  enregistrement_paiements?: boolean;
  generation_quittances?: boolean;
  acces_rapports?: boolean;
}

export const defaultPermissions: GerantPermissions = {
  gestion_biens: true,
  gestion_logements: true,
  gestion_locataires: true,
  gestion_baux: true,
  enregistrement_paiements: true,
  generation_quittances: true,
  acces_rapports: true,
};

/**
 * Récupère tous les gérants adjoints d'un bailleur
 */
export async function getGerants(userUid: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) return [];

    // Si c'est un gérant adjoint connecté, retourner la liste de son propriétaire rattaché
    const ownerId = user.role === 'GERANT' ? user.id : user.id;

    const gerants = await prisma.gerantAdjoint.findMany({
      where: { proprietaireId: ownerId },
      include: {
        activites: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return gerants.map(g => ({
      id: g.uid,
      dbId: g.id,
      name: g.name,
      email: g.email,
      phonenumber: g.phonenumber,
      pays: 'Cameroun',
      role: 'gerant_adjoint' as const,
      statut_compte: (g.statutCompte || 'actif') as 'actif' | 'inactif' | 'suspendu',
      permissions: (g.permissions as any) || defaultPermissions,
      proprietaire_id: user.uid,
      created_at: g.createdAt?.toISOString() || new Date().toISOString(),
      activites_count: g.activites.length,
    }));
  } catch (error) {
    console.error('Error fetching gerants via Prisma:', error);
    throw new Error('Erreur lors de la récupération des gérants adjoints.', { cause: error });
  }
}

/**
 * Crée un nouveau gérant adjoint avec permissions modulaires
 */
export async function createGerant(userUid: string, data: {
  name: string;
  email: string;
  phonenumber: string;
  password?: string;
  permissions?: GerantPermissions;
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { plan: true },
          take: 1,
        },
        gerantsAdjoints: true,
      },
    });

    if (!user) throw new Error('Bailleur non trouvé');

    // Vérification de la limite de gérants adjoints (1 gérant adjoint par bailleur)
    if (user.gerantsAdjoints.length >= 1) {
      throw new Error('Votre forfait actuel autorise 1 Gérant Adjoint délégué. Veuillez modifier le gérant existant ou contacter le support DISCOM.');
    }

    // Vérifier l'unicité de l'email
    const existingEmail = await prisma.gerantAdjoint.findFirst({
      where: { email: data.email.trim().toLowerCase() },
    });
    if (existingEmail) {
      throw new Error(`Un gérant avec l'adresse email "${data.email}" existe déjà.`);
    }

    const gerantUid = `user_gerant_${Date.now()}`;
    const mergedPermissions = {
      ...defaultPermissions,
      ...(data.permissions || {}),
    };

    const newGerant = await prisma.gerantAdjoint.create({
      data: {
        uid: gerantUid,
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        phonenumber: data.phonenumber.trim(),
        password: data.password?.trim() || 'passer123',
        statutCompte: 'actif',
        permissions: mergedPermissions as any,
        proprietaireId: user.id,
      },
    });

    // Enregistrer également dans la table users pour permettre l'authentification directe
    try {
      const existingUser = await prisma.user.findUnique({ where: { uid: gerantUid } });
      if (!existingUser) {
        await prisma.user.create({
          data: {
            uid: gerantUid,
            email: data.email.trim().toLowerCase(),
            nom: data.name.trim(),
            phone: data.phonenumber.trim(),
            role: 'GERANT',
            isVerified: true,
            pays: user.pays || 'Cameroun',
            ville: user.ville || 'Douala',
          },
        });
      }
    } catch (syncErr) {
      console.warn('Sync to user table warning:', syncErr);
    }

    // Journaliser l'activité de création
    const now = new Date();
    await prisma.activiteGerant.create({
      data: {
        gerantId: newGerant.id,
        gerantUid: newGerant.uid,
        gerantNom: newGerant.name,
        bailleurId: user.id,
        actionType: 'connexion',
        titre: 'Création du compte gérant adjoint',
        description: `Le bailleur a configuré les accès et permissions modulaires pour le gérant ${newGerant.name}.`,
        date: now.toLocaleDateString('fr-FR'),
        heure: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        statut: 'succes',
      },
    });

    return {
      id: newGerant.uid,
      dbId: newGerant.id,
      name: newGerant.name,
      email: newGerant.email,
      phonenumber: newGerant.phonenumber,
      role: 'gerant_adjoint',
      statut_compte: newGerant.statutCompte || 'actif',
      permissions: mergedPermissions,
      proprietaire_id: user.uid,
      created_at: newGerant.createdAt?.toISOString() || new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error creating gerant via Prisma:', error);
    throw new Error((error as any).message || 'Erreur lors de la création du gérant adjoint.');
  }
}

/**
 * Met à jour les informations, le statut ou les permissions modulaires d'un gérant adjoint
 */
export async function updateGerant(userUid: string, gerantIdOrUid: string | number, data: {
  name?: string;
  email?: string;
  phonenumber?: string;
  password?: string;
  statutCompte?: string;
  statut_compte?: string;
  permissions?: GerantPermissions;
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) throw new Error('Bailleur non trouvé');

    // Trouver le gérant adjoint rattaché à ce bailleur
    const parsedId = typeof gerantIdOrUid === 'number' ? gerantIdOrUid : parseInt(gerantIdOrUid, 10);
    const existing = await prisma.gerantAdjoint.findFirst({
      where: {
        OR: [
          ...(!isNaN(parsedId) ? [{ id: parsedId }] : []),
          { uid: String(gerantIdOrUid) },
        ],
        proprietaireId: user.id,
      },
    });

    if (!existing) {
      throw new Error('Gérant adjoint non trouvé ou accès non autorisé.');
    }

    const statut = data.statutCompte || data.statut_compte;

    const updated = await prisma.gerantAdjoint.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.email !== undefined && { email: data.email.trim().toLowerCase() }),
        ...(data.phonenumber !== undefined && { phonenumber: data.phonenumber.trim() }),
        ...(data.password !== undefined && { password: data.password.trim() }),
        ...(statut !== undefined && { statutCompte: statut }),
        ...(data.permissions !== undefined && { permissions: data.permissions as any }),
      },
    });

    // Mettre à jour l'utilisateur miroir dans la table users si existant
    try {
      await prisma.user.updateMany({
        where: { uid: existing.uid },
        data: {
          ...(data.name !== undefined && { nom: data.name.trim() }),
          ...(data.email !== undefined && { email: data.email.trim().toLowerCase() }),
          ...(data.phonenumber !== undefined && { phone: data.phonenumber.trim() }),
        },
      });
    } catch (syncErr) {
      console.warn('Sync to user table warning:', syncErr);
    }

    // Journaliser la modification d'accès
    const now = new Date();
    await prisma.activiteGerant.create({
      data: {
        gerantId: updated.id,
        gerantUid: updated.uid,
        gerantNom: updated.name,
        bailleurId: user.id,
        actionType: 'modification_acces',
        titre: 'Mise à jour des accès & permissions',
        description: `Mise à jour des droits accordés au gérant adjoint ${updated.name}. Statut du compte : ${updated.statutCompte}.`,
        date: now.toLocaleDateString('fr-FR'),
        heure: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        statut: 'succes',
      },
    });

    return {
      id: updated.uid,
      dbId: updated.id,
      name: updated.name,
      email: updated.email,
      phonenumber: updated.phonenumber,
      role: 'gerant_adjoint',
      statut_compte: updated.statutCompte || 'actif',
      permissions: (updated.permissions as any) || defaultPermissions,
      proprietaire_id: user.uid,
      updated_at: updated.updatedAt?.toISOString() || new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error updating gerant via Prisma:', error);
    throw new Error((error as any).message || 'Erreur lors de la mise à jour du gérant adjoint.');
  }
}

/**
 * Supprime définitivement un gérant adjoint
 */
export async function deleteGerant(userUid: string, gerantIdOrUid: string | number) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) throw new Error('Bailleur non trouvé');

    const parsedId = typeof gerantIdOrUid === 'number' ? gerantIdOrUid : parseInt(gerantIdOrUid, 10);
    const existing = await prisma.gerantAdjoint.findFirst({
      where: {
        OR: [
          ...(!isNaN(parsedId) ? [{ id: parsedId }] : []),
          { uid: String(gerantIdOrUid) },
        ],
        proprietaireId: user.id,
      },
    });

    if (!existing) {
      throw new Error('Gérant adjoint non trouvé ou accès non autorisé.');
    }

    // Supprimer les activités associées puis le gérant
    await prisma.$transaction(async (tx) => {
      await tx.activiteGerant.deleteMany({
        where: { gerantId: existing.id },
      });
      await tx.gerantAdjoint.delete({
        where: { id: existing.id },
      });
      // Supprimer également le compte utilisateur miroir s'il existe
      await tx.user.deleteMany({
        where: { uid: existing.uid },
      });
    });

    return { success: true, id: existing.uid, name: existing.name };
  } catch (error) {
    console.error('Error deleting gerant via Prisma:', error);
    throw new Error((error as any).message || 'Erreur lors de la suppression du gérant adjoint.');
  }
}

/**
 * Récupère le journal d'activité des gérants adjoints pour un bailleur
 */
export async function getActivitesGerant(userUid: string, options?: { limit?: number; gerantUid?: string }) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) return [];

    const activites = await prisma.activiteGerant.findMany({
      where: {
        bailleurId: user.id,
        ...(options?.gerantUid ? { gerantUid: options.gerantUid } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
    });

    return activites.map(a => ({
      id: String(a.id),
      gerant_id: a.gerantUid || String(a.gerantId || ''),
      gerant_nom: a.gerantNom,
      bailleur_id: user.uid,
      action_type: a.actionType as any,
      titre: a.titre,
      description: a.description,
      montant_fcfa: a.montantFcfa || undefined,
      quittance_numero: a.quittanceNumero || undefined,
      reference: a.reference || undefined,
      locataire_nom: a.locataireNom || undefined,
      logement_nom: a.logementNom || undefined,
      date: a.date,
      heure: a.heure,
      statut: (a.statut || 'succes') as 'succes' | 'alerte' | 'info',
    }));
  } catch (error) {
    console.error('Error fetching gerant activities:', error);
    return [];
  }
}

/**
 * Enregistre une activité effectuée par un gérant adjoint
 */
export async function logActivite(data: {
  gerantUid?: string;
  gerantNom: string;
  bailleurUid: string;
  actionType: string;
  titre: string;
  description: string;
  montantFcfa?: number;
  quittanceNumero?: string;
  reference?: string;
  locataireNom?: string;
  logementNom?: string;
  statut?: 'succes' | 'alerte' | 'info';
}) {
  try {
    const bailleur = await prisma.user.findUnique({
      where: { uid: data.bailleurUid },
    });
    if (!bailleur) return null;

    let gerantDbId: number | undefined;
    if (data.gerantUid) {
      const g = await prisma.gerantAdjoint.findUnique({ where: { uid: data.gerantUid } });
      if (g) gerantDbId = g.id;
    }

    const now = new Date();
    return await prisma.activiteGerant.create({
      data: {
        gerantId: gerantDbId,
        gerantUid: data.gerantUid,
        gerantNom: data.gerantNom,
        bailleurId: bailleur.id,
        actionType: data.actionType,
        titre: data.titre,
        description: data.description,
        montantFcfa: data.montantFcfa,
        quittanceNumero: data.quittanceNumero,
        reference: data.reference,
        locataireNom: data.locataireNom,
        logementNom: data.logementNom,
        date: now.toLocaleDateString('fr-FR'),
        heure: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        statut: data.statut || 'succes',
      },
    });
  } catch (err) {
    console.warn('Failed to log gerant activity:', err);
    return null;
  }
}
