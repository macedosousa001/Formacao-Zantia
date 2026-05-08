/**
 * Kill-switch Service Worker
 * Substitui qualquer SW antigo, limpa todas as caches, desregista-se,
 * e força reload da página para o utilizador voltar a usar a app sem SW.
 */
self.addEventListener('install', (e) => {
  // Toma controlo imediatamente
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // 1. Apaga todas as caches existentes
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) {}

    // 2. Reclama todos os clientes
    try { await self.clients.claim(); } catch (_) {}

    // 3. Avisa todos os clientes para fazerem reload
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const c of clients) c.postMessage({ type: 'SW_KILLED' });
    } catch (_) {}

    // 4. Desregista-se a si próprio
    try { await self.registration.unregister(); } catch (_) {}
  })());
});

// NÃO intercepta nenhum fetch — pedidos vão direto à rede.
// Isto garante que cookies, CORS e Cloudflare challenges funcionam normalmente.
