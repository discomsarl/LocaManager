import { Router } from 'express';
import { requireAuth, requireRole, requireGerantPermission, AuthRequest } from '../middleware/auth.ts';
import { getPaiements, createPaiement, updatePaiement, deletePaiement } from '../db/tenants.ts';

const router = Router();

// GET /api/paiements - Historique de tous les paiements perçus
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const paiements = await getPaiements(uid);
    res.json({ success: true, paiements });
  } catch (err: any) {
    console.error('Error in GET /api/paiements:', err);
    res.status(500).json({ error: err.message || 'Erreur chargement paiements' });
  }
});

// POST /api/paiements - Enregistrer un nouveau paiement / quittance (Bailleur / Gérant / SuperAdmin)
router.post('/', requireAuth, requireRole(['PROPRIETAIRE', 'GERANT']), requireGerantPermission('enregistrement_paiements'), async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const { bailId, locataireId, montant, moisConcerne, datePaiement } = req.body;
    if (!bailId || !locataireId || !montant || !moisConcerne || !datePaiement) {
      return res.status(400).json({
        error: 'Champs obligatoires manquants: bailId, locataireId, montant, moisConcerne, datePaiement',
      });
    }

    const paiement = await createPaiement(uid, {
      bailId: Number(bailId),
      locataireId: Number(locataireId),
      montant: Number(montant),
      moisConcerne: String(moisConcerne),
      modePaiement: req.body.modePaiement || 'especes',
      statut: req.body.statut || 'valide',
      reference: req.body.reference,
      datePaiement: String(datePaiement),
    });

    res.status(201).json({ success: true, paiement });
  } catch (err: any) {
    console.error('Error in POST /api/paiements:', err);
    res.status(500).json({ error: err.message || 'Erreur enregistrement paiement' });
  }
});

// PUT /api/paiements/:id - Modifier un paiement / quittance (Bailleur / Gérant / SuperAdmin)
router.put('/:id', requireAuth, requireRole(['PROPRIETAIRE', 'GERANT']), requireGerantPermission('enregistrement_paiements'), async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const paiementId = parseInt(idParam, 10);
    if (isNaN(paiementId)) return res.status(400).json({ error: 'ID paiement invalide' });

    const updated = await updatePaiement(uid, paiementId, req.body);
    res.json({ success: true, paiement: updated });
  } catch (err: any) {
    console.error('Error in PUT /api/paiements/:id:', err);
    res.status(500).json({ error: err.message || 'Erreur modification paiement' });
  }
});

// DELETE /api/paiements/:id - Annuler/Supprimer un paiement (Propriétaire uniquement)
router.delete('/:id', requireAuth, requireRole(['PROPRIETAIRE']), async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Non authentifié' });

    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const paiementId = parseInt(idParam, 10);
    if (isNaN(paiementId)) return res.status(400).json({ error: 'ID paiement invalide' });

    const result = await deletePaiement(uid, paiementId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Error in DELETE /api/paiements/:id:', err);
    res.status(500).json({ error: err.message || 'Erreur suppression paiement' });
  }
});

export default router;
