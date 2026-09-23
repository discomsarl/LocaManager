import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { authClient } from '../lib/auth-client';

export const VerifyEmail: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Vérification de votre adresse e-mail...');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setStatus('error');
      setMessage('Ce lien de vérification est invalide ou incomplet.');
      return;
    }

    authClient.verifyEmail({
      query: {
        token,
        callbackURL: `${window.location.origin}/`,
      },
    }).then((result) => {
      if (result.error) {
        setStatus('error');
        setMessage(result.error.message || 'Ce lien est invalide ou a expiré.');
        return;
      }

      setStatus('success');
      setMessage('Votre adresse e-mail est confirmée. Vous pouvez maintenant vous connecter.');
    }).catch(() => {
      setStatus('error');
      setMessage('Impossible de confirmer cette adresse e-mail.');
    });
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl border border-slate-100 text-center">
        {status === 'loading' && <Loader2 className="mx-auto h-12 w-12 animate-spin text-indigo-600" />}
        {status === 'success' && <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />}
        {status === 'error' && <XCircle className="mx-auto h-12 w-12 text-red-500" />}
        <h1 className="mt-4 text-xl font-bold text-slate-900">{status === 'success' ? 'E-mail confirmé' : 'Confirmation d’e-mail'}</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        {status !== 'loading' && (
          <button type="button" onClick={() => window.location.assign('/')} className="mt-6 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">
            Retour à la connexion
          </button>
        )}
      </section>
    </main>
  );
};