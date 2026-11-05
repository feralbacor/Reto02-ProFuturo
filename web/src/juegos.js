// Sopa de letras y crucigrama, hechos en el móvil con las palabras de la lección: sin red y sin IA.
// Se comprueba con: node web/comprobar-juegos.js

// En mayúsculas y sin tildes (la ñ se queda), letra a letra. Vale también para otros alfabetos.
export const letras = (palabra) => [...String(palabra).trim().toLocaleUpperCase()
  .replace(/Ñ/g, '\u0000').normalize('NFD').replace(/\p{M}/gu, '').replace(/\u0000/g, 'Ñ')]

// Números al azar que salen siempre iguales con la misma semilla (el id de la lección): el mismo tablero cada vez.
function azar(semilla) {
  let a = [...String(semilla)].reduce((h, ch) => Math.imul(h ^ ch.codePointAt(0), 16777619), 2166136261) >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DIRECCIONES = [[0, 1], [1, 0], [1, 1], [-1, 1]] // derecha, abajo y las dos diagonales: se leen de izquierda a derecha

export function sopaDeLetras(palabras, semilla) {
  const rnd = azar(semilla)
  const lista = palabras.map(p => ({ ...p, letras: letras(p.palabra) })).sort((a, b) => b.letras.length - a.letras.length)
  const lado = Math.min(12, Math.max(8, lista[0]?.letras.length || 8))
  const tablero = Array.from({ length: lado }, () => Array(lado).fill(''))
  const colocadas = []
  for (const p of lista) {
    for (let intento = 0; intento < 300; intento++) {
      const [df, dc] = DIRECCIONES[Math.floor(rnd() * DIRECCIONES.length)]
      const f0 = Math.floor(rnd() * lado)
      const c0 = Math.floor(rnd() * lado)
      const celdas = p.letras.map((_, i) => [f0 + df * i, c0 + dc * i])
      if (celdas.every(([f, c], i) => f >= 0 && f < lado && c >= 0 && c < lado && (!tablero[f][c] || tablero[f][c] === p.letras[i]))) {
        celdas.forEach(([f, c], i) => { tablero[f][c] = p.letras[i] })
        colocadas.push({ palabra: p.palabra, pista: p.pista, celdas })
        break
      }
    }
  }
  const relleno = lista.flatMap(p => p.letras) // letras del mismo alfabeto que las palabras
  for (const fila of tablero) fila.forEach((l, c) => { if (!l) fila[c] = relleno[Math.floor(rnd() * relleno.length)] })
  return { tablero, colocadas }
}

// ¿Qué palabra va de la casilla a a la b (en cualquiera de los dos sentidos)? Su posición en colocadas, o -1.
export const palabraEntre = (colocadas, a, b) => colocadas.findIndex(({ celdas }) => {
  const [primera, ultima] = [celdas[0], celdas[celdas.length - 1]]
  const igual = (x, y) => x[0] === y[0] && x[1] === y[1]
  return (igual(primera, a) && igual(ultima, b)) || (igual(primera, b) && igual(ultima, a))
})

const MAX_LADO = 13 // para que quepa en un móvil pequeño

export function crucigrama(palabras) {
  const lista = palabras.map(p => ({ ...p, letras: letras(p.palabra) })).filter(p => p.letras.length <= MAX_LADO)
    .sort((a, b) => b.letras.length - a.letras.length)
  const celdas = new Map() // "f,c" → { letra, h, v }
  const clave = (f, c) => `${f},${c}`
  const puestas = []
  let caja = { f0: 0, f1: 0, c0: 0, c1: 0 }

  // Cuántos cruces tendría la palabra empezando en (f, c), o -1 si no cabe.
  const cruces = (p, f, c, h) => {
    const [df, dc] = h ? [0, 1] : [1, 0]
    const n = p.letras.length
    if (celdas.has(clave(f - df, c - dc)) || celdas.has(clave(f + df * n, c + dc * n))) return -1
    const f1 = f + df * (n - 1)
    const c1 = c + dc * (n - 1)
    if (Math.max(caja.f1, f1) - Math.min(caja.f0, f) >= MAX_LADO || Math.max(caja.c1, c1) - Math.min(caja.c0, c) >= MAX_LADO) return -1
    let n_cruces = 0
    for (let i = 0; i < n; i++) {
      const [ff, cc] = [f + df * i, c + dc * i]
      const hay = celdas.get(clave(ff, cc))
      if (hay) {
        if (hay.letra !== p.letras[i] || hay[h ? 'h' : 'v']) return -1
        n_cruces++
      } else if (celdas.has(clave(ff + dc, cc + df)) || celdas.has(clave(ff - dc, cc - df))) {
        return -1 // pegada a otra palabra: se formarían palabras que no existen
      }
    }
    return n_cruces
  }

  const poner = (p, f, c, h) => {
    const [df, dc] = h ? [0, 1] : [1, 0]
    p.letras.forEach((letra, i) => {
      const k = clave(f + df * i, c + dc * i)
      celdas.set(k, { ...celdas.get(k), letra, [h ? 'h' : 'v']: true })
    })
    caja = { f0: Math.min(caja.f0, f), f1: Math.max(caja.f1, f + df * (p.letras.length - 1)), c0: Math.min(caja.c0, c), c1: Math.max(caja.c1, c + dc * (p.letras.length - 1)) }
    puestas.push({ ...p, f, c, horizontal: h })
  }

  let quedan = [...lista]
  if (quedan.length) poner(quedan.shift(), 0, 0, true)
  for (let vuelta = 0; vuelta < 2; vuelta++) { // a la segunda vuelta caben algunas que antes no tenían con qué cruzarse
    quedan = quedan.filter(p => {
      let mejor = null
      for (const [k, celda] of celdas) {
        const [f, c] = k.split(',').map(Number)
        p.letras.forEach((letra, i) => {
          if (letra !== celda.letra) return
          for (const h of [true, false]) {
            const [f0, c0] = h ? [f, c - i] : [f - i, c]
            const n = cruces(p, f0, c0, h)
            if (n > 0 && (!mejor || n > mejor.n)) mejor = { n, f0, c0, h }
          }
        })
      }
      if (mejor) poner(p, mejor.f0, mejor.c0, mejor.h)
      return !mejor
    })
  }

  // Números como en un crucigrama de papel: de arriba abajo y de izquierda a derecha.
  const inicios = [...new Set(puestas.map(p => clave(p.f, p.c)))]
    .map(k => k.split(',').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const numero = (f, c) => inicios.findIndex(([ff, cc]) => ff === f && cc === c) + 1
  return {
    filas: caja.f1 - caja.f0 + 1,
    columnas: caja.c1 - caja.c0 + 1,
    celdas: [...celdas].map(([k, { letra }]) => {
      const [f, c] = k.split(',').map(Number)
      return { f: f - caja.f0, c: c - caja.c0, letra, numero: puestas.some(p => p.f === f && p.c === c) ? numero(f, c) : null }
    }),
    palabras: puestas.map(p => ({ numero: numero(p.f, p.c), horizontal: p.horizontal, f: p.f - caja.f0, c: p.c - caja.c0, letras: p.letras, pista: p.pista }))
      .sort((a, b) => a.numero - b.numero),
  }
}
