import { cert, initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const hasFirebaseAdminCredentials = Boolean(
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
);

if (process.env.NODE_ENV === 'production' && !hasFirebaseAdminCredentials) {
  throw new Error('Firebase Admin credentials are required in production.');
}

if (!getApps().length) {
  const firebaseOptions = hasFirebaseAdminCredentials
    ? {
        projectId: process.env.FIREBASE_PROJECT_ID,
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        }),
      }
    : { projectId: process.env.FIREBASE_PROJECT_ID };

  initializeApp(firebaseOptions);
}

export const adminAuth = getAuth();
