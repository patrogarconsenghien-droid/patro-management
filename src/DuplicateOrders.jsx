import React, { useMemo, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { formatCurrency, formatDateTime, plural } from './lib/format';
import { seasonLabel } from './lib/seasons';

// Deux commandes identiques (même membre, mêmes articles, même montant)
// espacées de moins de ce délai sont considérées comme une même rafale.
const BURST_WINDOW_MS = 10000;

const signatureOf = (order) => {
  const items = (order.items || [])
    .map((item) => `${item.quantity}x${item.productId}`)
    .sort()
    .join('|');
  return `${order.memberId}#${order.type}#${order.amount}#${items}`;
};

const describeItems = (order) =>
  (order.items || []).map((item) => `${item.quantity}× ${item.productName}`).join(', ') ||
  (order.type === 'order' ? 'Commande' : 'Rechargement');

/** Regroupe les commandes identiques passées en rafale. */
export function findOrderBursts(orders = []) {
  const bySignature = new Map();

  orders
    .filter((order) => order.timestamp && order.memberId)
    .map((order) => ({ ...order, _time: Date.parse(order.timestamp) }))
    .filter((order) => Number.isFinite(order._time))
    .sort((a, b) => a._time - b._time)
    .forEach((order) => {
      const key = signatureOf(order);
      if (!bySignature.has(key)) bySignature.set(key, []);
      bySignature.get(key).push(order);
    });

  const bursts = [];
  bySignature.forEach((list) => {
    let run = [list[0]];
    for (let i = 1; i <= list.length; i += 1) {
      const order = list[i];
      if (order && order._time - run[run.length - 1]._time < BURST_WINDOW_MS) {
        run.push(order);
      } else {
        if (run.length > 1) bursts.push(run);
        run = order ? [order] : [];
      }
    }
  });

  return bursts.sort((a, b) => b[0]._time - a[0]._time);
}

/**
 * Doublons de commandes.
 *
 * Quand le réseau est mauvais, « Valider » attendait le serveur sans rien
 * afficher : chaque nouvel appui créait une commande de plus, et tout partait
 * au retour du réseau. Cet écran liste ces rafales et laisse choisir quoi
 * supprimer. Par défaut, la première commande de chaque rafale est gardée.
 */
const DuplicateOrders = ({ Header, navigateTo, orders = [], deleteFromFirebase, viewedSeasonId }) => {
  const bursts = useMemo(() => findOrderBursts(orders), [orders]);

  const [selected, setSelected] = useState(() => new Set(
    bursts.flatMap((run) => run.slice(1).map((order) => order.id))
  ));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const toggle = (id) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const selectedOrders = bursts.flat().filter((order) => selected.has(order.id));
  const selectedAmount = selectedOrders.reduce((sum, order) => sum + (order.amount || 0), 0);

  const deleteSelected = async () => {
    if (selectedOrders.length === 0) return;
    const ok = confirm(
      `Supprimer ${plural(selectedOrders.length, 'commande')} pour un total de ${formatCurrency(selectedAmount)} ?\n\n` +
      'Les ardoises concernées seront corrigées. Le stock ne sera pas modifié.'
    );
    if (!ok) return;

    setRunning(true);
    let deleted = 0;
    const failures = [];
    for (const order of selectedOrders) {
      try {
        await deleteFromFirebase('orders', order.id);
        deleted += 1;
      } catch (error) {
        console.error('Suppression du doublon impossible:', order.id, error);
        failures.push(order.id);
      }
    }
    setRunning(false);
    setResult({ deleted, failures });
    setSelected(new Set());
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <Header title="Commandes en double" onBack={() => navigateTo('settings')} />

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-lg shadow-sm p-4 text-sm text-gray-700 space-y-2">
          <p>
            Commandes identiques — même membre, mêmes articles, même montant — passées à moins
            de 10 secondes d'intervalle, sur la {seasonLabel(viewedSeasonId)}.
          </p>
          <p className="text-gray-500">
            Vérifie chaque rafale : une vraie deuxième tournée peut aussi apparaître ici.
            Le stock n'est pas modifié, car lors de ces rafales il n'avait été décompté qu'une fois.
          </p>
        </div>

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
            {plural(result.deleted, 'commande supprimée', 'commandes supprimées')}.
            {result.failures.length > 0 && (
              <span className="block text-red-700 mt-1">
                {plural(result.failures.length, 'échec', 'échecs')} : relance la suppression.
              </span>
            )}
          </div>
        )}

        {bursts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
            Aucune commande en double sur cette saison.
          </div>
        ) : (
          bursts.map((run) => {
            const first = run[0];
            const seconds = String(Math.round((run[run.length - 1]._time - first._time) / 100) / 10).replace('.', ',');
            return (
              <div key={first.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{first.memberName}</h3>
                      <p className="text-sm text-gray-600">{describeItems(first)}</p>
                    </div>
                    <span className="flex-none text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">
                      {run.length} fois en {seconds} s
                    </span>
                  </div>
                </div>
                <ul className="divide-y divide-gray-100">
                  {run.map((order, index) => (
                    <li key={order.id}>
                      <label className="flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selected.has(order.id)}
                          onChange={() => toggle(order.id)}
                          className="w-5 h-5"
                        />
                        <span className="flex-1 text-gray-700">{formatDateTime(order.timestamp)}</span>
                        <span className="font-medium">{formatCurrency(order.amount)}</span>
                        {index === 0 && !selected.has(order.id) && (
                          <span className="text-xs text-green-700">gardée</span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}

        {bursts.length > 0 && (
          <div className="sticky bottom-4 bg-white rounded-lg shadow-lg p-4 space-y-3">
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <AlertTriangle size={18} className="text-orange-500 flex-none mt-0.5" />
              <span>
                {plural(selectedOrders.length, 'commande sélectionnée', 'commandes sélectionnées')},{' '}
                soit <strong>{formatCurrency(selectedAmount)}</strong> retirés des ardoises.
              </span>
            </div>
            <button
              onClick={deleteSelected}
              disabled={running || selectedOrders.length === 0}
              className="w-full p-3 bg-red-500 text-white rounded-lg font-semibold disabled:bg-gray-300 active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              <Trash2 size={18} />
              {running ? 'Suppression en cours…' : 'Supprimer la sélection'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DuplicateOrders;
