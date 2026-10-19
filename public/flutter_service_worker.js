// La app Flutter anterior instalaba un service worker con este mismo nombre en
// esta dirección, y sigue sirviendo la versión vieja desde su caché. Este archivo
// lo reemplaza: borra las cachés, se da de baja y recarga las pestañas abiertas
// para que carguen la versión nueva (React).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const claves = await caches.keys()
        await Promise.all(claves.map((k) => caches.delete(k)))
      } catch {
        /* sin cachés que borrar */
      }
      await self.registration.unregister()
      const ventanas = await self.clients.matchAll({ type: 'window' })
      ventanas.forEach((v) => v.navigate(v.url))
    })(),
  )
})
