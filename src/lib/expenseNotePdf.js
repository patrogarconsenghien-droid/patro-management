// Note de frais en PDF, pour la partager ou la télécharger. Dessinée avec
// jsPDF (texte vectoriel, fichier léger), sur le modèle de la note à l'écran :
// une ligne par personne, le total, le QR de virement.
import { formatCurrency } from './format';

// Les polices de base du PDF ne connaissent pas les espaces insécables fines
// des montants à la belge.
const clean = (text) => String(text ?? '').replace(/[  ]/g, ' ');
const euros = (amount) => clean(formatCurrency(amount));
const hoursLabel = (value) => `${String(value).replace('.', ',')} h`;
const longDate = (value) =>
  value ? new Date(value).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

/** Nom du fichier : « Note de frais - Bal du bourgmestre - 2026-10-11.pdf ». */
export function expenseNoteFileName(note) {
  const what = String(note.description || 'boulot').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  const day = String(note.date || note.issuedAt || '').slice(0, 10);
  return `Note de frais - ${what}${day ? ` - ${day}` : ''}.pdf`;
}

/**
 * @param note  la note (voir ExpenseNote)
 * @param qr    l'image du QR (data URL), ou null
 * @returns     un Blob application/pdf
 */
export async function buildExpenseNotePdf(note, qr) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const W = 210;
  const M = 14;
  const right = W - M;
  const ink = [22, 19, 15];
  const muted = [107, 101, 96];
  const rule = [231, 226, 220];
  const payment = note.payment;

  const lines = note.lines || [];
  const amountOf = (l) => l.hours * note.rate;
  const total = lines.reduce((sum, l) => sum + amountOf(l), 0);
  const ownTotal = lines.filter((l) => l.sectionId === note.sectionId).reduce((sum, l) => sum + amountOf(l), 0);
  const otherTotal = total - ownTotal;

  const color = (rgb) => pdf.setTextColor(...rgb);
  const font = (style, size) => { pdf.setFont('helvetica', style); pdf.setFontSize(size); };
  const text = (value, x, y, opts) => pdf.text(clean(value), x, y, opts);

  // En-tête
  let y = M + 4;
  font('normal', 8); color(muted); text('NOTE DE FRAIS', M, y);
  font('bold', 18); color(ink); text(payment?.holderName || 'Patro', M, y + 8);
  if (note.sectionLabel) { font('normal', 9); color(muted); text(`Section ${note.sectionLabel}`, M, y + 13); }
  if (payment?.communication) { font('bold', 9); color(ink); text(payment.communication, right, y, { align: 'right' }); }
  font('normal', 9); color(muted); text(`Émise le ${longDate(note.issuedAt)}`, right, y + 5, { align: 'right' });
  y += 17;
  pdf.setDrawColor(...ink); pdf.setLineWidth(0.6); pdf.line(M, y, right, y);

  // Pour qui, quel boulot
  y += 7;
  const col2 = W / 2 + 4;
  font('normal', 8); color(muted); text('POUR', M, y); text('BOULOT', col2, y);
  font('bold', 11); color(ink);
  const billTo = pdf.splitTextToSize(clean(note.billTo || '—'), col2 - M - 6);
  const work = pdf.splitTextToSize(clean(note.description || ''), right - col2);
  pdf.text(billTo, M, y + 5.5);
  pdf.text(work, col2, y + 5.5);
  const workEnd = y + 5.5 + (work.length - 1) * 4.6;
  font('normal', 9); color(muted);
  text(`${longDate(note.date)}${note.location ? ` · ${note.location}` : ''}`, col2, workEnd + 4.6);
  y = Math.max(y + 5.5 + (billTo.length - 1) * 4.6, workEnd + 4.6) + 8;

  // Tableau
  const cols = { hours: 128, rate: 156, amount: right };
  const header = () => {
    font('normal', 8); color(muted);
    text('QUI', M, y); text('HEURES', cols.hours, y, { align: 'right' });
    text('TARIF', cols.rate, y, { align: 'right' }); text('MONTANT', cols.amount, y, { align: 'right' });
    y += 2; pdf.setDrawColor(...rule); pdf.setLineWidth(0.2); pdf.line(M, y, right, y); y += 4.6;
  };
  header();
  const ROW = 6.2;
  const own = lines.filter((l) => l.sectionId === note.sectionId);
  const others = lines.filter((l) => l.sectionId !== note.sectionId);
  [...own, ...others].forEach((l) => {
    if (y > 282) { pdf.addPage(); y = M + 4; header(); }
    font('bold', 9.5); color(ink);
    const name = pdf.splitTextToSize(clean(l.name), cols.hours - M - 22)[0];
    text(name, M, y);
    if (l.sectionId !== note.sectionId) {
      const width = pdf.getTextWidth(clean(name));
      font('normal', 9.5); color(muted); text(` · ${note.otherLabel}`, M + width, y);
    }
    font('normal', 9.5); color(ink);
    text(hoursLabel(l.hours), cols.hours, y, { align: 'right' });
    text(euros(note.rate), cols.rate, y, { align: 'right' });
    font('bold', 9.5); text(euros(amountOf(l)), cols.amount, y, { align: 'right' });
    pdf.setDrawColor(...rule); pdf.line(M, y + 2, right, y + 2);
    y += ROW;
  });
  y += 2;
  font('bold', 12); color(ink); text('Total', M, y);
  font('normal', 9.5); color(muted); text(hoursLabel(lines.reduce((s, l) => s + l.hours, 0)), cols.hours, y, { align: 'right' });
  font('bold', 14); color(ink); text(euros(total), cols.amount, y, { align: 'right' });

  // Paiement : un bloc d'un seul tenant
  const BOX = qr ? 46 : 32;
  y += 8;
  if (y + BOX > 287) { pdf.addPage(); y = M; }
  pdf.setDrawColor(...rule); pdf.setLineWidth(0.3); pdf.roundedRect(M, y, right - M, BOX, 3, 3);
  const tx = qr ? M + 44 : M + 5;
  if (qr) pdf.addImage(qr, 'PNG', M + 4, y + 4, 36, 36, undefined, 'FAST');
  let py = y + 7;
  const say = (value, { bold = false, tone = ink, size = 9 } = {}) => {
    font(bold ? 'bold' : 'normal', size); color(tone);
    const wrapped = pdf.splitTextToSize(clean(value), right - 5 - tx);
    pdf.text(wrapped, tx, py);
    py += wrapped.length * 4.3;
  };
  say('Paiement', { bold: true, size: 11 });
  py += 0.6;
  if (note.paidAt) {
    say(`Payé le ${longDate(note.paidAt)}. Merci !`, { bold: true, tone: [21, 128, 61] });
  } else if (payment) {
    say('Scannez le QR code avec votre app bancaire, ou faites un virement :');
    say(`Bénéficiaire : ${payment.holderName}`);
    say(`IBAN : ${payment.iban}`);
    say(`Montant : ${euros(note.collectTogether ? total : ownTotal)}`);
    say(`Communication : ${payment.communication}`);
    if (payment.link) say(`Ou en ligne : ${payment.link}`, { tone: muted, size: 8 });
  } else {
    say('À régler en liquide ou par virement au patro.', { tone: muted });
  }
  if (otherTotal > 0) {
    say(note.collectTogether
      ? `Un seul paiement pour toute l'équipe, y compris les ${note.otherLabel}.`
      : `${payment ? 'Ce paiement couvre' : 'Cette note couvre'} la part des ${note.sectionLabel} (${euros(ownTotal)}). La part des ${note.otherLabel} (${euros(otherTotal)}) est demandée séparément par leur section.`,
    { tone: muted, size: 8.5 });
  }

  font('normal', 8); color(muted);
  text('Merci pour votre confiance !', W / 2, Math.min(y + BOX + 7, 292), { align: 'center' });
  if (payment?.link) pdf.link(tx, y + 2, right - 5 - tx, BOX - 4, { url: payment.link });

  return pdf.output('blob');
}
