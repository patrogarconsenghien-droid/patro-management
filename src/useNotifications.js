import { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { app, db, VAPID_KEY } from './firebase';

// Instance Messaging partagée, résolue à la demande. Firebase Messaging est
// importé dynamiquement : il n'est pas supporté sur tous les navigateurs
// (Safari iOS < 16.4, navigation privée, ...).
let messagingPromise = null;

const getMessagingInstance = () => {
  if (!messagingPromise) {
    messagingPromise = import('firebase/messaging')
      .then(async ({ getMessaging, isSupported }) => {
        if (!(await isSupported())) return null;
        return getMessaging(app);
      })
      .catch((error) => {
        console.error('Messaging non disponible:', error);
        return null;
      });
  }
  return messagingPromise;
};

export const useNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [token, setToken] = useState(null);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    setIsSupported(true);
    setPermission(Notification.permission);
    getMessagingInstance();
  }, []);

  const saveUserToken = async (fcmToken) => {
    try {
      await setDoc(doc(db, 'fcmTokens', fcmToken), {
        token: fcmToken,
        createdAt: new Date().toISOString(),
        userAgent: navigator.userAgent.substring(0, 200)
      });
    } catch (error) {
      console.error('Erreur sauvegarde du token FCM:', error);
    }
  };

  const requestPermission = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') return result;

      const messaging = await getMessagingInstance();
      if (!messaging) return result;

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const { getToken } = await import('firebase/messaging');

      const fcmToken = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration
      });

      if (fcmToken) {
        setToken(fcmToken);
        await saveUserToken(fcmToken);
      }

      return result;
    } catch (error) {
      console.error('Erreur demande de permission notifications:', error);
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
