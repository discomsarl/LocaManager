import { prisma } from './index.ts';
import { auth } from '../auth.ts';

// -------------------------------------------------------------
// LOCATAIRES (TENANTS)
// -------------------------------------------------------------
export async function getLocataires(userUid: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) return [];

    if (user.role === 'LOCATAIRE') {
      const locataire = await prisma.locataire.findFirst({
        where: {
          OR: [
            { authUid: user.uid },
            { email: user.email },
          ],
        },
        include: {
          baux: {
            include: { logement: { include: { bien: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      return locataire ? [locataire] : [];
    }

    const locataires = await prisma.locataire.findMany({
      where: { proprietaireId: user.id },
      include: {
        baux: {
          include: {
            logement: {
              include: {
                bien: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        paiements: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return locataires;
  } catch (error) {
    console.error('Error fetching locataires via Prisma:', error);
    throw new Error('Erreur lors du chargement des locataires.', { cause: error });
  }
}

export async function createLocataire(userUid: string, data: {
  nom: string;
  telephone: string;
  email?: string;
  cni?: string;
  profession?: string;
  contactGarant?: string;
  password: string;
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) throw new Error('Utilisateur propriétaire non trouvé');

    if (!data.email) throw new Error('Un email est obligatoire pour créer un accès locataire.');
    if (!data.password || data.password.length < 8 || !/[A-Z]/.test(data.password) || !/[0-9]/.test(data.password)) {
      throw new Error('Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.');
    }

    const authResult = await auth.api.signUpEmail({
      body: { name: data.nom, email: data.email.trim().toLowerCase(), password: data.password },
    });
    if (!authResult.user) {
      throw new Error('Impossible de créer l’accès du locataire.');
    }

    await prisma.user.create({
      data: {
        uid: authResult.user.id,
        email: data.email.trim().toLowerCase(),
        nom: data.nom,
        phone: data.telephone,
        role: 'LOCATAIRE',
      },
    });

    const newLocataire = await prisma.locataire.create({
      data: {
        proprietaireId: user.id,
        nom: data.nom,
        telephone: data.telephone,
        email: data.email || '',
        cni: data.cni || '',
        profession: data.profession || '',
        contactGarant: data.contactGarant || '',
        authUid: authResult.user.id,
      },
    });

    return newLocataire;
  } catch (error) {
    console.error('Error creating locataire via Prisma:', error);
    throw new Error('Erreur lors de la création du locataire.', { cause: error });
  }
}

export async function updateLocataire(userUid: string, locataireId: number, data: {
  nom?: string;
  telephone?: string;
  email?: string;
  cni?: string;
  profession?: string;
  contactGarant?: string;
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) throw new Error('Utilisateur propriétaire non trouvé');

    // Verify ownership
    const existing = await prisma.locataire.findFirst({
      where: { id: locataireId, proprietaireId: user.id },
    });
    if (!existing) throw new Error('Locataire introuvable ou accès non autorisé');

    const updated = await prisma.locataire.update({
      where: { id: locataireId },
      data: {
        ...data,
      },
    });

    return updated;
  } catch (error) {
    console.error('Error updating locataire via Prisma:', error);
    throw new Error('Erreur lors de la mise à jour du locataire.', { cause: error });
  }
}

export async function deleteLocataire(userUid: string, locataireId: number) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) throw new Error('Utilisateur propriétaire non trouvé');

    const existing = await prisma.locataire.findFirst({
      where: { id: locataireId, proprietaireId: user.id },
    });
    if (!existing) throw new Error('Locataire introuvable ou accès non autorisé');

    await prisma.locataire.delete({
      where: { id: locataireId },
    });

    return { success: true, id: locataireId };
  } catch (error) {
    console.error('Error deleting locataire via Prisma:', error);
    throw new Error('Erreur lors de la suppression du locataire.', { cause: error });
  }
}

// -------------------------------------------------------------
// BAUX (LEASES / CONTRACTS)
// -------------------------------------------------------------
export async function getBaux(userUid: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) return [];

    const baux = await prisma.bail.findMany({
      where: {
        locataire: {
          proprietaireId: user.id,
        },
      },
      include: {
        locataire: true,
        logement: {
          include: {
            bien: true,
          },
        },
        paiements: {
          orderBy: { datePaiement: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return baux;
  } catch (error) {
    console.error('Error fetching baux via Prisma:', error);
    throw new Error('Erreur lors de la récupération des baux.', { cause: error });
  }
}

export async function createBail(userUid: string, data: {
  locataireId: number;
  logementId: number;
  loyerMensuel: number;
  chargesMensuelles?: number;
  depotGarantie?: number;
  fraisDossier?: number;
  dateDebut: string;
  dateFin?: string;
  statut?: string;
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) throw new Error('Utilisateur propriétaire non trouvé');

    // Verify locataire belongs to user
    const locataire = await prisma.locataire.findFirst({
      where: { id: data.locataireId, proprietaireId: user.id },
    });
    if (!locataire) throw new Error('Locataire non autorisé');

    const newBail = await prisma.bail.create({
      data: {
        locataireId: data.locataireId,
        logementId: data.logementId,
        loyerMensuel: data.loyerMensuel,
        chargesMensuelles: data.chargesMensuelles || 0,
        depotGarantie: data.depotGarantie || 0,
        fraisDossier: data.fraisDossier || 0,
        dateDebut: data.dateDebut,
        dateFin: data.dateFin,
        statut: data.statut || 'actif',
      },
      include: {
        locataire: true,
        logement: true,
      },
    });

    // Update unit status to 'occupe'
    await prisma.logement.update({
      where: { id: data.logementId },
      data: { statut: 'occupe' },
    });

    return newBail;
  } catch (error) {
    console.error('Error creating bail via Prisma:', error);
    throw new Error('Erreur lors de la création du contrat de bail.', { cause: error });
  }
}

export async function terminateBail(userUid: string, bailId: number) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) throw new Error('Utilisateur propriétaire non trouvé');

    const bail = await prisma.bail.findFirst({
      where: {
        id: bailId,
        locataire: { proprietaireId: user.id },
      },
    });
    if (!bail) throw new Error('Bail introuvable ou non autorisé');

    const updatedBail = await prisma.bail.update({
      where: { id: bailId },
      data: { statut: 'resilie' },
    });

    // Free up the unit
    await prisma.logement.update({
      where: { id: bail.logementId },
      data: { statut: 'libre' },
    });

    return updatedBail;
  } catch (error) {
    console.error('Error terminating bail via Prisma:', error);
    throw new Error('Erreur lors de la résiliation du bail.', { cause: error });
  }
}

export async function updateBail(userUid: string, bailId: number, data: {
  loyerMensuel?: number;
  chargesMensuelles?: number;
  depotGarantie?: number;
  fraisDossier?: number;
  dateDebut?: string;
  dateFin?: string;
  statut?: string;
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) throw new Error('Utilisateur propriétaire non trouvé');

    const bail = await prisma.bail.findFirst({
      where: {
        id: bailId,
        locataire: { proprietaireId: user.id },
      },
    });
    if (!bail) throw new Error('Bail introuvable ou non autorisé');

    const updated = await prisma.bail.update({
      where: { id: bailId },
      data: {
        ...(data.loyerMensuel !== undefined && { loyerMensuel: data.loyerMensuel }),
        ...(data.chargesMensuelles !== undefined && { chargesMensuelles: data.chargesMensuelles }),
        ...(data.depotGarantie !== undefined && { depotGarantie: data.depotGarantie }),
        ...(data.fraisDossier !== undefined && { fraisDossier: data.fraisDossier }),
        ...(data.dateDebut !== undefined && { dateDebut: data.dateDebut }),
        ...(data.dateFin !== undefined && { dateFin: data.dateFin }),
        ...(data.statut !== undefined && { statut: data.statut }),
      },
      include: {
        locataire: true,
        logement: true,
      },
    });

    return updated;
  } catch (error) {
    console.error('Error updating bail via Prisma:', error);
    throw new Error('Erreur lors de la mise à jour du bail.', { cause: error });
  }
}

export async function deleteBail(userUid: string, bailId: number) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) throw new Error('Utilisateur propriétaire non trouvé');

    const bail = await prisma.bail.findFirst({
      where: {
        id: bailId,
        locataire: { proprietaireId: user.id },
      },
    });
    if (!bail) throw new Error('Bail introuvable ou non autorisé');

    await prisma.$transaction(async (tx) => {
      // Delete associated payments
      await tx.paiement.deleteMany({ where: { bailId } });
      // Free housing unit
      await tx.logement.update({
        where: { id: bail.logementId },
        data: { statut: 'libre' },
      });
      // Delete lease
      await tx.bail.delete({ where: { id: bailId } });
    });

    return { success: true, id: bailId };
  } catch (error) {
    console.error('Error deleting bail via Prisma:', error);
    throw new Error('Erreur lors de la suppression du bail.', { cause: error });
  }
}

// -------------------------------------------------------------
// PAIEMENTS & QUITTANCES (PAYMENTS & RECEIPTS)
// -------------------------------------------------------------
export async function getPaiements(userUid: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) return [];

    // If tenant, retrieve only payments for this tenant's email or identity
    if (user.role === 'LOCATAIRE') {
      const locataire = await prisma.locataire.findFirst({
        where: { email: user.email },
      });
      if (!locataire) return [];

      return await prisma.paiement.findMany({
        where: { locataireId: locataire.id },
        include: {
          locataire: true,
          bail: {
            include: {
              logement: {
                include: {
                  bien: true,
                },
              },
            },
          },
        },
        orderBy: { datePaiement: 'desc' },
        take: 100,
      });
    }

    // Propriétaire, Gérant, SuperAdmin
    const paiements = await prisma.paiement.findMany({
      where: user.role === 'SUPER_ADMIN' ? {} : {
        locataire: {
          proprietaireId: user.id,
        },
      },
      include: {
        locataire: true,
        bail: {
          include: {
            logement: {
              include: {
                bien: true,
              },
            },
          },
        },
      },
      orderBy: { datePaiement: 'desc' },
      take: 100,
    });

    return paiements;
  } catch (error) {
    console.error('Error fetching paiements via Prisma:', error);
    throw new Error('Erreur lors de la récupération des paiements.', { cause: error });
  }
}

