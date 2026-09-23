import React, { useState } from 'react';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { authClient } from '../lib/auth-client';
import { PasswordInput } from '../components/PasswordInput';

export const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const token = new URLSearchParams(window.location.search).get('token');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!token) return setError('Ce lien est invalide ou a expiré. Demande un nouveau lien.');
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) return setError('Le mot de passe doit contenir 8 caractères, une majuscule et un chiffre.');
    if (password !== confirmation) return setError('Les deux mots de passe ne correspondent pas.');

    setLoading(true);
    try {
      const result = await authClient.resetPassword({ token, newPassword: password });
      if (result.error) {
        setError(result.error.message || 'Ce lien est invalide ou a expiré.');
        return;
      }
      setCompleted(true);
    } catch {
      setError('Impossible de réinitialiser le mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl border border-slate-100">
        {completed ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h1 className="text-xl font-bold text-slate-900">Mot de passe modifié</h1>
            <p className="text-sm text-slate-600">Tes autres sessions ont été fermées par sécurité.</p>
            <button type="button" onClick={() => window.location.assign('/')} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">Se connecter</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <KeyRound className="mb-3 h-8 w-8 text-indigo-600" />
              <h1 className="text-xl font-bold text-slate-900">Nouveau mot de passe</h1>
              <p className="mt-2 text-sm text-slate-600">Choisis un mot de passe de 8 caractères avec une majuscule et un chiffre.</p>
            </div>
            <PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" placeholder="Nouveau mot de passe" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100" />
            <PasswordInput value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} autoComplete="new-password" placeholder="Confirmer le mot de passe" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading || !token} className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{loading ? 'Mise à jour…' : 'Enregistrer le mot de passe'}</button>
          </form>
        )}
      </section>
    </main>
  );
};
