import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../config/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { prisma } from '../db/index.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: any;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Empty token' });
  }

  // Helper to attach database user record
  const populateDbUser = async (uid: string) => {
    try {
      const user = await prisma.user.findUnique({
        where: { uid },
      });
      if (user) {
        req.dbUser = user;
        return;
      }

      // If not found in users table, check in gerants_adjoints
      const gerant = await prisma.gerantAdjoint.findUnique({
        where: { uid },
      });
      if (gerant) {
        req.dbUser = {
          id: gerant.id,
          uid: gerant.uid,
          email: gerant.email,
          nom: gerant.name,
          role: 'GERANT',
          isGerantAdjoint: true,
          statutCompte: gerant.statutCompte,
          permissions: (gerant.permissions as any) || {},
          proprietaireId: gerant.proprietaireId,
        };
      }
    } catch (dbErr) {
      console.warn('Could not populate dbUser:', dbErr);
    }
  };

  // Development tokens are deliberately opt-in and never accepted in production.
  const developmentAuthEnabled = process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_AUTH === 'true';
  if (developmentAuthEnabled && (token.startsWith('dev_') || token.startsWith('demo_') || token.startsWith('user_'))) {
    const uid = token.replace(/^(dev_|demo_)/, '');
    req.user = {
      uid,
      email: token.includes('@') ? token : `${uid}@discom.africa`,
      auth_time: Math.floor(Date.now() / 1000),
      sub: uid,
      iss: 'dev-environment',
      aud: 'discom-saas',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 30,
    } as any;
    await populateDbUser(uid);
    return next();
  }

  // Production and normal development requests must use a Firebase ID token.
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    await populateDbUser(decodedToken.uid);
    return next();
  } catch (error: any) {
    console.warn('Firebase ID token verification failed:', error.message || error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

/**
 * RBAC middleware: verifies that the authenticated user has one of the allowed roles.
 * Supports: 'PROPRIETAIRE', 'GERANT', 'LOCATAIRE', 'SUPER_ADMIN' (case-insensitive)
 * Superadmin always bypasses restrictions.
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = (req.dbUser?.role || 'PROPRIETAIRE').toUpperCase();
    const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());

    if (userRole === 'SUPER_ADMIN' || normalizedAllowed.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      error: `Accès non autorisé pour le rôle [${userRole}]. Rôles requis : [${allowedRoles.join(', ')}]`,
    });
  };
};

/**
 * Middleware vérifiant si un Gérant Adjoint possède une permission spécifique.
 * Les propriétaires et les superadmins disposent toujours de l'accès complet.
 */
export const requireGerantPermission = (permissionKey: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Si ce n'est pas un gérant adjoint (ex: propriétaire bailleur ou superadmin), autoriser
    if (!req.dbUser?.isGerantAdjoint) {
      return next();
    }

    // Vérifier si le compte est actif
    if (req.dbUser.statutCompte === 'suspendu' || req.dbUser.statutCompte === 'inactif') {
      return res.status(403).json({
        error: 'Votre compte de gérant adjoint est temporairement désactivé ou suspendu.',
      });
    }

    const perms = req.dbUser.permissions || {};
    // Si la permission est explicitement désactivée à false
    if (perms[permissionKey] === false) {
      return res.status(403).json({
        error: `Permission refusée : Votre profil Gérant n'a pas accès à la fonctionnalité [${permissionKey}].`,
        permissionManquante: permissionKey,
      });
    }

    return next();
  };
};

