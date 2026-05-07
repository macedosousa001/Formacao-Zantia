/**
 * Registers the PWA service worker and adds the manifest link on Web only.
 * This is a side-effect module imported once from _layout.tsx.
 * All native platforms (iOS/Android) ignore this entirely.
 */
import { Platform } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
  // 1. Inject the manifest link if not already present.
  try {
    const hasManifest = !!document.querySelector('link[rel="manifest"]');
    if (!hasManifest) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.webmanifest';
      document.head.appendChild(link);
    }
    // Theme color for browser chrome
    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#D92525';
      document.head.appendChild(meta);
    }
    // Apple touch icon for iOS Safari "Add to home screen"
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const apple = document.createElement('link');
      apple.rel = 'apple-touch-icon';
      apple.href = '/assets/assets/images/icon.png';
      document.head.appendChild(apple);
    }
    // Apple-mobile-web-app-capable for standalone mode on iOS
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

  // 2. Register the service worker (only on production HTTPS / localhost).
  if ('serviceWorker' in navigator) {
    const isLocal =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHttps = window.location.protocol === 'https:';
    if (isLocal || isHttps) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then((reg) => {
            // Listen for new versions and force-refresh the page.
            if (reg && reg.update) {
              reg.update().catch(() => null);
            }
          })
          .catch((err) => console.warn('SW registration failed:', err));
      });
    }
  }

  // 3. Capture install prompt to allow custom UI later if needed.
  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault();
    (window as any).__zantiaDeferredPrompt = e;
  });
}

export {};
