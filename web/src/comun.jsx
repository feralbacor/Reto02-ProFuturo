// Estilos y utilidades que usan todas las pantallas. Es de Claude (ver REPARTO.md): se puede importar, no editar.

// ---------- Estilos ----------
// El diseño está en estilo.css (clases). Estos objetos son para quien usa estilos en línea (Panel.jsx),
// con los mismos colores: papel, tinta y un solo color, el amarillo.
export const COLOR = {
  amarillo: '#f5b400', ocre: '#8a5a00', tinta: '#1a1712', verde: '#17784b', rojo: '#b3302f',
  gris: '#4f483c', borde: '#ddd4c3', suave: '#6b6354', papel: '#f5f1e8', superficie: '#fffdf8',
  azul: '#8a5a00', // nombre antiguo: ahora es el ocre
}
export const pagina = { padding: '12px 16px 72px', maxWidth: '720px', margin: '0 auto' }
const BOTON = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '10px', minHeight: '54px', padding: '0 22px',
  fontSize: '19px', fontWeight: 650, borderRadius: '12px', border: '1px solid transparent', cursor: 'pointer',
}
// boton() es el principal (amarillo con texto en tinta); boton(COLOR.gris) el secundario (papel con borde).
export const boton = (color, extra = {}) => ({
  ...BOTON,
  ...(color === COLOR.gris || color === COLOR.suave
    ? { backgroundColor: COLOR.superficie, color: COLOR.tinta, borderColor: '#c8bda8' }
    : color === COLOR.rojo ? { backgroundColor: COLOR.rojo, color: 'white' }
      : { backgroundColor: COLOR.amarillo, color: '#1c1404' }),
  ...extra,
})
export const botonVolver = { ...BOTON, minHeight: '48px', padding: '0 12px', marginLeft: '-10px', marginBottom: '12px', backgroundColor: 'transparent', color: COLOR.gris }
export const campo = { width: '100%', minHeight: '56px', padding: '0 14px', fontSize: '20px', border: '1px solid #c8bda8', borderRadius: '12px', fontFamily: 'inherit', backgroundColor: COLOR.superficie, color: COLOR.tinta }
export const tarjeta = { padding: '18px', backgroundColor: COLOR.superficie, border: `1px solid ${COLOR.borde}`, borderRadius: '14px', boxShadow: '0 1px 2px hsl(35 30% 18% / 0.07)' }
export const etiqueta = { display: 'block', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }
export const titulo = { fontSize: 'clamp(30px, 8.4vw, 40px)', fontWeight: 800, lineHeight: 1.04, letterSpacing: '-0.035em', marginBottom: '20px' }

// Iconos dibujados a mano (trazo de 2 px, del color del texto). Nada de emojis: cada móvil los pinta distinto.
const TRAZOS = {
  volver: 'M15 5l-7 7 7 7',
  seguir: 'M9 5l7 7-7 7',
  camara: 'M4 8h3l2-3h6l2 3h3v11H4z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  fotos: 'M4 5h16v14H4z M4 16l5-5 4 4 3-3 4 4 M15.5 9.5h.01',
  altavoz: 'M4 9v6h4l5 4V5L8 9z M16.5 8.5a5 5 0 0 1 0 7 M19 6a8.5 8.5 0 0 1 0 12',
  parar: 'M7 7h10v10H7z',
  bien: 'M5 12.5l4.5 4.5L19 7.5',
  mal: 'M6 6l12 12M18 6L6 18',
  mas: 'M12 5v14M5 12h14',
  salir: 'M14 5h5v14h-5 M10 8l-4 4 4 4 M6 12h10',
  buscar: 'M20 12a8 8 0 1 1-2.4-5.7 M20 4v4.5h-4.5',
  notas: 'M5 19V11 M10 19V5 M15 19v-6 M20 19V9',
  duda: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.5 M12 16.8h.01',
}
export function Icono({ nombre, tam = 24, className }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
      <path d={TRAZOS[nombre]} />
    </svg>
  )
}

// ---------- Utilidades ----------
export const SIN_CONEXION = 'No hay conexión con el ordenador de la clase.'

// Las rutas /api/clases/{codigo}/... del profe llevan solas el PIN de esa clase, si este aparato lo tiene,
// y la sesión del profe que ha entrado en este aparato.
export async function api(ruta, { method = 'GET', body } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  const codigo = ruta.match(/^\/api\/clases\/([^/?]+)/)?.[1]
  const pin = codigo && leer('pines-profe', {})[decodeURIComponent(codigo).toUpperCase()]
  if (pin) headers['X-Pin-Profe'] = pin
  const sesion = /^\/api\/(clases|profes)\b/.test(ruta) && leer('profe-sesion', null)?.sesion
  if (sesion) headers['X-Sesion-Profe'] = sesion
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
  if (clave === 'pendientes' || clave === 'dudas-pendientes' || clave === 'perfiles' || /^(clases|version):/.test(clave)) espejar()
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
    const dudas = leer('dudas-pendientes', [])
    await (await caches.open(ESPEJO)).put('/espejo/pagina.json', new Response(JSON.stringify({
      perfiles: perfiles.map(p => ({ id: p.id, version: leer(`clases:${p.id}`, null) ? leer(`version:${p.id}`, null) : null })),
      pendientes,
      dudas,
    })))
    if (!perfiles.length || !navigator.serviceWorker?.controller) return
    const sw = await navigator.serviceWorker.ready
    // Enviar al volver la red aunque la app esté cerrada (Chrome y Android; Safari no lo tiene).
    if (pendientes.length || dudas.length) await sw.sync?.register('mochila')
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
    <div className="cargando" role="status">
      <div className="ruedita" />
      <p>{texto}</p>
    </div>
  )
}

// Aviso de error (por defecto) o de que algo ha ido bien (color = COLOR.verde).
export function Aviso({ texto, color = COLOR.rojo }) {
  if (!texto) return null
  return <p role="alert" className={`aviso ${color === COLOR.verde ? 'aviso-ok' : 'aviso-error'}`}>{texto}</p>
}
