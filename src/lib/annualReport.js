// Construction du rapport annuel à partir des données déjà chargées depuis
// Firestore. Tout est calculé en mémoire : aucune lecture supplémentaire.
//
// Convention de trésorerie de l'app (cf. écran Objectif financier) :
//  - une commande ('order') est débitée du solde du membre, ce n'est PAS une
//    entrée d'argent ;
//  - l'argent entre via les rechargements / remboursements, les boulots payés
//    et les rentrées manuelles ;
//  - l'argent sort via les frais manuels.
// Le rapport garde ces deux plans séparés pour ne rien compter deux fois.

import { roundHours } from './format';

// Une saison démarre le 1er août (mois 7) et se termine le 31 juillet.
export const SEASON_START_MONTH = 7;

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// Abréviations explicites : tronquer à 3 lettres donnerait « Jui » pour juin
// comme pour juillet.
const MONTHS_SHORT = [
  'Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'
];

export const CATEGORY_LABELS = {
  sales: 'Ventes',
  events: 'Événements',
  donations: 'Dons',
  subsidies: 'Subsides',
  supplies: 'Fournitures',
  maintenance: 'Entretien',
  utilities: 'Charges',
  bank_transfer: 'Mouvement bancaire',
  other: 'Autre'
};

export const categoryLabel = (key) => CATEGORY_LABELS[key] || key || 'Autre';

/**
 * Les dates arrivent sous plusieurs formes selon l'écran qui a écrit le
 * document : ISO string, 'YYYY-MM-DD', ou Timestamp Firestore.
 */
export const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value) ? null : value;
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  if (typeof value.toDate === 'function') {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  const parsed = new Date(value);
  return isNaN(parsed) ? null : parsed;
};

const orderDate = (order) => toDate(order.timestamp) || toDate(order.createdAt);
const jobDate = (job) => toDate(job.date) || toDate(job.paidAt) || toDate(job.createdAt);
const transactionDate = (t) => toDate(t.timestamp) || toDate(t.createdAt);
const movementDate = (m) => toDate(m.timestamp) || toDate(m.createdAt);

/**
 * Période couverte par le rapport.
 * - 'calendar' : 1er janvier -> 31 décembre
 * - 'patro'    : 1er août -> 31 juillet (l'année de fonctionnement de la
 *   section, celle qui a du sens pour un bilan de saison)
 */
export const getPeriod = (year, mode = 'calendar') => {
  if (mode === 'patro') {
    return {
      start: new Date(year, SEASON_START_MONTH, 1),
      end: new Date(year + 1, SEASON_START_MONTH, 1),
      label: `Saison ${year}–${year + 1}`
    };
  }
  return {
    start: new Date(year, 0, 1),
    end: new Date(year + 1, 0, 1),
    label: `Année ${year}`
  };
};

/**
 * Saison en cours. Avant août, on est encore dans la saison ouverte l'été
 * précédent : en juin 2026, la saison est « 2025–2026 ».
 */
export const getCurrentPatroYear = (today = new Date()) =>
  today.getMonth() >= SEASON_START_MONTH ? today.getFullYear() : today.getFullYear() - 1;

/** Années pour lesquelles il existe au moins une donnée. */
export const getAvailableYears = ({ orders = [], jobs = [], financialTransactions = [] }) => {
  const years = new Set();
  orders.forEach((o) => { const d = orderDate(o); if (d) years.add(d.getFullYear()); });
  jobs.forEach((j) => { const d = jobDate(j); if (d) years.add(d.getFullYear()); });
  financialTransactions.forEach((t) => { const d = transactionDate(t); if (d) years.add(d.getFullYear()); });

  const currentYear = new Date().getFullYear();
  years.add(currentYear);
  return [...years].sort((a, b) => b - a);
};

const inPeriod = (date, period) => date && date >= period.start && date < period.end;

