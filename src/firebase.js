import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// REMPLACEZ cette configuration par la vôtre obtenue à l'étape 2.5
const firebaseConfig = {
  apiKey: "AIzaSyBPLArT81P6fAyXFuvAZrEUM1KG-wYcRT0",
  authDomain: "patro-management-2024.firebaseapp.com",
  projectId: "patro-management-2024",
  storageBucket: "patro-management-2024.firebasestorage.app",
  messagingSenderId: "371769454761",
  appId: "1:371769454761:web:782ae053effc3e4ca539b8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);