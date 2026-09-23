import { prisma } from './index.ts';

export async function getBiensAndLogements(userUid: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) return { biens: [], logements: [] };

    const biensList = await prisma.bien.findMany({
      where: { proprietaireId: user.id },
      include: {
        logements: {
          take: 500,
          orderBy: [
            { etage: 'asc' },
            { numero: 'asc' },
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const allLogements = biensList.flatMap(b => b.logements);

    return {
      biens: biensList.map(({ logements, ...rest }) => rest),
      logements: allLogements,
    };
  } catch (error) {
    console.error('Prisma query failed in getBiensAndLogements:', error);
    throw new Error('Erreur lors du chargement des biens et logements avec Prisma.', { cause: error });
  }
}

export async function createBien(userUid: string, data: {
  nom: string;
  type: string;
  adresse: string;
  ville: string;
  pays?: string;
  nombreEtages?: number;
  aLogementsRdc?: boolean;
  aSousSol?: boolean;
  nombreSousSols?: number;
  description?: string;
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) throw new Error('Utilisateur non trouvé');

    const newBien = await prisma.bien.create({
      data: {
        proprietaireId: user.id,
        nom: data.nom,
        type: data.type,
        adresse: data.adresse,
        ville: data.ville,
        pays: data.pays || 'Cameroun',
        nombreEtages: data.nombreEtages || 1,
        aLogementsRdc: data.aLogementsRdc !== false,
        aSousSol: !!data.aSousSol,
        nombreSousSols: data.nombreSousSols || 0,
        description: data.description || '',
      },
    });

    return newBien;
  } catch (error) {
    console.error('Error creating bien via Prisma:', error);
    throw new Error('Erreur lors de la création du bien immobilier avec Prisma.', { cause: error });
  }
}

export async function createLogement(bienId: number, data: {
  numero: string;
  nom: string;
  type: string;
  nombrePieces: number;
  etage: number;
  superficie: number;
  loyerReference: number;
  chargesIncluses: number;
  statut?: string;
  description?: string;
}) {
  try {
    const newLogement = await prisma.logement.create({
      data: {
        bienId,
        numero: data.numero,
        nom: data.nom,
        type: data.type,
        nombrePieces: data.nombrePieces,
        etage: data.etage,
        superficie: data.superficie,
        loyerReference: data.loyerReference,
        chargesIncluses: data.chargesIncluses,
        statut: data.statut || 'libre',
        description: data.description || '',
      },
    });

    return newLogement;
  } catch (error) {
    console.error('Error creating logement via Prisma:', error);
    throw new Error('Erreur lors de la création du logement avec Prisma.', { cause: error });
  }
}

export async function updateBien(userUid: string, bienId: number, data: {
  nom?: string;
  type?: string;
  adresse?: string;
  ville?: string;
  pays?: string;
  nombreEtages?: number;
  aLogementsRdc?: boolean;
  aSousSol?: boolean;
  nombreSousSols?: number;
  description?: string;
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) throw new Error('Utilisateur non trouvé');

    const existing = await prisma.bien.findFirst({
      where: { id: bienId, proprietaireId: user.id },
    });
    if (!existing) throw new Error('Bien non trouvé ou accès non autorisé');

    const updated = await prisma.bien.update({
      where: { id: bienId },
      data: {
        ...(data.nom !== undefined && { nom: data.nom }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.adresse !== undefined && { adresse: data.adresse }),
        ...(data.ville !== undefined && { ville: data.ville }),
        ...(data.pays !== undefined && { pays: data.pays }),
        ...(data.nombreEtages !== undefined && { nombreEtages: data.nombreEtages }),
        ...(data.aLogementsRdc !== undefined && { aLogementsRdc: data.aLogementsRdc }),
        ...(data.aSousSol !== undefined && { aSousSol: data.aSousSol }),
        ...(data.nombreSousSols !== undefined && { nombreSousSols: data.nombreSousSols }),
        ...(data.description !== undefined && { description: data.description }),
      },
    });

    return updated;
  } catch (error) {
    console.error('Error updating bien via Prisma:', error);
    throw new Error('Erreur lors de la mise à jour du bien immobilier avec Prisma.', { cause: error });
  }
}

export async function deleteBien(userUid: string, bienId: number) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) throw new Error('Utilisateur non trouvé');

    const existing = await prisma.bien.findFirst({
      where: { id: bienId, proprietaireId: user.id },
      include: {
        logements: {
          include: {
            baux: true,
          },
        },
      },
    });
    if (!existing) throw new Error('Bien non trouvé ou accès non autorisé');

    // Safe deletion: delete in transaction or verify no active leases
    const hasActiveLease = existing.logements.some(l => l.baux.some(b => b.statut === 'actif'));
    if (hasActiveLease) {
      throw new Error('Impossible de supprimer un bien contenant des logements avec un bail actif.');
    }

    // Clean up child logements and the property in a transaction
    await prisma.$transaction(async (tx) => {
      // Find all logement IDs
      const logementIds = existing.logements.map(l => l.id);
      if (logementIds.length > 0) {
        // Delete related payments and baux for these units if any closed ones exist
        const baux = await tx.bail.findMany({
          where: { logementId: { in: logementIds } },
          select: { id: true },
        });
        const bailIds = baux.map(b => b.id);
        if (bailIds.length > 0) {
          await tx.paiement.deleteMany({ where: { bailId: { in: bailIds } } });
          await tx.bail.deleteMany({ where: { id: { in: bailIds } } });
        }
        await tx.logement.deleteMany({ where: { id: { in: logementIds } } });
      }
      await tx.bien.delete({ where: { id: bienId } });
    });

    return { success: true, id: bienId };
  } catch (error) {
    console.error('Error deleting bien via Prisma:', error);
    throw new Error((error as any).message || 'Erreur lors de la suppression du bien immobilier.');
  }
}

