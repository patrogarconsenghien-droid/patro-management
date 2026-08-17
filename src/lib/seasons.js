// Découpage des données par saison.
//
// Chaque saison vit dans ses propres sous-collections :
//   seasons/{seasonId}/members, seasons/{seasonId}/orders, ...
// Deux saisons ne partagent donc aucun document : modifier une saison close
// n'a aucun effet sur la saison en cours, et inversement.
//
// EXCEPTION HISTORIQUE : les données antérieures au découpage vivent encore
// aux collections racines ('members', 'orders', ...). Plutôt que de déplacer
// des milliers de documents de production, la saison LEGACY_SEASON_ID pointe
// directement sur ces collections racines. C'est transparent pour le reste de
// l'app : tout passe par collectionRef() / docRef().
import { collection, doc } from 'firebase/firestore';
import { SEASON_START_MONTH } from './annualReport';

/** Saison dont les données sont restées aux collections racines. */
export const LEGACY_SEASON_ID = '2025-2026';

/** Document qui désigne la saison en cours, commun à tous les appareils. */
export const CURRENT_SEASON_DOC = ['appState', 'current'];

/**
 * Collections qui ne dépendent pas d'une saison : les tokens de notification
 * identifient des appareils, pas une année de fonctionnement.
 */
export const GLOBAL_COLLECTIONS = ['fcmTokens'];

/** Collections recopiées ou réinitialisées au passage d'une saison à l'autre. */
export const SEASON_COLLECTIONS = [
  'members',
  'bros',
  'products',
  'orders',
  'jobs',
  'scheduledJobs',
  'stockMovements',
  'financialTransactions',
  'financialGoals',
  'popularProducts',
  'barSettings',
  'jobSettings',
  'surpriseSettings',
  'tripSettings',
  'tripExpenses',
  'tripEvents'
];

export const seasonIdFor = (startYear) => `${startYear}-${startYear + 1}`;

export const startYearOf = (seasonId) => Number(String(seasonId).split('-')[0]);

export const seasonLabel = (seasonId) => `Saison ${String(seasonId).replace('-', '–')}`;

/** Bornes réelles de la saison : 1er août -> 31 juillet inclus. */
export const seasonBounds = (seasonId) => {
  const year = startYearOf(seasonId);
  return {
    start: new Date(year, SEASON_START_MONTH, 1),
    end: new Date(year + 1, SEASON_START_MONTH, 1)
  };
};

/** Saison correspondant à une date donnée. */
export const seasonIdAt = (date = new Date()) =>
  seasonIdFor(date.getMonth() >= SEASON_START_MONTH ? date.getFullYear() : date.getFullYear() - 1);

/** Saison qui suit une saison donnée. */
export const nextSeasonId = (seasonId) => seasonIdFor(startYearOf(seasonId) + 1);

const isLegacy = (seasonId) => seasonId === LEGACY_SEASON_ID;

/**
 * Référence de collection pour une saison. Unique endroit du code qui connaît
 * la structure des chemins.
 */
export const collectionRef = (db, seasonId, name) => {
  if (GLOBAL_COLLECTIONS.includes(name)) return collection(db, name);
  return isLegacy(seasonId)
    ? collection(db, name)
    : collection(db, 'seasons', seasonId, name);
};

/** Référence de document pour une saison. */
export const docRef = (db, seasonId, name, id) => {
  if (GLOBAL_COLLECTIONS.includes(name)) return doc(db, name, id);
  return isLegacy(seasonId)
    ? doc(db, name, id)
    : doc(db, 'seasons', seasonId, name, id);
};

/**
 * Chemin sous forme de segments, pour les écritures par lots qui ne peuvent
 * pas passer par collectionRef (création de la saison suivante).
 */
export const collectionPath = (seasonId, name) =>
  isLegacy(seasonId) ? [name] : ['seasons', seasonId, name];
