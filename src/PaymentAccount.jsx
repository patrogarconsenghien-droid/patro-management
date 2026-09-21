import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Landmark, ShieldCheck, ShieldAlert, Smartphone } from 'lucide-react';
import { db, functions, reauthenticate } from './firebase';
import { SECTIONS, isAdmin } from './auth/account';
import { toast } from './lib/feedback';
import { formatIban, isValidBelgianIban, lastFour } from './lib/iban';

// L'ancien compte reste affiché un mois à côté du nouveau : un animateur qui
// n'attendait pas de changement doit pouvoir le remarquer.
const PREVIOUS_VISIBLE_DAYS = 30;

const ERRORS = {
  'bad-code': 'Code incorrect. Vérifie l\'heure de ton téléphone et réessaie avec un nouveau code.',
  'locked': 'Trop de codes faux : c\'est verrouillé 15 minutes.',
  'not-enrolled': 'Relie d\'abord une app d\'authentification.',
  'not-admin': 'Réservé à l\'admin.',
  'bad-iban': 'Ce numéro n\'est pas un IBAN belge valide. Vérifie chaque chiffre.',
  'bad-holder': 'Le nom du titulaire doit faire entre 2 et 70 caractères.',
  'recent-login-required': 'Reconnecte-toi à Google pour confirmer que c\'est bien toi.'
};

const messageFor = (error) => {
  const reason = error?.details?.reason;
  if (reason && ERRORS[reason]) return ERRORS[reason];
  if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/operation-not-supported-in-this-environment') {
    return 'La fenêtre Google a été bloquée. Ouvre l\'app dans Chrome ou Safari, pas depuis l\'icône installée, puis réessaie.';
  }
  if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') return null;
  if (error?.code === 'auth/user-mismatch') return 'Reconnecte-toi avec le même compte Google.';
  return 'Ça n\'a pas marché. Vérifie ta connexion et réessaie.';
};

/**
 * Appelle une fonction sensible : redemande d'abord le compte Google, puisque
 * le serveur exige une connexion de moins de 5 minutes.
 */
async function callSecure(name, data) {
  await reauthenticate();
  const result = await httpsCallable(functions, name)(data);
  return result.data;
}

const CodeInput = ({ id, value, onChange }) => (
  <input
    id={id}
    inputMode="numeric"
    autoComplete="one-time-code"
    maxLength={6}
    placeholder="6 chiffres"
    value={value}
    onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
    className="w-full p-3 border rounded-lg font-mono text-xl tracking-[0.4em] text-center"
  />
);

