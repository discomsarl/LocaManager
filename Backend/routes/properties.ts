import { Router } from 'express';
import { requireAuth, requireRole, requireGerantPermission, AuthRequest } from '../middleware/auth.ts';
import { 
  getBiensAndLogements, 
  createBien, 
  updateBien,
  deleteBien,
  createLogement,
  updateLogement,
  deleteLogement,
  getPropertyStats
} from '../db/properties.ts';
import { seedUserData } from '../db/seed.ts';

const router = Router();

// Get aggregated property stats
router.get('/stats', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const stats = await getPropertyStats(uid);
    res.json({ success: true, stats });
  } catch (err: any) {
    console.error('Error fetching property stats:', err);
    res.status(500).json({ error: err.message || 'Erreur calcul statistiques' });
  }
});

// Seed initial property data if database is empty for this owner
router.post('/seed', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const nom = req.body?.nom || req.user?.email?.split('@')[0] || 'Propriétaire';
    const result = await seedUserData(uid, nom);
    const data = await getBiensAndLogements(uid);
    res.json({ success: true, ...result, ...data });
  } catch (err: any) {
    console.error('Error seeding data:', err);
    res.status(500).json({ error: err.message || 'Erreur initialisation données' });
  }
});

// Get all properties & housing units for the logged-in owner/manager
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const data = await getBiensAndLogements(uid);
    res.json({ success: true, ...data });
  } catch (err: any) {
    console.error('Error fetching biens:', err);
    res.status(500).json({ error: err.message || 'Erreur chargement biens' });
  }
});

// Create a new property (immeuble, villa, etc.) - Bailleur / Gérant / SuperAdmin
router.post('/', requireAuth, requireRole(['PROPRIETAIRE', 'GERANT']), requireGerantPermission('gestion_biens'), async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const bien = await createBien(uid, req.body);
    res.json({ success: true, bien });
  } catch (err: any) {
    console.error('Error creating bien:', err);
    res.status(500).json({ error: err.message || 'Erreur création bien' });
  }
});

// Update a property
router.put('/:id', requireAuth, requireRole(['PROPRIETAIRE', 'GERANT']), requireGerantPermission('gestion_biens'), async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const bienId = parseInt(idParam, 10);
    if (isNaN(bienId)) return res.status(400).json({ error: 'ID bien invalide' });

    const updated = await updateBien(uid, bienId, req.body);
    res.json({ success: true, bien: updated });
  } catch (err: any) {
    console.error('Error updating bien:', err);
    res.status(500).json({ error: err.message || 'Erreur modification bien' });
  }
});

// Delete a property
router.delete('/:id', requireAuth, requireRole(['PROPRIETAIRE']), async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const bienId = parseInt(idParam, 10);
    if (isNaN(bienId)) return res.status(400).json({ error: 'ID bien invalide' });

    const result = await deleteBien(uid, bienId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Error deleting bien:', err);
    res.status(500).json({ error: err.message || 'Erreur suppression bien' });
  }
});

// Create a unit inside a property
router.post('/:id/logements', requireAuth, requireRole(['PROPRIETAIRE', 'GERANT']), requireGerantPermission('gestion_logements'), async (req: AuthRequest, res) => {
  try {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const bienId = parseInt(idParam, 10);
    if (isNaN(bienId)) return res.status(400).json({ error: 'ID bien invalide' });

    const logement = await createLogement(bienId, req.body);
    res.json({ success: true, logement });
  } catch (err: any) {
    console.error('Error creating logement:', err);
    res.status(500).json({ error: err.message || 'Erreur création logement' });
  }
});

// Update a unit
router.put('/logements/:logementId', requireAuth, requireRole(['PROPRIETAIRE', 'GERANT']), requireGerantPermission('gestion_logements'), async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const idParam = Array.isArray(req.params.logementId) ? req.params.logementId[0] : req.params.logementId;
    const logementId = parseInt(idParam, 10);
    if (isNaN(logementId)) return res.status(400).json({ error: 'ID logement invalide' });

    const updated = await updateLogement(uid, logementId, req.body);
    res.json({ success: true, logement: updated });
  } catch (err: any) {
    console.error('Error updating logement:', err);
    res.status(500).json({ error: err.message || 'Erreur modification logement' });
  }
});

// Delete a unit
router.delete('/logements/:logementId', requireAuth, requireRole(['PROPRIETAIRE']), async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const idParam = Array.isArray(req.params.logementId) ? req.params.logementId[0] : req.params.logementId;
    const logementId = parseInt(idParam, 10);
    if (isNaN(logementId)) return res.status(400).json({ error: 'ID logement invalide' });

    const result = await deleteLogement(uid, logementId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Error deleting logement:', err);
    res.status(500).json({ error: err.message || 'Erreur suppression logement' });
  }
});

export default router;
