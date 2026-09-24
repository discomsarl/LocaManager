import { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.ts';
import { prisma } from '../db/index.ts';
import { getOrCreateUser } from '../db/users.ts';

const sessionRequests = new Map<string, Promise<any>>();

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
    name?: string;
    [key: string]: any;
  };
  dbUser?: any;
  session?: any;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Helper to attach database user record
  const populateDbUser = async (uid: string) => {
    try {
      let user = await prisma.user.findUnique({
        where: { uid },
      });

      // Synchronisation automatique si le compte existe dans Better Auth mais pas encore dans users
      if (!user) {
        const authUser = await prisma.authUser.findUnique({
          where: { id: uid },
        });
        if (authUser) {
          user = await getOrCreateUser(authUser.id, authUser.email, authUser.name);
        }
      }

      if (user) {
        req.dbUser = user;
        return;
      }

      // Si introuvable dans users, vérifier dans gerants_adjoints
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

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1].trim() : null;

  // Contournement développement opt-in (uniquement si ENABLE_DEV_AUTH est actif)
  const developmentAuthEnabled = process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_AUTH === 'true';
  if (developmentAuthEnabled && token && (token.startsWith('dev_') || token.startsWith('demo_') || token.startsWith('user_'))) {
    const uid = token.replace(/^(dev_|demo_)/, '');
    req.user = {
      uid,
      email: token.includes('@') ? token : `${uid}@discom.africa`,
      name: `Dev User (${uid})`,
      auth_time: Math.floor(Date.now() / 1000),
      sub: uid,
    };
    await populateDbUser(uid);
    return next();
  }

  // Vérification de session Better Auth (supporte session cookie HTTP-only et Bearer token)
  try {
    const sessionToken = token;
    let sessionPromise = sessionToken ? sessionRequests.get(sessionToken) : undefined;
    if (!sessionPromise) {
      sessionPromise = auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (sessionToken) {
        sessionRequests.set(sessionToken, sessionPromise);
        sessionPromise.finally(() => sessionRequests.delete(sessionToken)).catch(() => undefined);
      }
    }
    const session = await sessionPromise;

    if (session && session.user) {
      const uid = session.user.id;
      req.user = {
        uid,
        email: session.user.email,
        name: session.user.name,
        sub: uid,
      };
      req.session = session.session;
      await populateDbUser(uid);
      return next();
    }
  } catch (error: any) {
    console.warn('Better Auth session verification failed:', error?.message || error);
  }

  return res.status(401).json({ error: 'Unauthorized: Session invalide ou expirée' });
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
