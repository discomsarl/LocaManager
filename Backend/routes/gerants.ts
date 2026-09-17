import { Router, Response } from 'express';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import {
  getGerants,
  createGerant,
  updateGerant,
  deleteGerant,
  getActivitesGerant,
  logActivite,
  defaultPermissions,
} from '../db/gerants.ts';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(requireAuth);

/**
 * GET /api/gerants
 * Récupère la liste des gérants adjoints rattachés au compte
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Utilisateur non identifié.' });
    }

    const gerants = await getGerants(uid);
    res.json({
      success: true,
      gerants,
      count: gerants.length,
      maxAllowed: 1, // 1 Gérant Adjoint délégué inclus
    });
  } catch (error: any) {
    console.error('Erreur GET /api/gerants:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur lors de la récupération des gérants.' });
  }
});

/**
 * POST /api/gerants
 * Crée un nouveau gérant adjoint avec permissions modulaires
 */
router.post('/', requireRole(['PROPRIETAIRE']), async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Utilisateur non identifié.' });
    }

    const { name, email, phonenumber, password, permissions } = req.body;

    if (!name || !email || !phonenumber) {
      return res.status(400).json({
        error: 'Champs requis manquants : nom, email et téléphone sont obligatoires.',
      });
    }

    const newGerant = await createGerant(uid, {
      name,
      email,
      phonenumber,
      password: password || 'passer123',
      permissions: permissions || defaultPermissions,
    });

    res.status(201).json({
      success: true,
      message: `Le compte Gérant Adjoint pour "${newGerant.name}" a été configuré avec succès.`,
      gerant: newGerant,
    });
  } catch (error: any) {
    console.error('Erreur POST /api/gerants:', error);
    res.status(400).json({ error: error.message || 'Erreur lors de la création du gérant adjoint.' });
  }
});

/**
 * PUT /api/gerants (compatible avec /api/gerants-adjoints sans ID dans l'URL)
 * PUT /api/gerants/:id
 * Met à jour un gérant adjoint existant (informations, statut, permissions modulaires)
 */
const handleUpdate = async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Utilisateur non identifié.' });
    }

    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const gerantId = idParam || req.body.id || (req.query.id as string);
    if (!gerantId) {
      return res.status(400).json({ error: 'Identifiant du gérant manquant.' });
    }

    const { name, email, phonenumber, password, statut_compte, statutCompte, permissions } = req.body;

    const updated = await updateGerant(uid, gerantId, {
      name,
      email,
      phonenumber,
      password,
      statutCompte: statutCompte || statut_compte,
      permissions,
    });

    res.json({
      success: true,
      message: `Les accès et permissions du gérant "${updated.name}" ont été mis à jour avec succès.`,
      gerant: updated,
    });
  } catch (error: any) {
    console.error('Erreur PUT /api/gerants:', error);
    res.status(400).json({ error: error.message || 'Erreur lors de la mise à jour du gérant adjoint.' });
  }
};

router.put('/:id', requireRole(['PROPRIETAIRE']), handleUpdate);
router.put('/', requireRole(['PROPRIETAIRE']), handleUpdate);

/**
 * DELETE /api/gerants
 * DELETE /api/gerants/:id
 * Supprime définitivement un gérant adjoint
 */
const handleDelete = async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Utilisateur non identifié.' });
    }

    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const gerantId = idParam || req.body?.id || (req.query.id as string);
    if (!gerantId) {
      return res.status(400).json({ error: 'Identifiant du gérant manquant.' });
    }

    const result = await deleteGerant(uid, gerantId);
    res.json({
      success: true,
      message: `Le gérant adjoint "${result.name}" a été définitivement supprimé.`,
      id: result.id,
    });
  } catch (error: any) {
    console.error('Erreur DELETE /api/gerants:', error);
    res.status(400).json({ error: error.message || 'Erreur lors de la suppression du gérant adjoint.' });
  }
};

router.delete('/:id', requireRole(['PROPRIETAIRE']), handleDelete);
router.delete('/', requireRole(['PROPRIETAIRE']), handleDelete);

/**
 * PATCH /api/gerants/:id/statut
 * Activer ou suspendre rapidement un gérant adjoint
 */
router.patch('/:id/statut', requireRole(['PROPRIETAIRE']), async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Utilisateur non identifié.' });

    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!idParam) return res.status(400).json({ error: 'Identifiant requis.' });

    const { statut } = req.body;
    if (!statut || !['actif', 'inactif', 'suspendu'].includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide. Valeurs acceptées : actif, inactif, suspendu.' });
    }

    const updated = await updateGerant(uid, idParam, { statutCompte: statut });
    res.json({
      success: true,
      message: `Statut du compte mis à jour : ${statut}.`,
      gerant: updated,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PATCH /api/gerants/:id/permissions
 * Mettre à jour uniquement les permissions modulaires
 */
router.patch('/:id/permissions', requireRole(['PROPRIETAIRE']), async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Utilisateur non identifié.' });

    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!idParam) return res.status(400).json({ error: 'Identifiant requis.' });

    const { permissions } = req.body;
    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ error: 'Objet permissions invalide.' });
    }

    const updated = await updateGerant(uid, idParam, { permissions });
    res.json({
      success: true,
      message: 'Permissions modulaires mises à jour avec succès.',
      permissions: updated.permissions,
      gerant: updated,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/gerants/activites
 * Journal d'activité (Audit log) des gérants
 */
router.get('/activites', async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Utilisateur non identifié.' });

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const gerantUid = req.query.gerant_id as string | undefined;

    const activites = await getActivitesGerant(uid, { limit, gerantUid });
    res.json({
      success: true,
      activites,
      count: activites.length,
    });
  } catch (error: any) {
    console.error('Erreur GET /api/gerants/activites:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des activités.' });
  }
});

/**
 * POST /api/gerants/activites
 * Enregistre une activité effectuée par un gérant adjoint
 */
router.post('/activites', async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Utilisateur non identifié.' });

    const {
      gerant_id,
      gerant_nom,
      action_type,
      titre,
      description,
      montant_fcfa,
      quittance_numero,
      reference,
      locataire_nom,
      logement_nom,
      statut,
    } = req.body;

    if (!titre || !description || !action_type) {
      return res.status(400).json({ error: 'Titre, description et action_type sont requis.' });
    }

    const created = await logActivite({
      gerantUid: gerant_id,
      gerantNom: gerant_nom || req.dbUser?.nom || 'Gérant Adjoint',
      bailleurUid: uid,
      actionType: action_type,
      titre,
      description,
      montantFcfa: montant_fcfa,
      quittanceNumero: quittance_numero,
      reference,
      locataireNom: locataire_nom,
      logementNom: logement_nom,
      statut,
    });

    res.status(201).json({
      success: true,
      activite: created,
    });
  } catch (error: any) {
    console.error('Erreur POST /api/gerants/activites:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement de l\'activité.' });
  }
});

export default router;
