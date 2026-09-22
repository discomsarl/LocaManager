import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer } from 'better-auth/plugins';
import { Resend } from 'resend';
import { prisma } from './db/index.ts';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const resendFrom = process.env.RESEND_FROM_EMAIL || 'LocaManager <onboarding@resend.dev>';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',
  user: {
    modelName: 'authUser',
  },
  session: {
    modelName: 'session',
    expiresIn: 60 * 60 * 24 * 30, // 30 jours
    updateAge: 60 * 60 * 24, // 1 jour
  },
  account: {
    modelName: 'account',
  },
  verification: {
    modelName: 'verification',
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    requireEmailVerification: false,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      if (!resend) {
        console.error('RESEND_API_KEY est absente : e-mail de réinitialisation non envoyé.');
        return;
      }

      const { error } = await resend.emails.send({
        from: resendFrom,
        to: [user.email],
        subject: 'Réinitialisez votre mot de passe LocaManager',
        html: `
          <div style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.5">
            <h1 style="font-size:20px">Réinitialisation de votre mot de passe</h1>
            <p>Bonjour,</p>
            <p>Une demande de réinitialisation a été reçue pour votre compte LocaManager.</p>
            <p><a href="${url}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Choisir un nouveau mot de passe</a></p>
            <p>Ce lien expire dans une heure. Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet e-mail.</p>
          </div>`,
      });
      if (error) throw error;
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
  },
  plugins: [
    bearer(),
  ],
  trustedOrigins: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ],
  advanced: {
    database: {
      validateSchema: false,
    },
  },
});

export type Auth = typeof auth;
