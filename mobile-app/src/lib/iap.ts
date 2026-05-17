import { Capacitor } from '@capacitor/core';

export function isNativeApp(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

export function detectPlatform(): 'android' | 'ios' | 'web' {
  try {
    const p = Capacitor.getPlatform();
    if (p === 'android') return 'android';
    if (p === 'ios') return 'ios';
  } catch {}
  return 'web';
}
