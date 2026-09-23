import React, { useState } from 'react';
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { createSuperAdminAccount } from '../lib/api';
import { PasswordInput } from '../components/PasswordInput';

export const SuperAdminSetup: React.FC = () => {
  const [form, setForm] = useState({ name: 'DISCOM Administration', email: '', password: '', confirmPassword: '' });
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('idle');
    setMessage('');

    if (form.password !== form.confirmPassword) {
      setStatus('error');
      setMessage('Les mots de passe ne correspondent pas.');
      return;
    }
    if (form.password.length < 8 || !/[A-Z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      setStatus('error');
      setMessage('Le mot de passe doit contenir 8 caractères, une majuscule et un chiffre.');
      return;
    }
    setLoading(true);
    try {
      const result = await createSuperAdminAccount({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      setStatus('success');
      setMessage(result.message);
    } catch (error: any) {
      setStatus('error');
      setMessage(error?.message || 'Impossible de créer le compte SuperAdmin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <section className="w-full max-w-lg rounded-2xl bg-white p-7 shadow-2xl border border-slate-200">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-indigo-100 p-3 text-indigo-700"><ShieldCheck className="h-6 w-6" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Initialisation SuperAdmin DISCOM</h1>
            <p className="mt-1 text-sm text-slate-600">Cette page recrée le compte racine après une réinitialisation complète de la base.</p>
          </div>
        </div>

        {status !== 'idle' && (
          <div className={`mt-5 rounded-xl border p-3 text-sm flex items-start gap-2 ${status === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {status === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
            <span>{message}</span>
          </div>
        )}

        {status !== 'success' && (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-700">Nom de l’administration
              <input value={form.name} onChange={(event) => update('name', event.target.value)} required minLength={2} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-600" />
            </label>
            <label className="block text-sm font-medium text-slate-700">E-mail SuperAdmin
              <input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} required autoComplete="email" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-600" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">Mot de passe
                <PasswordInput value={form.password} onChange={(event) => update('password', event.target.value)} required minLength={8} autoComplete="new-password" className="mt-1 rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-600" />
              </label>
              <label className="block text-sm font-medium text-slate-700">Confirmation
                <PasswordInput value={form.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} required minLength={8} autoComplete="new-password" className="mt-1 rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-600" />
              </label>
            </div>
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {loading ? 'Création en cours...' : 'Créer le compte SuperAdmin'}
            </button>
          </form>
        )}

        {status === 'success' && <button type="button" onClick={() => window.location.assign('/')} className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white">Retour à la connexion</button>}
        <p className="mt-5 text-center text-xs text-slate-500">L’endpoint refuse toute nouvelle création dès qu’un SuperAdmin existe.</p>
      </section>
    </main>
  );
};
