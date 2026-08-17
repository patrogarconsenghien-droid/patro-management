import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { AlertTriangle, Check } from 'lucide-react';
import { db } from './firebase';
import { formatCurrency, openingBalanceOf, plural } from './lib/format';
import { collectionPath, seasonLabel } from './lib/seasons';
import { computeMemberBalances } from './lib/seasonRollover';

/**
 * Rattrapage des soldes d'ouverture.
 *
 * Une saison ouverte par une clôture reprend le solde de ses membres, mais pas
 * l'historique des commandes. Comme les écrans du bar recalculent le solde à
 * partir de cet historique, le report doit être stocké dans `openingBalance`
 * pour être visible. Cet écran (re)calcule ce point de départ à partir de la
 * saison précédente, et affiche chaque écart avant d'écrire quoi que ce soit.
 */
const RepairBalances = ({
  Header,
  navigateTo,
  activeSeasonId,
  viewedSeasonId,
  seasons = [],
  members = [],
  orders = [],
  updateInFirebase
}) => {
  const [previous, setPrevious] = useState(null);
  const [loadingPrevious, setLoadingPrevious] = useState(true);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(null);

  const seasonDoc = seasons.find((s) => s.id === viewedSeasonId);
  const previousSeasonId = seasonDoc?.createdFrom || null;

  useEffect(() => {
    if (!previousSeasonId) {
      setLoadingPrevious(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [membersSnap, ordersSnap] = await Promise.all([
          getDocs(collection(db, ...collectionPath(previousSeasonId, 'members'))),
          getDocs(collection(db, ...collectionPath(previousSeasonId, 'orders')))
        ]);
        if (cancelled) return;
        setPrevious({
          members: membersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          orders: ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        });
      } catch (error) {
        console.error('Lecture de la saison précédente impossible:', error);
      } finally {
        if (!cancelled) setLoadingPrevious(false);
      }
    })();

    return () => { cancelled = true; };
  }, [previousSeasonId]);

  // Ce que les membres avaient réellement à la clôture, recalculé depuis
  // l'historique de la saison précédente.
  const plan = useMemo(() => {
    if (!previous) return [];

    const carried = computeMemberBalances({
      members: previous.members,
      orders: previous.orders
    });

    // Mouvements déjà enregistrés dans la saison en cours : le solde stocké
    // doit en tenir compte, sinon on écraserait une activité récente.
    const delta = new Map(members.map((m) => [m.id, 0]));
    orders.forEach((order) => {
      if (!delta.has(order.memberId)) return;
      const amount = order.amount || 0;
      const current = delta.get(order.memberId);
      if (order.type === 'order') delta.set(order.memberId, current - amount);
      else if (order.type === 'recharge' || order.type === 'repayment') {
        delta.set(order.memberId, current + amount);
      }
    });

    return members.map((member) => {
      const opening = Math.round((carried.get(member.id) || 0) * 100) / 100;
      return {
        id: member.id,
        nom: member.name,
        ouvertureActuelle: openingBalanceOf(member),
        ouvertureCorrigee: opening,
        soldeCorrige: Math.round((opening + (delta.get(member.id) || 0)) * 100) / 100
      };
    });
  }, [previous, members, orders]);

  const changes = plan.filter(
    (p) => Math.abs(p.ouvertureActuelle - p.ouvertureCorrigee) > 0.005
  );
  const totalDebt = plan.filter((p) => p.soldeCorrige < 0).reduce((s, p) => s + p.soldeCorrige, 0);
  const totalCredit = plan.filter((p) => p.soldeCorrige > 0).reduce((s, p) => s + p.soldeCorrige, 0);

  const apply = async () => {
    setRunning(true);
    let written = 0;
    const failures = [];

    for (const item of changes) {
      try {
        await updateInFirebase('members', item.id, {
          openingBalance: item.ouvertureCorrigee,
          balance: item.soldeCorrige
        });
        written += 1;
      } catch (error) {
        console.error(`Échec sur ${item.nom}:`, error);
        failures.push(item.nom);
      }
    }

    setRunning(false);
    setDone({ written, failures });
  };

  if (viewedSeasonId !== activeSeasonId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Réparer les soldes" onBack={() => navigateTo('settings')} />
        <div className="p-4">
          <p className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-sm text-orange-800">
            Reviens sur la saison en cours pour lancer la réparation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <Header title="Réparer les soldes" onBack={() => navigateTo('settings')} />

      <div className="p-4">
        {loadingPrevious && <p className="text-sm text-gray-500">Lecture de la saison précédente…</p>}

        {!loadingPrevious && !previousSeasonId && (
          <p className="bg-gray-100 rounded-lg p-4 text-sm text-gray-600">
            La {seasonLabel(viewedSeasonId)} n'a pas été ouverte par une clôture :
            il n'y a aucun solde à reporter.
          </p>
        )}

        {previous && (
          <>
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <p className="text-sm text-gray-700">
                Les soldes sont recalculés depuis les{' '}
                <strong>{plural(previous.orders.length, 'commande')}</strong> de la{' '}
                {seasonLabel(previousSeasonId)} — le même calcul que celui affiché
                dans la section Bar.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-lg shadow-sm p-3">
                <p className="text-xs text-gray-500">Dettes après réparation</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(Math.abs(totalDebt))}</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-3">
                <p className="text-xs text-gray-500">Crédits après réparation</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(totalCredit)}</p>
              </div>
            </div>

            {changes.length === 0 ? (
              <p className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
                Rien à corriger : les soldes d'ouverture sont déjà à jour.
              </p>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                <h3 className="font-semibold mb-3">
                  {plural(changes.length, 'membre')} à corriger
                </h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {changes.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-1.5">
                      <span className="truncate pr-2">{item.nom}</span>
                      <span className="whitespace-nowrap">
                        <span className="text-gray-400 line-through mr-2">
                          {formatCurrency(item.ouvertureActuelle)}
                        </span>
                        <span className={item.soldeCorrige < 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                          {formatCurrency(item.soldeCorrige)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {done ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
                {plural(done.written, 'membre')} mis à jour.
                {done.failures.length > 0 && (
                  <span className="block text-red-700 mt-1">
                    Échecs : {done.failures.join(', ')}. Relance la réparation.
                  </span>
                )}
              </div>
            ) : changes.length > 0 && (
              <>
                <div className="flex items-start space-x-2 mb-3">
                  <AlertTriangle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700">
                    Seuls les soldes de la saison en cours sont modifiés.
                    La {seasonLabel(previousSeasonId)} n'est pas touchée.
                  </p>
                </div>

                <button
                  onClick={apply}
                  disabled={running}
                  className="w-full p-4 bg-purple-500 text-white rounded-lg font-semibold disabled:bg-gray-300 active:scale-95 transition-transform flex items-center justify-center space-x-2"
                >
                  <Check size={18} />
                  <span>{running ? 'Correction en cours…' : 'Appliquer la correction'}</span>
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RepairBalances;
