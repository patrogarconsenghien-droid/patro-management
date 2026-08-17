// Passage d'une saison à la suivante.
//
// Principe : on ne déplace ni ne supprime jamais rien. La saison close garde
// l'intégralité de son historique (commandes, boulots, mouvements, écritures),
// et la nouvelle saison reçoit uniquement ce que la personne qui clôture a
// choisi de reprendre. Les deux saisons vivent ensuite côte à côte.
import {
  collection, doc, setDoc, getDocs, writeBatch, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { openingBalanceOf, roundHours } from './format';
import {
  collectionPath, CURRENT_SEASON_DOC, seasonBounds, seasonLabel
} from './seasons';

// Firestore plafonne à 500 opérations par lot ; on garde de la marge.
const BATCH_LIMIT = 400;

/** Tout est repris par défaut, sauf ce qui n'a de sens que pour une saison. */
export const defaultChoices = {
  products: { keep: true, stock: 'carry' },        // carry | zero
  members: { keep: true, balances: 'carry' },      // carry | zero | debtsOnly | creditsOnly
  bros: { keep: true, hours: 'zero' },             // zero | carry
  unpaidJobs: 'leave',                             // leave | copy
  settings: {
    hourlyRate: true,
    barThreshold: true,
    surprise: true,
    popular: true
  },
  financialGoal: 'reset',                          // reset | copy
  openingBalance: 'carry',                         // carry | zero
  trip: 'reset'                                    // reset | settings | full
};

const docRefIn = (seasonId, name, id) => {
  const path = collectionPath(seasonId, name);
  return id ? doc(db, ...path, id) : doc(collection(db, ...path));
};

/**
 * Trésorerie réelle de la saison : ce qui est physiquement rentré, réparti
 * entre caisse et compte.
 *
 * Les commandes du bar sont volontairement exclues : elles sont débitées du
 * solde des membres, ce n'est pas de l'argent encaissé. Un paiement direct au
 * bar génère de son côté un rechargement, qui lui est bien compté.
 */
export function computeTreasury({ orders = [], jobs = [], financialTransactions = [] }) {
  const totals = { cash: 0, account: 0 };

  const add = (method, amount) => {
    if (method === 'cash') totals.cash += amount;
    else if (method === 'account') totals.account += amount;
  };

  orders.forEach((order) => {
    if (order.type === 'recharge' || order.type === 'repayment') {
      add(order.paymentMethod, order.amount || 0);
    }
  });

  jobs.forEach((job) => {
    if (job.isPaid) add(job.paymentMethod, job.total || 0);
  });

  // Les dépôts bancaires sont inclus : ils déplacent de l'argent de la caisse
  // vers le compte, ils changent donc bien la répartition (et s'annulent sur
  // le total).
  financialTransactions.forEach((t) => {
    add(t.paymentMethod, t.type === 'income' ? (t.amount || 0) : -(t.amount || 0));
  });

  return { ...totals, total: totals.cash + totals.account };
}

/**
 * Solde réel de chaque membre, recalculé depuis l'historique des commandes de
 * la saison, exactement comme l'affichent les écrans du bar.
 *
 * C'est cette valeur qui fait foi, et non le champ `balance` stocké sur le
 * membre : les deux ont divergé au fil des corrections d'historique, et le
 * recalcul est celui que les membres ont sous les yeux.
 *
 * On repart du solde d'ouverture de la saison, sinon un report serait perdu
 * à chaque clôture successive.
 */
export function computeMemberBalances({ members = [], orders = [] }) {
  const balances = new Map(members.map((m) => [m.id, openingBalanceOf(m)]));

  orders.forEach((order) => {
    if (!balances.has(order.memberId)) return;
    const amount = order.amount || 0;
    const current = balances.get(order.memberId);

    if (order.type === 'order') balances.set(order.memberId, current - amount);
    else if (order.type === 'recharge' || order.type === 'repayment') {
      balances.set(order.memberId, current + amount);
    }
  });

  return balances;
}

/** Solde d'un membre après application du choix de report. */
export const carriedBalance = (balance, mode) => {
  const value = balance || 0;
  switch (mode) {
    case 'zero': return 0;
    case 'debtsOnly': return value < 0 ? value : 0;
    case 'creditsOnly': return value > 0 ? value : 0;
    default: return value;
  }
};

/** Récapitulatif chiffré affiché avant confirmation. */
export function buildRolloverPreview({
  choices,
  products = [],
  members = [],
  bros = [],
  jobs = [],
  orders = [],
  tripCounts = { expenses: 0, events: 0 }
}) {
  const unpaidJobs = jobs.filter((j) => !j.isPaid);
  const carriedMembers = choices.members.keep ? members : [];
  const balances = computeMemberBalances({ members, orders });
  const carriedOf = (m) => carriedBalance(balances.get(m.id) || 0, choices.members.balances);

  const carriedDebt = carriedMembers.reduce((sum, m) => {
    const balance = carriedOf(m);
    return balance < 0 ? sum + balance : sum;
  }, 0);
  const carriedCredit = carriedMembers.reduce((sum, m) => {
    const balance = carriedOf(m);
    return balance > 0 ? sum + balance : sum;
  }, 0);
  const carriedStock = choices.products.keep && choices.products.stock === 'carry'
    ? products.reduce((sum, p) => sum + (p.stock || 0), 0)
    : 0;

  return {
    products: choices.products.keep ? products.length : 0,
    carriedStock,
    members: carriedMembers.length,
    carriedDebt,
    carriedCredit,
    bros: choices.bros.keep ? bros.length : 0,
    carriedHours: choices.bros.keep && choices.bros.hours === 'carry'
      ? roundHours(bros.reduce((sum, b) => sum + (b.totalHours || 0), 0))
      : 0,
    unpaidJobs: choices.unpaidJobs === 'copy' ? unpaidJobs.length : 0,
    unpaidAmount: choices.unpaidJobs === 'copy'
      ? unpaidJobs.reduce((sum, j) => sum + (j.total || 0), 0)
      : 0,
    tripExpenses: choices.trip === 'full' ? tripCounts.expenses : 0,
    tripEvents: choices.trip === 'full' ? tripCounts.events : 0
  };
}

/** Compte les documents Voyage de la saison, pour l'aperçu. */
export async function fetchTripCounts(seasonId) {
  try {
    const [expenses, events] = await Promise.all([
      getDocs(collection(db, ...collectionPath(seasonId, 'tripExpenses'))),
      getDocs(collection(db, ...collectionPath(seasonId, 'tripEvents')))
    ]);
    return { expenses: expenses.size, events: events.size };
  } catch (error) {
    console.error('Lecture des données Voyage impossible:', error);
    return { expenses: 0, events: 0 };
  }
}

/**
 * Exécute la clôture.
 *
 * L'ordre compte : on écrit d'abord les données, puis on bascule
 * appState/current en dernier. Si quelque chose casse en route, la saison en
 * cours n'a pas bougé et l'app continue de fonctionner normalement.
 */
export async function executeRollover({
  fromSeasonId,
  toSeasonId,
  choices,
  data,
  opening,
  onProgress = () => {}
}) {
  const { products = [], members = [], bros = [], jobs = [],
          barSettings, surpriseSettings, popularProducts, financialGoal } = data;

  const writes = [];
  const push = (ref, payload) => writes.push({ ref, payload });

  // --- Marque la nouvelle saison comme en cours de création -----------------
  const bounds = seasonBounds(toSeasonId);
  await setDoc(doc(db, 'seasons', toSeasonId), {
    label: seasonLabel(toSeasonId),
    status: 'creating',
    startDate: bounds.start.toISOString(),
    endDate: new Date(bounds.end.getTime() - 1).toISOString(),
    createdFrom: fromSeasonId,
    createdAt: serverTimestamp(),
    choices
  });

  // --- Produits ------------------------------------------------------------
  if (choices.products.keep) {
    products.forEach((product) => {
      const { id, createdAt, updatedAt, ...rest } = product;
      push(docRefIn(toSeasonId, 'products', id), {
        ...rest,
        stock: choices.products.stock === 'zero' ? 0 : (product.stock || 0)
      });
    });
  }

  // --- Membres -------------------------------------------------------------
  if (choices.members.keep) {
    const balances = computeMemberBalances({ members, orders: data.orders });

    members.forEach((member) => {
      const { id, createdAt, updatedAt, ...rest } = member;
      const carried = carriedBalance(balances.get(member.id) || 0, choices.members.balances);
      push(docRefIn(toSeasonId, 'members', id), {
        ...rest,
        balance: carried,
        // Point de départ du solde recalculé à l'écran : l'historique des
        // commandes ne suit pas la saison, le report serait sinon invisible.
        openingBalance: carried
      });
    });
  }

  // --- Bro -----------------------------------------------------------------
  if (choices.bros.keep) {
    bros.forEach((bro) => {
      const { id, createdAt, updatedAt, ...rest } = bro;
      push(docRefIn(toSeasonId, 'bros', id), {
        ...rest,
        totalHours: choices.bros.hours === 'carry' ? (bro.totalHours || 0) : 0
      });
    });
  }

  // --- Boulots non payés ---------------------------------------------------
  if (choices.unpaidJobs === 'copy') {
    jobs.filter((j) => !j.isPaid).forEach((job) => {
      const { id, createdAt, updatedAt, ...rest } = job;
      push(docRefIn(toSeasonId, 'jobs', id), { ...rest, carriedFrom: fromSeasonId });
    });
  }

  // --- Réglages ------------------------------------------------------------
  if (choices.settings.hourlyRate && data.hourlyRate > 0) {
    push(docRefIn(toSeasonId, 'jobSettings'), {
      hourlyRate: data.hourlyRate,
      updatedAt: new Date().toISOString()
    });
  }

  if (choices.settings.barThreshold && barSettings != null) {
    push(docRefIn(toSeasonId, 'barSettings'), {
      openThreshold: barSettings,
      updatedAt: new Date().toISOString()
    });
  }

  if (choices.settings.surprise && surpriseSettings) {
    push(docRefIn(toSeasonId, 'surpriseSettings'), {
      ...surpriseSettings,
      updatedAt: new Date().toISOString()
    });
  }

  if (choices.settings.popular && popularProducts?.length) {
    push(docRefIn(toSeasonId, 'popularProducts'), {
      products: popularProducts,
      lastUpdated: new Date().toISOString()
    });
  }

  if (choices.financialGoal === 'copy' && financialGoal?.isActive) {
    push(docRefIn(toSeasonId, 'financialGoals'), { ...financialGoal });
  }

  // --- Trésorerie d'ouverture ---------------------------------------------
  // Sans cette écriture, la nouvelle saison démarre à zéro et l'argent
  // réellement en caisse disparaît du bilan.
  if (choices.openingBalance === 'carry') {
    const stamp = bounds.start.toISOString();
    if (opening.cash) {
      push(docRefIn(toSeasonId, 'financialTransactions'), {
        type: opening.cash >= 0 ? 'income' : 'expense',
        amount: Math.abs(opening.cash),
        description: `Solde d'ouverture (caisse) — report de la ${seasonLabel(fromSeasonId)}`,
        paymentMethod: 'cash',
        category: 'opening_balance',
        timestamp: stamp
      });
    }
    if (opening.account) {
      push(docRefIn(toSeasonId, 'financialTransactions'), {
        type: opening.account >= 0 ? 'income' : 'expense',
        amount: Math.abs(opening.account),
        description: `Solde d'ouverture (compte) — report de la ${seasonLabel(fromSeasonId)}`,
        paymentMethod: 'account',
        category: 'opening_balance',
        timestamp: stamp
      });
    }
  }

  // --- Voyage --------------------------------------------------------------
  if (choices.trip !== 'reset') {
    const settingsSnap = await getDocs(
      collection(db, ...collectionPath(fromSeasonId, 'tripSettings'))
    );
    settingsSnap.docs.forEach((d) => {
      const { createdAt, updatedAt, ...rest } = d.data();
      push(docRefIn(toSeasonId, 'tripSettings', d.id), rest);
    });

    if (choices.trip === 'full') {
      const [expenses, events] = await Promise.all([
        getDocs(collection(db, ...collectionPath(fromSeasonId, 'tripExpenses'))),
        getDocs(collection(db, ...collectionPath(fromSeasonId, 'tripEvents')))
      ]);
      expenses.docs.forEach((d) => push(docRefIn(toSeasonId, 'tripExpenses', d.id), d.data()));
      events.docs.forEach((d) => push(docRefIn(toSeasonId, 'tripEvents', d.id), d.data()));
    }
  }

  // --- Écriture par lots ---------------------------------------------------
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    writes.slice(i, i + BATCH_LIMIT).forEach(({ ref, payload }) => batch.set(ref, payload));
    await batch.commit();
    onProgress(Math.min(i + BATCH_LIMIT, writes.length), writes.length);
  }

  // --- Clôture de l'ancienne saison et bascule -----------------------------
  await setDoc(
    doc(db, 'seasons', fromSeasonId),
    {
      label: seasonLabel(fromSeasonId),
      status: 'closed',
      closedAt: serverTimestamp(),
      closingTreasury: opening,
      closedInto: toSeasonId
    },
    { merge: true }
  );

  await setDoc(doc(db, 'seasons', toSeasonId), { status: 'active' }, { merge: true });

  // En dernier : c'est ce document qui fait basculer tous les appareils.
  await setDoc(doc(db, ...CURRENT_SEASON_DOC), {
    seasonId: toSeasonId,
    updatedAt: serverTimestamp()
  });

  return { documentsCreated: writes.length };
}
