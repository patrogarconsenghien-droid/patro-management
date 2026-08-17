import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { formatCurrency, plural, roundHours } from './lib/format';
import { nextSeasonId, seasonLabel } from './lib/seasons';
import {
  buildRolloverPreview,
  carriedBalance,
  computeTreasury,
  defaultChoices,
  executeRollover,
  fetchTripCounts
} from './lib/seasonRollover';

const Section = ({ title, hint, children }) => (
  <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
    <h3 className="font-semibold">{title}</h3>
    {hint && <p className="text-xs text-gray-500 mt-0.5 mb-3">{hint}</p>}
    <div className={hint ? '' : 'mt-3'}>{children}</div>
  </div>
);

const Choice = ({ selected, onSelect, label, detail }) => (
  <button
    onClick={onSelect}
    className={`w-full text-left p-3 rounded-lg border mb-2 active:scale-95 transition-transform ${
      selected ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white'
    }`}
  >
    <div className="flex items-start space-x-2">
      <div
        className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
          selected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
        }`}
      >
        {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-xs text-gray-500 mt-0.5">{detail}</p>}
      </div>
    </div>
  </button>
);

const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center space-x-2 mb-3 cursor-pointer">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 accent-purple-500"
    />
    <span className="text-sm">{label}</span>
  </label>
);

const CloseSeason = ({
  Header,
  navigateTo,
  activeSeasonId,
  viewedSeasonId,
  products = [],
  members = [],
  bros = [],
  jobs = [],
  orders = [],
  financialTransactions = [],
  barOpenThreshold,
  hourlyRate,
  surpriseSettings,
  popularProducts,
  financialGoal
}) => {
  const [choices, setChoices] = useState(defaultChoices);
  const [tripCounts, setTripCounts] = useState({ expenses: 0, events: 0 });
  const [confirmText, setConfirmText] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);

  const toSeasonId = nextSeasonId(activeSeasonId);
  const onActiveSeason = viewedSeasonId === activeSeasonId;

  const treasury = useMemo(
    () => computeTreasury({ orders, jobs, financialTransactions }),
    [orders, jobs, financialTransactions]
  );

  const [openingCash, setOpeningCash] = useState('');
  const [openingAccount, setOpeningAccount] = useState('');

  useEffect(() => {
    setOpeningCash(treasury.cash.toFixed(2));
    setOpeningAccount(treasury.account.toFixed(2));
  }, [treasury.cash, treasury.account]);

  useEffect(() => {
    fetchTripCounts(activeSeasonId).then(setTripCounts);
  }, [activeSeasonId]);

  const preview = useMemo(
    () => buildRolloverPreview({ choices, products, members, bros, jobs, tripCounts }),
    [choices, products, members, bros, jobs, tripCounts]
  );

  const set = (path, value) =>
    setChoices((current) => {
      const next = { ...current };
      const [head, leaf] = path.split('.');
      if (leaf) next[head] = { ...current[head], [leaf]: value };
      else next[head] = value;
      return next;
    });

  const debtTotal = members.reduce((sum, m) => (m.balance < 0 ? sum + m.balance : sum), 0);
  const creditTotal = members.reduce((sum, m) => (m.balance > 0 ? sum + m.balance : sum), 0);

  const run = async () => {
    setRunning(true);
    setProgress({ done: 0, total: 0 });
    try {
      const result = await executeRollover({
        fromSeasonId: activeSeasonId,
        toSeasonId,
        choices,
        data: {
          products,
          members,
          bros,
          jobs,
          barSettings: barOpenThreshold,
          hourlyRate,
          surpriseSettings,
          popularProducts,
          financialGoal
        },
        opening: {
          cash: choices.openingBalance === 'carry' ? Number(openingCash) || 0 : 0,
          account: choices.openingBalance === 'carry' ? Number(openingAccount) || 0 : 0
        },
        onProgress: (done, total) => setProgress({ done, total })
      });

      alert(
        `✅ ${seasonLabel(toSeasonId)} ouverte !\n\n` +
        `${result.documentsCreated} éléments repris.\n` +
        `La ${seasonLabel(activeSeasonId)} reste consultable dans les paramètres.`
      );
      navigateTo('settings');
    } catch (error) {
      console.error('Clôture impossible:', error);
      alert(
        `❌ La clôture a échoué :\n${error.message}\n\n` +
        "La saison en cours n'a pas changé, tu peux relancer l'opération."
      );
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  if (!onActiveSeason) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Clôturer la saison" onBack={() => navigateTo('settings')} />
        <div className="p-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-sm text-orange-800">
            Tu consultes une saison archivée. Reviens sur la {seasonLabel(activeSeasonId)}
            {' '}pour pouvoir la clôturer.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <Header title="Clôturer la saison" onBack={() => navigateTo('settings')} />

      <div className="p-4">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-purple-900">
            <strong>{seasonLabel(activeSeasonId)}</strong> sera archivée, et
            {' '}<strong>{seasonLabel(toSeasonId)}</strong> deviendra la saison en cours.
          </p>
          <p className="text-xs text-purple-700 mt-2">
            Rien n'est supprimé : l'historique complet reste consultable, et tu pourras
            encore y ajouter une dépense en retard.
          </p>
        </div>

        <Section
          title="Produits"
          hint={`${products.length} produits à la carte`}
        >
          <Toggle
            checked={choices.products.keep}
            onChange={(v) => set('products.keep', v)}
            label="Reprendre la carte des produits"
          />
          {choices.products.keep && (
            <>
              <Choice
                selected={choices.products.stock === 'carry'}
                onSelect={() => set('products.stock', 'carry')}
                label="Reporter le stock actuel"
                detail={`${products.reduce((s, p) => s + (p.stock || 0), 0)} unités reprises telles quelles`}
              />
              <Choice
                selected={choices.products.stock === 'zero'}
                onSelect={() => set('products.stock', 'zero')}
                label="Repartir d'un stock à zéro"
                detail="À saisir ensuite via un inventaire"
              />
            </>
          )}
        </Section>

        <Section title="Membres" hint={`${members.length} membres`}>
          <Toggle
            checked={choices.members.keep}
            onChange={(v) => set('members.keep', v)}
            label="Reprendre la liste des membres"
          />
          {choices.members.keep && (
            <>
              <Choice
                selected={choices.members.balances === 'carry'}
                onSelect={() => set('members.balances', 'carry')}
                label="Reporter tous les soldes"
                detail={`${formatCurrency(Math.abs(debtTotal))} de dettes et ${formatCurrency(creditTotal)} de crédits suivent`}
              />
              <Choice
                selected={choices.members.balances === 'debtsOnly'}
                onSelect={() => set('members.balances', 'debtsOnly')}
                label="Reporter les dettes, effacer les crédits"
                detail={`${formatCurrency(Math.abs(debtTotal))} à récupérer, ${formatCurrency(creditTotal)} offerts`}
              />
              <Choice
                selected={choices.members.balances === 'creditsOnly'}
                onSelect={() => set('members.balances', 'creditsOnly')}
                label="Reporter les crédits, effacer les dettes"
                detail={`${formatCurrency(Math.abs(debtTotal))} de créances abandonnées`}
              />
              <Choice
                selected={choices.members.balances === 'zero'}
                onSelect={() => set('members.balances', 'zero')}
                label="Tout remettre à zéro"
                detail="Ardoise effacée pour tout le monde"
              />
            </>
          )}
        </Section>

        <Section title="Bro" hint={`${bros.length} Bro`}>
          <Toggle
            checked={choices.bros.keep}
            onChange={(v) => set('bros.keep', v)}
            label="Reprendre la liste des Bro"
          />
          {choices.bros.keep && (
            <>
              <Choice
                selected={choices.bros.hours === 'zero'}
                onSelect={() => set('bros.hours', 'zero')}
                label="Remettre les heures à zéro"
                detail="Chaque saison repart de 0 h"
              />
              <Choice
                selected={choices.bros.hours === 'carry'}
                onSelect={() => set('bros.hours', 'carry')}
                label="Reporter les heures cumulées"
                detail={`${roundHours(bros.reduce((s, b) => s + (b.totalHours || 0), 0))} h au total`}
              />
            </>
          )}
        </Section>

        <Section
          title="Boulots non payés"
          hint={`${plural(jobs.filter((j) => !j.isPaid).length, 'boulot')} en attente de paiement`}
        >
          <Choice
            selected={choices.unpaidJobs === 'leave'}
            onSelect={() => set('unpaidJobs', 'leave')}
            label="Les laisser dans la saison close"
            detail="Tu iras les marquer payés dans l'ancienne saison"
          />
          <Choice
            selected={choices.unpaidJobs === 'copy'}
            onSelect={() => set('unpaidJobs', 'copy')}
            label="Les recopier dans la nouvelle saison"
            detail="Pratique pour ne pas les oublier, mais le montant apparaît alors dans les deux saisons"
          />
        </Section>

        <Section title="Réglages">
          <Toggle
            checked={choices.settings.hourlyRate}
            onChange={(v) => set('settings.hourlyRate', v)}
            label={`Tarif horaire des boulots (${formatCurrency(hourlyRate)}/h)`}
          />
          <Toggle
            checked={choices.settings.barThreshold}
            onChange={(v) => set('settings.barThreshold', v)}
            label={`Seuil d'ouverture du bar (${barOpenThreshold})`}
          />
          <Toggle
            checked={choices.settings.surprise}
            onChange={(v) => set('settings.surprise', v)}
            label="Configuration du verre surprise"
          />
          <Toggle
            checked={choices.settings.popular}
            onChange={(v) => set('settings.popular', v)}
            label="Produits populaires"
          />
        </Section>

        <Section title="Objectif financier">
          <Choice
            selected={choices.financialGoal === 'reset'}
            onSelect={() => set('financialGoal', 'reset')}
            label="Repartir sans objectif"
          />
          <Choice
            selected={choices.financialGoal === 'copy'}
            onSelect={() => set('financialGoal', 'copy')}
            label="Reprendre l'objectif actuel"
            detail={financialGoal?.isActive ? formatCurrency(financialGoal.amount) : 'Aucun objectif actif'}
          />
        </Section>

        <Section
          title="Trésorerie d'ouverture"
          hint="Sans report, la nouvelle saison démarre à zéro et l'argent réellement en caisse disparaît du bilan."
        >
          <Choice
            selected={choices.openingBalance === 'carry'}
            onSelect={() => set('openingBalance', 'carry')}
            label="Reporter le solde"
            detail={`Calculé : ${formatCurrency(treasury.cash)} en caisse, ${formatCurrency(treasury.account)} sur le compte`}
          />
          <Choice
            selected={choices.openingBalance === 'zero'}
            onSelect={() => set('openingBalance', 'zero')}
            label="Démarrer à zéro"
          />

          {choices.openingBalance === 'carry' && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Caisse (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Compte (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={openingAccount}
                  onChange={(e) => setOpeningAccount(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <p className="col-span-2 text-xs text-gray-500">
                Corrige les montants si le compte réel diffère du calcul.
              </p>
            </div>
          )}
        </Section>

        <Section
          title="Section Voyage"
          hint={`${plural(tripCounts.expenses, 'dépense')}, ${plural(tripCounts.events, 'événement')}`}
        >
          <Choice
            selected={choices.trip === 'reset'}
            onSelect={() => set('trip', 'reset')}
            label="Repartir de zéro"
            detail="Le voyage de la saison close reste consultable dans son archive"
          />
          <Choice
            selected={choices.trip === 'settings'}
            onSelect={() => set('trip', 'settings')}
            label="Reprendre seulement les réglages"
            detail="Dates, protection par mot de passe"
          />
          <Choice
            selected={choices.trip === 'full'}
            onSelect={() => set('trip', 'full')}
            label="Reprendre tout le voyage"
            detail="Réglages, dépenses et événements recopiés"
          />
        </Section>

        {/* Récapitulatif */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4 border-2 border-purple-200">
          <h3 className="font-semibold mb-3">Ce qui sera repris</h3>
          <ul className="text-sm space-y-1.5">
            <li className="flex justify-between">
              <span>Produits</span><span className="font-medium">{preview.products}</span>
            </li>
            <li className="flex justify-between">
              <span>Stock reporté</span><span className="font-medium">{preview.carriedStock} unités</span>
            </li>
            <li className="flex justify-between">
              <span>Membres</span><span className="font-medium">{preview.members}</span>
            </li>
            <li className="flex justify-between">
              <span>Dettes reportées</span>
              <span className="font-medium text-red-600">{formatCurrency(Math.abs(preview.carriedDebt))}</span>
            </li>
            <li className="flex justify-between">
              <span>Crédits reportés</span>
              <span className="font-medium text-green-600">{formatCurrency(preview.carriedCredit)}</span>
            </li>
            <li className="flex justify-between">
              <span>Bro</span><span className="font-medium">{preview.bros}</span>
            </li>
            <li className="flex justify-between">
              <span>Heures reportées</span><span className="font-medium">{preview.carriedHours} h</span>
            </li>
            <li className="flex justify-between">
              <span>Boulots non payés recopiés</span>
              <span className="font-medium">{preview.unpaidJobs}</span>
            </li>
            <li className="flex justify-between">
              <span>Trésorerie d'ouverture</span>
              <span className="font-medium">
                {choices.openingBalance === 'carry'
                  ? formatCurrency((Number(openingCash) || 0) + (Number(openingAccount) || 0))
                  : formatCurrency(0)}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Voyage</span>
              <span className="font-medium">
                {choices.trip === 'reset' ? 'rien' :
                  choices.trip === 'settings' ? 'réglages' :
                    `${preview.tripExpenses} dépenses, ${preview.tripEvents} événements`}
              </span>
            </li>
          </ul>
        </div>

        {/* Confirmation */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-start space-x-2 mb-3">
            <AlertTriangle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">
              Pour confirmer, écris <strong>{toSeasonId}</strong> ci-dessous.
            </p>
          </div>

          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={toSeasonId}
            className="w-full p-3 border-2 border-gray-200 rounded-lg text-center font-mono mb-3 focus:border-purple-500 focus:outline-none"
          />

          {progress && (
            <p className="text-sm text-gray-600 text-center mb-3">
              Création en cours… {progress.done}/{progress.total}
            </p>
          )}

          <button
            onClick={run}
            disabled={confirmText.trim() !== toSeasonId || running}
            className="w-full p-4 bg-purple-500 text-white rounded-lg font-semibold disabled:bg-gray-300 active:scale-95 transition-transform flex items-center justify-center space-x-2"
          >
            <Check size={18} />
            <span>{running ? 'Clôture en cours…' : `Ouvrir la ${seasonLabel(toSeasonId)}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CloseSeason;
