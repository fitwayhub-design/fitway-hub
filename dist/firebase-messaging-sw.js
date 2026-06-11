/**
 * Firebase Cloud Messaging Service Worker
 * Must be served at /firebase-messaging-sw.js (root scope)
 *
 * Handles background push notifications when the app tab is not focused.
 * Foreground notifications are handled in firebase.ts via onMessage().
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ── Firebase config (must match src/lib/firebase.ts) ─────────────────────────
firebase.initializeApp({
  apiKey:            'AIzaSyBisyUGQSc5GBmwaQYJ5SO7eu4eaIUsYY4',
  authDomain:        'fitwayhubpn.firebaseapp.com',
  projectId:         'fitwayhubpn',
  storageBucket:     'fitwayhubpn.firebasestorage.app',
  messagingSenderId: '87232494754',
  appId:             '1:87232494754:web:5984b2dad50061e4e16bfb',
  measurementId:     'G-C7G6XBE731',
});

const messaging = firebase.messaging();

// ── Background message handler ────────────────────────────────────────────────
// Called when the app is in background or tab is closed.
// Firebase shows a default notification automatically if the message has a
// `notification` field, but we override it here for custom icon/actions.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'FitWay Hub';
  const body  = payload.notification?.body  || payload.data?.body  || '';
  const icon  = payload.notification?.icon  || '/logo.svg';
  const link  = payload.data?.link || '/';

  self.registration.showNotification(title, {
    body,
    icon,
    badge: '/logo.svg',
    tag: 'fitway-push',
    renotify: true,
    data: { link },
    vibrate: [150, 50, 150],
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  });
});

// ── Notification click handler ────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const link = event.notification.data?.link || '/';
  const urlToOpen = new URL(link, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a tab is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(urlToOpen);
          return;
        }
      }
      // No existing tab — open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ── Activate immediately (skip waiting) ──────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
