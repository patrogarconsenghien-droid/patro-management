import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from 'firebase/auth';

// La connexion Google revient sur le domaine Firebase : c'est la seule adresse
// de retour enregistrée auprès de Google (vérifié : patro-management.vercel.app
// est refusée avec « redirect_uri_mismatch »).
//
// Pour fiabiliser la connexion dans l'app installée sur iPhone, on pourra
// passer authDomain à 'patro-management.vercel.app' (vercel.json relaie déjà
// /__/auth vers Firebase), mais SEULEMENT après avoir ajouté
// https://patro-management.vercel.app/__/auth/handler aux URI de redirection
// autorisées du client OAuth, dans Google Cloud Console. Sans ce réglage,
// plus personne ne pourrait se connecter.
const AUTH_DOMAIN = 'patro-management-2024.firebaseapp.com';

// Config Firebase web : ces clés sont publiques par nature (elles partent dans le
// bundle). La sécurité repose sur les règles Firestore, pas sur ces valeurs.
export const firebaseConfig = {
  apiKey: "AIzaSyBPLArT81P6fAyXFuvAZrEUM1KG-wYcRT0",
  authDomain: AUTH_DOMAIN,
  projectId: "patro-management-2024",
  storageBucket: "patro-management-2024.firebasestorage.app",
  messagingSenderId: "371769454761",
  appId: "1:371769454761:web:782ae053effc3e4ca539b8"
};

export const VAPID_KEY = "BEBfDWRNwW7ZiPMhuViDk21-kKddD0nHHehHA-S3s4MfeK7rjBYFY203rT5S7mOZ6bY9_htIyEeBR6X0UxgTRP4";

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

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

// Erreurs de pop-up pour lesquelles on retente par redirection.
const POPUP_UNAVAILABLE = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment'
]);

/**
 * Ouvre la connexion Google, en fenêtre pop-up d'abord, partout.
 *
 * La redirection n'est qu'un repli : avec le domaine Firebase, Safari sur
 * iPhone bloque souvent le retour d'une redirection (stockage cloisonné entre
 * domaines), alors que la pop-up passe.
 */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    if (POPUP_UNAVAILABLE.has(error.code)) return signInWithRedirect(auth, provider);
    throw error;
  }
}

export const signOutUser = () => signOut(auth);

// Les Cloud Functions tournent en Belgique (europe-west1), comme la base.
export const functions = getFunctions(app, 'europe-west1');

/**
 * Redemande le compte Google, puis renouvelle le jeton. Les gestes sensibles
 * (compte de paiement) exigent côté serveur une connexion de moins de
 * 5 minutes : une session restée ouverte sur un téléphone ne suffit pas.
 */
export async function reauthenticate() {
  const user = auth.currentUser;
  if (!user) throw new Error('Personne n\'est connecté.');
  const provider = new GoogleAuthProvider();
  // Le même compte, sans le laisser en choisir un autre.
  provider.setCustomParameters({ login_hint: user.email || '', prompt: 'login' });
  await reauthenticateWithPopup(user, provider);
  await user.getIdToken(true);
}
