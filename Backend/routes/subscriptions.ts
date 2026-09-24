import { Router } from 'express';
import { z } from 'zod';
import { auth, emailVerificationCallbackUrl } from '../auth.ts';
import { prisma } from '../db/index.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';

const router = Router();

const adminUserSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  phonenumber: z.string().trim().min(3),
  entreprise: z.string().trim().optional(),
  ville: z.string().trim().optional(),
  planId: z.string().min(1),
  dureeMois: z.number().int().positive().max(120),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
});

function requireSuperAdmin(req: AuthRequest, res: any) {
  if (req.dbUser?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ success: false, error: 'Accès réservé au SuperAdmin.' });
    return false;
  }
  return true;
}

router.post('/admin-users', requireAuth, async (req: AuthRequest, res) => {
  if (!requireSuperAdmin(req, res)) return;
  const parsed = adminUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Identifiants invalides.', details: parsed.error.issues });

  const data = parsed.data;
  try {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: data.planId } });
    if (!plan) return res.status(400).json({ success: false, error: 'Forfait introuvable.' });

    const authResult = await auth.api.signUpEmail({
      body: { name: data.name, email: data.email, password: data.password, callbackURL: emailVerificationCallbackUrl },
    });
    if (!authResult.user) return res.status(400).json({ success: false, error: 'Impossible de créer le compte de connexion.' });

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + data.dureeMois);
    const user = await prisma.user.create({
      data: {
        uid: authResult.user.id,
        email: data.email,
        nom: data.name,
        phone: data.phonenumber,
        role: 'PROPRIETAIRE',
        nomEntreprise: data.entreprise || null,
        ville: data.ville || null,
        isVerified: authResult.user.emailVerified,
        subscriptions: { create: { planId: data.planId, status: 'ACTIVE', endDate } },
      },
      include: { subscriptions: { include: { plan: true }, take: 1 } },
    });
    return res.status(201).json({ success: true, user, subscription: user.subscriptions[0] });
  } catch (error: any) {
    console.error('Erreur création utilisateur BackOffice:', error);
    return res.status(400).json({ success: false, error: error?.message || 'Impossible de créer cet utilisateur.' });
  }
});

router.put('/admin-users/:uid', requireAuth, async (req: AuthRequest, res) => {
  if (!requireSuperAdmin(req, res)) return;
  const uid = String(req.params.uid);
  try {
    if (req.body.email !== undefined || req.body.name !== undefined) {
      await prisma.authUser.update({
        where: { id: uid },
        data: {
          ...(req.body.email !== undefined ? { email: String(req.body.email).trim().toLowerCase() } : {}),
          ...(req.body.name !== undefined ? { name: String(req.body.name).trim() } : {}),
        },
      });
    }
    const user = await prisma.user.update({
      where: { uid },
      data: {
        ...(req.body.name !== undefined ? { nom: String(req.body.name).trim() } : {}),
        ...(req.body.email !== undefined ? { email: String(req.body.email).trim().toLowerCase() } : {}),
        ...(req.body.phonenumber !== undefined ? { phone: String(req.body.phonenumber).trim() } : {}),
        ...(req.body.entreprise !== undefined ? { nomEntreprise: req.body.entreprise || null } : {}),
        ...(req.body.ville !== undefined ? { ville: req.body.ville || null } : {}),
      },
    });
    const subscription = await prisma.subscription.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    if (subscription) {
      await prisma.subscription.update({ where: { id: subscription.id }, data: {
        ...(req.body.planId ? { planId: req.body.planId } : {}),
        ...(req.body.statut ? { status: String(req.body.statut).toUpperCase() } : {}),
        ...(req.body.date_expiration ? { endDate: new Date(req.body.date_expiration) } : {}),
      } });
    }
    return res.json({ success: true, user });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message || 'Impossible de modifier cet utilisateur.' });
  }
});

router.delete('/admin-users/:uid', requireAuth, async (req: AuthRequest, res) => {
  if (!requireSuperAdmin(req, res)) return;
  const uid = String(req.params.uid);
  try {
    const user = await prisma.user.findUnique({ where: { uid } });
    if (!user) return res.status(404).json({ success: false, error: 'Utilisateur introuvable.' });
    if (user.role === 'SUPER_ADMIN') return res.status(400).json({ success: false, error: 'Le SuperAdmin racine ne peut pas être supprimé.' });

    const biens = await prisma.bien.findMany({ where: { proprietaireId: user.id }, select: { id: true } });
    const bienIds = biens.map((bien) => bien.id);
    const logements = await prisma.logement.findMany({ where: { bienId: { in: bienIds } }, select: { id: true } });
    const logementIds = logements.map((logement) => logement.id);
    const baux = await prisma.bail.findMany({ where: { logementId: { in: logementIds } }, select: { id: true } });
    const bailIds = baux.map((bail) => bail.id);
    const locataires = await prisma.locataire.findMany({ where: { proprietaireId: user.id }, select: { id: true } });
    const locataireIds = locataires.map((locataire) => locataire.id);

    await prisma.$transaction(async (tx) => {
      await tx.paiement.deleteMany({ where: { OR: [{ bailId: { in: bailIds } }, { locataireId: { in: locataireIds } }] } });
      await tx.bail.deleteMany({ where: { id: { in: bailIds } } });
      await tx.locataire.deleteMany({ where: { id: { in: locataireIds } } });
      await tx.logement.deleteMany({ where: { id: { in: logementIds } } });
      await tx.bien.deleteMany({ where: { id: { in: bienIds } } });
      await tx.activiteGerant.deleteMany({ where: { bailleurId: user.id } });
      const gerants = await tx.gerantAdjoint.findMany({ where: { proprietaireId: user.id }, select: { id: true, uid: true } });
      await tx.activiteGerant.deleteMany({ where: { gerantId: { in: gerants.map((gerant) => gerant.id) } } });
      await tx.gerantAdjoint.deleteMany({ where: { proprietaireId: user.id } });
      await tx.securityAuditLog.deleteMany({ where: { userId: user.id } });
      await tx.subscription.deleteMany({ where: { userId: user.id } });
      await tx.user.delete({ where: { id: user.id } });
      await tx.authUser.delete({ where: { id: user.uid } });
    });
    return res.json({ success: true, id: uid });
  } catch (error: any) {
    console.error('Erreur suppression utilisateur BackOffice:', error);
    return res.status(400).json({ success: false, error: error?.message || 'Impossible de supprimer cet utilisateur.' });
  }
});

router.get('/admin-overview', requireAuth, async (req: AuthRequest, res) => {
  if (req.dbUser?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, error: 'Accès réservé au SuperAdmin.' });
  }

  try {
    const [users, subscriptions, plans] = await Promise.all([
      prisma.user.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.subscription.findMany({ include: { plan: true }, orderBy: { createdAt: 'desc' } }),
      prisma.subscriptionPlan.findMany({ orderBy: { id: 'asc' } }),
    ]);
    return res.json({ success: true, users, subscriptions, plans });
  } catch (err: any) {
    console.error('Failed to get SuperAdmin overview via Prisma:', err);
    return res.status(500).json({ success: false, error: err.message || 'Erreur BackOffice' });
  }
});

// Get subscription plans via Prisma
router.get('/plans', async (req, res) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany();
    res.json({ success: true, plans });
  } catch (err: any) {
    console.error('Failed to get subscription plans via Prisma:', err);
    res.status(500).json({ success: false, error: err.message || 'Erreur plans' });
  }
});

export default router;