export async function createPaiement(userUid: string, data: {
  bailId: number;
  locataireId: number;
  montant: number;
  moisConcerne: string;
  modePaiement?: string;
  statut?: string;
  reference?: string;
  datePaiement: string;
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) throw new Error('Utilisateur propriétaire non trouvé');

    // Verify ownership
    const locataire = await prisma.locataire.findFirst({
      where: { id: data.locataireId, proprietaireId: user.id },
    });
    if (!locataire) throw new Error('Locataire non autorisé');

    // Auto-generate reference if missing
    const ref = data.reference || `QUIT-${Date.now().toString().slice(-6)}`;

    const newPaiement = await prisma.paiement.create({
      data: {
        bailId: data.bailId,
        locataireId: data.locataireId,
        montant: data.montant,
        moisConcerne: data.moisConcerne,
        modePaiement: data.modePaiement || 'especes',
        statut: data.statut || 'valide',
        reference: ref,
        datePaiement: data.datePaiement,
      },
      include: {
        locataire: true,
        bail: {
          include: {
            logement: true,
          },
        },
      },
    });

    return newPaiement;
  } catch (error) {
    console.error('Error creating paiement via Prisma:', error);
    throw new Error('Erreur lors de la création du paiement.', { cause: error });
  }
}

export async function updatePaiement(userUid: string, paiementId: number, data: {
  montant?: number;
  moisConcerne?: string;
  modePaiement?: string;
  statut?: string;
  reference?: string;
  datePaiement?: string;
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) throw new Error('Utilisateur propriétaire non trouvé');

    const existing = await prisma.paiement.findFirst({
      where: {
        id: paiementId,
        locataire: { proprietaireId: user.id },
      },
    });
    if (!existing) throw new Error('Paiement introuvable ou non autorisé');

    const updated = await prisma.paiement.update({
      where: { id: paiementId },
      data: {
        ...(data.montant !== undefined && { montant: data.montant }),
        ...(data.moisConcerne !== undefined && { moisConcerne: data.moisConcerne }),
        ...(data.modePaiement !== undefined && { modePaiement: data.modePaiement }),
        ...(data.statut !== undefined && { statut: data.statut }),
        ...(data.reference !== undefined && { reference: data.reference }),
        ...(data.datePaiement !== undefined && { datePaiement: data.datePaiement }),
      },
    });

    return updated;
  } catch (error) {
    console.error('Error updating paiement via Prisma:', error);
    throw new Error('Erreur lors de la mise à jour du paiement.', { cause: error });
  }
}

export async function deletePaiement(userUid: string, paiementId: number) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) throw new Error('Utilisateur propriétaire non trouvé');

    const existing = await prisma.paiement.findFirst({
      where: {
        id: paiementId,
        locataire: { proprietaireId: user.id },
      },
    });
    if (!existing) throw new Error('Paiement introuvable ou non autorisé');

    await prisma.paiement.delete({
      where: { id: paiementId },
    });

    return { success: true, id: paiementId };
  } catch (error) {
    console.error('Error deleting paiement via Prisma:', error);
    throw new Error('Erreur lors de la suppression du paiement.', { cause: error });
  }
}
