import express from 'express';
import 'dotenv/config';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.ts';

// Routes
import authRouter, { handleSyncUser, handleGetCurrentUser, handleUpdateProfile } from './routes/auth.ts';
import propertyRouter from './routes/properties.ts';
import subscriptionRouter from './routes/subscriptions.ts';
import locatairesRouter from './routes/locataires.ts';
import bauxRouter from './routes/baux.ts';
import paiementsRouter from './routes/paiements.ts';
import gerantsRouter from './routes/gerants.ts';
import verifyQuittanceRouter from './routes/verifyQuittance.ts';
import { requireAuth } from './middleware/auth.ts';

export async function startBackendServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3001);
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const allowedOrigins = new Set([frontendUrl, 'http://localhost:3000']);

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
  app.put('/api/auth/profile', express.json(), requireAuth, handleUpdateProfile);

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

  // Vite middleware for development & static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express 5 wildcard routing
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DISCOM SaaS Backend] Serveur démarré sur http://0.0.0.0:${PORT}`);
  });
}

// Auto-start when executed directly
startBackendServer();
