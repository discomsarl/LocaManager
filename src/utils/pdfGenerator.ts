import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Paiement, UserAccount, Logement, Piece, Locataire } from '../types';
import { formatFCFA, formatDateFR, formatMonthYear } from './formatters';

interface QuittancePDFOptions {
  paiement: Paiement;
  bailleur: UserAccount;
  locataire?: Locataire;
  logement?: Logement;
  pieces?: Piece[];
  qrDataUrl?: string;
  verificationUrl?: string;
}

export const downloadQuittancePDF = async ({
  paiement,
  bailleur,
  locataire,
  logement,
  pieces = [],
  qrDataUrl,
  verificationUrl
}: QuittancePDFOptions): Promise<boolean> => {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 16;

    // Header Background Accent Bar
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margin, y, pageWidth - (margin * 2), 22, 'F');

    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text((bailleur.entreprise || bailleur.name || 'DISCOM CAMEROUN').toUpperCase(), margin + 6, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Gestion Immobilière & Patrimoine Locatif Conforme OHADA', margin + 6, y + 14);
    doc.text(`Contact : ${bailleur.phonenumber || ''} | ${bailleur.email || ''}`, margin + 6, y + 18);

    // Header Right: Ticket / Quittance Number
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const quittanceNumStr = `TICKET N° ${paiement.quittance_numero || paiement.id}`;
    doc.text(quittanceNumStr, pageWidth - margin - 6, y + 10, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const dateStr = `Émis le : ${formatDateFR(paiement.date_paiement || paiement.date_creation)}`;
    doc.text(dateStr, pageWidth - margin - 6, y + 16, { align: 'right' });

    y += 28;

    // Document Title Banner
    const isMultiMois = paiement.type_paiement === 'multi_mois' || (paiement.nb_mois_regles && paiement.nb_mois_regles > 1);
    const isTranche = paiement.type_paiement === 'tranche';
    
    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.roundedRect(margin, y, pageWidth - (margin * 2), 14, 2, 2, 'FD');

    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const titleText = isTranche 
      ? "REÇU D'ACOMPTE - PAIEMENT DE LOYER EN TRANCHE" 
      : isMultiMois 
      ? "QUITTANCE DE LOYER MULTIPLE-MOIS (PAIEMENT GROUPÉ)" 
      : "QUITTANCE DE LOYER & REÇU D'ACQUITTEMENT DÉFINITIF";
    doc.text(titleText, pageWidth / 2, y + 7.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Délivrée en conformité avec le droit locatif et les règles de bail OHADA au Cameroun', pageWidth / 2, y + 11.5, { align: 'center' });

    y += 20;

    // Notice for tranche or multi-month payment
    if (isTranche || isMultiMois) {
      doc.setFillColor(238, 242, 255); // indigo-50
      doc.setDrawColor(199, 210, 254); // indigo-200
      doc.roundedRect(margin, y, pageWidth - (margin * 2), 12, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(67, 56, 202); // indigo-700
      
      if (isTranche) {
        const montantRecu = paiement.montant_recu;
        const montantAttendu = paiement.montant_attendu || montantRecu;
        const soldeRestant = paiement.tranche_solde_restant ?? (montantAttendu - montantRecu);
        const trancheText = `PAIEMENT EN TRANCHE (Tranche ${paiement.tranche_numero || 1}) : Acompte versé ${formatFCFA(montantRecu)} sur ${formatFCFA(montantAttendu)}. Reste à solder : ${formatFCFA(soldeRestant)}`;
        doc.text(trancheText, margin + 4, y + 7.5);
      } else {
        const nbMois = paiement.nb_mois_regles || (paiement.mois_soldes ? paiement.mois_soldes.length : 1);
        const multiText = `PAIEMENT GROUPÉ : Règlement groupé de ${nbMois} mois consécutifs. Période couverte : ${paiement.mois_soldes_labels || formatMonthYear(paiement.mois_concerne)}`;
        doc.text(multiText, margin + 4, y + 7.5);
      }
      y += 16;
    }

    // Two Columns for Details: Property & Tenant
    const colWidth = (pageWidth - (margin * 2) - 8) / 2;
    const colHeight = 36;

    // Left Column: Property & Units
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, colWidth, colHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('BIEN IMMOBILIER & LOGEMENT(S) LOUÉ(S)', margin + 4, y + 6);

    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(logement?.nom || 'Bien immobilier', margin + 4, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const unitsStr = pieces.length > 0 
      ? pieces.map(p => `${p.nom} (${p.type.toUpperCase()})`).join(' + ')
      : 'Logement principal';
    doc.text(`Unité(s) : ${unitsStr.substring(0, 38)}`, margin + 4, y + 18);
    doc.text(`Adresse : ${logement?.adresse || ''}, ${logement?.ville || 'Cameroun'}`, margin + 4, y + 24);
    doc.text(`Superficie estimée : ${pieces.reduce((sum, p) => sum + (p.superficie || 0), 0) || 50} m²`, margin + 4, y + 30);

    // Right Column: Tenant Details
    const rightColX = margin + colWidth + 8;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(rightColX, y, colWidth, colHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('LOCATAIRE DÉBITEUR & BÉNÉFICIAIRE', rightColX + 4, y + 6);

    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(locataire?.nom_complet || 'Locataire', rightColX + 4, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(`CNI / Passeport : ${locataire?.cni_passeport || 'N/A'}`, rightColX + 4, y + 18);
    doc.text(`Téléphone : ${locataire?.telephone_principal || 'N/A'}`, rightColX + 4, y + 24);
    doc.text(`Profession : ${locataire?.profession || 'Cadre'}`, rightColX + 4, y + 30);

    y += colHeight + 8;

    // Table Header for Financial Details
    const tableWidth = pageWidth - (margin * 2);
    doc.setFillColor(226, 232, 240); // slate-200
    doc.rect(margin, y, tableWidth, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text('DÉSIGNATION DES POSTES', margin + 4, y + 5.5);
    doc.text('PÉRIODE', margin + 70, y + 5.5);
    doc.text('ATTENDU (FCFA)', margin + 115, y + 5.5, { align: 'right' });
    doc.text('ENCAISSÉ (FCFA)', margin + tableWidth - 4, y + 5.5, { align: 'right' });

    y += 8;

    // Rows
    const drawRow = (label: string, periode: string, attendu: number, encaisse: number, isAlt = false) => {
      if (isAlt) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, tableWidth, 7.5, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(label, margin + 4, y + 5);
      doc.text(periode, margin + 70, y + 5);
      doc.text(formatFCFA(attendu), margin + 115, y + 5, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(formatFCFA(encaisse), margin + tableWidth - 4, y + 5, { align: 'right' });
      y += 7.5;
    };

    const isGrouped = paiement.type_paiement === 'multi_mois';
    const periodePrincipale = isGrouped 
      ? (paiement.mois_soldes_labels || formatMonthYear(paiement.mois_concerne))
      : formatMonthYear(paiement.mois_concerne);

    const nbMois = paiement.nb_mois_regles || (paiement.mois_soldes && paiement.mois_soldes.length > 0 ? paiement.mois_soldes.length : 1);
    const totalCharges = pieces.reduce((sum, p) => sum + (p.charges_incluses || 0), 0) * (isGrouped ? nbMois : 1);
    const montantChargesCalcule = Math.min(paiement.montant_recu, totalCharges);
    const montantLoyerCalcule = Math.max(0, paiement.montant_recu - montantChargesCalcule);

    drawRow('Loyer principal d\'habitation / local commercial', periodePrincipale, montantLoyerCalcule, montantLoyerCalcule, false);
    
    if (montantChargesCalcule > 0) {
      drawRow('Provisions sur charges locatives (Eau, communs, gardiennage)', periodePrincipale, montantChargesCalcule, montantChargesCalcule, true);
    }

    // Total Bar
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margin, y, tableWidth, 10, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL GÉNÉRAL RÉGLÉ ET ACQUITTÉ', margin + 4, y + 6.5);
    doc.setFontSize(10);
    doc.text(formatFCFA(paiement.montant_recu), margin + tableWidth - 4, y + 6.5, { align: 'right' });

    y += 15;

    // Payment Information Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, tableWidth, 27, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('MODALITÉS DE RÈGLEMENT ET TRAÇABILITÉ', margin + 4, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    const modeLabel = paiement.mode_paiement === 'mtn_money' 
      ? 'MTN Mobile Money Cameroun (*126#)' 
      : paiement.mode_paiement === 'orange_money' 
      ? 'Orange Money Cameroun (#150#)'
      : paiement.mode_paiement === 'virement'
      ? 'Virement Bancaire'
      : paiement.mode_paiement === 'cheque'
      ? 'Chèque Bancaire'
      : 'Espèces contre reçu';
    doc.text(`• Mode de versement : ${modeLabel}`, margin + 4, y + 11);
    doc.text(`• Réf. Transaction : ${paiement.reference_recu || 'N/A'}`, margin + 4, y + 16.5);
    doc.text(`• N° Quittance : ${paiement.quittance_numero || paiement.id}`, margin + 4, y + 22);

    const midCol = margin + (tableWidth / 2);
    doc.text(`• Date de paiement : ${formatDateFR(paiement.date_paiement || paiement.date_creation)}`, midCol, y + 11);
    doc.text(`• Statut : Règlement validé avec acquittement`, midCol, y + 16.5);
    if (paiement.commentaire) {
      doc.text(`• Note : ${paiement.commentaire.substring(0, 45)}`, midCol, y + 22);
    }

    y += 31;

    // Generate or prepare QR Code for Public Verification
    const lookupCode = paiement.reference_recu || paiement.quittance_numero || String(paiement.id);
    let qrImage = qrDataUrl;
    if (!qrImage) {
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const targetUrl = verificationUrl || `${currentOrigin}/?verify=${encodeURIComponent(lookupCode)}`;
      try {
        qrImage = await QRCode.toDataURL(targetUrl, {
          width: 200,
          margin: 0,
          color: { dark: '#0f172a', light: '#ffffff' }
        });
      } catch (err) {
        console.warn('Could not generate client-side QR code for PDF:', err);
      }
    }

    // QR Code Box on Left
    const qrSize = 25;
    const qrBoxWidth = 52;
    const qrBoxHeight = 31;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(16, 185, 129); // emerald-500
    doc.roundedRect(margin, y - 2, qrBoxWidth, qrBoxHeight, 1.5, 1.5, 'FD');

    if (qrImage) {
      try {
        doc.addImage(qrImage, 'PNG', margin + 2, y, qrSize, qrSize);
      } catch (err) {
        console.warn('Failed to embed QR code image in PDF:', err);
      }
    }

    // QR Code label and verification text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(16, 185, 129);
    doc.text('QR CODE ANTI-FRAUDE', margin + qrSize + 4, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Scannez pour vérifier', margin + qrSize + 4, y + 9);
    doc.text('l\'authenticité et la', margin + qrSize + 4, y + 13);
    doc.text('validité auprès du', margin + qrSize + 4, y + 17);
    doc.text('registre DISCOM.', margin + qrSize + 4, y + 21);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Réf: ${lookupCode.slice(0, 14)}`, margin + qrSize + 4, y + 26);

    // Legal acknowledgment block in Center
    const legalBoxX = margin + qrBoxWidth + 4;
    const legalBoxWidth = tableWidth - qrBoxWidth - 54;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    const legalText = "Le bailleur soussigné reconnaît avoir reçu du locataire susnommé la somme indiquée au titre du paiement des loyers pour la période susmentionnée. Cette quittance certifiée conforme OHADA annule tout reçu provisoire antérieur et fait foi légale d'acquittement intégrale.";
    const splitLegal = doc.splitTextToSize(legalText, legalBoxWidth);
    doc.text(splitLegal, legalBoxX, y + 3);

    // Official Stamp / Signature Box on the Right
    const stampX = pageWidth - margin - 48;
    const stampY = y - 2;
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(79, 70, 229);
    doc.roundedRect(stampX, stampY, 48, qrBoxHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(79, 70, 229);
    doc.text('POUR ACQUIT & VALIDATION', stampX + 24, stampY + 5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(51, 65, 85);
    doc.text('Signature / Cachet Bailleur', stampX + 24, stampY + 9, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(16, 185, 129);
    doc.text('CERTIFIÉ DISCOM', stampX + 24, stampY + 16, { align: 'center' });

    doc.setFontSize(5.5);
    doc.setTextColor(148, 163, 184);
    doc.text(new Date().toISOString().split('T')[0], stampX + 24, stampY + 21, { align: 'center' });

    // Footer
    y = 282;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Document officiel généré par LocaManager DISCOM • Sceau Numérique OHADA • www.discom-cameroun.cm', pageWidth / 2, y + 4, { align: 'center' });

    // Filename & trigger download
    const safeLocataire = (locataire?.nom_complet || 'Locataire').replace(/[^a-zA-Z0-9]/g, '_');
    const safeTicket = (paiement.quittance_numero || paiement.id).replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Ticket_Quittance_${safeTicket}_${safeLocataire}.pdf`;

    doc.save(filename);
    return true;
  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    return false;
  }
};
