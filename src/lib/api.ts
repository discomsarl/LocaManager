// Client API pour communiquer avec le Backend Express & Prisma PostgreSQL

import { authClient } from './auth-client';

let currentAuthToken: string | null = null;

export const setApiAuthToken = (token: string | null) => {
  currentAuthToken = token;
};

const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const getApiAuthToken = async (): Promise<string | null> => {
  try {
    const session = await authClient.getSession({ query: {} });
    if (session?.data?.session?.token) {
      return session.data.session.token;
    }
  } catch (err) {
    // Better Auth session token fallback
  }

  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_AUTH === 'true') {
    return currentAuthToken;
  }

  return currentAuthToken;
};

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getApiAuthToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (!headers.has('Authorization') && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${apiBaseUrl}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Erreur API: ${response.statusText}`);
  }
  return data;
}

// -------------------------------------------------------------
// AUTH & SYNC
// -------------------------------------------------------------
export async function syncUserProfile(nom?: string) {
  try {
    return await apiFetch<{ success: boolean; user: any }>('/api/auth/sync', {
      method: 'POST',
      body: JSON.stringify({ nom }),
    });
  } catch (err) {
    console.warn('API syncUserProfile notice:', err);
    return null;
  }
}

export async function getCurrentUserProfile() {
  try {
    return await apiFetch<{ success: boolean; user: any }>('/api/auth/me');
  } catch (err) {
    console.warn('API getCurrentUserProfile notice:', err);
    return null;
  }
}

export async function changePasswordApi(data: { currentPassword: string; newPassword: string; confirmPassword: string }) {
  return apiFetch<{ success: boolean }>('/api/user/security/password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function requestEmailChangeApi(data: { currentPassword: string; newEmail: string }) {
  return apiFetch<{ success: boolean; message: string }>('/api/user/security/email', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateUserProfileApi(data: Record<string, unknown>) {
  return apiFetch<{ success: boolean; user: any }>('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function confirmEmailChangeApi(token: string) {
  return apiFetch<{ success: boolean }>('/api/user/security/email/confirm', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

// -------------------------------------------------------------
// BIENS & LOGEMENTS (PROPERTIES)
// -------------------------------------------------------------
export async function fetchBiensAndLogements() {
  try {
    const res = await apiFetch<{ success: boolean; biens: any[]; logements: any[] }>('/api/biens');
    return res;
  } catch (err) {
    console.error('API fetchBiensAndLogements failed:', err);
    return { success: false, biens: [], logements: [] };
  }
}

export async function createBienApi(data: {
  nom: string;
  type: string;
  adresse: string;
  ville: string;
  nombreEtages?: number;
  description?: string;
}) {
  return await apiFetch<{ success: boolean; bien: any }>('/api/biens', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateBienApi(bienId: number | string, data: any) {
  return await apiFetch<{ success: boolean; bien: any }>(`/api/biens/${bienId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteBienApi(bienId: number | string) {
  return await apiFetch<{ success: boolean; id: number }>(`/api/biens/${bienId}`, {
    method: 'DELETE',
  });
}

export async function fetchPropertyStatsApi() {
  try {
    return await apiFetch<{ success: boolean; stats: any }>('/api/biens/stats');
  } catch (err) {
    console.error('API fetchPropertyStatsApi failed:', err);
    return null;
  }
}

export async function createLogementApi(bienId: number | string, data: {
  numero: string;
  nom: string;
  type: string;
  nombrePieces: number;
  etage: number;
  superficie: number;
  loyerReference: number;
  chargesIncluses: number;
  statut?: string;
  description?: string;
}) {
  return await apiFetch<{ success: boolean; logement: any }>(`/api/biens/${bienId}/logements`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateLogementApi(logementId: number | string, data: any) {
  return await apiFetch<{ success: boolean; logement: any }>(`/api/biens/logements/${logementId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteLogementApi(logementId: number | string) {
  return await apiFetch<{ success: boolean; id: number }>(`/api/biens/logements/${logementId}`, {
    method: 'DELETE',
  });
}

export async function seedPropertiesApi(nom?: string) {
  try {
    return await apiFetch<{ success: boolean; seeded: boolean; biens: any[]; logements: any[] }>('/api/biens/seed', {
      method: 'POST',
      body: JSON.stringify({ nom }),
    });
  } catch (err) {
    console.error('API seedPropertiesApi failed:', err);
    return null;
  }
}

// -------------------------------------------------------------
// LOCATAIRES (TENANTS)
// -------------------------------------------------------------
export async function fetchLocataires() {
  try {
    const res = await apiFetch<{ success: boolean; locataires: any[] }>('/api/locataires');
    return res.locataires || [];
  } catch (err) {
    console.error('API fetchLocataires failed:', err);
    return [];
  }
}

export async function createLocataireApi(data: {
  nom: string;
  telephone: string;
  email?: string;
  cni?: string;
  profession?: string;
  contactGarant?: string;
  password: string;
}) {
  return await apiFetch<{ success: boolean; locataire: any }>('/api/locataires', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateLocataireApi(locataireId: number | string, data: any) {
  return await apiFetch<{ success: boolean; locataire: any }>(`/api/locataires/${locataireId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteLocataireApi(locataireId: number | string) {
  return await apiFetch<{ success: boolean; id: number }>(`/api/locataires/${locataireId}`, {
    method: 'DELETE',
  });
}

// -------------------------------------------------------------
// BAUX (LEASES)
// -------------------------------------------------------------
export async function fetchBaux() {
  try {
    const res = await apiFetch<{ success: boolean; baux: any[] }>('/api/baux');
    return res.baux || [];
  } catch (err) {
    console.error('API fetchBaux failed:', err);
    return [];
  }
}

export async function createBailApi(data: {
  locataireId: number | string;
  logementId: number | string;
  loyerMensuel: number;
  chargesMensuelles?: number;
  depotGarantie?: number;
  dateDebut: string;
  dateFin?: string;
}) {
  return await apiFetch<{ success: boolean; bail: any }>('/api/baux', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateBailApi(bailId: number | string, data: any) {
  return await apiFetch<{ success: boolean; bail: any }>(`/api/baux/${bailId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function resilierBailApi(bailId: number | string) {
  return await apiFetch<{ success: boolean; bail: any }>(`/api/baux/${bailId}/resilier`, {
    method: 'PATCH',
  });
}

export async function deleteBailApi(bailId: number | string) {
  return await apiFetch<{ success: boolean; id: number }>(`/api/baux/${bailId}`, {
    method: 'DELETE',
  });
}

// -------------------------------------------------------------
// PAIEMENTS & QUITTANCES (PAYMENTS)
// -------------------------------------------------------------
export async function fetchPaiements() {
  try {
    const res = await apiFetch<{ success: boolean; paiements: any[] }>('/api/paiements');
    return res.paiements || [];
  } catch (err) {
    console.error('API fetchPaiements failed:', err);
    return [];
  }
}

export async function createPaiementApi(data: {
  bailId: number | string;
  locataireId: number | string;
  montant: number;
  moisConcerne: string;
  modePaiement: string;
  datePaiement: string;
  reference?: string;
}) {
  return await apiFetch<{ success: boolean; paiement: any }>('/api/paiements', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePaiementApi(paiementId: number | string, data: any) {
  return await apiFetch<{ success: boolean; paiement: any }>(`/api/paiements/${paiementId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deletePaiementApi(paiementId: number | string) {
  return await apiFetch<{ success: boolean; id: number }>(`/api/paiements/${paiementId}`, {
    method: 'DELETE',
  });
}

// -------------------------------------------------------------
// PLANS D'ABONNEMENT
// -------------------------------------------------------------
export async function fetchSubscriptionPlansApi() {
  try {
    const res = await apiFetch<{ success: boolean; plans: any[] }>('/api/subscription/plans');
    return res.plans || [];
  } catch (err) {
    console.error('API fetchSubscriptionPlansApi failed:', err);
    return [];
  }
}

// -------------------------------------------------------------
// GÉRANTS ADJOINTS & PERMISSIONS MODULAIRES
// -------------------------------------------------------------
export async function fetchGerantsApi() {
  try {
    const res = await apiFetch<{ success: boolean; gerants: any[]; count: number }>('/api/gerants');
    return res.gerants || [];
  } catch (err) {
    console.error('API fetchGerantsApi failed:', err);
    return [];
  }
}

export async function createGerantApi(data: {
  name: string;
  email: string;
  phonenumber: string;
  password?: string;
  permissions?: any;
}) {
  return await apiFetch<{ success: boolean; gerant: any; message?: string }>('/api/gerants', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateGerantApi(id: string | number, data: {
  name?: string;
  email?: string;
  phonenumber?: string;
  password?: string;
  statut_compte?: string;
  statutCompte?: string;
  permissions?: any;
}) {
  return await apiFetch<{ success: boolean; gerant: any; message?: string }>(`/api/gerants/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ id, ...data }),
  });
}

export async function deleteGerantApi(id: string | number) {
  return await apiFetch<{ success: boolean; id: string; name?: string; message?: string }>(`/api/gerants/${id}`, {
    method: 'DELETE',
  });
}

export async function toggleGerantStatutApi(id: string | number, statut: 'actif' | 'inactif' | 'suspendu') {
  return await apiFetch<{ success: boolean; gerant: any; message?: string }>(`/api/gerants/${id}/statut`, {
    method: 'PATCH',
    body: JSON.stringify({ statut }),
  });
}

export async function updateGerantPermissionsApi(id: string | number, permissions: any) {
  return await apiFetch<{ success: boolean; permissions: any; message?: string }>(`/api/gerants/${id}/permissions`, {
    method: 'PATCH',
    body: JSON.stringify({ permissions }),
  });
}

export async function fetchActivitesGerantApi(gerantId?: string, limit: number = 50) {
  try {
    const query = new URLSearchParams();
    if (gerantId) query.set('gerant_id', gerantId);
    if (limit) query.set('limit', String(limit));
    const res = await apiFetch<{ success: boolean; activites: any[] }>(`/api/gerants/activites?${query.toString()}`);
    return res.activites || [];
  } catch (err) {
    console.error('API fetchActivitesGerantApi failed:', err);
    return [];
  }
}

export async function logActiviteGerantApi(data: {
  gerant_id?: string;
  gerant_nom?: string;
  action_type: string;
  titre: string;
  description: string;
  montant_fcfa?: number;
  quittance_numero?: string;
  reference?: string;
  locataire_nom?: string;
  logement_nom?: string;
  statut?: 'succes' | 'alerte' | 'info';
}) {
  try {
    return await apiFetch<{ success: boolean; activite: any }>('/api/gerants/activites', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.warn('API logActiviteGerantApi notice:', err);
    return null;
  }
}

// -------------------------------------------------------------
// VÉRIFICATION PUBLIQUE DES QUITTANCES & QR CODE
// -------------------------------------------------------------
export interface QuittanceVerificationResult {
  success: boolean;
  valid: boolean;
  statut: string;
  message?: string;
  quittance?: {
    id: number;
    reference: string;
    numero_quittance: string;
    mois_concerne: string;
    montant_paye_fcfa: number;
    date_paiement: string;
    date_enregistrement: string;
    mode_paiement: string;
    statut_paiement: string;
  };
  parties?: {
    bailleur: {
      nom: string;
      entreprise: string;
      contact: string;
      email_masque: string;
      pays: string;
    };
    locataire: {
      nom_complet: string;
      telephone_masque: string;
      cni_masquee: string;
    };
  };
  bien_immobilier?: {
    nom_bien: string;
    adresse: string;
    ville: string;
    logement_nom: string;
    logement_type: string;
    superficie: number;
  };
  securite_ohada?: {
    certifie_par: string;
    empreinte_securisee: string;
    conforme_ohada: boolean;
    registre: string;
    date_verification: string;
  };
}

export async function verifyQuittanceApi(code: string): Promise<QuittanceVerificationResult> {
  try {
    const encoded = encodeURIComponent(code.trim());
    return await apiFetch<QuittanceVerificationResult>(`/api/verify-quittance/${encoded}`);
  } catch (error: any) {
    return {
      success: false,
      valid: false,
      statut: 'ERREUR_COMMUNICATION',
      message: error?.message || 'Impossible de joindre le service de vérification.',
    };
  }
}

export async function getQuittanceQrDataUrl(code: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(code.trim());
    const res = await apiFetch<{ success: boolean; dataUrl: string }>(`/api/verify-quittance/${encoded}/qr?format=json`);
    return res.dataUrl || null;
  } catch (error) {
    console.warn('QR Code generation fallback:', error);
    return null;
  }
}
