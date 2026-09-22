import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Mail, Send } from 'lucide-react';
import { authClient } from '../lib/auth-client';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (result.error) {
        setError(result.error.message || 'Impossible d’envoyer le lien de réinitialisation.');
        return;
      }
      // Keep the same response for existing and unknown addresses.
      setSent(true);
    } catch {
      setError('Impossible d’envoyer le lien de réinitialisation. Réessaie dans quelques instants.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl border border-slate-100">
        <button type="button" onClick={() => window.location.assign('/')} className="mb-6 flex items-center gap-2 text-sm text-indigo-600 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Retour à la connexion
        </button>
        {sent ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h1 className="text-xl font-bold text-slate-900">Vérifie ta boîte e-mail</h1>
            <p className="text-sm text-slate-600">Si cette adresse correspond à un compte, un lien de réinitialisation vient d’être envoyé.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Mot de passe oublié ?</h1>
              <p className="mt-2 text-sm text-slate-600">Entre ton adresse e-mail : nous t’enverrons un lien valable une heure.</p>
            </div>
            <label className="block text-sm font-medium text-slate-700">
              Adresse e-mail
              <span className="relative mt-1 block">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100" placeholder="nom@domaine.com" />
              </span>
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              <Send className="h-4 w-4" /> {loading ? 'Envoi en cours…' : 'Envoyer le lien'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
};
