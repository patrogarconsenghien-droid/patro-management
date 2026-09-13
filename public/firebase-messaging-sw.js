// Service worker des notifications (Firebase Cloud Messaging).
//
// Les messages envoyés par la Cloud Function ne contiennent que des « data » :
// c'est ici qu'on affiche la notification, une seule fois, avec la même
// présentation sur Android, iPhone (app installée) et ordinateur.
importScripts('https://www.gstatic.com/firebasejs/12.1.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBPLArT81P6fAyXFuvAZrEUM1KG-wYcRT0",
  authDomain: "patro-management-2024.firebaseapp.com",
  projectId: "patro-management-2024",
  storageBucket: "patro-management-2024.firebasestorage.app",
  messagingSenderId: "371769454761",
  appId: "1:371769454761:web:782ae053effc3e4ca539b8"
});

const messaging = firebase.messaging();

// Les nouvelles versions du service worker prennent la main tout de suite,
// sans attendre que tous les onglets de l'app soient fermés.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  // Anciens messages avec un bloc « notification » : on reprend leur contenu.
  const legacy = payload.notification || {};

  const title = data.title || legacy.title || 'Nouveau boulot disponible';
  return self.registration.showNotification(title, {
    body: data.body || legacy.body || 'Un nouveau boulot est disponible',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.jobId ? `job-${data.jobId}` : 'new-job',
    renotify: true,
    data
  });
});

// Appui sur la notification : on revient sur l'app si elle est déjà ouverte,
// sinon on l'ouvre sur les boulots programmés.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/#boulots-scheduled';

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      if ('navigate' in existing) {
        try { await existing.navigate(link); } catch (error) { /* navigation refusée : l'app reste ouverte */ }
      }
      return;
    }
    await self.clients.openWindow(link);
  })());
});