/** Index des mois de la période, dans l'ordre chronologique. */
const buildMonthlyBuckets = (period) => {
  const buckets = [];
  const cursor = new Date(period.start);
  while (cursor < period.end) {
    buckets.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label: `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`,
      shortLabel: MONTHS_SHORT[cursor.getMonth()],
      barSales: 0,
      collected: 0,
      jobRevenue: 0,
      expenses: 0
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
};

const monthKey = (date) => `${date.getFullYear()}-${date.getMonth()}`;

const topOf = (map, key, limit) =>
  [...map.values()].sort((a, b) => b[key] - a[key]).slice(0, limit);

export function buildAnnualReport({
  year,
  mode = 'calendar',
  orders = [],
  jobs = [],
  financialTransactions = [],
  members = [],
  bros = [],
  products = [],
  stockMovements = [],
  sectionId = null
}) {
  const period = getPeriod(year, mode);
  const months = buildMonthlyBuckets(period);
  const monthsByKey = new Map(months.map((m) => [m.key, m]));

  // ---------------------------------------------------------------- Bar
  const periodOrders = orders
    .map((o) => ({ ...o, _date: orderDate(o) }))
    .filter((o) => inPeriod(o._date, period));

  const sales = periodOrders.filter((o) => o.type === 'order');
  const topUps = periodOrders.filter((o) => o.type === 'recharge' || o.type === 'repayment');

  const barRevenue = sales.reduce((sum, o) => sum + (o.amount || 0), 0);
  const collected = topUps.reduce((sum, o) => sum + (o.amount || 0), 0);

  const productStats = new Map();
  const memberStats = new Map();
  let itemsSold = 0;

  sales.forEach((order) => {
    const bucket = monthsByKey.get(monthKey(order._date));
    if (bucket) bucket.barSales += order.amount || 0;

    const memberName = order.memberName || 'Inconnu';
    const member = memberStats.get(memberName) || { name: memberName, total: 0, orders: 0 };
    member.total += order.amount || 0;
    member.orders += 1;
    memberStats.set(memberName, member);

    (order.items || []).forEach((item) => {
      const name = item.productName || 'Produit supprimé';
      const entry = productStats.get(name) || { name, quantity: 0, total: 0 };
      entry.quantity += item.quantity || 0;
      entry.total += item.total || 0;
      productStats.set(name, entry);
      itemsSold += item.quantity || 0;
    });
  });

  topUps.forEach((order) => {
    const bucket = monthsByKey.get(monthKey(order._date));
    if (bucket) bucket.collected += order.amount || 0;
  });

  const paymentSplit = { cash: 0, account: 0, unknown: 0 };
  topUps.forEach((o) => {
    const key = o.paymentMethod === 'cash' || o.paymentMethod === 'account' ? o.paymentMethod : 'unknown';
    paymentSplit[key] += o.amount || 0;
  });

  // ------------------------------------------------------------ Boulots
  const periodJobs = jobs
    .map((j) => ({ ...j, _date: jobDate(j) }))
    .filter((j) => inPeriod(j._date, period));

  const jobHours = roundHours(periodJobs.reduce((sum, j) => sum + (j.hours || 0), 0));
  const jobRevenue = periodJobs.reduce((sum, j) => sum + (j.total || 0), 0);
  const jobPaid = periodJobs.filter((j) => j.isPaid).reduce((sum, j) => sum + (j.total || 0), 0);
  const jobPending = jobRevenue - jobPaid;

  const broStats = new Map();
  periodJobs.forEach((job) => {
    const name = job.broName || 'Inconnu';
    const entry = broStats.get(name) || { name, hours: 0, total: 0, jobs: 0 };
    entry.hours += job.hours || 0;
    entry.total += job.total || 0;
    entry.jobs += 1;
    broStats.set(name, entry);

    if (job.isPaid) {
      const bucket = monthsByKey.get(monthKey(job._date));
      if (bucket) bucket.jobRevenue += job.total || 0;
    }
  });

  // ----------------------------------------------------------- Finances
  const periodTransactions = financialTransactions
    .map((t) => ({ ...t, _date: transactionDate(t) }))
    .filter((t) => inPeriod(t._date, period));

  // Les dépôts bancaires sont un déplacement caisse -> compte, pas une
  // rentrée ni un frais : on les sort des totaux pour ne pas gonfler le bilan.
  const realTransactions = periodTransactions.filter((t) => t.category !== 'bank_transfer');

  const income = realTransactions.filter((t) => t.type === 'income');
  const expenses = realTransactions.filter((t) => t.type === 'expense');
  const incomeTotal = income.reduce((sum, t) => sum + (t.amount || 0), 0);
  const expenseTotal = expenses.reduce((sum, t) => sum + (t.amount || 0), 0);

  expenses.forEach((t) => {
    const bucket = monthsByKey.get(monthKey(t._date));
    if (bucket) bucket.expenses += t.amount || 0;
  });
  income.forEach((t) => {
    const bucket = monthsByKey.get(monthKey(t._date));
    if (bucket) bucket.collected += t.amount || 0;
  });

  const byCategory = (list) => {
    const map = new Map();
    list.forEach((t) => {
      const label = categoryLabel(t.category);
      const entry = map.get(label) || { name: label, total: 0, count: 0 };
      entry.total += t.amount || 0;
      entry.count += 1;
      map.set(label, entry);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  };

  const biggestExpenses = [...expenses]
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))
    .slice(0, 5)
    .map((t) => ({ description: t.description, amount: t.amount, date: t._date }));

  // ------------------------------------------------------------ Membres
  const debtors = members
    .filter((m) => (m.balance || 0) < 0)
    .sort((a, b) => (a.balance || 0) - (b.balance || 0));
  const totalDebt = debtors.reduce((sum, m) => sum + (m.balance || 0), 0);
  const totalCredit = members
    .filter((m) => (m.balance || 0) > 0)
    .reduce((sum, m) => sum + (m.balance || 0), 0);

  // -------------------------------------------------------------- Stock
  const periodMovements = stockMovements.filter((m) => inPeriod(movementDate(m), period));
  const unitsSold = periodMovements
    .filter((m) => (m.quantityChange || 0) < 0)
    .reduce((sum, m) => sum + Math.abs(m.quantityChange), 0);
  const lowStock = products
    .filter((p) => (p.stock || 0) <= (p.alertThreshold || 0))
    .sort((a, b) => (a.stock || 0) - (b.stock || 0));

  // ------------------------------------------------------------- Totaux
  const totalIn = collected + jobPaid + incomeTotal;
  const netResult = totalIn - expenseTotal;

  return {
    meta: {
      year,
      mode,
      sectionId,
      label: period.label,
      start: period.start,
      end: period.end,
      generatedAt: new Date(),
      isEmpty: periodOrders.length === 0 && periodJobs.length === 0 && periodTransactions.length === 0
    },
    summary: {
      totalIn,
      expenseTotal,
      netResult,
      barRevenue,
      jobRevenue,
      jobHours
    },
    bar: {
      revenue: barRevenue,
      orderCount: sales.length,
      averageBasket: sales.length ? barRevenue / sales.length : 0,
      itemsSold,
      collected,
      topUpCount: topUps.length,
      paymentSplit,
      topProductsByQuantity: topOf(productStats, 'quantity', 10),
      topProductsByRevenue: topOf(productStats, 'total', 10),
      topMembers: topOf(memberStats, 'total', 10),
      activeMembers: memberStats.size
    },
    jobs: {
      count: periodJobs.length,
      hours: jobHours,
      revenue: jobRevenue,
      paid: jobPaid,
      pending: jobPending,
      averageRate: jobHours ? jobRevenue / jobHours : 0,
      activeBros: broStats.size,
      registeredBros: bros.length,
      topBros: [...broStats.values()]
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 10)
        .map((b) => ({ ...b, hours: roundHours(b.hours) }))
    },
    finance: {
      incomeTotal,
      expenseTotal,
      incomeCount: income.length,
      expenseCount: expenses.length,
      incomeByCategory: byCategory(income),
      expenseByCategory: byCategory(expenses),
      biggestExpenses
    },
    members: {
      total: members.length,
      external: members.filter((m) => m.isExternal).length,
      active: memberStats.size,
      debtorCount: debtors.length,
      totalDebt,
      totalCredit,
      topDebtors: debtors.slice(0, 10).map((m) => ({ name: m.name, balance: m.balance }))
    },
    stock: {
      movements: periodMovements.length,
      unitsSold,
      productCount: products.length,
      lowStock: lowStock.slice(0, 10).map((p) => ({ name: p.name, stock: p.stock, threshold: p.alertThreshold }))
    },
    months
  };
}
