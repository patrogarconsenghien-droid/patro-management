import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from 'firebase/auth';

// Sur le site en production, la connexion Google passe par l'adresse de l'app
// elle-même : vercel.json relaie /__/auth vers Firebase. Sans ça, Safari sur
// iPhone bloque le retour de connexion, faute de cookies partagés entre deux
// domaines. En local et sur les prévisualisations, domaine Firebase habituel.
const PRODUCTION_HOST = 'patro-management.vercel.app';
const authDomain = typeof window !== 'undefined' && window.location.hostname === PRODUCTION_HOST
  ? PRODUCTION_HOST
  : 'patro-management-2024.firebaseapp.com';

// Config Firebase web : ces clés sont publiques par nature (elles partent dans le
// bundle). La sécurité repose sur les règles Firestore, pas sur ces valeurs.
export const firebaseConfig = {
  apiKey: "AIzaSyBPLArT81P6fAyXFuvAZrEUM1KG-wYcRT0",
  authDomain,
  projectId: "patro-management-2024",
  storageBucket: "patro-management-2024.firebasestorage.app",
  messagingSenderId: "371769454761",
  appId: "1:371769454761:web:782ae053effc3e4ca539b8"
};

export const VAPID_KEY = "BEBfDWRNwW7ZiPMhuViDk21-kKddD0nHHehHA-S3s4MfeK7rjBYFY203rT5S7mOZ6bY9_htIyEeBR6X0UxgTRP4";

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

/**
 * Résolue dès qu'une personne est connectée. Les lectures Firestore attendent
 * cette promesse avant de s'abonner. L'app n'étant montée qu'après la
 * connexion (voir auth/AuthGate), elle est déjà résolue à ce moment-là.
 */
export const authReady = new Promise((resolve) => {
  const stop = onAuthStateChanged(auth, (user) => {
    // Une session anonyme héritée de l'ancienne version ne compte pas.
    if (user && !user.isAnonymous) {
      stop();
      resolve(user);
    }
  });
});

const isIosStandalone = () =>
  (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);

// Erreurs de pop-up pour lesquelles on retente par redirection.
const POPUP_UNAVAILABLE = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment'
]);

/** Ouvre la connexion Google. */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  // App installée sur iPhone : les fenêtres pop-up n'y fonctionnent pas.
  if (isIosStandalone()) return signInWithRedirect(auth, provider);

  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    if (POPUP_UNAVAILABLE.has(error.code)) return signInWithRedirect(auth, provider);
    throw error;
  }
}

export const signOutUser = () => signOut(auth);
