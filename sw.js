/* Bizon Training — service worker de nettoyage.
   Rôle unique : effacer le service worker hérité du projet ASA, vider ses caches,
   se désinscrire lui-même, puis recharger les onglets ouverts sur la vraie page.
   Il n'intercepte aucune requête. À retirer du dépôt quand le parc est assaini. */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const nom of await caches.keys()) {
      await caches.delete(nom);
    }
    await self.registration.unregister();
    const onglets = await self.clients.matchAll({ type: 'window' });
    for (const o of onglets) {
      try { o.navigate(o.url); } catch (_) {}
    }
  })());
});

/* Aucun respondWith : tout passe par le réseau, rien n'est servi depuis un cache. */
self.addEventListener('fetch', () => {});
