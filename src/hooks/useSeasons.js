import { useEffect, useState } from 'react';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { CURRENT_SEASON_DOC, LEGACY_SEASON_ID, seasonLabel } from '../lib/seasons';

/**
 * Saison en cours (partagée par tous les appareils) et saison consultée
 * (locale à l'appareil, remise sur la saison en cours à chaque ouverture de
 * l'app : on ne veut pas rouvrir l'app dans une saison archivée sans le
 * vouloir).
 */
export function useSeasons() {
  const [activeSeasonId, setActiveSeasonId] = useState(LEGACY_SEASON_ID);
  const [viewedSeasonId, setViewedSeasonId] = useState(LEGACY_SEASON_ID);
  const [seasons, setSeasons] = useState([]);
  const [seasonsReady, setSeasonsReady] = useState(false);

  // Tant que l'utilisateur n'a pas explicitement changé de saison, la saison
  // consultée suit la saison en cours.
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const unsubscribeCurrent = onSnapshot(
      doc(db, ...CURRENT_SEASON_DOC),
      (snapshot) => {
        const id = snapshot.exists() ? snapshot.data().seasonId : LEGACY_SEASON_ID;
        setActiveSeasonId(id || LEGACY_SEASON_ID);
        setSeasonsReady(true);
      },
      (error) => {
        // Document absent ou règles restrictives : on reste sur la saison
        // historique, qui pointe sur les collections racines.
        console.error('Lecture de la saison en cours impossible:', error);
        setSeasonsReady(true);
      }
    );

    const unsubscribeSeasons = onSnapshot(
      collection(db, 'seasons'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setSeasons(list.sort((a, b) => b.id.localeCompare(a.id)));
      },
      (error) => console.error('Lecture des saisons impossible:', error)
    );

    return () => {
      unsubscribeCurrent();
      unsubscribeSeasons();
    };
  }, []);

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

  // La saison historique n'a pas de document tant qu'aucune clôture n'a eu
  // lieu : on l'ajoute pour que le sélecteur ne soit jamais vide.
  const knownSeasons = seasons.some((s) => s.id === LEGACY_SEASON_ID)
    ? seasons
    : [...seasons, { id: LEGACY_SEASON_ID, label: seasonLabel(LEGACY_SEASON_ID), status: 'legacy' }]
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
