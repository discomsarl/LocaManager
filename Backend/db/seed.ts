import { prisma } from './index.ts';

export async function seedUserData(uid: string, userNom: string) {
  // 1. Get or create user
  const user = await prisma.user.upsert({
    where: { uid },
    update: { nom: userNom },
    create: {
      uid,
      email: `${uid}@discom.africa`,
      nom: userNom,
      role: 'PROPRIETAIRE',
      pays: 'Cameroun',
      ville: 'Douala',
    },
  });

  // 2. Ensure subscription exists
  const existingSub = await prisma.subscription.findFirst({
    where: { userId: user.id },
  });
  if (!existingSub) {
    const inOneYear = new Date();
    inOneYear.setFullYear(inOneYear.getFullYear() + 1);
    await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: 'pro',
        status: 'ACTIVE',
        endDate: inOneYear,
      },
    });
  }

  // 3. Check if user already has properties and units
  let bien = await prisma.bien.findFirst({
    where: { proprietaireId: user.id },
  });

  const existingUnits = bien ? await prisma.logement.count({
    where: { bienId: bien.id }
  }) : 0;

  if (bien && existingUnits > 0) {
    return { seeded: false, message: 'Données déjà existantes pour ce propriétaire' };
  }

  // 4. Create Immeuble if none exists
  if (!bien) {
    bien = await prisma.bien.create({
      data: {
        proprietaireId: user.id,
        nom: 'Résidence Les Orchidées',
        type: 'immeuble',
        adresse: 'Rue des Palmiers, Bonapriso',
        ville: 'Douala',
        pays: 'Cameroun',
        nombreEtages: 3,
        aLogementsRdc: true,
        description: 'Immeuble résidentiel moderne avec gardiennage et groupe électrogène',
      },
    });
  }

  // 5. Create Logements (Apartments)
  const apt1 = await prisma.logement.create({
    data: {
      bienId: bien.id,
      numero: 'A-101',
      nom: 'Appartement T3 Standing',
      type: '3_pieces',
      nombrePieces: 3,
      etage: 1,
      superficie: 85,
      loyerReference: 250000,
      chargesIncluses: 25000,
      statut: 'occupe',
    },
  });

  const apt2 = await prisma.logement.create({
    data: {
      bienId: bien.id,
      numero: 'A-102',
      nom: 'Studio Meublé Confort',
      type: 'studio',
      nombrePieces: 1,
      etage: 1,
      superficie: 42,
      loyerReference: 120000,
      chargesIncluses: 15000,
      statut: 'occupe',
    },
  });

  const apt3 = await prisma.logement.create({
    data: {
      bienId: bien.id,
      numero: 'B-201',
      nom: 'Appartement T4 Vue Panoramique',
      type: '4_pieces_plus',
      nombrePieces: 4,
      etage: 2,
      superficie: 115,
      loyerReference: 380000,
      chargesIncluses: 30000,
      statut: 'libre',
    },
  });

  // 6. Create Locataires
  const loc1 = await prisma.locataire.create({
    data: {
      proprietaireId: user.id,
      nom: 'Mballa',
      telephone: '+237 677 45 89 12',
      email: 'eric.mballa@gmail.com',
      cni: 'LT-10928374',
      profession: 'Ingénieur Télécoms',
      contactGarant: '+237 699 12 34 56 (Mme Mballa)',
    },
  });

  const loc2 = await prisma.locataire.create({
    data: {
      proprietaireId: user.id,
      nom: 'Eboué',
      telephone: '+237 698 33 22 11',
      email: 'sophie.eboue@yahoo.fr',
      cni: 'LT-55443322',
      profession: 'Consultante Financière',
      contactGarant: '+237 671 22 33 44',
    },
  });

  // 7. Create Baux
  const bail1 = await prisma.bail.create({
    data: {
      locataireId: loc1.id,
      logementId: apt1.id,
      loyerMensuel: 250000,
      chargesMensuelles: 25000,
      depotGarantie: 500000,
      fraisDossier: 50000,
      dateDebut: '2026-01-01',
      statut: 'actif',
    },
  });

  const bail2 = await prisma.bail.create({
    data: {
      locataireId: loc2.id,
      logementId: apt2.id,
      loyerMensuel: 120000,
      chargesMensuelles: 15000,
      depotGarantie: 240000,
      fraisDossier: 30000,
      dateDebut: '2026-02-01',
      statut: 'actif',
    },
  });

  // 8. Create Paiements
  await prisma.paiement.create({
    data: {
      bailId: bail1.id,
      locataireId: loc1.id,
      montant: 275000,
      moisConcerne: 'Septembre 2026',
      modePaiement: 'orange_money',
      statut: 'valide',
      reference: 'QUIT-OM-202609-01',
      datePaiement: '2026-09-05',
    },
  });

  await prisma.paiement.create({
    data: {
      bailId: bail2.id,
      locataireId: loc2.id,
      montant: 135000,
      moisConcerne: 'Septembre 2026',
      modePaiement: 'mtn_money',
      statut: 'valide',
      reference: 'QUIT-MOMO-202609-02',
      datePaiement: '2026-09-06',
    },
  });

  return {
    seeded: true,
    bien,
    logements: [apt1, apt2, apt3],
    locataires: [loc1, loc2],
    baux: [bail1, bail2],
  };
}
