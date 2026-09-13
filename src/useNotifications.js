import { useCallback, useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { app, auth, db, VAPID_KEY } from './firebase';

// Instance Messaging partagée, résolue à la demande. Firebase Messaging est
// importé dynamiquement : il n'est pas supporté partout (iPhone hors app
// installée, navigation privée...).
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

export const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

const platformLabel = () => {
  const ua = navigator.userAgent;
  if (isIos()) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Windows|Macintosh|Linux/.test(ua)) return 'desktop';
  return 'autre';
};

/**
 * Récupère le jeton de l'appareil et l'enregistre. Appelé à chaque ouverture
 * de l'app quand les notifications sont autorisées : les jetons expirent ou
 * changent, et un jeton jamais rafraîchi finit par ne plus rien recevoir.
 */
async function registerDevice({ firstTime = false } = {}) {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  await navigator.serviceWorker.ready;

  const { getToken } = await import('firebase/messaging');
  const fcmToken = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration
  });
  if (!fcmToken) return null;

  const now = new Date().toISOString();
  await setDoc(
    doc(db, 'fcmTokens', fcmToken),
    {
      token: fcmToken,
      userAgent: navigator.userAgent.substring(0, 200),
      platform: platformLabel(),
      standalone: isStandalone(),
      // Compte connecté : servira à cibler les notifications par section.
      uid: auth.currentUser?.uid || null,
      lastSeenAt: now,
      ...(firstTime ? { createdAt: now } : {})
    },
    { merge: true }
  );

  return fcmToken;
}

export const useNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [token, setToken] = useState(null);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return undefined;

    setIsSupported(true);
    setPermission(Notification.permission);

    let unsubscribe = null;
    let cancelled = false;

    (async () => {
      if (Notification.permission !== 'granted') return;

      try {
        const fcmToken = await registerDevice();
        if (!cancelled && fcmToken) setToken(fcmToken);
      } catch (error) {
        console.error('Rafraîchissement du jeton de notification impossible:', error);
      }

      // App ouverte : le système n'affiche rien de lui-même, on s'en charge.
      const messaging = await getMessagingInstance();
      if (!messaging || cancelled) return;
      const { onMessage } = await import('firebase/messaging');
      unsubscribe = onMessage(messaging, async (payload) => {
        const data = payload.data || {};
        const legacy = payload.notification || {};
        const registration = await navigator.serviceWorker.ready;
        registration.showNotification(data.title || legacy.title || 'Nouveau boulot disponible', {
          body: data.body || legacy.body || '',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: data.jobId ? `job-${data.jobId}` : 'new-job',
          data
        });
      });
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') return result;

      const fcmToken = await registerDevice({ firstTime: true });
      if (fcmToken) setToken(fcmToken);
      return result;
    } catch (error) {
      console.error('Erreur demande de permission notifications:', error);
      return 'denied';
    }
  }, []);

  return {
    isSupported,
    permission,
    token,
    requestPermission
  };
};
