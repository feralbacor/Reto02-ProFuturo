// Nivel básico del tutor: busca en la lección las frases que responden a la duda. Sin internet y sin IA.
// Solo usa el contenido de la lección: nunca el nombre ni los datos del alumno.

const VACIAS = new Set(('el la los las un una unos unas de del al a en y o u e que qué es son ser esta este esto estas estos ' +
  'por para con sin se su sus lo le les me mi mis te tu tus nos como cómo cuando cuándo donde dónde cual cuál cuales cuáles ' +
  'quien quién porque pero mas más muy hay ya no si sí eso esa ese también tiene tienen hace hacen puede pueden sirve sirven ' +
  'algo alguna alguno todo toda todos todas otra otro otras otros entre sobre hasta desde cada parte decir dice explica significa ' +
  'yo entiendo entender sé saber pasa ocurre llama llaman').split(' ').map(sinTildes))

function sinTildes(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// «plantas», «planta» y «plantar» comparten raíz: basta con las 5 primeras letras.
// «llueve», «lluvia» y «llover» cambian las vocales: también cuentan sus consonantes («~llv»), si son al menos 3.
export function raices(texto) {
  return [...new Set(sinTildes(texto).split(/[^a-zñ0-9]+/)
    .filter(p => p.length > 2 && !VACIAS.has(p))
    .flatMap(p => {
      const raiz = p.slice(0, 5)
      const consonantes = raiz[0] + raiz.slice(1).replace(/[aeiou]/g, '')
      return consonantes.length >= 3 ? [raiz, `~${consonantes}`] : [raiz]
    }))]
}

// Parte la lección en frases, recordando de qué pestaña viene cada una.
export function frasesDe(contenido) {
  const partes = [['Leer', contenido.lectura_facil], ['Ejemplo', contenido.explicacion_ejemplo]]
  return partes.flatMap(([parte, texto]) => (texto || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map(f => f.trim())
    .filter(f => f.length > 3)
    // «También absorben agua» habla de lo de la frase anterior (las raíces): cuenta también sus palabras.
    .map((texto, i, todas) => ({ texto, parte, raices: raices(REMITE.test(sinTildes(texto)) && i > 0 ? `${todas[i - 1]} ${texto}` : texto) })))
}

// Devuelve las frases que mejor responden (como mucho 2, en el orden de la lección), o [] si la lección no lo explica.
export function buscar(contenido, duda) {
  const frases = frasesDe(contenido)
  const cuantas = r => frases.filter(f => f.raices.includes(r)).length
  // «¿Qué papel toma el sol?»: «papel» y «toma» no salen en la lección y no deben tapar a «sol».
  const escritas = raices(duda)
  const pedidas = escritas.filter(r => cuantas(r) > 0)
  if (!pedidas.length) return []
  // «¿Qué son los volcanes del agua?»: si al quitar las que no están solo queda una muy repetida, la lección no lo explica.
  if (pedidas.length < escritas.length && !pedidas.some(r => cuantas(r) <= frases.length / 2)) return []
  // Una palabra que sale en pocas frases dice más que una que sale en todas.
  const peso = r => Math.log(1 + frases.length / (1 + cuantas(r)))
  const total = pedidas.reduce((s, r) => s + peso(r), 0)
  const puntuadas = frases.map((f, i) => ({ ...f, i, nota: f.raices.filter(r => pedidas.includes(r)).reduce((s, r) => s + peso(r), 0) / total }))
  const mejor = Math.max(...puntuadas.map(f => f.nota))
  if (mejor < 0.34) return [] // casi nada en común: mejor decir que no lo sabe que inventar
  const elegidas = new Set(puntuadas.filter(f => f.nota >= mejor * 0.75).sort((a, b) => b.nota - a.nota).slice(0, 2).map(f => f.i))
  // «Este proceso se llama fotosíntesis» no se entiende solo: añadimos la frase de antes.
  for (const i of [...elegidas]) if (i > 0 && frases[i - 1].parte === frases[i].parte && REMITE.test(sinTildes(frases[i].texto))) elegidas.add(i - 1)
  // Frases seguidas de la misma pestaña van juntas, en el orden de la lección.
  const trozos = []
  for (const i of [...elegidas].sort((a, b) => a - b)) {
    const ultimo = trozos.at(-1)
    if (ultimo && ultimo.hasta === i - 1 && ultimo.parte === frases[i].parte) { ultimo.texto += ` ${frases[i].texto}`; ultimo.hasta = i }
    else trozos.push({ texto: frases[i].texto, parte: frases[i].parte, hasta: i })
  }
  return trozos.map(({ texto, parte }) => ({ texto, parte }))
}

const REMITE = /^(este|esta|estos|estas|eso|esto|ese|esa|tambien|alli|asi|ademas|por eso)\b/
