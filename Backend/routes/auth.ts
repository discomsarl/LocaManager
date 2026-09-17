import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { getOrCreateUser, getUserWithDetails, updateUserProfile } from '../db/users.ts';

const router = Router();

// User Sync upon Firebase login
router.post('/sync', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || `${uid}@discomsaas.com`;
    const name = req.body?.nom || req.user?.name || email.split('@')[0];

    if (!uid) {
      return res.status(401).json({ error: 'UID Firebase manquant' });
    }

    const user = await getOrCreateUser(uid, email, name);
    const userWithDetails = await getUserWithDetails(uid);

    res.json({
      success: true,
      user: userWithDetails || user,
    });
  } catch (err: any) {
    console.error('Error in /api/auth/sync:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la synchronisation utilisateur' });
  }
});

// Get current user profile & active subscription
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const profile = await getUserWithDetails(uid);
    if (!profile) {
      const created = await getOrCreateUser(uid, req.user?.email || `${uid}@discom.cm`, req.user?.name);
      return res.json({ success: true, user: created });
    }

    res.json({ success: true, user: profile });
  } catch (err: any) {
    console.error('Error in /api/auth/me:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la récupération du profil' });
  }
});

// Update profile details (RCS, Contribuable, Nom, etc.)
router.put('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const updated = await updateUserProfile(uid, req.body);
    res.json({ success: true, user: updated });
  } catch (err: any) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: err.message || 'Erreur mise à jour profil' });
  }
});

export default router;
