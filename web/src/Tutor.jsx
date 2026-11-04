// Tutor sin conexión: el alumno escribe su duda y el tutor le enseña la parte de la lección que lo explica.
// Todo ocurre en el móvil: no usa internet y solo trabaja con el contenido de la lección.
import { useState, useEffect, useRef } from 'react'
import { COLOR, boton, campo, tarjeta } from './comun.jsx'
import { buscar } from './tutorBuscar.js'

const SALUDO = { de: 'tutor', texto: 'Hola. Escríbeme lo que no entiendas de esta lección y te enseño dónde lo explica.' }

export default function Tutor({ contenido }) {
  const [mensajes, setMensajes] = useState([SALUDO])
  const [duda, setDuda] = useState('')
  const final = useRef(null)

  useEffect(() => { final.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }) }, [mensajes])

  const preguntar = (e) => {
    e.preventDefault()
    const texto = duda.trim()
    if (!texto) return
    const encontradas = buscar(contenido, texto)
    const respuesta = encontradas.length
      ? { de: 'tutor', texto: 'Esto es lo que dice la lección:', trozos: encontradas }
      : { de: 'tutor', texto: 'No encuentro eso en esta lección. Prueba a decirlo con otras palabras o pregúntaselo a tu profe.' }
    setMensajes(m => [...m, { de: 'alumno', texto }, respuesta])
    setDuda('')
  }

  return (
    <div>
      <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
        {mensajes.map((m, i) => <Mensaje key={i} {...m} />)}
        <div ref={final} />
      </div>
      <form onSubmit={preguntar} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label htmlFor="duda-tutor" style={{ fontSize: '20px', fontWeight: 'bold' }}>¿Qué no entiendes?</label>
        <input id="duda-tutor" value={duda} onChange={e => setDuda(e.target.value)} placeholder="Escribe tu duda"
          autoComplete="off" enterKeyHint="send" style={campo} />
        <button type="submit" disabled={!duda.trim()} style={boton(COLOR.azul, { width: '100%', fontSize: '22px' })}>Preguntar</button>
      </form>
    </div>
  )
}

function Mensaje({ de, texto, trozos }) {
  const alumno = de === 'alumno'
  return (
    <div style={{
      ...tarjeta, fontSize: '20px', lineHeight: '1.6', maxWidth: '90%',
      alignSelf: alumno ? 'flex-end' : 'flex-start',
      backgroundColor: alumno ? '#dbeafe' : 'white', borderColor: alumno ? '#bfdbfe' : COLOR.borde,
    }}>
      <p>{texto}</p>
      {trozos?.map((t, i) => (
        <blockquote key={i} style={{ margin: '10px 0 0', padding: '10px 14px', borderLeft: `5px solid ${COLOR.verde}`, backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
          <p>{t.texto}</p>
          <p style={{ marginTop: '6px', fontSize: '16px', color: COLOR.suave }}>Está en «{t.parte}»</p>
        </blockquote>
      ))}
    </div>
  )
}
