/**
 * Registers the PWA service worker and adds the manifest link on Web only.
 * Side-effect module imported once from _layout.tsx.
 * Native (iOS/Android) ignores this entirely.
 */
import { Platform } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
  // 1. Inject manifest + meta tags
  try {
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.webmanifest';
      document.head.appendChild(link);
    }
    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#D92525';
      document.head.appendChild(meta);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const apple = document.createElement('link');
      apple.rel = 'apple-touch-icon';
      apple.href = '/assets/assets/images/icon.png';
      document.head.appendChild(apple);
    }
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const m = document.createElement('meta');
      m.name = 'apple-mobile-web-app-capable';
      m.content = 'yes';
      document.head.appendChild(m);
    }
    if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) {
      const m = document.createElement('meta');
      m.name = 'apple-mobile-web-app-title';
      m.content = 'Zantia';
      document.head.appendChild(m);
    }
  } catch (e) {
    console.warn('PWA meta injection failed:', e);
  }

  // 2. Register service worker (HTTPS or localhost only) with auto-reload on update
  if ('serviceWorker' in navigator) {
    let __reloaded = false;
    navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
      if (e.data && (e.data as any).type === 'SW_UPDATED' && !__reloaded) {
        __reloaded = true;
        setTimeout(() => window.location.reload(), 200);
      }
    });
    const isLocal =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHttps = window.location.protocol === 'https:';
    if (isLocal || isHttps) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then((reg) => {
            if (reg && reg.update) reg.update().catch(() => null);
            reg.addEventListener('updatefound', () => {
              const nw = reg.installing;
              if (!nw) return;
              nw.addEventListener('statechange', () => {
                if (nw.state === 'activated' && navigator.serviceWorker.controller && !__reloaded) {
                  __reloaded = true;
                  window.location.reload();
                }
              });
            });
          })
          .catch((err) => console.warn('SW registration failed:', err));
      });
    }
  }

  // 3. Capture install prompt for future custom UI
  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault();
    (window as any).__zantiaDeferredPrompt = e;
  });
}

export {};
