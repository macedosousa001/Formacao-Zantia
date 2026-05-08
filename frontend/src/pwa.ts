/**
 * Web-only PWA setup. Após o "kill switch" do SW, decidimos NÃO registar
 * mais nenhum SW — a app funciona como SPA normal, sem cache, sem
 * intermediários a interferirem com chamadas API/CORS/Cloudflare.
 *
 * Mantemos apenas: manifest link, theme-color e apple-touch-icon
 * (suficientes para "Add to Home Screen").
 */
import { Platform } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
  // Inject manifest + meta tags (no SW)
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

  // Auto-cleanup: se houver SWs antigos registados, força-os a actualizar
  // para o kill-switch (que limpa caches e desregista-se), depois reload.
  if ('serviceWorker' in navigator) {
    let __reloaded = false;
    const reloadOnce = () => {
      if (__reloaded) return;
      __reloaded = true;
      setTimeout(() => window.location.reload(), 200);
    };

    navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
      const t = e.data && (e.data as any).type;
      if (t === 'SW_KILLED' || t === 'SW_UPDATED') reloadOnce();
    });

    // Verifica SWs antigos e força update; se nenhum estiver registado, não faz nada.
    (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length === 0) return; // nada a fazer
        for (const reg of regs) {
          try {
            await reg.update();
            // Carrega o sw.js (kill switch) para que a versão antiga se substitua
            await fetch('/sw.js?nuke=' + Date.now(), { cache: 'no-cache' });
          } catch (_) {}
        }
        // Após short delay, se ainda houver controller, limpa storage e recarrega.
        setTimeout(async () => {
          try {
            const regsNow = await navigator.serviceWorker.getRegistrations();
            for (const r of regsNow) {
              try { await r.unregister(); } catch (_) {}
            }
            if ('caches' in window) {
              try {
                const ks = await caches.keys();
                await Promise.all(ks.map((k) => caches.delete(k)));
              } catch (_) {}
            }
          } catch (_) {}
        }, 1500);
      } catch (e) {
        console.warn('SW cleanup failed:', e);
      }
    })();
  }
}

export {};
