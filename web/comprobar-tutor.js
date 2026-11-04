// Comprueba la búsqueda del tutor con las lecciones de la demo: node web/comprobar-tutor.js
import assert from 'node:assert/strict'
import { buscar } from './src/tutorBuscar.js'

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
assert.match(textos(agua, 'Que papel toma el sol?'), /^El sol calienta/) // las palabras que no salen en la lección no tapan a «sol»
assert.match(textos(agua, 'por que llueve'), /llover/) // «llueve» encuentra «llover» aunque cambien las vocales
for (const duda of ['¿Qué son los volcanes?', 'hola', '', '¿?']) assert.deepEqual(buscar(agua, duda), [], duda) // no se inventa nada
assert.deepEqual(buscar({}, 'agua'), []) // lección sin textos
// Pista del test: la pregunta y su opción buena llevan a la frase de la lección donde está.
assert.equal(textos(agua, '¿Qué forma las nubes? Gotas pequeñas'), 'Forma gotas pequeñas que se juntan en las nubes: es la condensación.')
console.log('Tutor correcto: encuentra la frase, une «Este…» con la anterior y no contesta lo que no está.')
