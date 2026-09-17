import { Router } from 'express';
import { prisma } from '../db/index.ts';

const router = Router();

// Get subscription plans via Prisma
router.get('/plans', async (req, res) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany();
    res.json({ success: true, plans });
  } catch (err: any) {
    console.error('Failed to get subscription plans via Prisma:', err);
    res.status(500).json({ success: false, error: err.message || 'Erreur plans' });
  }
});

export default router;
