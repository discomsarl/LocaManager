import express from 'express';
import 'dotenv/config';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.ts';

// Routes
import authRouter, { handleSyncUser, handleGetCurrentUser, handleUpdateProfile, profileUpdateSchema } from './routes/auth.ts';
import propertyRouter from './routes/properties.ts';
import subscriptionRouter from './routes/subscriptions.ts';
import locatairesRouter from './routes/locataires.ts';
import bauxRouter from './routes/baux.ts';
import paiementsRouter from './routes/paiements.ts';
import gerantsRouter from './routes/gerants.ts';
import verifyQuittanceRouter from './routes/verifyQuittance.ts';
import superadminSetupRouter from './routes/superadminSetup.ts';
import { requireAuth } from './middleware/auth.ts';
import { validateBody } from './middleware/validate.ts';

export function createApp() {
  const app = express();
  const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || '';
  const allowedOrigins = new Set(
    [frontendUrl, process.env.APP_URL, process.env.TRUSTED_ORIGINS?.split(',').filter(Boolean)].flat().filter(Boolean)
  );

  // CORS Middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Health Check
  app.get('/api/health', async (req, res) => {
    res.json({
      status: 'ok',
      service: 'DISCOM SaaS Backend',
      auth: 'Better Auth (TypeScript & PostgreSQL Session/Bearer)',
      orm: 'Prisma ORM (Next-Gen for Node.js & TypeScript)',
      database: 'PostgreSQL (Cloud SQL)',
      directory: 'Backend',
      endpoints: [
        '/api/auth',
        '/api/biens',
        '/api/locataires',
        '/api/baux',
        '/api/paiements',
        '/api/gerants',
        '/api/gerants-adjoints',
        '/api/subscription',
        '/api/verify-quittance',
      ],
    });
  });

  // Custom User Profile Endpoints (mounted before Better Auth catch-all)
  app.post('/api/auth/sync', express.json(), requireAuth, handleSyncUser);
  app.get('/api/auth/me', requireAuth, handleGetCurrentUser);
  app.put('/api/auth/profile', express.json(), requireAuth, validateBody(profileUpdateSchema), handleUpdateProfile);

  // One-time SuperAdmin bootstrap, available only while no SuperAdmin exists.
  app.use('/api/setup/superadmin', express.json(), superadminSetupRouter);

  // Mount Better Auth handler for all /api/auth/* routes (sign-in, sign-up, sign-out, session, etc.)
  // Express 5 wildcard syntax: *all
  app.all('/api/auth/*all', toNodeHandler(auth));

  // Global JSON body parser for all subsequent application API routes
  app.use(express.json());

  // API Routes
  app.use('/api/user', authRouter);
  app.use('/api/biens', propertyRouter);
  app.use('/api/locataires', locatairesRouter);
  app.use('/api/baux', bauxRouter);
  app.use('/api/paiements', paiementsRouter);
  app.use('/api/gerants', gerantsRouter);
  app.use('/api/gerants-adjoints', gerantsRouter);
  app.use('/api/subscription', subscriptionRouter);
  app.use('/api/verify-quittance', verifyQuittanceRouter);

  return app;
}

const app = createApp();

// Démarrage manuel uniquement hors Vercel (développement local ou serveur Node standalone)
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT || 3001);
  
  if (process.env.NODE_ENV !== 'production') {
    createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    }).then((vite) => {
      app.use(vite.middlewares);
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`[DISCOM SaaS Backend Dev] Serveur démarré sur http://0.0.0.0:${PORT}`);
      });
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[DISCOM SaaS Backend Prod] Serveur démarré sur http://0.0.0.0:${PORT}`);
    });
  }
}

// Requis par Vercel pour exécuter Express sous forme de Serverless Function
export default app;