// public/firebase-messaging-sw.js
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

const firebaseConfig = {
  apiKey: "AIzaSyBPLArT81P6fAyXFuvAZrEUM1KG-wYcRT0",
  authDomain: "patro-management-2024.firebaseapp.com",
  projectId: "patro-management-2024",
  storageBucket: "patro-management-2024.firebasestorage.app",
  messagingSenderId: "371769454761",
  appId: "1:371769454761:web:782ae053effc3e4ca539b8"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

onBackgroundMessage(messaging, (payload) => {
  console.log('🔔 Notification reçue !', payload);

  const notificationTitle = payload.notification?.title || 'Nouveau boulot !';
  const notificationOptions = {
    body: payload.notification?.body || 'Un nouveau boulot est disponible',
    icon: '/favicon.ico',
    tag: 'new-job',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/#boulots-scheduled')
  );
});