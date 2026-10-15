import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { formatCurrency } from '../lib/format';
import { renderQr } from '../lib/payLink';

const hoursLabel = (value) => `${String(value).replace('.', ',')} h`;

/**
 * Note de frais d'un boulot : une ligne par personne, le total, et le QR de
 * virement de la demande de paiement créée à la validation.
 *
 * Le QR, l'IBAN et la communication viennent du serveur (getPaymentPage) :
 * l'app n'a jamais le dernier mot sur le compte qui reçoit l'argent.
 *
 * Affichée par-dessus l'app ; « Imprimer / PDF » n'imprime qu'elle (voir
 * index.css). Couleurs en dur : c'est une feuille de papier, elle reste
 * blanche en mode sombre.
 */
export default function ExpenseNote({ note, onClose }) {
  const [qr, setQr] = useState(null);
  const payment = note.payment;

  const ownLines = note.lines.filter((l) => l.sectionId === note.sectionId);
  const otherLines = note.lines.filter((l) => l.sectionId !== note.sectionId);
  const amountOf = (l) => l.hours * note.rate;
  const total = note.lines.reduce((sum, l) => sum + amountOf(l), 0);
  const ownTotal = ownLines.reduce((sum, l) => sum + amountOf(l), 0);
  const otherTotal = total - ownTotal;

  useEffect(() => {
    if (!payment?.qrPayload) { setQr(null); return; }
    renderQr(payment.qrPayload, 360).then(setQr).catch((error) => console.error('QR impossible:', error));
  }, [payment?.qrPayload]);

  // Pendant l'affichage, l'impression ne garde que la note.
  useEffect(() => {
    document.body.classList.add('printing-note');
    return () => document.body.classList.remove('printing-note');
  }, []);

  const ink = '#16130f';
  const muted = '#6b6560';
  const rule = '#e7e2dc';
  const mono = '"DM Mono", ui-monospace, monospace';
  const date = (value) => new Date(value).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' });
  const cell = { padding: '10px 0', borderBottom: `1px solid ${rule}` };
  const head = { padding: '8px 0', borderBottom: `1px solid ${rule}`, fontWeight: 600 };
  const caption = { margin: 0, fontSize: 12, color: muted, textTransform: 'uppercase', letterSpacing: '.06em' };

  return createPortal(
    <div id="expense-note" style={{ position: 'fixed', inset: 0, zIndex: 100, overflowY: 'auto', background: 'rgba(22,19,15,.6)' }}>
      {/* Barre d'outils, absente du papier */}
      <div className="no-print" style={{ position: 'sticky', top: 0, display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 16px' }}>
        <button
          onClick={() => window.print()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, background: '#16a34a', color: '#fff', fontWeight: 700, border: 0 }}
        >
          <Printer size={18} /> Imprimer / PDF
        </button>
        <button
          onClick={onClose}
          aria-label="Fermer la note"
          style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: 12, background: '#fff', color: ink, border: 0 }}
        >
          <X size={20} />
        </button>
      </div>

      <article
        className="expense-note-sheet"
        style={{ background: '#fff', color: ink, maxWidth: 720, margin: '0 auto 32px', padding: '32px 28px', borderRadius: 16, fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 14, lineHeight: 1.45 }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', borderBottom: `2px solid ${ink}`, paddingBottom: 16 }}>
          <div>
            <p style={{ ...caption, letterSpacing: '.08em' }}>Note de frais</p>
            <h1 style={{ margin: '4px 0 0', fontFamily: '"Bricolage Grotesque", system-ui, sans-serif', fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>
              {payment?.holderName || 'Patro'}
            </h1>
            {note.sectionLabel && <p style={{ margin: '2px 0 0', color: muted }}>Section {note.sectionLabel}</p>}
          </div>
          <div style={{ textAlign: 'right', fontSize: 13 }}>
            {payment?.communication && (
              <p style={{ margin: 0, fontFamily: mono, fontWeight: 600, whiteSpace: 'nowrap' }}>{payment.communication}</p>
            )}
            <p style={{ margin: '2px 0 0', color: muted }}>Émise le {date(note.issuedAt)}</p>
          </div>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, margin: '20px 0' }}>
          <div>
            <p style={caption}>Pour</p>
            <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: 16 }}>{note.billTo || '—'}</p>
          </div>
          <div>
            <p style={caption}>Boulot</p>
            <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: 16 }}>{note.description}</p>
            <p style={{ margin: '2px 0 0', color: muted }}>
              {date(note.date)}{note.location ? ` · ${note.location}` : ''}
            </p>
          </div>
        </section>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: 12, color: muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              <th style={head}>Qui</th>
              <th style={{ ...head, textAlign: 'right' }}>Heures</th>
              <th style={{ ...head, textAlign: 'right' }}>Tarif</th>
              <th style={{ ...head, textAlign: 'right' }}>Montant</th>
            </tr>
          </thead>
          <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
            {[...ownLines, ...otherLines].map((l) => (
              <tr key={l.key}>
                <td style={{ ...cell, fontWeight: 600 }}>
                  {l.name}
                  {l.sectionId !== note.sectionId && (
                    <span style={{ fontWeight: 400, color: muted }}> · {note.otherLabel}</span>
                  )}
                </td>
                <td style={{ ...cell, textAlign: 'right' }}>{hoursLabel(l.hours)}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{formatCurrency(note.rate)}</td>
                <td style={{ ...cell, textAlign: 'right', fontWeight: 600 }}>{formatCurrency(amountOf(l))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ paddingTop: 14, fontWeight: 800, fontSize: 16 }}>Total</td>
              <td style={{ paddingTop: 14, textAlign: 'right', color: muted }}>
                {hoursLabel(note.lines.reduce((s, l) => s + l.hours, 0))}
              </td>
              <td />
              <td style={{ paddingTop: 14, textAlign: 'right', fontWeight: 800, fontSize: 20 }}>{formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>

        <section style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', marginTop: 28, padding: 16, border: `1px solid ${rule}`, borderRadius: 12 }}>
          {qr && <img src={qr} alt="QR code de paiement" style={{ width: 150, height: 150 }} />}
          <div style={{ flex: '1 1 220px', fontSize: 13 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>Paiement</p>
            {note.paidAt ? (
              <p style={{ margin: '4px 0 0', color: '#15803d', fontWeight: 700 }}>
                Payé le {date(note.paidAt)}. Merci !
              </p>
            ) : payment ? (
              <>
                <p style={{ margin: '4px 0 0' }}>Scannez le QR code avec votre app bancaire, ou faites un virement :</p>
                <p style={{ margin: '8px 0 0' }}><span style={{ color: muted }}>Bénéficiaire :</span> {payment.holderName}</p>
                <p style={{ margin: '2px 0 0' }}><span style={{ color: muted }}>IBAN :</span> <span style={{ fontFamily: mono }}>{payment.iban}</span></p>
                <p style={{ margin: '2px 0 0' }}><span style={{ color: muted }}>Montant :</span> {formatCurrency(note.collectTogether ? total : ownTotal)}</p>
                <p style={{ margin: '2px 0 0' }}><span style={{ color: muted }}>Communication :</span> <span style={{ fontFamily: mono }}>{payment.communication}</span></p>
                {payment.link && (
                  <p style={{ margin: '6px 0 0', color: muted, wordBreak: 'break-all' }}>Ou en ligne : {payment.link}</p>
                )}
              </>
            ) : (
              <p style={{ margin: '4px 0 0', color: muted }}>
                {note.preview
                  ? 'Le QR de virement est créé à la validation du boulot.'
                  : 'À régler en liquide ou par virement au patro.'}
              </p>
            )}
            {otherTotal > 0 && note.collectTogether && (
              <p style={{ margin: '8px 0 0', color: muted }}>
                Un seul paiement pour toute l'équipe, y compris les {note.otherLabel}.
              </p>
            )}
            {otherTotal > 0 && !note.collectTogether && (
              <p style={{ margin: '8px 0 0', color: muted }}>
                {payment ? 'Ce paiement couvre' : 'Cette note couvre'} la part des {note.sectionLabel} ({formatCurrency(ownTotal)}).
                La part des {note.otherLabel} ({formatCurrency(otherTotal)}) est demandée séparément par leur section.
              </p>
            )}
          </div>
        </section>

        <p style={{ marginTop: 20, fontSize: 12, color: muted, textAlign: 'center' }}>Merci pour votre confiance !</p>
      </article>
    </div>,
    document.body
  );
}