const PaymentAccount = ({ Header, navigateTo, account, sectionId }) => {
  const admin = isAdmin(account?.profile);
  const sectionLabel = SECTIONS[sectionId] || sectionId;

  const [settings, setSettings] = useState(undefined);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Relier une app : secret en attente, QR, premier code.
  const [enrollment, setEnrollment] = useState(null);
  const [enrollCode, setEnrollCode] = useState('');
  const [replaceCode, setReplaceCode] = useState('');

  // Poser ou changer le compte.
  const [iban, setIban] = useState('');
  const [holderName, setHolderName] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => onSnapshot(
    doc(db, 'paymentSettings', sectionId),
    (snapshot) => setSettings(snapshot.exists() ? snapshot.data() : null),
    (readError) => { console.error('Lecture du compte de paiement impossible:', readError); setSettings(null); }
  ), [sectionId]);

  useEffect(() => {
    if (!admin) return;
    httpsCallable(functions, 'paymentSecurityStatus')()
      .then((result) => setStatus(result.data))
      .catch((statusError) => { console.error('Statut de la double authentification impossible:', statusError); setStatus({ enrolled: false, unknown: true }); });
  }, [admin]);

  useEffect(() => { setHolderName(settings?.holderName || ''); }, [settings?.holderName]);

  const run = async (action) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      console.error('Compte de paiement:', caught);
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  };

  const startEnrollment = () => run(async () => {
    const data = await callSecure('paymentTotpEnroll', status?.enrolled ? { code: replaceCode } : {});
    // Le QR est dessiné ici, dans le navigateur : le secret ne part vers aucun
    // service tiers.
    const QRCode = (await import('qrcode')).default;
    const qr = await QRCode.toDataURL(data.uri, { margin: 1, width: 240 });
    setEnrollment({ ...data, qr });
    setReplaceCode('');
  });

  const confirmEnrollment = () => run(async () => {
    await callSecure('paymentTotpConfirm', { code: enrollCode });
    setEnrollment(null);
    setEnrollCode('');
    setStatus({ enrolled: true, enrolledAt: Date.now() });
    toast('App d\'authentification reliée');
  });

  const saveAccount = () => run(async () => {
    if (!isValidBelgianIban(iban)) { setError(ERRORS['bad-iban']); return; }
    const changing = settings && lastFour(settings.iban) !== lastFour(iban);
    if (!confirm(
      `${changing ? 'CHANGER' : 'Enregistrer'} le compte de paiement des ${sectionLabel} ?\n\n` +
      `${formatIban(iban)}\n${holderName.trim()}\n\n` +
      'Tous les QR de paiement utiliseront ce compte. Les animateurs seront prévenus.'
    )) return;

    await callSecure('setPaymentAccount', { sectionId, iban, holderName, code });
    setIban('');
    setCode('');
    toast('Compte de paiement enregistré');
  });

  const replacedAt = settings?.previousReplacedAt?.toMillis?.() || 0;
  const showPrevious = settings?.previousIban
    && Date.now() - replacedAt < PREVIOUS_VISIBLE_DAYS * 24 * 60 * 60 * 1000;
  const updatedAt = settings?.updatedAt?.toDate?.();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Compte de paiement" onBack={() => navigateTo('settings')} />

      <div className="p-4 space-y-4">
        {/* Compte en vigueur : visible de tous les animateurs de la section. */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center space-x-3 mb-3">
            <Landmark className="text-purple-500" size={24} />
            <h3 className="font-semibold">Compte des {sectionLabel}</h3>
          </div>

          {settings === undefined && <p className="text-sm text-gray-500">Chargement…</p>}
          {settings === null && (
            <p className="text-sm text-gray-600">
              Aucun compte n'est encore enregistré. Les QR de paiement ne pourront être créés qu'ensuite.
            </p>
          )}
          {settings && (
            <>
              <p className="font-mono text-lg tracking-wide">{formatIban(settings.iban)}</p>
              <p className="text-sm text-gray-700 mt-1">{settings.holderName}</p>
              <p className="text-xs text-gray-500 mt-2">
                {updatedAt ? `Enregistré le ${updatedAt.toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Enregistré'}
                {settings.updatedByEmail ? ` par ${settings.updatedByEmail}` : ''}
              </p>
              {showPrevious && (
                <p className="text-sm text-orange-800 bg-orange-50 rounded-lg p-3 mt-3">
                  Ce compte a remplacé <span className="font-mono">{formatIban(settings.previousIban)}</span> le{' '}
                  {new Date(replacedAt).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long' })}.
                  Si tu n'étais pas au courant, parles-en tout de suite à l'admin.
                </p>
              )}
            </>
          )}
        </div>

        {!admin && (
          <p className="text-sm text-gray-600 bg-white rounded-lg ring-1 ring-gray-200 p-3">
            Seul l'admin peut enregistrer ou changer ce compte, avec une double authentification.
            Tu es prévenu par notification à chaque changement.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3" role="alert">{error}</p>
        )}

        {/* Double authentification de l'admin. */}
        {admin && status && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center space-x-3 mb-3">
              {status.enrolled
                ? <ShieldCheck className="text-green-600" size={24} />
                : <ShieldAlert className="text-orange-500" size={24} />}
              <h3 className="font-semibold">Double authentification</h3>
            </div>

            {!enrollment && (
              <>
                <p className="text-sm text-gray-600 mb-3">
                  {status.enrolled
                    ? 'Une app d\'authentification est reliée à ton compte. Son code est demandé à chaque changement de compte de paiement.'
                    : 'Avant d\'enregistrer un compte, relie une app d\'authentification (Google Authenticator, Microsoft Authenticator, Aegis…). Elle fournira le code demandé à chaque changement.'}
                </p>
                {status.enrolled && (
                  <div className="mb-3">
                    <label htmlFor="replace-code" className="block text-sm font-medium text-gray-700 mb-1">
                      Pour relier une autre app, code de l'app actuelle
                    </label>
                    <CodeInput id="replace-code" value={replaceCode} onChange={setReplaceCode} />
                  </div>
                )}
                <button
                  onClick={startEnrollment}
                  disabled={busy || (status.enrolled && replaceCode.length !== 6)}
                  className="w-full p-3 bg-purple-500 text-white rounded-lg font-semibold disabled:opacity-50 active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <Smartphone size={18} />
                  {status.enrolled ? 'Relier une autre app' : 'Relier une app d\'authentification'}
                </button>
              </>
            )}

            {enrollment && (
              <div className="space-y-3">
                <ol className="text-sm text-gray-700 list-decimal pl-5 space-y-1">
                  <li>Ouvre ton app d'authentification et ajoute un compte.</li>
                  <li>Scanne ce QR, ou saisis la clé à la main.</li>
                  <li>Entre ci-dessous le code à 6 chiffres qu'elle affiche.</li>
                </ol>
                <img src={enrollment.qr} alt="QR à scanner avec l'app d'authentification" width="240" height="240" className="mx-auto rounded-lg ring-1 ring-gray-200" />
                <p className="font-mono text-sm text-center break-all bg-gray-100 rounded-lg p-2 select-all">{enrollment.secret}</p>
                <p className="text-xs text-gray-500">
                  Cette clé n'est affichée qu'une fois. Ne la partage pas et ne la garde pas en capture d'écran.
                </p>
                <CodeInput id="enroll-code" value={enrollCode} onChange={setEnrollCode} />
                <button
                  onClick={confirmEnrollment}
                  disabled={busy || enrollCode.length !== 6}
                  className="w-full p-3 bg-purple-500 text-white rounded-lg font-semibold disabled:opacity-50 active:scale-95 transition-transform"
                >
                  Confirmer
                </button>
                <button onClick={() => { setEnrollment(null); setEnrollCode(''); }} className="w-full p-2 text-sm text-gray-600">
                  Annuler
                </button>
              </div>
            )}
          </div>
        )}

        {/* Poser ou changer le compte. */}
        {admin && status?.enrolled && !enrollment && (
          <div className="bg-white rounded-lg shadow-md p-4 space-y-3">
            <h3 className="font-semibold">{settings ? 'Changer de compte' : 'Enregistrer le compte'}</h3>
            <div>
              <label htmlFor="iban" className="block text-sm font-medium text-gray-700 mb-1">IBAN belge</label>
              <input
                id="iban"
                value={iban}
                onChange={(e) => setIban(e.target.value.toUpperCase())}
                placeholder="BE00 0000 0000 0000"
                autoComplete="off"
                className="w-full p-3 border rounded-lg font-mono"
              />
              {iban && !isValidBelgianIban(iban) && (
                <p className="text-xs text-orange-700 mt-1">Pas encore un IBAN belge valide.</p>
              )}
              {iban && isValidBelgianIban(iban) && (
                <p className="text-xs text-green-700 mt-1">IBAN valide : {formatIban(iban)}</p>
              )}
            </div>
            <div>
              <label htmlFor="holder" className="block text-sm font-medium text-gray-700 mb-1">
                Titulaire, tel qu'il apparaît à la banque
              </label>
              <input
                id="holder"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                maxLength={70}
                placeholder="Patro … ASBL"
                className="w-full p-3 border rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="totp-code" className="block text-sm font-medium text-gray-700 mb-1">
                Code de ton app d'authentification
              </label>
              <CodeInput id="totp-code" value={code} onChange={setCode} />
            </div>
            <p className="text-xs text-gray-500">
              Google te redemandera ton compte juste après. Les animateurs des {sectionLabel} recevront une notification.
            </p>
            <button
              onClick={saveAccount}
              disabled={busy || !isValidBelgianIban(iban) || holderName.trim().length < 2 || code.length !== 6}
              className="w-full p-3 bg-purple-500 text-white rounded-lg font-semibold disabled:opacity-50 active:scale-95 transition-transform"
            >
              {busy ? 'Vérification…' : settings ? 'Changer le compte' : 'Enregistrer le compte'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentAccount;
