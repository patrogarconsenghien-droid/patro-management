// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBPLArT81P6fAyXFuvAZrEUM1KG-wYcRT0",
  authDomain: "patro-management-2024.firebaseapp.com",
  projectId: "patro-management-2024",
  storageBucket: "patro-management-2024.firebasestorage.app",
  messagingSenderId: "371769454761",
  appId: "1:371769454761:web:782ae053effc3e4ca539b8"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Gérer les messages en arrière-plan
messaging.onBackgroundMessage((payload) => {
  console.log('🔔 Notification reçue en arrière-plan:', payload);

  const notificationTitle = payload.notification?.title || 'Nouveau boulot !';
  const notificationOptions = {
    body: payload.notification?.body || 'Un nouveau boulot est disponible',
    icon: '/favicon.ico',
    tag: 'new-job',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Gérer les clics sur les notifications
self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ Clic sur notification:', event);
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/') // Ouvrir l'app
  );
});