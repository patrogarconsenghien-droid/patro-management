import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// Config Firebase web : ces clés sont publiques par nature (elles partent dans le
// bundle). La sécurité repose sur les règles Firestore, pas sur ces valeurs.
export const firebaseConfig = {
  apiKey: "AIzaSyBPLArT81P6fAyXFuvAZrEUM1KG-wYcRT0",
  authDomain: "patro-management-2024.firebaseapp.com",
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
 * Connexion anonyme, sans compte ni friction pour l'utilisateur : elle sert
 * uniquement à ce que les règles Firestore puissent exiger `request.auth`,
 * plutôt que de laisser la base ouverte à tout internet.
 *
 * La session est conservée localement par le SDK : seule la toute première
 * ouverture nécessite le réseau, les suivantes repartent du cache (important
 * pour une app utilisée au bar, parfois hors ligne).
 *
 * Toutes les lectures Firestore attendent cette promesse avant de s'abonner.
 */
export const authReady = signInAnonymously(auth)
  .then(({ user }) => user)
  .catch((error) => {
    // On ne bloque pas l'app : si les règles sont encore ouvertes, tout
    // continue de fonctionner.
    console.error('Connexion anonyme impossible:', error);
    return null;
  });
