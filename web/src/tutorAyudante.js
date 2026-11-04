// Nivel mejorado del tutor (opcional): un modelo pequeño (unos 150 MB) que compara frases por su significado, dentro del móvil.
// Solo se descarga si el estudiante lo pide; después funciona sin red. No escribe nada: solo elige frases de la lección.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { buscar, frasesDe, elegir } from './tutorBuscar.js'

export const MODELO = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2'
// Medido con las lecciones de la demo: lo que no tiene que ver da 0.29 o menos; lo que sí, 0.42 o más.
const MINIMO = 0.38

// La búsqueda por palabras acierta más cuando la duda usa las palabras de la lección. Si no encuentra nada
// («¿por qué llueve?» no dice «lluvia»), el ayudante busca la frase que significa lo mismo.
export async function buscarConSentido(contenido, duda, vectores) {
  const basico = buscar(contenido, duda)
  if (basico.length) return basico
  const frases = frasesDe(contenido)
  if (!frases.length || !duda.trim()) return []
  const [v, ...vs] = await vectores([duda, ...frases.map(f => f.conAntes)])
  return elegir(frases, vs.map(x => x.reduce((s, n, k) => s + n * v[k], 0)), MINIMO, 0.9)
}

let actual = { estado: leerEstado(), progreso: 0 } // estado: 'no' | 'descargando' | 'listo' | 'error'
const avisos = new Set()
function cambiar(estado, progreso = 0) { actual = { estado, progreso }; avisos.forEach(f => f()) }

function leerEstado() {
  try { return localStorage.getItem('ayudante') === 'listo' ? 'listo' : 'no' } catch { return 'no' }
}

let modelo = null
function cargar(alAvanzar) {
  modelo ??= import('@huggingface/transformers').then(({ pipeline, env }) => {
    const ort = env.backends.onnx
    // El motor sencillo (14 MB) basta: no usamos la tarjeta gráfica. La librería lo guarda para usarlo sin red.
    const motor = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.versions.web}/dist/ort-wasm-simd-threaded`
    ort.wasm.wasmPaths = { mjs: `${motor}.mjs`, wasm: `${motor}.wasm` }
    return pipeline('feature-extraction', MODELO, { dtype: 'q8', device: 'wasm', progress_callback: alAvanzar })
  }).catch(error => { modelo = null; throw error })
  return modelo
}

export async function descargar() {
  cambiar('descargando')
  navigator.storage?.persist?.() // que el móvil no lo borre para hacer sitio
  const archivos = {}
  try {
    await cargar(p => {
      if (p.status !== 'progress' || !p.total) return
      archivos[p.file] = p
      const todos = Object.values(archivos)
      cambiar('descargando', Math.floor(100 * todos.reduce((s, a) => s + a.loaded, 0) / todos.reduce((s, a) => s + a.total, 0)))
    })
    localStorage.setItem('ayudante', 'listo')
    cambiar('listo')
  } catch {
    cambiar('error')
  }
}

const guardados = new Map() // frase → vector, para no volver a calcular las frases de la lección en cada duda
async function vectores(textos) {
  const faltan = textos.filter(t => !guardados.has(t))
  if (faltan.length) {
    const calculados = (await (await cargar())(faltan, { pooling: 'mean', normalize: true })).tolist()
    faltan.forEach((t, i) => guardados.set(t, calculados[i]))
  }
  return textos.map(t => guardados.get(t))
}

export function useAyudante() {
  return useSyncExternalStore(f => { avisos.add(f); return () => avisos.delete(f) }, () => actual)
}

// Lo mismo que buscar(), pero si el ayudante está descargado también entiende la duda dicha con otras palabras.
export function useBuscar(contenido, duda) {
  const { estado } = useAyudante()
  const basico = buscar(contenido, duda)
  const [mejor, setMejor] = useState(null)
  const falta = estado === 'listo' && !basico.length
  useEffect(() => {
    if (!falta) return
    let sigue = true
    buscarConSentido(contenido, duda, vectores)
      .then(trozos => sigue && setMejor({ contenido, duda, trozos }))
      .catch(() => { try { localStorage.removeItem('ayudante') } catch { /* sin almacenamiento */ } cambiar('no') }) // el móvil lo borró: que se pueda volver a descargar
    return () => { sigue = false }
  }, [contenido, duda, falta])
  return falta && mejor?.contenido === contenido && mejor.duda === duda ? mejor.trozos : basico
}
