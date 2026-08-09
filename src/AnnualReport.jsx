import React, { useMemo, useState } from 'react';
import { Download, Printer, TrendingDown, TrendingUp } from 'lucide-react';
import { formatCurrency, plural } from './lib/format';
import { buildAnnualReport, getAvailableYears, getCurrentPatroYear } from './lib/annualReport';
import { downloadReport, printReport } from './lib/reportExport';

const Kpi = ({ label, value, hint, tone = 'neutral' }) => {
  const tones = {
    neutral: 'text-gray-900',
    positive: 'text-green-600',
    negative: 'text-red-600'
  };
  return (
    <div className="bg-white rounded-lg shadow-sm p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${tones[tone]}`}>{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
};

const Section = ({ title, icon, children }) => (
  <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
    <h3 className="font-semibold mb-3 flex items-center space-x-2">
      {icon && <span>{icon}</span>}
      <span>{title}</span>
    </h3>
    {children}
  </div>
);

const Ranking = ({ rows, empty }) => {
  if (!rows.length) return <p className="text-sm text-gray-400 italic">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.weight), 1);

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="truncate pr-2">
              <span className="text-gray-400 mr-1.5">{index + 1}.</span>
              {row.label}
            </span>
            <span className="font-medium whitespace-nowrap">{row.value}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
            <div
              className="h-full bg-purple-400 rounded-full"
              style={{ width: `${Math.round((row.weight / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const AnnualReport = ({
  Header,
  navigateTo,
  orders = [],
  jobs = [],
  financialTransactions = [],
  members = [],
  bros = [],
  products = [],
  stockMovements = []
}) => {
  const availableYears = useMemo(
    () => getAvailableYears({ orders, jobs, financialTransactions }),
    [orders, jobs, financialTransactions]
  );

  const [year, setYear] = useState(availableYears[0] ?? new Date().getFullYear());
  const [mode, setMode] = useState('calendar');

  const currentPatroYear = getCurrentPatroYear();

  const changeMode = (next) => {
    setMode(next);
    // Sans ça, passer en mode patro depuis 2026 ouvrirait « 2026–2027 »,
    // une saison qui n'a pas encore commencé.
    if (next === 'patro') setYear((current) => Math.min(current, currentPatroYear));
  };

  const report = useMemo(
    () => buildAnnualReport({
      year, mode, orders, jobs, financialTransactions, members, bros, products, stockMovements
    }),
    [year, mode, orders, jobs, financialTransactions, members, bros, products, stockMovements]
  );

  const { summary, bar, jobs: jobStats, finance, members: memberStats, stock, months } = report;
  const maxMonth = Math.max(...months.map((m) => m.barSales), 1);

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <Header title="Rapport annuel" onBack={() => navigateTo('settings')} />

      <div className="p-4">
        {/* Sélection de la période */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex items-center space-x-2 mb-3">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="flex-1 p-2 border rounded-lg bg-white"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {mode === 'patro' ? `${y} – ${y + 1}` : y}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'calendar', label: 'Année civile', hint: 'janv. → déc.' },
              { key: 'patro', label: 'Année patro', hint: 'sept. → août' }
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => changeMode(option.key)}
                className={`p-2 rounded-lg border text-sm active:scale-95 transition-transform ${
                  mode === option.key
                    ? 'bg-purple-500 text-white border-purple-500'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                <span className="block font-medium">{option.label}</span>
                <span className={`block text-xs ${mode === option.key ? 'text-purple-100' : 'text-gray-400'}`}>
                  {option.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        {report.meta.isEmpty && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4 text-sm text-orange-800">
            Aucune donnée enregistrée sur cette période. Choisis une autre année.
          </div>
        )}

        {/* Synthèse */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Kpi label="Total encaissé" value={formatCurrency(summary.totalIn)} tone="positive" />
          <Kpi label="Total dépensé" value={formatCurrency(summary.expenseTotal)} tone="negative" />
          <Kpi
            label="Résultat net"
            value={formatCurrency(summary.netResult)}
            tone={summary.netResult >= 0 ? 'positive' : 'negative'}
          />
          <Kpi
            label="Consommation bar"
            value={formatCurrency(summary.barRevenue)}
            hint={plural(bar.orderCount, 'commande')}
          />
        </div>

        <p className="text-xs text-gray-500 bg-gray-100 border-l-4 border-gray-300 p-3 rounded-r-lg mb-4">
          Les commandes du bar sont débitées du solde des membres : elles mesurent la
          consommation, pas l'argent encaissé. Le total encaissé compte les rechargements,
          les boulots payés et les rentrées manuelles.
        </p>

        {/* Bar */}
        <Section title="Bar" icon="🍺">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Kpi label="Panier moyen" value={formatCurrency(bar.averageBasket)} />
            <Kpi label="Articles vendus" value={bar.itemsSold} />
            <Kpi label="Encaissé" value={formatCurrency(bar.collected)} hint={plural(bar.topUpCount, 'recharge')} />
            <Kpi label="Membres actifs" value={bar.activeMembers} />
          </div>

          <p className="text-xs text-gray-500 mb-2">
            Cash {formatCurrency(bar.paymentSplit.cash)} · Compte {formatCurrency(bar.paymentSplit.account)}
            {bar.paymentSplit.unknown > 0 && ` · Non précisé ${formatCurrency(bar.paymentSplit.unknown)}`}
          </p>

          <h4 className="text-xs uppercase tracking-wide text-gray-500 mt-4 mb-2">Top produits</h4>
          <Ranking
            empty="Aucune vente sur la période."
            rows={bar.topProductsByQuantity.slice(0, 5).map((p) => ({
              label: p.name,
              value: `${p.quantity} · ${formatCurrency(p.total)}`,
              weight: p.quantity
            }))}
          />

          <h4 className="text-xs uppercase tracking-wide text-gray-500 mt-4 mb-2">Top consommateurs</h4>
          <Ranking
            empty="Aucune commande sur la période."
            rows={bar.topMembers.slice(0, 5).map((m) => ({
              label: m.name,
              value: formatCurrency(m.total),
              weight: m.total
            }))}
          />
        </Section>

        {/* Boulots */}
        <Section title="Boulots" icon="🔧">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Kpi label="Boulots" value={jobStats.count} hint={`${jobStats.activeBros} Bro ${jobStats.activeBros >= 2 ? 'actifs' : 'actif'}`} />
            <Kpi label="Heures" value={`${jobStats.hours} h`} />
            <Kpi label="Montant total" value={formatCurrency(jobStats.revenue)} />
            <Kpi
              label="Reste à encaisser"
              value={formatCurrency(jobStats.pending)}
              tone={jobStats.pending > 0 ? 'negative' : 'positive'}
            />
          </div>

          <p className="text-xs text-gray-500 mb-3">
            Taux horaire moyen : {formatCurrency(jobStats.averageRate)}/h
          </p>

          <Ranking
            empty="Aucun boulot sur la période."
            rows={jobStats.topBros.slice(0, 5).map((b) => ({
              label: b.name,
              value: `${b.hours} h · ${formatCurrency(b.total)}`,
              weight: b.hours
            }))}
          />
        </Section>

        {/* Finances */}
        <Section title="Rentrées et frais" icon="💰">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Kpi
              label="Rentrées"
              value={formatCurrency(finance.incomeTotal)}
              hint={plural(finance.incomeCount, 'opération')}
              tone="positive"
            />
            <Kpi
              label="Frais"
              value={formatCurrency(finance.expenseTotal)}
              hint={plural(finance.expenseCount, 'opération')}
              tone="negative"
            />
          </div>

          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2 flex items-center">
            <TrendingUp size={14} className="mr-1 text-green-500" /> Rentrées par catégorie
          </h4>
          <Ranking
            empty="Aucune rentrée enregistrée."
            rows={finance.incomeByCategory.slice(0, 5).map((c) => ({
              label: c.name,
              value: formatCurrency(c.total),
              weight: c.total
            }))}
          />

          <h4 className="text-xs uppercase tracking-wide text-gray-500 mt-4 mb-2 flex items-center">
            <TrendingDown size={14} className="mr-1 text-red-500" /> Frais par catégorie
          </h4>
          <Ranking
            empty="Aucun frais enregistré."
            rows={finance.expenseByCategory.slice(0, 5).map((c) => ({
              label: c.name,
              value: formatCurrency(c.total),
              weight: c.total
            }))}
          />
        </Section>

        {/* Membres */}
        <Section title="Membres" icon="👥">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Kpi label="Inscrits" value={memberStats.total} hint={`${memberStats.external} externes`} />
            <Kpi
              label="Dettes à récupérer"
              value={formatCurrency(Math.abs(memberStats.totalDebt))}
              hint={plural(memberStats.debtorCount, 'membre')}
              tone="negative"
            />
          </div>
          <Ranking
            empty="Aucun solde négatif. 🎉"
            rows={memberStats.topDebtors.slice(0, 5).map((m) => ({
              label: m.name,
              value: formatCurrency(m.balance),
              weight: Math.abs(m.balance)
            }))}
          />
          <p className="text-xs text-gray-400 mt-3">
            Photo des soldes au moment de la génération, pas un cumul sur la période.
          </p>
        </Section>

        {/* Stock */}
        <Section title="Stock" icon="📦">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Kpi label="Unités sorties" value={stock.unitsSold} hint={plural(stock.movements, 'mouvement')} />
            <Kpi label="Produits à la carte" value={stock.productCount} />
          </div>
          {stock.lowStock.length > 0 && (
            <p className="text-xs text-orange-700 bg-orange-50 rounded-lg p-2">
              {plural(stock.lowStock.length, 'produit')} sous le seuil d'alerte :{' '}
              {stock.lowStock.slice(0, 4).map((p) => p.name).join(', ')}
              {stock.lowStock.length > 4 && '…'}
            </p>
          )}
        </Section>

        {/* Mois par mois */}
        <Section title="Mois par mois" icon="📅">
          <div className="space-y-2">
            {months.map((month) => (
              <div key={month.key}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>{month.shortLabel}</span>
                  <span className="text-gray-600">{formatCurrency(month.barSales)}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full"
                    style={{ width: `${Math.round((month.barSales / maxMonth) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">Consommation bar par mois.</p>
        </Section>

        {/* Export */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => downloadReport(report)}
            className="p-4 bg-purple-500 text-white rounded-lg shadow-md active:scale-95 transition-transform flex items-center justify-center space-x-2"
          >
            <Download size={18} />
            <span className="font-medium">Télécharger</span>
          </button>
          <button
            onClick={() => printReport(report)}
            className="p-4 bg-white text-purple-600 border border-purple-200 rounded-lg shadow-md active:scale-95 transition-transform flex items-center justify-center space-x-2"
          >
            <Printer size={18} />
            <span className="font-medium">Imprimer / PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnnualReport;
