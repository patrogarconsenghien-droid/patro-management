import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { authReady, db } from '../firebase';

/**
 * Photo de chaque Bro : celle envoyée dans l'app (bro.photoURL) passe avant
 * celle du compte Google relié (users.photoURL). Renvoie { broId: url }.
 */
export function useBroPhotos(bros = []) {
  const [accountPhotos, setAccountPhotos] = useState({});

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = null;
    (async () => {
      await authReady;
      if (cancelled) return;
      unsubscribe = onSnapshot(
        collection(db, 'users'),
        (snapshot) => {
          const map = {};
          snapshot.docs.forEach((d) => {
            const u = d.data();
            if (u.broId && u.photoURL) map[u.broId] = u.photoURL;
          });
          setAccountPhotos(map);
        },
        (error) => console.error('Lecture des photos de compte impossible:', error)
      );
      if (cancelled) unsubscribe();
    })();
    return () => { cancelled = true; if (unsubscribe) unsubscribe(); };
  }, []);

  return useMemo(() => {
    const map = { ...accountPhotos };
    bros.forEach((bro) => { if (bro.photoURL) map[bro.id] = bro.photoURL; });
    return map;
  }, [accountPhotos, bros]);
}
