import { useEffect, useRef, useState } from 'react';
import { getRedirectResult, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { BOOTSTRAP_ADMINS } from './account';

/**
 * État du compte de la personne qui utilise l'app.
 *
 * - loading    : on ne sait pas encore
 * - signed-out : personne n'est connecté
 * - pending    : connecté, en attente de validation par un animateur
 * - disabled   : compte désactivé
 * - active     : compte validé, accès selon le rôle
 *
 * Le profil est écouté en temps réel : un compte validé par un animateur
 * s'ouvre tout seul, sans avoir à se reconnecter.
 */
export function useAccountState() {
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  const [error, setError] = useState(null);
  const creating = useRef(false);

  useEffect(() => {
    // Retour d'une connexion par redirection (app installée sur iPhone).
    getRedirectResult(auth).catch((redirectError) => setError(redirectError));

    return onAuthStateChanged(auth, (nextUser) => {
      // Session anonyme héritée de l'ancienne version de l'app : ce n'est pas un
      // compte. On la ferme pour afficher l'écran de connexion, sans créer de
      // fiche « en attente » vide.
      if (nextUser?.isAnonymous) {
        signOut(auth).catch((signOutError) => console.error('Fermeture de la session anonyme impossible:', signOutError));
        setUser(null);
        setProfile(null);
        return;
      }

      setUser(nextUser);
      if (!nextUser) setProfile(null);
    });
  }, []);

  useEffect(() => {
    if (!user || user.isAnonymous) return undefined;

    setProfile(undefined);
    creating.current = false;
    const ref = doc(db, 'users', user.uid);

    return onSnapshot(
      ref,
      async (snapshot) => {
        if (snapshot.exists()) {
          setProfile({ id: snapshot.id, ...snapshot.data() });
          return;
        }

        // Première connexion : on crée la fiche du compte.
        if (creating.current) return;
        creating.current = true;

        const email = (user.email || '').toLowerCase();
        const bootstrapAdmin = user.emailVerified && BOOTSTRAP_ADMINS.includes(email);

        try {
          await setDoc(ref, {
            uid: user.uid,
            email,
            displayName: user.displayName || email,
            photoURL: user.photoURL || null,
            status: bootstrapAdmin ? 'active' : 'pending',
            role: bootstrapAdmin ? 'admin' : null,
            sectionId: bootstrapAdmin ? 'garcons' : null,
            broId: null,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp()
          });
        } catch (createError) {
          console.error('Création du compte impossible:', createError);
          setError(createError);
        }
      },
      (readError) => {
        console.error('Lecture du compte impossible:', readError);
        setError(readError);
      }
    );
  }, [user]);

  // Dernière connexion, une fois par ouverture de l'app.
  const hasProfile = Boolean(profile);
  useEffect(() => {
    if (!user || user.isAnonymous || !hasProfile) return;
    setDoc(
      doc(db, 'users', user.uid),
      {
        lastLoginAt: serverTimestamp(),
        displayName: user.displayName || user.email,
        photoURL: user.photoURL || null
      },
      { merge: true }
    ).catch((updateError) => console.error('Mise à jour de la dernière connexion impossible:', updateError));
  }, [user, hasProfile]);

  let status = 'loading';
  if (user === null) status = 'signed-out';
  else if (user && profile) {
    if (profile.status === 'active') status = 'active';
    else if (profile.status === 'disabled') status = 'disabled';
    else status = 'pending';
  }

  return { status, user, profile, error };
}
