import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ArrowLeftRight } from 'lucide-react';
import { db, functions } from '../firebase';
import { SECTIONS } from '../auth/account';
import { formatCurrency, formatDate } from '../lib/format';
import { toast } from '../lib/feedback';

const euros = (cents) => formatCurrency((cents || 0) / 100);

/** Dettes ouvertes de la section, dans un sens (`field` = debtorSection ou creditorSection). */
function useOpenDebts(field, sectionId) {
  const [debts, setDebts] = useState([]);
  useEffect(() => {
    const q = query(collection(db, 'sectionDebts'), where(field, '==', sectionId), where('status', '==', 'open'));
    return onSnapshot(
      q,
      (snap) => setDebts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => console.error('Lecture des dettes entre sections impossible:', error)
    );
  }, [field, sectionId]);
  return debts;
}

/**
 * Boulots ouverts encaissés en une fois par une section : ce qu'elle doit à
 * l'autre, ou ce que l'autre lui doit. C'est la section qui reçoit l'argent
 * qui confirme le versement : ses boulots passent alors payés.
 */
export default function SectionDebts({ sectionId }) {
  const owed = useOpenDebts('debtorSection', sectionId);
  const due = useOpenDebts('creditorSection', sectionId);
  const [busy, setBusy] = useState(null);

  if (owed.length === 0 && due.length === 0) return null;

  const settle = async (debt, paymentMethod) => {
    const how = paymentMethod === 'cash' ? 'en liquide' : 'par virement';
    if (!confirm(`Les ${SECTIONS[debt.debtorSection]} vous ont versé ${euros(debt.amountCents)} ${how} ?\n\nLes boulots concernés passeront payés.`)) return;
    setBusy(debt.id);
    try {
      await httpsCallable(functions, 'settleSectionDebt')({ debtId: debt.id, paymentMethod });
      toast(`${euros(debt.amountCents)} reçus des ${SECTIONS[debt.debtorSection]}`);
    } catch (error) {
      console.error('Versement entre sections:', error);
      toast(error?.details?.reason ? error.message : 'Ça n\'a pas marché. Vérifie ta connexion.', { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const total = (list) => list.reduce((sum, d) => sum + d.amountCents, 0);
  const date = (debt) => (debt.createdAt?.toDate ? formatDate(debt.createdAt.toDate()) : '');

  return (
    <div className="bg-white rounded-xl shadow-lg p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="text-finance-600" size={22} />
        <h2 className="text-lg font-bold">Entre sections</h2>
      </div>

      {owed.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between">
            <p className="font-semibold text-red-700">À verser aux {SECTIONS[owed[0].creditorSection]}</p>
            <p className="text-xl font-extrabold text-red-700">{euros(total(owed))}</p>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Le client a tout payé chez nous ; leur part est dans notre compte. C'est leur section qui confirme le versement.
          </p>
          <ul className="divide-y">
            {owed.map((debt) => (
              <li key={debt.id} className="py-2 flex justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium">{debt.label}</span>
                  <span className="block text-xs text-gray-500">
                    {debt.targets.map((t) => t.broName).filter(Boolean).join(', ')} · {date(debt)}
                  </span>
                </span>
                <span className="font-semibold whitespace-nowrap">{euros(debt.amountCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {due.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between">
            <p className="font-semibold text-green-700">Les {SECTIONS[due[0].debtorSection]} nous doivent</p>
            <p className="text-xl font-extrabold text-green-700">{euros(total(due))}</p>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Boulots que le client a déjà payés à leur section. Quand l'argent arrive, confirme-le : les boulots passent payés.
          </p>
          <ul className="divide-y">
            {due.map((debt) => (
              <li key={debt.id} className="py-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span>
                    <span className="font-medium">{debt.label}</span>
                    <span className="block text-xs text-gray-500">
                      {debt.targets.map((t) => t.broName).filter(Boolean).join(', ')} · {date(debt)}
                    </span>
                  </span>
                  <span className="font-semibold whitespace-nowrap">{euros(debt.amountCents)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={busy === debt.id}
                    onClick={() => settle(debt, 'cash')}
                    className="p-2 rounded-lg bg-green-500 text-white font-semibold disabled:opacity-50 active:scale-95 transition-transform"
                  >
                    💵 Reçu en liquide
                  </button>
                  <button
                    disabled={busy === debt.id}
                    onClick={() => settle(debt, 'account')}
                    className="p-2 rounded-lg bg-blue-500 text-white font-semibold disabled:opacity-50 active:scale-95 transition-transform"
                  >
                    🏦 Reçu par virement
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
