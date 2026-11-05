// Comprueba la sopa de letras y el crucigrama: node web/comprobar-juegos.js
import assert from 'node:assert/strict'
import { letras, sopaDeLetras, palabraEntre, crucigrama } from './src/juegos.js'

const palabras = ['raíz', 'hoja', 'tallo', 'agua', 'fotosíntesis', 'semilla', 'flor', 'suelo', 'luz', 'año']
  .map(palabra => ({ palabra, pista: `Pista de ${palabra}` }))

assert.deepEqual(letras(' raíz '), ['R', 'A', 'I', 'Z'])
assert.deepEqual(letras('año'), ['A', 'Ñ', 'O']) // la ñ no pierde la tilde

// Sopa: cada palabra está en su sitio, letra a letra, y con la misma semilla sale el mismo tablero.
const sopa = sopaDeLetras(palabras, 'leccion-1')
assert.equal(sopa.colocadas.length, palabras.length)
for (const p of sopa.colocadas) {
  assert.equal(p.celdas.map(([f, c]) => sopa.tablero[f][c]).join(''), letras(p.palabra).join(''))
  assert.equal(palabraEntre(sopa.colocadas, p.celdas.at(-1), p.celdas[0]), sopa.colocadas.indexOf(p)) // tocada al revés también vale
}
assert.ok(sopa.tablero.flat().every(l => l.length === 1))
assert.deepEqual(sopaDeLetras(palabras, 'leccion-1'), sopa)
assert.notDeepEqual(sopaDeLetras(palabras, 'leccion-2').tablero, sopa.tablero)
assert.equal(palabraEntre(sopa.colocadas, [0, 0], [0, 0]), -1)

// Crucigrama: las palabras se cruzan bien, no se pisan, caben en el móvil y están numeradas.
const cruci = crucigrama(palabras)
assert.ok(cruci.palabras.length >= 6, `solo caben ${cruci.palabras.length}`)
assert.ok(cruci.filas <= 13 && cruci.columnas <= 13)
const letra = new Map(cruci.celdas.map(c => [`${c.f},${c.c}`, c.letra]))
for (const p of cruci.palabras) {
  const escrita = p.letras.map((_, i) => letra.get(p.horizontal ? `${p.f},${p.c + i}` : `${p.f + i},${p.c}`)).join('')
  assert.equal(escrita, p.letras.join(''))
  assert.equal(cruci.celdas.find(c => c.f === p.f && c.c === p.c).numero, p.numero)
}
assert.equal(cruci.celdas.length, letra.size) // ninguna casilla repetida
// Lo que se lee de corrido en cada fila y columna (2 letras o más) es una palabra del crucigrama: nada pegado de más.
const enLinea = (h) => {
  const lineas = []
  for (let a = 0; a < (h ? cruci.filas : cruci.columnas); a++) {
    let actual = ''
    for (let b = 0; b <= (h ? cruci.columnas : cruci.filas); b++) {
      const l = letra.get(h ? `${a},${b}` : `${b},${a}`)
      if (l) actual += l
      else { if (actual.length > 1) lineas.push(actual); actual = '' }
    }
  }
  return lineas.sort()
}
assert.deepEqual(enLinea(true), cruci.palabras.filter(p => p.horizontal).map(p => p.letras.join('')).sort())
assert.deepEqual(enLinea(false), cruci.palabras.filter(p => !p.horizontal).map(p => p.letras.join('')).sort())
assert.deepEqual(crucigrama([]).palabras, [])
console.log(`Juegos: sopa de ${sopa.tablero.length}×${sopa.tablero.length} con ${sopa.colocadas.length} palabras y crucigrama de ${cruci.filas}×${cruci.columnas} con ${cruci.palabras.length}`)
