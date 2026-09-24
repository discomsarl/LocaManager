import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { confirmEmailChangeApi } from '../lib/api';

export const ConfirmEmail: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setStatus('error');
      return;
    }
    confirmEmailChangeApi(token).then(() => setStatus('success')).catch(() => setStatus('error'));
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-xl border border-slate-100">
        {status === 'loading' && <p className="text-sm text-slate-600">Confirmation en cours...</p>}
        {status === 'success' && <><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" /><h1 className="mt-4 text-xl font-bold text-slate-900">Adresse e-mail confirmée</h1><p className="mt-2 text-sm text-slate-600">Votre nouvelle adresse est maintenant active.</p></>}
        {status === 'error' && <><XCircle className="mx-auto h-12 w-12 text-red-500" /><h1 className="mt-4 text-xl font-bold text-slate-900">Lien invalide ou expiré</h1><p className="mt-2 text-sm text-slate-600">Demandez un nouveau lien depuis vos paramètres.</p></>}
      </section>
    </main>
  );
};