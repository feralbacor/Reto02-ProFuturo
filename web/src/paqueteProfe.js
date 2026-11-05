// Modo caja: el profe entra sin conexión en cualquier aparato que haya visto la caja alguna vez.
// Su aparato junta lo que ve (clases, notas, estadísticas y su sesión), lo cifra con una llave sacada de su
// contraseña (AES-GCM) y lo sube. Todos los aparatos se bajan los paquetes de todos los profes: sin la contraseña
// de ese profe son ilegibles. La llave sale de 600.000 vueltas de PBKDF2, para que probar contraseñas sea lento.
import { api, leer, guardar, nuevoId } from './comun.jsx'

const VUELTAS = 600000
const texto = new TextEncoder()

function aBase64(datos) {
  const b = new Uint8Array(datos)
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(s)
}
const deBase64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0))
const delUsuario = (usuario) => usuario.replace(/\s+/g, '').toLowerCase()

async function llave(contrasena, sal) {
  const base = await crypto.subtle.importKey('raw', texto.encode(contrasena), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: texto.encode(sal), iterations: VUELTAS },
    base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}
// Mientras el profe está dentro, su aparato guarda la llave para ir subiendo el paquete sin volver a pedir la contraseña.
const guardarLlave = async (usuario, sal, k) => guardar('profe-llave', { usuario, sal, k: aBase64(await crypto.subtle.exportKey('raw', k)) })

// Al entrar con conexión.
// shortcut: vale cualquier contraseña (prototipo); con una corta, quien copie el paquete la adivina probando. Para uso real, pedir 8 o más.
export async function prepararLlave(usuario, contrasena) {
  try {
    const sal = nuevoId()
    await guardarLlave(usuario, sal, await llave(contrasena, sal))
  } catch { /* sin https no hay WebCrypto: entonces no hay paquete */ }
}

let subiendo = false
export async function subirPaquete(sesion) {
  const ll = leer('profe-llave', null)
  if (subiendo || !ll || ll.usuario !== sesion.usuario) return
  subiendo = true
  try {
    const copias = { '/api/profes/clases': await api('/api/profes/clases') }
    for (const c of copias['/api/profes/clases']) {
      const r = `/api/clases/${encodeURIComponent(c.codigo)}`
      for (const ruta of [r, `${r}/panel`, `${r}/estadisticas`]) copias[ruta] = await api(ruta).catch(() => null)
    }
    const k = await crypto.subtle.importKey('raw', deBase64(ll.k), 'AES-GCM', false, ['encrypt'])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, texto.encode(JSON.stringify({ sesion, copias })))
    const paquete = { usuario: sesion.usuario, nombre: sesion.nombre, sal: ll.sal, iv: aBase64(iv), cifrado: aBase64(cifrado) }
    const { fecha } = await api('/api/profes/paquete', { method: 'PUT', body: { sal: paquete.sal, iv: paquete.iv, cifrado: paquete.cifrado } })
    guardar('paquetes-profe', [...leer('paquetes-profe', []).filter(p => p.usuario !== sesion.usuario), { ...paquete, fecha }])
  } catch { /* sin conexión o fuera del modo caja: se probará más tarde */ } finally {
    subiendo = false
  }
}

// Todos los aparatos, también los de los alumnos: mira qué paquetes han cambiado y baja solo esos.
// alHaberNuevos(n) se llama antes de bajarlos. Devuelve { nuevos, total }. Sin conexión lanza el error de api().
export async function actualizarPaquetes(alHaberNuevos = () => {}) {
  const fechas = await api('/api/paquetes-profe/fechas')
  const aqui = leer('paquetes-profe', []).filter(p => fechas.some(f => f.usuario === p.usuario)) // sin los que ya no están
  const nuevos = fechas.filter(f => !aqui.some(p => p.usuario === f.usuario && p.fecha === f.fecha)).map(f => f.usuario)
  if (nuevos.length) {
    alHaberNuevos(nuevos.length)
    const bajados = await api(`/api/paquetes-profe?usuarios=${encodeURIComponent(nuevos.join(','))}`)
    guardar('paquetes-profe', [...aqui.filter(p => !nuevos.includes(p.usuario)), ...bajados])
  } else {
    guardar('paquetes-profe', aqui)
  }
  return { nuevos: nuevos.length, total: fechas.length }
}

export const tienePaquete = (usuario) => leer('paquetes-profe', []).some(p => p.usuario === delUsuario(usuario))

// Entrar sin conexión: devuelve la sesión, o null si la contraseña no abre el paquete (o no hay paquete).
export async function abrirPaquete(usuario, contrasena) {
  const p = leer('paquetes-profe', []).find(p => p.usuario === delUsuario(usuario))
  if (!p) return null
  try {
    const k = await llave(contrasena, p.sal)
    const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deBase64(p.iv) }, k, deBase64(p.cifrado))
    const { sesion, copias } = JSON.parse(new TextDecoder().decode(claro))
    for (const [ruta, datos] of Object.entries(copias)) if (datos) guardar(`copia:${p.usuario}:${ruta}`, datos)
    await guardarLlave(p.usuario, p.sal, k)
    return sesion
  } catch {
    return null // AES-GCM no abre con otra contraseña
  }
}

// Al salir no queda nada del profe a la vista en este aparato: solo su paquete cifrado.
export function borrarCopiasProfe(usuario) {
  try {
    Object.keys(localStorage)
      .filter(k => k === 'profe-sesion' || k === 'profe-llave' || k === 'profe-clases' || k.startsWith(`copia:${usuario}:`)
        || /^profe-(clase|progreso|estadisticas):/.test(k))
      .forEach(k => localStorage.removeItem(k))
  } catch { /* nada */ }
}
