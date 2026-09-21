import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Check, Copy, Maximize2, QrCode, Share2 } from 'lucide-react';
import { functions } from '../firebase';
import { payUrl, renderQr } from '../lib/payLink';

/**
 * Le QR de rechargement permanent d'un membre du bar. Chaque membre a SA
 * communication : il verse ce qu'il veut, et le montant arrive sur son compte.
 * Le code est créé par le serveur à la première demande, et ne change plus.
 */
const euros = (cents) =>
  new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(cents / 100);

/** « 12,5 » ou « 12.50 » → 1250 ; null si vide ou invalide. */
const toCents = (text) => {
  const value = Math.round(parseFloat(String(text || '').replace(',', '.')) * 100);
  return Number.isInteger(value) && value >= 1 ? value : null;
};

export default function MemberPayCode({ memberPath, memberName, amount = '' }) {
  const [code, setCode] = useState(null);
  const [qr, setQr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(null);

  const wanted = toCents(amount);
  const outdated = code && (code.amountCents ?? null) !== wanted;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Le montant saisi dans la fenêtre (une dette à rembourser) est proposé
      // dans le QR ; sans montant, l'app bancaire le demande au membre.
      const { data } = await httpsCallable(functions, 'getMemberPaymentCode')({ memberPath, amountCents: wanted });
      setCode(data);
      setQr(await renderQr(data.qrPayload, 560));
    } catch (caught) {
      console.error('Code de paiement du membre:', caught);
      setError(caught?.details?.reason ? caught.message : 'Le QR n\'a pas pu être préparé. Vérifie ta connexion.');
    } finally {
      setLoading(false);
    }
  };

  const copy = async (what, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      window.prompt('Copie :', value);
    }
  };

  const share = async () => {
    const url = payUrl(code.token);
    const text = `${memberName}, voici ton QR pour recharger ton compte bar du patro. Communication : ${code.communication}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Recharger mon compte bar', text, url }); } catch { /* partage annulé */ }
    } else {
      copy('link', url);
    }
  };

  if (fullscreen && qr) {
    return (
      <button
        onClick={() => setFullscreen(false)}
        className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center gap-3 p-6"
        aria-label="Fermer le QR en plein écran"
      >
        <img src={qr} alt="QR de rechargement" className="w-full max-w-md" />
        <p className="font-display text-2xl font-extrabold text-gray-900">{memberName}</p>
        <p className="font-mono text-lg text-gray-900">{code.communication}</p>
        {code.amountCents && <p className="font-display text-3xl font-extrabold text-gray-900">{euros(code.amountCents)}</p>}
        <p className="text-sm text-gray-500">{code.amountCents ? 'Scanne avec ton app bancaire' : 'Scanne, choisis ton montant'} · touche pour fermer</p>
      </button>
    );
  }

  if (!code) {
    return (
      <div>
        <button
          onClick={load}
          disabled={loading}
          className="w-full p-3 rounded-xl bg-bar-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-transform"
        >
          <QrCode size={18} />
          {loading ? 'Préparation…' : wanted ? `QR de virement pour ${euros(wanted)}` : 'QR de virement, montant libre'}
        </button>
        {error && <p className="mt-2 text-sm text-red-700 bg-red-50 rounded-xl p-3" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl ring-1 ring-gray-200 p-3 space-y-3">
      <p className="text-sm text-gray-700">
        {code.amountCents
          ? <>Ce QR propose <strong>{euros(code.amountCents)}</strong> à <strong>{memberName}</strong>, avec <strong>sa</strong> communication, toujours la même.</>
          : <><strong>{memberName}</strong> verse le montant qu'il veut avec <strong>sa</strong> communication, toujours la même.</>}
        {' '}Ce qui arrive sur le compte est ajouté à son solde.
      </p>
      {outdated && (
        <button
          onClick={load}
          disabled={loading}
          className="w-full p-2.5 rounded-xl bg-yellow-400 text-yellow-950 text-sm font-bold disabled:opacity-60 active:scale-95 transition-transform"
        >
          {loading ? 'Préparation…' : wanted ? `Refaire le QR pour ${euros(wanted)}` : 'Refaire le QR à montant libre'}
        </button>
      )}
      {qr && (
        <button onClick={() => setFullscreen(true)} className="block mx-auto" aria-label="Afficher le QR en plein écran">
          <img src={qr} alt="QR de rechargement" width="200" height="200" className="rounded-xl ring-1 ring-gray-200" />
        </button>
      )}
      <button
        onClick={() => copy('communication', code.communication)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-100 text-left"
      >
        <span className="min-w-0">
          <span className="block text-xs text-gray-500">Sa communication</span>
          <span className="block font-mono">{code.communication}</span>
        </span>
        {copied === 'communication' ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <p className="text-xs text-gray-500">Compte {code.iban} · {code.holderName}</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setFullscreen(true)} className="p-2.5 rounded-xl bg-gray-900 text-gray-50 text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
          <Maximize2 size={16} />Plein écran
        </button>
        <button onClick={share} className="p-2.5 rounded-xl bg-white ring-1 ring-gray-200 text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
          {copied === 'link' ? <Check size={16} /> : <Share2 size={16} />}{copied === 'link' ? 'Lien copié' : 'Lui envoyer'}
        </button>
      </div>
    </div>
  );
}
