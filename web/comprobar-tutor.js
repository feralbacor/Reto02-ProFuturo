// Comprueba la búsqueda del tutor con las lecciones de la demo: node web/comprobar-tutor.js
import assert from 'node:assert/strict'
import { buscar } from './src/tutorBuscar.js'
import { buscarConSentido } from './src/tutorAyudante.js'

const agua = {
  lectura_facil: 'El agua cambia de lugar y de estado. El sol calienta el agua de mares, ríos y lagos. Parte se convierte en vapor: es la evaporación. El vapor sube y se enfría. Forma gotas pequeñas que se juntan en las nubes: es la condensación.',
  explicacion_ejemplo: 'Después de llover queda un charco en el patio. Con el calor del sol, parte del agua se evapora.',
}
const plantas = {
  lectura_facil: 'Las raíces sujetan la planta al suelo. También absorben agua y sales minerales. Las hojas aprovechan la luz para fabricar alimento. Este proceso se llama fotosíntesis.',
  explicacion_ejemplo: 'Regamos la tierra para que las raíces puedan absorber agua.',
}
const textos = (l, duda) => buscar(l, duda).map(t => t.texto).join(' | ')

assert.match(textos(agua, '¿Qué es la condensación?'), /es la condensación/)
assert.match(textos(agua, 'no entiendo la evaporacion'), /es la evaporación/) // sin tilde también
assert.equal(buscar(agua, 'no entiendo la evaporacion')[1].parte, 'Ejemplo')
assert.match(textos(plantas, '¿Qué es la fotosíntesis?'), /^Las hojas aprovechan la luz.*fotosíntesis\.$/) // «Este proceso…» trae la frase de antes
assert.match(textos(plantas, 'que absorben las raices'), /También absorben agua/)
for (const duda of ['¿Qué son los volcanes?', 'hola', '', '¿?']) assert.deepEqual(buscar(agua, duda), [], duda) // no se inventa nada
assert.deepEqual(buscar({}, 'agua'), []) // lección sin textos
// Pista del test: la pregunta y su opción buena llevan a la frase de la lección donde está.
assert.equal(textos(agua, '¿Qué forma las nubes? Gotas pequeñas'), 'Forma gotas pequeñas que se juntan en las nubes: es la condensación.')
// Ayudante: solo se usa si las palabras no encuentran nada, y tampoco contesta si nada se parece lo bastante.
// Vectores de prueba: la duda apunta a la frase de la lluvia (no hace falta el modelo de verdad).
const lluvia = { ...agua, lectura_facil: agua.lectura_facil + ' Cuando las gotas crecen, caen como lluvia.' }
const parecido = (a, b) => async textos => textos.map((t, i) => i === 0 ? [1, 0] : t.includes('lluvia') ? [a, b] : [0, 1])
let usado = false
assert.match((await buscarConSentido(agua, '¿Qué es la condensación?', async () => { usado = true })).map(t => t.texto).join(), /condensación/)
assert.equal(usado, false)
assert.equal((await buscarConSentido(lluvia, '¿por qué llueve?', parecido(0.74, 0.67)))[0].texto, 'Cuando las gotas crecen, caen como lluvia.')
assert.deepEqual(await buscarConSentido(lluvia, '¿por qué llueve?', parecido(0.29, 0.96)), [])
console.log('Tutor correcto: encuentra la frase, une «Este…» con la anterior y no contesta lo que no está.')
