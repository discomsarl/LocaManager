import { Router, Response } from 'express';
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

    const updated = await updateUserProfile(uid, req.body);
    res.json({ success: true, user: updated });
  } catch (err: any) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: err.message || 'Erreur mise à jour profil' });
  }
}

const router = Router();

// User Sync upon login
router.post('/sync', requireAuth, handleSyncUser);

// Get current user profile & active subscription
router.get('/me', requireAuth, handleGetCurrentUser);

// Update profile details (RCS, Contribuable, Nom, etc.)
router.put('/profile', requireAuth, handleUpdateProfile);

export default router;
