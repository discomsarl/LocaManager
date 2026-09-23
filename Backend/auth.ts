import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer } from 'better-auth/plugins';
import { Resend } from 'resend';
import { prisma } from './db/index.ts';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const resendFrom = process.env.RESEND_FROM_EMAIL || 'LocaManager <onboarding@resend.dev>';

export async function sendPasswordChangeNotification(to: string) {
  if (!resend) {
    console.error('RESEND_API_KEY est absente : e-mail de sécurité non envoyé.');
    return;
  }

  const { error } = await resend.emails.send({
    from: resendFrom,
    to: [to],
    subject: 'Votre mot de passe LocaManager a été modifié',
    html: `<div style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.5"><p>Votre mot de passe a bien été modifié. Si vous n'êtes pas à l'origine de cette action, contactez immédiatement le support.</p></div>`,
  });
  if (error) throw error;
}

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
    minPasswordLength: 8,
    requireEmailVerification: true,
    autoSignIn: false,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    onPasswordReset: async ({ user }) => {
      try {
        await sendPasswordChangeNotification(user.email);
      } catch (error) {
        console.error('E-mail de notification de réinitialisation non envoyé:', error);
      }
    },
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
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      if (!resend) {
        console.error('RESEND_API_KEY est absente : e-mail de vérification non envoyé.');
        return;
      }

      const { error } = await resend.emails.send({
        from: resendFrom,
        to: [user.email],
        subject: 'Confirmez votre adresse e-mail LocaManager',
        html: `
          <div style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.5">
            <h1 style="font-size:20px">Confirmez votre adresse e-mail</h1>
            <p>Bonjour ${user.name},</p>
            <p>Confirmez votre adresse pour activer votre compte LocaManager.</p>
            <p><a href="${url}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Confirmer mon adresse</a></p>
            <p>Ce lien est valable 24 heures.</p>
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
    ...(process.env.TRUSTED_ORIGINS ? process.env.TRUSTED_ORIGINS.split(',') : []),
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://192.168.1.164:3000',
    'http://192.168.1.164:3001',
  ],
  advanced: {
    database: {
      validateSchema: false,
    },
  },
});

export type Auth = typeof auth;