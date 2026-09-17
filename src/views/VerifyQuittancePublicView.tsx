import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Building, 
  Calendar, 
  CreditCard, 
  User, 
  Lock, 
  Search, 
  ArrowLeft, 
  Download, 
  ExternalLink,
  QrCode,
  Sparkles,
  Info
} from 'lucide-react';
import { verifyQuittanceApi, QuittanceVerificationResult } from '../lib/api.ts';
import { formatFCFA, formatDateFR, formatMonthYear } from '../utils/formatters';

interface VerifyQuittancePublicViewProps {
  initialCode?: string;
  onBackToApp?: () => void;
}

export const VerifyQuittancePublicView: React.FC<VerifyQuittancePublicViewProps> = ({
  initialCode = '',
  onBackToApp,
}) => {
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuittanceVerificationResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const performVerification = async (searchCode: string) => {
    if (!searchCode.trim()) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const data = await verifyQuittanceApi(searchCode);
      setResult(data);
    } catch (err) {
      setResult({
        success: false,
        valid: false,
        statut: 'ERREUR_COMMUNICATION',
        message: 'Erreur lors de la vérification du document auprès du serveur sécurisé.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      performVerification(initialCode);
    }
  }, [initialCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performVerification(code);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 sm:px-8 py-4 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-black shadow-lg shadow-emerald-950/40">
              DIS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">LocaManager DISCOM</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  PORTAIL PUBLIC
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Authentification officielle & conformité foncière OHADA Cameroun</p>
            </div>
          </div>

          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Accéder à l'application</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Service d'Authenticité Numérique Anti-Fraude</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Vérification Officielle de Quittance de Loyer
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Scannez le QR Code présent sur le ticket ou saisissez la référence unique ci-dessous pour certifier l'acquittement réel et l'authenticité du document auprès du registre numérique DISCOM.
          </p>
        </div>

        {/* Search / Verification Form */}
        <div className="max-w-xl mx-auto bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              Référence du ticket, N° de quittance ou code QR
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ex: QUIT-2026-..., TK-202603-... ou ID"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950/50 flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Vérification...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Vérifier</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>Format reconnu : Réf. Transaction ou N° Quittance</span>
              <span className="text-slate-500">Validation temps-réel</span>
            </div>
          </form>
        </div>

        {/* Verification Result Area */}
        {hasSearched && !loading && result && (
          <div className="space-y-6 max-w-2xl mx-auto animate-fadeIn">
            {result.valid ? (
              /* Success / Valid Document Card */
              <div className="bg-slate-950 border-2 border-emerald-500/60 rounded-2xl overflow-hidden shadow-2xl shadow-emerald-950/60">
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 px-6 py-4 border-b border-emerald-500/30 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                          DOCUMENT AUTHENTIQUE & ENRÔLÉ
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-400 text-slate-950">
                          VALIDE
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-mono mt-0.5">
                        Réf : {result.quittance?.reference}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xl sm:text-2xl font-black text-emerald-300">
                      {formatFCFA(result.quittance?.montant_paye_fcfa || 0)}
                    </span>
                    <p className="text-[10px] text-slate-400 uppercase">Montant encaissé & acquitté</p>
                  </div>
                </div>

                {/* Details Body */}
                <div className="p-6 space-y-5 text-xs text-slate-300">
                  {/* Grid 2 Columns: Parties */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Bailleur */}
                    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                      <div className="flex items-center gap-2 text-slate-400 font-bold uppercase text-[10px]">
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Bailleur Certifié</span>
                      </div>
                      <p className="text-sm font-bold text-white">{result.parties?.bailleur.nom}</p>
                      <p className="text-[11px] text-slate-400">{result.parties?.bailleur.entreprise}</p>
                      <p className="text-[11px] text-slate-400">Contact : {result.parties?.bailleur.contact}</p>
                      <p className="text-[11px] text-slate-500">Pays : {result.parties?.bailleur.pays}</p>
                    </div>

                    {/* Locataire */}
                    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                      <div className="flex items-center gap-2 text-slate-400 font-bold uppercase text-[10px]">
                        <User className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Locataire Titulaire</span>
                      </div>
                      <p className="text-sm font-bold text-white">{result.parties?.locataire.nom_complet}</p>
                      <p className="text-[11px] text-slate-400">Téléphone vérifié : {result.parties?.locataire.telephone_masque}</p>
                      <p className="text-[11px] text-slate-400">Pièce CNI : {result.parties?.locataire.cni_masquee}</p>
                      <span className="inline-block px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 text-[10px] font-semibold">
                        Identité vérifiée OHADA
                      </span>
                    </div>
                  </div>

                  {/* Property & Period */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5 mb-1">
                        <Building className="w-3.5 h-3.5 text-indigo-400" /> Bien & Logement
                      </span>
                      <p className="font-bold text-white">{result.bien_immobilier?.nom_bien}</p>
                      <p className="text-[11px] text-slate-400">{result.bien_immobilier?.logement_nom} ({result.bien_immobilier?.logement_type})</p>
                      <p className="text-[11px] text-slate-500">{result.bien_immobilier?.ville}, Cameroun</p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Période Couverte
                      </span>
                      <p className="font-bold text-white capitalize">
                        {formatMonthYear(result.quittance?.mois_concerne || '')}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Paiement reçu le : {formatDateFR(result.quittance?.date_paiement || '')}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Date d'enrôlement : {formatDateFR(result.quittance?.date_enregistrement || '')}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5 mb-1">
                        <CreditCard className="w-3.5 h-3.5 text-amber-400" /> Règlement
                      </span>
                      <p className="font-bold text-white uppercase">{result.quittance?.mode_paiement}</p>
                      <p className="text-[11px] text-emerald-400 font-semibold">Acquittement intégral</p>
                      <p className="text-[11px] text-slate-400">Statut : Validé</p>
                    </div>
                  </div>

                  {/* Cryptographic Security Seal */}
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-emerald-900/60 flex items-start gap-3">
                    <Lock className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-[11px]">Sceau d'Intégrité Numérique Anti-Altération</span>
                        <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-mono">OHADA-VERIFIED</span>
                      </div>
                      <p className="text-[10px] font-mono text-emerald-400/90 break-all">
                        {result.securite_ohada?.empreinte_securisee}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Certifié conforme par {result.securite_ohada?.certifie_par} le {formatDateFR(result.securite_ohada?.date_verification || '')}.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Invalid or Not Found Card */
              <div className="bg-slate-950 border-2 border-rose-500/50 rounded-2xl p-6 shadow-2xl text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
                  <XCircle className="w-8 h-8" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h3 className="text-base font-bold text-white">Quittance Introuvable ou Non Authentifiée</h3>
                  <p className="text-xs text-rose-300/90">
                    {result.message || "Le numéro de quittance ou la référence soumise n'est rattachée à aucun acquittement validé dans le registre officiel."}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 max-w-md mx-auto text-left flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p>
                    Si vous disposez d'un document papier, vérifiez l'exactitude de la référence ou contactez directement l'administrateur de l'immeuble ou le bailleur certifié DISCOM.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Feature Points on Public Security */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-800/80 text-xs text-slate-400">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/60">
            <QrCode className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-slate-200">QR Code Instantané</p>
              <p className="text-[11px] mt-0.5 leading-relaxed">Chaque reçu de loyer imprimé ou transmis par WhatsApp dispose d'un QR code infalsifiable.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/60">
            <Lock className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <p className="font-bold text-slate-200">Empreinte Cryptographique</p>
              <p className="text-[11px] mt-0.5 leading-relaxed">Garantie contre les falsifications de montants, de dates ou de titulaires de bail.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/60">
            <Building className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-bold text-slate-200">Conformité Foncier Cameroun</p>
              <p className="text-[11px] mt-0.5 leading-relaxed">Conforme aux règles de quittance libératoire du droit locatif OHADA au Cameroun.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-4 text-center text-[11px] text-slate-500 bg-slate-950/40">
        <p>
          Plateforme LocaManager DISCOM SARL Cameroun • Service Public de Vérification Numérique • Tous droits réservés 2026.
        </p>
      </footer>
    </div>
  );
};
