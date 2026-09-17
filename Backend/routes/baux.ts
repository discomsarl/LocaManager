import { Router } from 'express';
import { requireAuth, requireRole, requireGerantPermission, AuthRequest } from '../middleware/auth.ts';
import { getBaux, createBail, updateBail, deleteBail, terminateBail } from '../db/tenants.ts';

const router = Router();

// GET /api/baux - Liste des baux du propriétaire
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const baux = await getBaux(uid);
    res.json({ success: true, baux });
  } catch (err: any) {
    console.error('Error in GET /api/baux:', err);
    res.status(500).json({ error: err.message || 'Erreur chargement baux' });
  }
});

// POST /api/baux - Créer un nouveau bail (Bailleur / Gérant / SuperAdmin)
router.post('/', requireAuth, requireRole(['PROPRIETAIRE', 'GERANT']), requireGerantPermission('gestion_baux'), async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const { locataireId, logementId, loyerMensuel, dateDebut } = req.body;
    if (!locataireId || !logementId || !loyerMensuel || !dateDebut) {
      return res.status(400).json({
        error: 'Champs obligatoires manquants: locataireId, logementId, loyerMensuel, dateDebut',
      });
    }

    const bail = await createBail(uid, {
      locataireId: Number(locataireId),
      logementId: Number(logementId),
      loyerMensuel: Number(loyerMensuel),
      chargesMensuelles: req.body.chargesMensuelles ? Number(req.body.chargesMensuelles) : 0,
      depotGarantie: req.body.depotGarantie ? Number(req.body.depotGarantie) : 0,
      fraisDossier: req.body.fraisDossier ? Number(req.body.fraisDossier) : 0,
      dateDebut: String(dateDebut),
      dateFin: req.body.dateFin ? String(req.body.dateFin) : undefined,
      statut: req.body.statut || 'actif',
    });

    res.status(201).json({ success: true, bail });
  } catch (err: any) {
    console.error('Error in POST /api/baux:', err);
    res.status(500).json({ error: err.message || 'Erreur création bail' });
  }
});

// PUT /api/baux/:id - Modifier un bail
router.put('/:id', requireAuth, requireRole(['PROPRIETAIRE', 'GERANT']), requireGerantPermission('gestion_baux'), async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const bailId = parseInt(idParam, 10);
    if (isNaN(bailId)) return res.status(400).json({ error: 'ID bail invalide' });

    const updated = await updateBail(uid, bailId, req.body);
    res.json({ success: true, bail: updated });
  } catch (err: any) {
    console.error('Error in PUT /api/baux/:id:', err);
    res.status(500).json({ error: err.message || 'Erreur modification bail' });
  }
});

// PATCH /api/baux/:id/resilier - Résilier un bail (Bailleur / Gérant / SuperAdmin)
router.patch('/:id/resilier', requireAuth, requireRole(['PROPRIETAIRE', 'GERANT']), requireGerantPermission('gestion_baux'), async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const bailId = parseInt(idParam, 10);
    if (isNaN(bailId)) return res.status(400).json({ error: 'ID bail invalide' });

    const terminated = await terminateBail(uid, bailId);
    res.json({ success: true, bail: terminated });
  } catch (err: any) {
    console.error('Error in PATCH /api/baux/:id/resilier:', err);
    res.status(500).json({ error: err.message || 'Erreur résiliation bail' });
  }
});

// DELETE /api/baux/:id - Supprimer un bail (Propriétaire uniquement)
router.delete('/:id', requireAuth, requireRole(['PROPRIETAIRE']), async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const bailId = parseInt(idParam, 10);
    if (isNaN(bailId)) return res.status(400).json({ error: 'ID bail invalide' });

    const result = await deleteBail(uid, bailId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Error in DELETE /api/baux/:id:', err);
    res.status(500).json({ error: err.message || 'Erreur suppression bail' });
  }
});

export default router;
