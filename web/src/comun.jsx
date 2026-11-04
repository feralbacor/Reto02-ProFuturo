// Estilos y utilidades que usan todas las pantallas. Es de Claude (ver REPARTO.md): se puede importar, no editar.

// ---------- Estilos ----------
export const COLOR = { azul: '#2563eb', verde: '#16a34a', rojo: '#dc2626', gris: '#57534e', borde: '#d6d3d1', suave: '#78716c' }
export const pagina = { padding: '20px 16px 60px', maxWidth: '720px', margin: '0 auto' }
export const boton = (color = COLOR.azul, extra = {}) => ({
  padding: '14px 22px', minHeight: '56px', fontSize: '20px', fontWeight: 'bold', color: 'white',
  backgroundColor: color, border: 'none', borderRadius: '12px', cursor: 'pointer', ...extra,
})
export const botonVolver = boton(COLOR.gris, { fontSize: '18px', minHeight: '48px', padding: '10px 18px', marginBottom: '20px' })
export const campo = { width: '100%', padding: '14px', fontSize: '20px', border: `2px solid ${COLOR.borde}`, borderRadius: '10px', fontFamily: 'inherit', backgroundColor: 'white' }
export const tarjeta = { padding: '18px', backgroundColor: 'white', border: `2px solid ${COLOR.borde}`, borderRadius: '14px' }
export const etiqueta = { display: 'block', fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' }
export const titulo = { fontSize: '30px', marginBottom: '20px' }

// ---------- Utilidades ----------
export const SIN_CONEXION = 'No hay conexión con el ordenador de la clase.'

// Las rutas /api/clases/{codigo}/... del profe llevan solas el PIN de esa clase, si este aparato lo tiene.
export async function api(ruta, { method = 'GET', body } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  const codigo = ruta.match(/^\/api\/clases\/([^/?]+)/)?.[1]
  const pin = codigo && leer('pines-profe', {})[decodeURIComponent(codigo).toUpperCase()]
  if (pin) headers['X-Pin-Profe'] = pin
  let res
  try {
    res = await fetch(ruta, { method, headers, body: body ? JSON.stringify(body) : undefined })
  } catch {
    throw new Error(SIN_CONEXION)
  }
  let datos = null
  try { datos = await res.json() } catch { /* respuesta sin JSON */ }
  if (!res.ok) {
    const detalle = datos?.detail
    const error = new Error(typeof detalle === 'string' ? detalle : detalle?.mensaje
      || (res.status >= 500 ? 'El ordenador de la clase no responde. Prueba otra vez.' : 'Algo no ha ido bien. Prueba otra vez.'))
    error.estado = res.status
    error.detalle = detalle // p. ej. {mensaje, sugerencia} si el usuario ya existe
    throw error
  }
  return datos
}

export function leer(clave, porDefecto) {
  try { const v = localStorage.getItem(clave); return v ? JSON.parse(v) : porDefecto } catch { return porDefecto }
}
export function guardar(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)) } catch { /* sin espacio o bloqueado */ }
  if (clave === 'pendientes' || clave === 'perfiles' || /^(clases|version):/.test(clave)) espejar()
}

// Para entrar sin conexión: hash de la contraseña guardado en el aparato (WebCrypto, solo con https o localhost).
export async function hashLocal(contrasena, sal) {
  const texto = new TextEncoder()
  const clave = await crypto.subtle.importKey('raw', texto.encode(contrasena), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: texto.encode(sal), iterations: 100000 }, clave, 256)
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// ---------- Segundo plano ----------
// El service worker (public/segundo-plano.js) sincroniza con la app cerrada, pero no puede leer localStorage:
// le dejamos una copia en la caché «mochila-espejo» y él deja ahí lo que ha enviado y descargado.
const ESPEJO = 'mochila-espejo'

// Varios alumnos pueden usar el mismo aparato: «perfiles» son los que han entrado aquí alguna vez,
// y cada uno tiene sus clases en «clases:ID» y «version:ID». Las respuestas pendientes son del aparato.
export async function espejar() {
  try {
    const perfiles = leer('perfiles', [])
    const pendientes = leer('pendientes', [])
    await (await caches.open(ESPEJO)).put('/espejo/pagina.json', new Response(JSON.stringify({
      perfiles: perfiles.map(p => ({ id: p.id, version: leer(`clases:${p.id}`, null) ? leer(`version:${p.id}`, null) : null })),
      pendientes,
    })))
    if (!perfiles.length || !navigator.serviceWorker?.controller) return
    const sw = await navigator.serviceWorker.ready
    // Enviar al volver la red aunque la app esté cerrada (Chrome y Android; Safari no lo tiene).
    if (pendientes.length) await sw.sync?.register('mochila')
    // Buscar lecciones nuevas de vez en cuando con la app cerrada (solo si está instalada; el navegador decide cuándo).
    await sw.periodicSync?.register('mochila', { minInterval: 60 * 60 * 1000 })
  } catch { /* sin caché, sin permiso o sin service worker: la página sincroniza mientras está abierta */ }
}

// Lo que el service worker envió o descargó con la app cerrada (y lo quita, para recogerlo una sola vez).
export async function tomarDelSegundoPlano() {
  try {
    const cache = await caches.open(ESPEJO)
    const r = await cache.match('/espejo/sw.json')
    if (!r) return null
    await cache.delete('/espejo/sw.json')
    return await r.json()
  } catch { return null }
}
export function guardarPin(codigo, pin) {
  guardar('pines-profe', { ...leer('pines-profe', {}), [codigo.toUpperCase()]: pin })
}

// crypto.randomUUID solo existe con https o en localhost
export const nuevoId = () => crypto.randomUUID
  ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16))

// Reduce la foto a 1600 px en JPEG: lee igual de bien y gasta muchos menos datos.
export function reducirFoto(archivo, ladoMax = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, ladoMax / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * escala)
      canvas.height = Math.round(img.naturalHeight * escala)
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`No se puede abrir «${archivo.name}». Prueba con una foto en JPG o PNG.`))
    }
    img.src = url
  })
}

export function Cargando({ texto }) {
  return (
    <div style={{ textAlign: 'center', padding: '30px 0' }}>
      <div style={{ width: '56px', height: '56px', margin: '0 auto 20px', border: `6px solid ${COLOR.borde}`, borderTopColor: COLOR.azul, borderRadius: '50%', animation: 'girar 1s linear infinite' }} />
      <p style={{ fontSize: '22px', color: COLOR.azul }}>{texto}</p>
    </div>
  )
}

export function Aviso({ texto, color = COLOR.rojo }) {
  if (!texto) return null
  return <p role="alert" style={{ margin: '16px 0', padding: '14px', borderRadius: '10px', backgroundColor: color === COLOR.rojo ? '#fee2e2' : '#dcfce7', color, fontSize: '19px' }}>{texto}</p>
}
