// Sincronización en segundo plano, dentro del service worker (vite.config.js → workbox.importScripts).
// Con la app cerrada: envía las respuestas pendientes en cuanto vuelve la red («sync») y busca lecciones
// nuevas de vez en cuando si la app está instalada («periodicsync»). Solo Chrome y Android; en Safari no existe
// y la página lo hace mientras está abierta. Los datos van y vienen por la caché «mochila-espejo» (comun.jsx).
const ESPEJO = 'mochila-espejo'

async function leerEspejo(ruta) {
  const r = await (await caches.open(ESPEJO)).match(ruta)
  return r ? r.json() : null
}

// Varios alumnos pueden compartir el aparato: se piden las clases de cada uno. Las respuestas pendientes
// van todas en la primera petición (el servidor mira el alumno de cada una).
async function sincronizarEnSegundoPlano() {
  const pagina = await leerEspejo('/espejo/pagina.json')
  if (!pagina?.perfiles?.length) return
  // Lo de una vez anterior que la página aún no ha recogido
  const previo = (await leerEspejo('/espejo/sw.json')) || { recibidas: [], alumnos: {} }
  const recibidas = new Set(previo.recibidas)
  const dudasRecibidas = new Set(previo.dudas_recibidas || [])
  const alumnos = { ...previo.alumnos }
  let porEnviar = pagina.pendientes.filter(p => !recibidas.has(p.id))
  let dudasPorEnviar = (pagina.dudas || []).filter(d => !dudasRecibidas.has(d.id))
  for (const { id, version } of pagina.perfiles) {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alumno_id: id, respuestas: porEnviar, dudas: dudasPorEnviar, version: alumnos[id] ? alumnos[id].version : version }),
    })
    if (!res.ok) throw new Error(`/api/sync ${res.status}`) // así el navegador lo reintenta más tarde
    const r = await res.json()
    r.recibidas.forEach(x => recibidas.add(x))
    ;(r.dudas_recibidas || []).forEach(x => dudasRecibidas.add(x))
    porEnviar = []
    dudasPorEnviar = []
    alumnos[id] = { clases: r.clases ?? alumnos[id]?.clases ?? null, version: r.version, dudas: r.dudas }
  }
  await (await caches.open(ESPEJO)).put('/espejo/sw.json', new Response(JSON.stringify({
    recibidas: [...recibidas],
    dudas_recibidas: [...dudasRecibidas],
    alumnos,
    fecha: new Date().toISOString(),
  })))
  for (const ventana of await self.clients.matchAll({ type: 'window' })) ventana.postMessage('mochila-sincronizada')
}

self.addEventListener('sync', e => { if (e.tag === 'mochila') e.waitUntil(sincronizarEnSegundoPlano()) })
self.addEventListener('periodicsync', e => { if (e.tag === 'mochila') e.waitUntil(sincronizarEnSegundoPlano()) })
