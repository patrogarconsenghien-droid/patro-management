import { useState, useEffect } from 'react';
import { VAPID_KEY } from './firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export const useNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [token, setToken] = useState(null);

  useEffect(() => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      setIsSupported(true);
      setPermission(Notification.permission);
      
      // Importer Firebase Messaging seulement si supporté
      import('firebase/messaging').then(async ({ getMessaging, getToken, isSupported }) => {
        const supported = await isSupported();
        if (supported) {
          const { initializeApp } = await import('firebase/app');
          const app = initializeApp({
            apiKey: "AIzaSyBPLArT81P6fAyXFuvAZrEUM1KG-wYcRT0",
            authDomain: "patro-management-2024.firebaseapp.com",
            projectId: "patro-management-2024",
            storageBucket: "patro-management-2024.firebasestorage.app",
            messagingSenderId: "371769454761",
            appId: "1:371769454761:web:782ae053effc3e4ca539b8"
          });
          window.messaging = getMessaging(app);
        }
      }).catch(err => console.log('Messaging non disponible:', err));
    }
  }, []);

  const saveUserToken = async (token) => {
    try {
      await setDoc(doc(db, 'fcmTokens', token), {
        token: token,
        createdAt: new Date().toISOString(),
        userAgent: navigator.userAgent.substring(0, 200)
      });
      console.log('✅ Token sauvé');
    } catch (error) {
      console.error('❌ Erreur token:', error);
    }
  };

  const requestPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission === 'granted' && window.messaging) {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const { getToken } = await import('firebase/messaging');
        
        const token = await getToken(window.messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration
        });

        if (token) {
          setToken(token);
          await saveUserToken(token);
          return 'granted';
        }
      }
      
      return permission;
    } catch (error) {
      console.error('❌ Erreur permission:', error);
      return 'denied';
    }
  };

  return {
    isSupported,
    permission,
    token,
    requestPermission
  };
};