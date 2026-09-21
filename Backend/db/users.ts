import { prisma } from './index.ts';

export async function getOrCreateUser(uid: string, email: string, nom?: string, role?: string) {
  try {
    const configuredSuperAdminEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
    const userRole = role || (configuredSuperAdminEmail && email.toLowerCase() === configuredSuperAdminEmail ? 'SUPER_ADMIN' : 'PROPRIETAIRE');
    const userName = nom || email.split('@')[0] || 'Utilisateur';

    // Upsert user using Prisma
    const user = await prisma.user.upsert({
      where: { uid },
      update: {
        email,
        ...(nom ? { nom: userName } : {}),
        ...(configuredSuperAdminEmail && email.toLowerCase() === configuredSuperAdminEmail ? { role: 'SUPER_ADMIN' } : {}),
        updatedAt: new Date(),
      },
      create: {
        uid,
        email,
        nom: userName,
        role: userRole,
      },
    });

    // Ensure a default subscription exists for PROPRIETAIRE
    if (user && user.role === 'PROPRIETAIRE') {
      const existingSubs = await prisma.subscription.findMany({
        where: { userId: user.id },
      });

      if (existingSubs.length === 0) {
        await prisma.subscriptionPlan.upsert({
          where: { id: 'pro' },
          update: {},
          create: {
            id: 'pro',
            nom: 'Professionnel',
            maxBiens: 20,
            maxLogements: 100,
            prixMensuel: 15000,
            prixAnnuel: 150000,
            description: 'Forfait professionnel DISCOM',
          },
        });
        const inOneMonth = new Date();
        inOneMonth.setDate(inOneMonth.getDate() + 30);
        await prisma.subscription.create({
          data: {
            userId: user.id,
            planId: 'pro',
            status: 'ACTIVE',
            endDate: inOneMonth,
          },
        });
      }
    }

    return user;
  } catch (error) {
    console.error('Failed in Prisma getOrCreateUser:', error);
    throw new Error('Impossible de charger ou créer le profil utilisateur avec Prisma.', { cause: error });
  }
}

export async function getUserWithDetails(uid: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { uid },
      include: {
        subscriptions: {
          include: {
            plan: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!user) return null;

    return {
      ...user,
      activeSubscription: user.subscriptions[0]
        ? {
            sub: user.subscriptions[0],
            plan: user.subscriptions[0].plan,
          }
        : null,
    };
  } catch (error) {
    console.error('Failed to get user details via Prisma:', error);
    throw new Error('Erreur de récupération des informations du profil avec Prisma.', { cause: error });
  }
}

export async function updateUserProfile(uid: string, updateData: {
  nom?: string;
  phone?: string;
  nomEntreprise?: string;
  numeroRcs?: string;
  numeroContribuable?: string;
  pays?: string;
  ville?: string;
  adresse?: string;
}) {
  try {
    const updated = await prisma.user.update({
      where: { uid },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });
    return updated;
  } catch (error) {
    console.error('Failed to update user profile via Prisma:', error);
    throw new Error('Impossible de mettre à jour le profil avec Prisma.', { cause: error });
  }
}
