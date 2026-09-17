import { Router } from 'express';
import { requireAuth, requireRole, requireGerantPermission, AuthRequest } from '../middleware/auth.ts';
import {
  getLocataires,
  createLocataire,
  updateLocataire,
  deleteLocataire,
} from '../db/tenants.ts';

const router = Router();

// GET /api/locataires - Liste des locataires du propriétaire
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const locataires = await getLocataires(uid);
    res.json({ success: true, locataires });
  } catch (err: any) {
    console.error('Error in GET /api/locataires:', err);
    res.status(500).json({ error: err.message || 'Erreur chargement locataires' });
  }
});

// POST /api/locataires - Création d'un locataire (Bailleur / Gérant / SuperAdmin)
router.post('/', requireAuth, requireRole(['PROPRIETAIRE', 'GERANT']), requireGerantPermission('gestion_locataires'), async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const { nom, telephone } = req.body;
    if (!nom || !telephone) {
      return res.status(400).json({ error: 'Le nom et le téléphone sont obligatoires' });
    }

    const locataire = await createLocataire(uid, req.body);
    res.status(201).json({ success: true, locataire });
  } catch (err: any) {
    console.error('Error in POST /api/locataires:', err);
    res.status(500).json({ error: err.message || 'Erreur création locataire' });
  }
});

// PUT /api/locataires/:id - Mise à jour d'un locataire (Bailleur / Gérant / SuperAdmin)
router.put('/:id', requireAuth, requireRole(['PROPRIETAIRE', 'GERANT']), requireGerantPermission('gestion_locataires'), async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const locataireId = parseInt(idParam, 10);
    if (isNaN(locataireId)) return res.status(400).json({ error: 'ID locataire invalide' });

    const updated = await updateLocataire(uid, locataireId, req.body);
    res.json({ success: true, locataire: updated });
  } catch (err: any) {
    console.error('Error in PUT /api/locataires/:id:', err);
    res.status(500).json({ error: err.message || 'Erreur mise à jour locataire' });
  }
});

// DELETE /api/locataires/:id - Suppression d'un locataire (Propriétaire uniquement)
router.delete('/:id', requireAuth, requireRole(['PROPRIETAIRE']), async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const locataireId = parseInt(idParam, 10);
    if (isNaN(locataireId)) return res.status(400).json({ error: 'ID locataire invalide' });

    const result = await deleteLocataire(uid, locataireId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Error in DELETE /api/locataires/:id:', err);
    res.status(500).json({ error: err.message || 'Erreur suppression locataire' });
  }
});

export default router;
