import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Check, Copy } from 'lucide-react';
import { functions } from './firebase';
import { renderQr } from './lib/payLink';

// Tant que le paiement n'est pas arrivé, on redemande l'état de temps en temps :
// la page passe d'elle-même à « reçu ».
const REFRESH_MS = 30_000;

const euros = (cents) =>
  new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);

const CopyRow = ({ label, value, mono = true }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt(`${label} :`, value);
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`${mono ? 'font-mono' : ''} text-gray-900 break-words`}>{value}</p>
      </div>
      <button
        onClick={copy}
        aria-label={`Copier ${label.toLowerCase()}`}
        className="flex-none p-2 rounded-lg ring-1 ring-gray-200 text-gray-600 active:scale-95 transition-transform"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </div>
  );
};

const Shell = ({ children }) => (
  <div className="min-h-screen bg-gray-50 flex justify-center p-5">
    <div className="w-full max-w-sm py-4">
      <div className="flex items-center gap-3 mb-6">
        <img src="/icon-192.png" alt="" width="44" height="44" />
        <p className="font-display text-xl font-extrabold tracking-tight">Patro · paiement</p>
      </div>
      {children}
    </div>
  </div>
);

/** Page publique d'une demande de paiement, ouverte par le client sans compte. */
export default function PayPage({ token }) {
  const [page, setPage] = useState(null);
  const [qr, setQr] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const load = async () => {
      try {
        const { data } = await httpsCallable(functions, 'getPaymentPage')({ token });
        if (cancelled) return;
        setPage(data);
        setError(null);
        if (data.status === 'pending' || data.status === 'open') {
          renderQr(data.qrPayload).then((image) => { if (!cancelled) setQr(image); });
        }
        // Une demande en attente finit par être payée ; un code de membre, lui, reste ouvert.
        if (data.status === 'pending') timer = setTimeout(load, REFRESH_MS);
      } catch (caught) {
        if (cancelled) return;
        const missing = caught?.details?.reason === 'no-request';
        setError(missing ? 'missing' : 'network');
        if (!missing) timer = setTimeout(load, REFRESH_MS);
      }
    };

    load();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [token]);

  if (error === 'missing') {
    return (
      <Shell>
        <div className="bg-white rounded-3xl ring-1 ring-gray-200 p-5">
          <p className="font-semibold">Ce lien de paiement n'existe pas.</p>
          <p className="text-sm text-gray-600 mt-1">Vérifie qu'il a été copié en entier, ou redemande-le au patro.</p>
        </div>
      </Shell>
    );
  }

  if (!page) {
    return (
      <Shell>
        <p className="text-sm text-gray-600" role="status">
          {error === 'network' ? 'Connexion impossible pour l\'instant, nouvel essai dans un instant…' : 'Chargement…'}
        </p>
      </Shell>
    );
  }

  const lines = page.lines || [];

  return (
    <Shell>
      <div className="bg-white rounded-3xl shadow-sm ring-1 ring-gray-200 p-5">
        <p className="text-sm text-gray-600">{page.label} · {page.sectionLabel}</p>
        {page.amountCents === null ? (
          <p className="font-display text-3xl font-extrabold tracking-tight mt-1">Le montant que tu veux</p>
        ) : (
          <p className="font-display text-5xl font-extrabold tracking-tight mt-1">{euros(page.amountCents)}</p>
        )}

        {lines.length > 0 && (
          <ul className="mt-4 text-sm text-gray-700 divide-y divide-gray-100">
            {lines.map((line, index) => (
              <li key={index} className="py-1.5 flex justify-between gap-3">
                <span className="min-w-0">{line.description}</span>
                <span className="font-mono flex-none">{euros(line.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {page.status === 'paid' && (
        <div className="mt-4 bg-green-50 text-green-900 rounded-3xl p-5">
          <p className="font-display text-2xl font-extrabold">Paiement reçu, merci !</p>
          <p className="text-sm mt-1">Tu n'as plus rien à faire.</p>
        </div>
      )}

      {page.status === 'cancelled' && (
        <div className="mt-4 bg-gray-100 text-gray-800 rounded-3xl p-5">
          <p className="font-semibold">Cette demande a été annulée.</p>
          <p className="text-sm mt-1">Ne paie rien avec ce lien. En cas de doute, contacte le patro.</p>
        </div>
      )}

      {(page.status === 'pending' || page.status === 'open') && (
        <>
          <div className="mt-4 bg-white rounded-3xl shadow-sm ring-1 ring-gray-200 p-5 text-center">
            <p className="font-semibold">Scanne ce QR avec ton app bancaire</p>
            <p className="text-sm text-gray-600 mt-0.5">
              Belfius, KBC, ING, BNP Paribas Fortis, Argenta… {page.amountCents === null ? 'Tu choisis le montant, le reste est prérempli.' : 'Tout est prérempli.'}
            </p>
            {qr
              ? <img src={qr} alt="QR de virement" width="260" height="260" className="mx-auto mt-3" />
              : <div className="mx-auto mt-3 w-[260px] h-[260px] rounded-xl bg-gray-100" aria-hidden="true" />}
          </div>

          <div className="mt-4 bg-white rounded-3xl shadow-sm ring-1 ring-gray-200 px-5 py-2 divide-y divide-gray-100">
            <p className="text-sm text-gray-600 py-2.5">Ou fais le virement toi-même, avec ces données :</p>
            <CopyRow label="Compte" value={page.iban} />
            <CopyRow label="Bénéficiaire" value={page.holderName} mono={false} />
            <CopyRow label="Communication structurée" value={page.communication} />
            {page.amountCents !== null && <CopyRow label="Montant" value={euros(page.amountCents)} mono={false} />}
          </div>

          <p className="text-xs text-gray-500 mt-4 px-1">
            {page.amountCents === null
              ? 'Cette communication est la tienne, pour toujours : enregistre ce bénéficiaire dans ton app bancaire, et recharge quand tu veux, du montant que tu veux. Ce que tu verses arrive sur ton compte bar.'
              : 'Garde bien la communication : c\'est elle qui relie ton virement à cette demande. Cette page se met à jour toute seule une fois le paiement reçu.'}
            {' '}Avant de valider, vérifie que ton app bancaire affiche le bénéficiaire ci-dessus.
          </p>
        </>
      )}
    </Shell>
  );
}
