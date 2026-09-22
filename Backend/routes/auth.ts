import { Router, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.ts';
import { prisma } from '../db/index.ts';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { getOrCreateUser, getUserWithDetails, updateUserProfile } from '../db/users.ts';

export async function handleSyncUser(req: AuthRequest, res: Response) {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || `${uid}@discomsaas.com`;
    const name = req.body?.nom || req.user?.name || email.split('@')[0];

    if (!uid) {
      return res.status(401).json({ error: 'Identifiant utilisateur manquant' });
    }

    const user = await getOrCreateUser(uid, email, name);
    const userWithDetails = await getUserWithDetails(uid);

    res.json({
      success: true,
      user: userWithDetails || user,
    });
  } catch (err: any) {
    console.error('Error in handleSyncUser:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la synchronisation utilisateur' });
  }
}

export async function handleGetCurrentUser(req: AuthRequest, res: Response) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    let profile = await getUserWithDetails(uid);
    if (!profile) {
      const created = await getOrCreateUser(uid, req.user?.email || `${uid}@discom.cm`, req.user?.name);
      profile = await getUserWithDetails(uid) || (created as any);
    }

    res.json({ success: true, user: profile });
  } catch (err: any) {
    console.error('Error in handleGetCurrentUser:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la récupération du profil' });
  }
}

export async function handleUpdateProfile(req: AuthRequest, res: Response) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    if (!req.body?.currentPassword) return res.status(400).json({ error: 'Le mot de passe actuel est requis pour modifier le profil.' });
    await auth.api.verifyPassword({ headers: fromNodeHeaders(req.headers), body: { password: req.body.currentPassword } });
    const { currentPassword: _currentPassword, email: _email, ...profileData } = req.body;
    const updated = await updateUserProfile(uid, profileData);
    await prisma.securityAuditLog.create({ data: { userId: req.dbUser?.id, action: 'PROFILE_UPDATED', ipAddress: getIp(req) } });
    res.json({ success: true, user: updated });
  } catch (err: any) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: err.message || 'Erreur mise à jour profil' });
  }
}

const router = Router();
const securityAttempts = new Map<string, { count: number; resetAt: number }>();

function allowSecurityAttempt(key: string) {
  const now = Date.now();
  const current = securityAttempts.get(key);
  if (!current || current.resetAt <= now) {
    securityAttempts.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= 5) return false;
  current.count += 1;
  return true;
}

function getIp(req: AuthRequest) {
  return req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || null;
}

router.post('/security/password', requireAuth, async (req: AuthRequest, res: Response) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ error: 'Non authentifié' });
  if (!allowSecurityAttempt(`${uid}:password`)) return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans une minute.' });

  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  if (!currentPassword || !newPassword || newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Mot de passe actuel, nouveau mot de passe et confirmation requis.' });
  }
  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir 8 caractères, une majuscule et un chiffre.' });
  }

  try {
    await auth.api.changePassword({
      headers: fromNodeHeaders(req.headers),
      body: { currentPassword, newPassword, revokeOtherSessions: true },
    });
    await prisma.securityAuditLog.create({ data: { userId: req.dbUser?.id, action: 'PASSWORD_CHANGED', ipAddress: getIp(req) } });
    console.info(`[security] Password changed for ${uid}`);
    return res.json({ success: true });
  } catch {
    return res.status(400).json({ error: 'Le mot de passe actuel est incorrect ou la modification a échoué.' });
  }
});

router.post('/security/email', requireAuth, async (req: AuthRequest, res: Response) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ error: 'Non authentifié' });
  if (!allowSecurityAttempt(`${uid}:email`)) return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans une minute.' });

  const newEmail = String(req.body?.newEmail || '').trim().toLowerCase();
  const currentPassword = String(req.body?.currentPassword || '');
  if (!newEmail || !currentPassword || !/^\S+@\S+\.\S+$/.test(newEmail)) return res.status(400).json({ error: 'Nouvel e-mail et mot de passe actuel requis.' });

  try {
    await auth.api.verifyPassword({ headers: fromNodeHeaders(req.headers), body: { password: currentPassword } });
    const existing = await prisma.authUser.findUnique({ where: { email: newEmail } });
    if (existing) return res.status(400).json({ error: 'Impossible de traiter cette demande.' });
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60_000);
    await prisma.user.update({ where: { uid }, data: { pendingEmail: newEmail, pendingEmailToken: token, pendingEmailExpiresAt: expires } });
    await prisma.securityAuditLog.create({ data: { userId: req.dbUser?.id, action: 'EMAIL_CHANGE_REQUESTED', ipAddress: getIp(req) } });
    console.info(`[security] Email confirmation token generated for ${uid}: ${token}`);
    return res.json({ success: true, message: 'Un lien de confirmation a été envoyé à la nouvelle adresse.' });
  } catch {
    return res.status(400).json({ error: 'Impossible de traiter cette demande.' });
  }
});

router.post('/security/email/confirm', async (req: AuthRequest, res: Response) => {
  const token = String(req.body?.token || '');
  if (!token) return res.status(400).json({ error: 'Jeton de confirmation manquant.' });
  const user = await prisma.user.findUnique({ where: { pendingEmailToken: token } });
  if (!user || !user.pendingEmail || !user.pendingEmailExpiresAt || user.pendingEmailExpiresAt < new Date()) {
    return res.status(400).json({ error: 'Lien invalide ou expiré.' });
  }
  try {
    await prisma.$transaction([
      prisma.authUser.update({ where: { id: user.uid }, data: { email: user.pendingEmail } }),
      prisma.user.update({ where: { id: user.id }, data: { email: user.pendingEmail, pendingEmail: null, pendingEmailToken: null, pendingEmailExpiresAt: null } }),
      prisma.securityAuditLog.create({ data: { userId: user.id, action: 'EMAIL_CHANGED' } }),
    ]);
    return res.json({ success: true });
  } catch {
    return res.status(400).json({ error: 'Impossible de confirmer cette adresse e-mail.' });
  }
});

// User Sync upon login
router.post('/sync', requireAuth, handleSyncUser);

// Get current user profile & active subscription
router.get('/me', requireAuth, handleGetCurrentUser);

// Update profile details (RCS, Contribuable, Nom, etc.)
router.put('/profile', requireAuth, handleUpdateProfile);

export default router;