export async function updateLogement(userUid: string, logementId: number, data: {
  numero?: string;
  nom?: string;
  type?: string;
  nombrePieces?: number;
  etage?: number;
  superficie?: number;
  loyerReference?: number;
  chargesIncluses?: number;
  statut?: string;
  description?: string;
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) throw new Error('Utilisateur non trouvé');

    const existing = await prisma.logement.findFirst({
      where: {
        id: logementId,
        bien: { proprietaireId: user.id },
      },
    });
    if (!existing) throw new Error('Logement non trouvé ou accès non autorisé');

    const updated = await prisma.logement.update({
      where: { id: logementId },
      data: {
        ...(data.numero !== undefined && { numero: data.numero }),
        ...(data.nom !== undefined && { nom: data.nom }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.nombrePieces !== undefined && { nombrePieces: data.nombrePieces }),
        ...(data.etage !== undefined && { etage: data.etage }),
        ...(data.superficie !== undefined && { superficie: data.superficie }),
        ...(data.loyerReference !== undefined && { loyerReference: data.loyerReference }),
        ...(data.chargesIncluses !== undefined && { chargesIncluses: data.chargesIncluses }),
        ...(data.statut !== undefined && { statut: data.statut }),
        ...(data.description !== undefined && { description: data.description }),
      },
    });

    return updated;
  } catch (error) {
    console.error('Error updating logement via Prisma:', error);
    throw new Error('Erreur lors de la mise à jour du logement avec Prisma.', { cause: error });
  }
}

export async function deleteLogement(userUid: string, logementId: number) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) throw new Error('Utilisateur non trouvé');

    const existing = await prisma.logement.findFirst({
      where: {
        id: logementId,
        bien: { proprietaireId: user.id },
      },
      include: {
        baux: true,
      },
    });
    if (!existing) throw new Error('Logement non trouvé ou accès non autorisé');

    const hasActiveLease = existing.baux.some(b => b.statut === 'actif');
    if (hasActiveLease) {
      throw new Error('Impossible de supprimer un logement avec un bail actif.');
    }

    await prisma.$transaction(async (tx) => {
      const bailIds = existing.baux.map(b => b.id);
      if (bailIds.length > 0) {
        await tx.paiement.deleteMany({ where: { bailId: { in: bailIds } } });
        await tx.bail.deleteMany({ where: { id: { in: bailIds } } });
      }
      await tx.logement.delete({ where: { id: logementId } });
    });

    return { success: true, id: logementId };
  } catch (error) {
    console.error('Error deleting logement via Prisma:', error);
    throw new Error((error as any).message || 'Erreur lors de la suppression du logement.');
  }
}

export async function getPropertyStats(userUid: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid: userUid },
    });
    if (!user) {
      return {
        totalBiens: 0,
        totalLogements: 0,
        logementsOccupes: 0,
        logementsVacants: 0,
        tauxOccupation: 0,
        loyerReferenceTotal: 0,
      };
    }

    const biens = await prisma.bien.findMany({
      where: { proprietaireId: user.id },
      include: {
        logements: true,
      },
    });

    const allLogements = biens.flatMap(b => b.logements);
    const totalBiens = biens.length;
    const totalLogements = allLogements.length;
    const logementsOccupes = allLogements.filter(l => l.statut === 'occupe').length;
    const logementsVacants = totalLogements - logementsOccupes;
    const tauxOccupation = totalLogements > 0 ? Math.round((logementsOccupes / totalLogements) * 100) : 0;
    const loyerReferenceTotal = allLogements.reduce((sum, l) => sum + (l.loyerReference || 0), 0);

    return {
      totalBiens,
      totalLogements,
      logementsOccupes,
      logementsVacants,
      tauxOccupation,
      loyerReferenceTotal,
    };
  } catch (error) {
    console.error('Error computing property stats via Prisma:', error);
    throw new Error('Erreur lors du calcul des statistiques des biens.', { cause: error });
  }
}
