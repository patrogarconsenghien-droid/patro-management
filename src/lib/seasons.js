// Découpage des données par section et par saison.
//
// Deux sections, garçons et filles, totalement séparées. Dans chaque section,
// chaque saison vit dans ses propres sous-collections :
//   garçons : seasons/{seasonId}/members, seasons/{seasonId}/orders, ...
//   filles  : sections/filles/seasons/{seasonId}/members, ...
// Deux saisons, ou deux sections, ne partagent donc aucun document.
//
// EXCEPTION HISTORIQUE : les données antérieures au découpage vivent encore
// aux collections racines ('members', 'orders', ...). Plutôt que de déplacer
// des milliers de documents de production, la saison LEGACY_SEASON_ID des
// garçons pointe directement sur ces collections racines. C'est transparent
// pour le reste de l'app : tout passe par collectionRef() / docRef().
import { collection, doc } from 'firebase/firestore';
import { SEASON_START_MONTH } from './annualReport';

export const DEFAULT_SECTION_ID = 'garcons';

/** Saison des garçons dont les données sont restées aux collections racines. */
export const LEGACY_SEASON_ID = '2025-2026';

/**
 * Collections qui ne dépendent ni d'une section ni d'une saison : les jetons
 * de notification identifient des appareils, pas une année de fonctionnement.
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

const isLegacy = (sectionId, seasonId) =>
  sectionId === DEFAULT_SECTION_ID && seasonId === LEGACY_SEASON_ID;

/** Préfixe de chemin d'une section : rien pour les garçons (historique). */
export const sectionPrefix = (sectionId = DEFAULT_SECTION_ID) =>
  sectionId === DEFAULT_SECTION_ID ? [] : ['sections', sectionId];

/** Document qui désigne la saison en cours d'une section, commun à tous les appareils. */
export const currentSeasonDocPath = (sectionId = DEFAULT_SECTION_ID) =>
  [...sectionPrefix(sectionId), 'appState', 'current'];

/** Collection des fiches de saison d'une section. */
export const seasonsCollectionPath = (sectionId = DEFAULT_SECTION_ID) =>
  [...sectionPrefix(sectionId), 'seasons'];

/** Fiche d'une saison. */
export const seasonDocPath = (sectionId, seasonId) =>
  [...seasonsCollectionPath(sectionId), seasonId];

/**
 * Chemin sous forme de segments d'une collection de saison. Unique endroit du
 * code qui connaît la structure des chemins.
 */
export const collectionPath = (seasonId, name, sectionId = DEFAULT_SECTION_ID) => {
  if (GLOBAL_COLLECTIONS.includes(name)) return [name];
  return isLegacy(sectionId, seasonId)
    ? [name]
    : [...sectionPrefix(sectionId), 'seasons', seasonId, name];
};

/** Référence de collection pour une saison d'une section. */
export const collectionRef = (db, seasonId, name, sectionId = DEFAULT_SECTION_ID) =>
  collection(db, ...collectionPath(seasonId, name, sectionId));

/** Référence de document pour une saison d'une section. */
export const docRef = (db, seasonId, name, id, sectionId = DEFAULT_SECTION_ID) =>
  doc(db, ...collectionPath(seasonId, name, sectionId), id);
