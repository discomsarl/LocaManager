import { Router, Response } from 'express';
import { z } from 'zod';
import { auth, emailVerificationCallbackUrl } from '../auth.ts';
import { prisma } from '../db/index.ts';
import { getOrCreateUser } from '../db/users.ts';

const router = Router();
const setupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
});

router.post('/', async (req, res: Response) => {
  const parsed = setupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Informations de création invalides.',
      details: parsed.error.issues.map((issue) => issue.message),
    });
  }

  const { name, email, password } = parsed.data;
  const existingSuperAdmin = await prisma.user.count({ where: { role: 'SUPER_ADMIN' } });
  if (existingSuperAdmin > 0) {
    return res.status(409).json({ error: 'Un compte SuperAdmin existe déjà. Cette page est réservée à la réinitialisation.' });
  }

  try {
    const authResult = await auth.api.signUpEmail({
      body: { name, email, password, callbackURL: emailVerificationCallbackUrl },
    });
    if (!authResult.user) {
      return res.status(400).json({ error: 'Impossible de créer le compte d’authentification.' });
    }

    await getOrCreateUser(authResult.user.id, email, name, 'SUPER_ADMIN');
    return res.status(201).json({
      success: true,
      requiresEmailVerification: !authResult.user.emailVerified,
      message: authResult.user.emailVerified
        ? 'Compte SuperAdmin créé. Vous pouvez vous connecter.'
        : 'Compte créé. Consultez votre boîte e-mail pour confirmer le compte avant de vous connecter.',
    });
  } catch (error: any) {
    console.error('SuperAdmin bootstrap failed:', error);
    return res.status(400).json({ error: 'Impossible de créer le compte SuperAdmin. Vérifiez les informations fournies.' });
  }
});

export default router;
