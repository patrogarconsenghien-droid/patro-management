import { useEffect, useState } from 'react';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { authReady, db } from '../firebase';
import {
  DEFAULT_SECTION_ID, LEGACY_SEASON_ID, currentSeasonDocPath, seasonIdAt,
  seasonLabel, seasonsCollectionPath
} from '../lib/seasons';

// Saison par défaut d'une section qui n'a pas encore de fiche « en cours » :
// la saison historique pour les garçons (collections racines), la saison
// calendaire pour une section qui démarre à vide.
const defaultSeasonFor = (sectionId) =>
  sectionId === DEFAULT_SECTION_ID ? LEGACY_SEASON_ID : seasonIdAt();

/**
 * Saison en cours d'une section (partagée par tous les appareils) et saison
 * consultée (locale à l'appareil, remise sur la saison en cours à chaque
 * ouverture de l'app : on ne veut pas rouvrir l'app dans une saison archivée
 * sans le vouloir).
 */
export function useSeasons(sectionId = DEFAULT_SECTION_ID) {
  const [activeSeasonId, setActiveSeasonId] = useState(() => defaultSeasonFor(sectionId));
  const [viewedSeasonId, setViewedSeasonId] = useState(() => defaultSeasonFor(sectionId));
  const [seasons, setSeasons] = useState([]);
  const [seasonsReady, setSeasonsReady] = useState(false);

  // Tant que l'utilisateur n'a pas explicitement changé de saison, la saison
  // consultée suit la saison en cours.
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeCurrent = null;
    let unsubscribeSeasons = null;

    // Changement de section : on repart de la saison par défaut de celle-ci.
    setActiveSeasonId(defaultSeasonFor(sectionId));
    setSeasons([]);
    setSeasonsReady(false);
    setPinned(false);

    const subscribe = async () => {
      // Même raison que dans useFirestoreData : les règles exigent une session.
      await authReady;
      if (cancelled) return;

      unsubscribeCurrent = onSnapshot(
        doc(db, ...currentSeasonDocPath(sectionId)),
        (snapshot) => {
          const id = snapshot.exists() ? snapshot.data().seasonId : null;
          setActiveSeasonId(id || defaultSeasonFor(sectionId));
          setSeasonsReady(true);
        },
        (error) => {
          // Document absent ou règles restrictives : on reste sur la saison
          // par défaut de la section.
          console.error('Lecture de la saison en cours impossible:', error);
          setSeasonsReady(true);
        }
      );

      unsubscribeSeasons = onSnapshot(
        collection(db, ...seasonsCollectionPath(sectionId)),
        (snapshot) => {
          const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          setSeasons(list.sort((a, b) => b.id.localeCompare(a.id)));
        },
        (error) => console.error('Lecture des saisons impossible:', error)
      );

      if (cancelled) {
        unsubscribeCurrent();
        unsubscribeSeasons();
      }
    };

    subscribe();

    return () => {
      cancelled = true;
      if (unsubscribeCurrent) unsubscribeCurrent();
      if (unsubscribeSeasons) unsubscribeSeasons();
    };
  }, [sectionId]);

  useEffect(() => {
    if (!pinned) setViewedSeasonId(activeSeasonId);
  }, [activeSeasonId, pinned]);

  const selectSeason = (seasonId) => {
    setPinned(seasonId !== activeSeasonId);
    setViewedSeasonId(seasonId);
  };

  const backToActiveSeason = () => {
    setPinned(false);
    setViewedSeasonId(activeSeasonId);
  };

  // La saison en cours n'a pas toujours de fiche (saison historique, ou
  // section qui démarre) : on l'ajoute pour que le sélecteur ne soit jamais vide.
  const knownSeasons = seasons.some((s) => s.id === activeSeasonId)
    ? seasons
    : [...seasons, { id: activeSeasonId, label: seasonLabel(activeSeasonId), status: 'active' }]
        .sort((a, b) => b.id.localeCompare(a.id));

  return {
    activeSeasonId,
    viewedSeasonId,
    seasons: knownSeasons,
    seasonsReady,
    isViewingArchive: viewedSeasonId !== activeSeasonId,
    selectSeason,
    backToActiveSeason
  };
}
