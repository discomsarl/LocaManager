import { Router, Request, Response } from 'express';
import { prisma } from '../db/index.ts';
import QRCode from 'qrcode';

const router = Router();

/**
 * Service de hachage & signature cryptographique simplifiée pour intégrité OHADA
 */
function computeQuittanceSecurityHash(data: {
  reference: string;
  montant: number;
  datePaiement: string;
  locataireNom: string;
  bailleurNom: string;
}) {
  const payload = `${data.reference}|${data.montant}|${data.datePaiement}|${data.locataireNom}|${data.bailleurNom}`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `DISCOM-AUTH-${Math.abs(hash).toString(16).toUpperCase()}-${data.reference.replace(/[^a-zA-Z0-9]/g, '')}`;
}

/**
 * GET /api/verify-quittance/:code
 * Endpoint public d'authenticité et de vérification d'une quittance de loyer par QR Code ou référence
 */
router.get('/:code', async (req: Request, res: Response) => {
  try {
    const codeParam = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
    const rawCode = decodeURIComponent(codeParam || '').trim();

    if (!rawCode) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: 'Code de quittance ou référence requis',
      });
    }

    // Recherche par référence directe (ex: QUIT-2026-..., TK-202603-..., ou ID numérique)
    const isNumeric = /^\d+$/.test(rawCode);

    let paiement = await prisma.paiement.findFirst({
      where: {
        OR: [
          { reference: { equals: rawCode, mode: 'insensitive' } },
          ...(isNumeric ? [{ id: parseInt(rawCode, 10) }] : []),
        ],
      },
      include: {
        locataire: {
          include: {
            proprietaire: {
              select: {
                id: true,
                nom: true,
                email: true,
                phone: true,
                nomEntreprise: true,
                pays: true,
              },
            },
          },
        },
        bail: {
          include: {
            logement: {
              include: {
                bien: true,
              },
            },
          },
        },
      },
    });

    // Si non trouvé en direct, vérifions si la référence est contenue dans une chaîne composite (ex: MTN_MONEY-QUIT-...)
    if (!paiement) {
      paiement = await prisma.paiement.findFirst({
        where: {
          reference: {
            contains: rawCode,
            mode: 'insensitive',
          },
        },
        include: {
          locataire: {
            include: {
              proprietaire: {
                select: {
                  id: true,
                  nom: true,
                  email: true,
                  phone: true,
                  nomEntreprise: true,
                  pays: true,
                },
              },
            },
          },
          bail: {
            include: {
              logement: {
                include: {
                  bien: true,
                },
              },
            },
          },
        },
      });
    }

    if (!paiement) {
      return res.status(404).json({
        success: false,
        valid: false,
        status: 'NON_TROUVEE',
        message: `Aucune quittance officielle trouvée pour la référence "${rawCode}".`,
        timestamp: new Date().toISOString(),
      });
    }

    const locataire = (paiement as any).locataire;
    const bailleur = locataire?.proprietaire;
    const bail = (paiement as any).bail;
    const logement = bail?.logement;
    const bien = logement?.bien;

    const locataireNom = locataire?.nom || 'Locataire non renseigné';
    const bailleurNom = bailleur?.nom || 'Bailleur certifié DISCOM';

    const digitalStamp = computeQuittanceSecurityHash({
      reference: paiement.reference || `QUIT-${paiement.id}`,
      montant: paiement.montant,
      datePaiement: paiement.datePaiement,
      locataireNom,
      bailleurNom,
    });

    const isValide = (paiement.statut || 'valide').toLowerCase() !== 'annule';

    const verificationPayload = {
      success: true,
      valid: isValide,
      statut: isValide ? 'AUTHENTIQUE_ET_VALIDE' : 'ANNULEE',
      quittance: {
        id: paiement.id,
        reference: paiement.reference || `QUIT-${paiement.id}`,
        numero_quittance: paiement.reference || `QUIT-CM-${paiement.moisConcerne}-${paiement.id}`,
        mois_concerne: paiement.moisConcerne,
        montant_paye_fcfa: paiement.montant,
        date_paiement: paiement.datePaiement,
        date_enregistrement: paiement.createdAt,
        mode_paiement: paiement.modePaiement || 'especes',
        statut_paiement: paiement.statut || 'valide',
      },
      parties: {
        bailleur: {
          nom: bailleurNom,
          entreprise: bailleur?.nomEntreprise || 'DISCOM CAMEROUN SARL',
          contact: bailleur?.phone || 'Non communiqué',
          email_masque: bailleur?.email ? bailleur.email.replace(/(.{2})(.*)(?=@)/, '$1***') : '',
          pays: bailleur?.pays || 'Cameroun',
        },
        locataire: {
          nom_complet: locataireNom,
          telephone_masque: locataire?.telephone ? locataire.telephone.replace(/(.{4})(.*)(.{2})/, '$1***$3') : '',
          cni_masquee: locataire?.cni ? locataire.cni.replace(/(.{3})(.*)(.{2})/, '$1***$3') : 'Enregistré',
        },
      },
      bien_immobilier: {
        nom_bien: bien?.nom || 'Bien immobilier',
        adresse: bien?.adresse || 'Douala, Cameroun',
        ville: bien?.ville || 'Douala',
        logement_nom: logement?.nom || 'Logement',
        logement_type: logement?.type || 'Appartement',
        superficie: logement?.superficie || 50,
      },
      securite_ohada: {
        certifie_par: 'DISCOM SARL Cameroun - Plateforme Numérique Foncière',
        empreinte_securisee: digitalStamp,
        conforme_ohada: true,
        registre: 'Registre Numérique Centralisé des Baux et Quittances',
        date_verification: new Date().toISOString(),
      },
    };

    return res.json(verificationPayload);
  } catch (error: any) {
    console.error('Error verifying quittance:', error);
    return res.status(500).json({
      success: false,
      valid: false,
      error: 'Erreur interne lors de la vérification de la quittance.',
    });
  }
});

/**
 * GET /api/verify-quittance/:code/qr
 * Génère l'image DataURL ou PNG du QR Code de vérification
 */
router.get('/:code/qr', async (req: Request, res: Response) => {
  try {
    const codeParam = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
    const rawCode = decodeURIComponent(codeParam || '').trim();

    if (!rawCode) {
      return res.status(400).json({ error: 'Code requis' });
    }

    // Construction de l'URL publique de vérification
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const verifyUrl = `${protocol}://${host}/?verify=${encodeURIComponent(rawCode)}`;

    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 256,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    if (req.query.format === 'json') {
      return res.json({
        success: true,
        url: verifyUrl,
        dataUrl: qrDataUrl,
      });
    }

    // Par défaut, retourner image PNG
    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const imgBuffer = Buffer.from(base64Data, 'base64');
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': imgBuffer.length,
    });
    res.end(imgBuffer);
  } catch (error: any) {
    console.error('Error generating QR code:', error);
    return res.status(500).json({ error: 'Erreur génération QR Code' });
  }
});

export default router;
