/**
 * PWA setup: APENAS injeta manifest + meta tags no DOM (web only).
 * NÃO regista qualquer Service Worker. Eliminadas todas as fontes
 * possíveis de cache problemática que causavam bloqueios em PWAs antigas.
 */
import { Platform } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
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
}

export {};
