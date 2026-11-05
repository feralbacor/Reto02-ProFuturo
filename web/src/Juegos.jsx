// La sopa de letras y el crucigrama de una lección: para practicar, sin red. No cuentan para la nota.
import { useMemo, useRef, useState } from 'react'
import { Icono } from './comun.jsx'
import { t } from './idioma.js'
import { sopaDeLetras, palabraEntre, crucigrama, letras } from './juegos.js'

const k = (f, c) => `${f},${c}`

export function SopaDeLetras({ palabras, semilla, siguiente }) {
  const { tablero, colocadas } = useMemo(() => sopaDeLetras(palabras, semilla), [palabras, semilla])
  const [inicio, setInicio] = useState(null)
  const [halladas, setHalladas] = useState([]) // posiciones en colocadas
  const [fallo, setFallo] = useState(false)
  const marcadas = new Set(halladas.flatMap(i => colocadas[i].celdas.map(([f, c]) => k(f, c))))

  const tocar = (f, c) => {
    setFallo(false)
    if (!inicio) return setInicio([f, c])
    const i = palabraEntre(colocadas, inicio, [f, c])
    if (i >= 0 && !halladas.includes(i)) setHalladas([...halladas, i])
    else if (i < 0 && k(...inicio) !== k(f, c)) setFallo(true)
    setInicio(null)
  }

  return (
    <>
      <p className="frase" style={{ marginTop: 0 }}>{t('Busca las palabras. Toca su primera letra y después la última.')}</p>
      <div className="sopa" style={{ gridTemplateColumns: `repeat(${tablero.length}, 1fr)` }}>
        {tablero.map((fila, f) => fila.map((letra, c) => (
          <button key={k(f, c)} onClick={() => tocar(f, c)} aria-pressed={inicio ? k(...inicio) === k(f, c) : false}
            className={`sopa-letra ${marcadas.has(k(f, c)) ? 'sopa-hallada' : ''} ${inicio && k(...inicio) === k(f, c) ? 'sopa-inicio' : ''}`}>{letra}</button>
        )))}
      </div>
      {fallo && <p role="status" className="aviso aviso-atencion">{t('Ahí no hay ninguna palabra. Prueba otra vez.')}</p>}
      <p className="pregunta-num" style={{ marginTop: 16 }}>{t('{a} de {b} palabras', { a: halladas.length, b: colocadas.length })}</p>
      <ul className="lista-juego">
        {colocadas.map((p, i) => (
          <li key={i} className={halladas.includes(i) ? 'lista-juego-hecha' : ''}>
            {halladas.includes(i) && <Icono nombre="bien" tam={18} />}<strong>{p.palabra}</strong>: {p.pista}
          </li>
        ))}
      </ul>
      {halladas.length === colocadas.length && <div role="status" className="aviso aviso-ok"><strong>{t('¡Las has encontrado todas!')}</strong></div>}
      {siguiente}
    </>
  )
}

export function Crucigrama({ palabras, siguiente }) {
  const cruci = useMemo(() => crucigrama(palabras), [palabras])
  const solucion = useMemo(() => new Map(cruci.celdas.map(x => [k(x.f, x.c), x])), [cruci])
  const [escrito, setEscrito] = useState({})
  const [comprobado, setComprobado] = useState(false)
  const [horizontal, setHorizontal] = useState(true) // hacia dónde salta al escribir una letra
  const casillas = useRef({})

  const alEntrar = (f, c) => {
    const h = solucion.has(k(f, c - 1)) || solucion.has(k(f, c + 1))
    const v = solucion.has(k(f - 1, c)) || solucion.has(k(f + 1, c))
    if (h !== v) setHorizontal(h) // en un cruce sigue como iba
  }
  const escribir = (f, c, valor) => {
    const letra = letras(valor).at(-1) || ''
    setEscrito(e => ({ ...e, [k(f, c)]: letra }))
    setComprobado(false)
    if (letra) casillas.current[horizontal ? k(f, c + 1) : k(f + 1, c)]?.focus()
  }
  const bien = cruci.celdas.every(x => escrito[k(x.f, x.c)] === x.letra)

  const pistas = (h) => cruci.palabras.filter(p => p.horizontal === h).map(p => (
    <li key={p.numero}><strong>{p.numero}.</strong> {p.pista} <span className="nota">({t('{n} letras', { n: p.letras.length })})</span></li>
  ))

  return (
    <>
      <p className="frase" style={{ marginTop: 0 }}>{t('Lee las pistas y escribe una letra en cada casilla.')}</p>
      <div className="cruci" style={{ gridTemplateColumns: `repeat(${cruci.columnas}, 1fr)`, maxWidth: cruci.columnas * 44 }}>
        {Array.from({ length: cruci.filas * cruci.columnas }, (_, i) => {
          const [f, c] = [Math.floor(i / cruci.columnas), i % cruci.columnas]
          const celda = solucion.get(k(f, c))
          if (!celda) return <span key={i} />
          const como = comprobado && escrito[k(f, c)] ? (escrito[k(f, c)] === celda.letra ? 'cruci-bien' : 'cruci-mal') : ''
          return (
            <span key={i} className={`cruci-celda ${como}`}>
              {celda.numero && <span className="cruci-num">{celda.numero}</span>}
              <input ref={el => { casillas.current[k(f, c)] = el }} value={escrito[k(f, c)] || ''} onFocus={() => alEntrar(f, c)}
                onChange={e => escribir(f, c, e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false}
                aria-label={t('Fila {f}, columna {c}', { f: f + 1, c: c + 1 })} />
            </span>
          )
        })}
      </div>
      <h3 className="subtitulo">{t('Horizontales')}</h3>
      <ul className="lista-juego">{pistas(true)}</ul>
      <h3 className="subtitulo">{t('Verticales')}</h3>
      <ul className="lista-juego">{pistas(false)}</ul>
      {comprobado && (bien
        ? <div role="status" className="aviso aviso-ok"><strong>{t('¡Crucigrama completo!')}</strong></div>
        : <p role="status" className="aviso aviso-atencion">{t('Las casillas en rojo no están bien. Las vacías, todavía por hacer.')}</p>)}
      <div className="botones-fila" style={{ marginTop: 18 }}>
        <button onClick={() => setComprobado(true)} className="boton boton-secundario">{t('Comprobar')}</button>
        <button onClick={() => { setEscrito(Object.fromEntries(cruci.celdas.map(x => [k(x.f, x.c), x.letra]))); setComprobado(true) }}
          className="boton boton-fantasma">{t('Ver la solución')}</button>
      </div>
      {siguiente}
    </>
  )
}
