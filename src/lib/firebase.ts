/**
 * Firebase — Web Push Notifications (browser only)
 * Native Android/iOS push is handled by Capacitor in pushNotifications.ts
 */

import { Capacitor } from '@capacitor/core';
import { initializeApp, getApps } from 'firebase/app';
import { logger } from "@/lib/logger";
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';
import { getApiBase } from '@/lib/api';

const firebaseConfig = {
  apiKey:            'AIzaSyBisyUGQSc5GBmwaQYJ5SO7eu4eaIUsYY4',
  authDomain:        'fitwayhubpn.firebaseapp.com',
  projectId:         'fitwayhubpn',
  storageBucket:     'fitwayhubpn.firebasestorage.app',
  messagingSenderId: '87232494754',
  appId:             '1:87232494754:web:5984b2dad50061e4e16bfb',
  measurementId:     'G-C7G6XBE731',
};

// Init once — guard against HMR double-init
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let _messaging: Messaging | null = null;
let _listenerAttached = false;

async function getMessagingInstance(): Promise<Messaging | null> {
  if (_messaging) return _messaging;
  try {
    const supported = await isSupported();
    if (!supported) return null;
    _messaging = getMessaging(app);
    return _messaging;
  } catch {
    return null;
  }
}

/**
 * Register service worker and get FCM token for web push.
 * Called on login (web browser only — Capacitor handles native).
 * Safe to call multiple times — re-registers if token changed.
 */
export async function initWebPush(authToken: string): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) return;

    // Only run in browsers that support push
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      !('serviceWorker' in navigator)
    ) return;

    const messaging = await getMessagingInstance();
    if (!messaging) return;

    // Ask for permission (no-op if already granted/denied)
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    // Register service worker
    let swReg: ServiceWorkerRegistration;
    try {
      swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
    } catch (err) {
      logger.warn('FCM: service worker registration failed:', err);
      return;
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      logger.warn('VITE_FIREBASE_VAPID_KEY not set — web push skipped');
      return;
    }

    let fcmToken: string | null = null;
    try {
      fcmToken = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
    } catch (err) {
      logger.warn('FCM getToken failed:', err);
      return;
    }

    if (!fcmToken) {
      logger.warn('FCM: no token returned — check VAPID key and Firebase project settings');
      return;
    }

    // Only re-register if token changed
    const stored = localStorage.getItem('fitway_push_token_web');
    if (fcmToken === stored) {
      // Token unchanged — just make sure foreground listener is attached
      attachForegroundListener(messaging);
      return;
    }

    // Save to backend
    try {
      const res = await fetch(getApiBase() + '/api/notifications/push-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ token: fcmToken, platform: 'web' }),
      });
      if (res.ok) {
        localStorage.setItem('fitway_push_token_web', fcmToken);
        logger.log('✅ Web push registered');
      } else {
        logger.warn('FCM: failed to save token to server, status:', res.status);
      }
    } catch (err) {
      logger.warn('FCM: network error saving token:', err);
    }

    attachForegroundListener(messaging);
  } catch (err) {
    logger.warn('Web push init failed:', err);
  }
}

/** Attach foreground message listener (once only) */
function attachForegroundListener(messaging: Messaging) {
  if (_listenerAttached) return;
  _listenerAttached = true;

  onMessage(messaging, (payload) => {
    const title = payload.notification?.title || (payload.data as any)?.title || 'FitWay Hub';
    const body  = payload.notification?.body  || (payload.data as any)?.body  || '';
    const icon  = payload.notification?.icon  || '/logo.svg';
    const link  = (payload.data as any)?.link || '/';

    // 1. In-app banner (always shown when tab is active)
    window.dispatchEvent(new CustomEvent('fitway:push', { detail: { title, body, link } }));

    // 2. Native OS notification via service worker (shows even when tab is focused)
    if (Notification.permission === 'granted') {
      try {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body,
            icon,
            badge: '/logo.svg',
            tag: `fitway-${Date.now()}`,
            renotify: true,
            data: { link },
            vibrate: [150, 50, 150],
          } as NotificationOptions & { renotify?: boolean; vibrate?: number[] });
        }).catch(() => {
          new Notification(title, { body, icon });
        });
      } catch {
        new Notification(title, { body, icon });
      }
    }
  });
}

export { app as firebaseApp };
