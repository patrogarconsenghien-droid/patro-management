// useNotifications.js
import { useState, useEffect } from 'react';
import { messaging, VAPID_KEY } from './firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export const useNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [token, setToken] = useState(null);

  useEffect(() => {
    // Vérifier si les notifications sont supportées
    if ('Notification' in window && 'serviceWorker' in navigator && messaging) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  // Sauvegarder le token
  const saveUserToken = async (token) => {
    try {
      await setDoc(doc(db, 'fcmTokens', token), {
        token: token,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        userAgent: navigator.userAgent.substring(0, 200) // Limiter la taille
      });
      
      console.log('✅ Token sauvegardé avec succès');
    } catch (error) {
      console.error('❌ Erreur sauvegarde token:', error);
    }
  };

  // Demander la permission
  const requestPermission = async () => {
    console.log('🔔 Demande de permission...');
    
    try {
      const permission = await Notification.requestPermission();
      console.log('📋 Permission:', permission);
      setPermission(permission);

      if (permission === 'granted') {
        console.log('✅ Permission accordée, enregistrement du service worker...');
        
        // Enregistrer le Service Worker
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('✅ Service Worker enregistré:', registration);
        
        // Obtenir le token FCM
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration
        });

        if (token) {
          console.log('✅ Token FCM obtenu:', token);
          setToken(token);
          await saveUserToken(token);
          return token;
        } else {
          console.log('❌ Pas de token disponible');
        }
      } else {
        console.log('❌ Permission refusée');
      }
    } catch (error) {
      console.error('❌ Erreur permission notifications:', error);
      alert('Erreur lors de la configuration des notifications: ' + error.message);
    }
  };

  // Écouter les messages quand l'app est ouverte
  useEffect(() => {
    if (messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('📨 Message reçu (app ouverte):', payload);
        
        // Afficher une notification custom dans l'app
        if (payload.notification) {
          const title = payload.notification.title || 'Notification';
          const body = payload.notification.body || '';
          
          // Tu peux personnaliser cette partie plus tard
          alert(`📢 ${title}\n${body}`);
        }
      });

      return unsubscribe;
    }
  }, []);

  return {
    isSupported,
    permission,
    token,
    requestPermission
  };
};