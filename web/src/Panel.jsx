import { useEffect, useState } from 'react'
import { pagina, boton, botonVolver, titulo, tarjeta, COLOR, api, Cargando, Aviso } from './comun.jsx'

const fecha = valor => valor ? new Date(valor).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin respuestas recibidas'
const celda = { padding: '14px', textAlign: 'left', borderBottom: `1px solid ${COLOR.borde}`, verticalAlign: 'top' }

export default function PanelClase({ codigo, onVolver }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [errorBaja, setErrorBaja] = useState('')
  const [cargando, setCargando] = useState(true)
  const [revision, setRevision] = useState(0)
  const [quitando, setQuitando] = useState(null)

  useEffect(() => {
    let activo = true
    setCargando(true)
    setError('')
    setDatos(null)
    api(`/api/clases/${encodeURIComponent(codigo)}/panel`)
      .then(resultado => { if (activo) setDatos(resultado) })
      .catch(e => { if (activo) setError(e.message) })
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [codigo, revision])

  const quitar = async (alumno) => {
    if (quitando || !window.confirm(`¿Quitar a ${alumno.nombre} de la clase? Se borran sus respuestas de esta clase.`)) return
    setQuitando(alumno.id)
    setErrorBaja('')
    try {
      await api(`/api/clases/${encodeURIComponent(codigo)}/alumnos/${encodeURIComponent(alumno.id)}`, { method: 'DELETE' })
    } catch (e) {
      setErrorBaja(e.message)
    } finally {
      setQuitando(null)
      setRevision(r => r + 1)
    }
  }

  const atras = datos?.alumnos.filter(a => a.motivos.length) || []
  return (
    <div style={{ ...pagina, fontSize: '18px' }}>
      <button onClick={onVolver} style={botonVolver}>Volver a la clase</button>
      <h1 style={titulo}>Notas de la clase</h1>
      <button disabled={cargando || !!quitando} onClick={() => { setErrorBaja(''); setRevision(r => r + 1) }} style={boton()}>Actualizar notas</button>
      {cargando && <Cargando texto="Cargando notas…" />}
      <Aviso texto={error || errorBaja} />
      {datos && <>
        <h2 style={{ margin: '24px 0 16px', fontSize: '24px' }}>{datos.nombre}</h2>
        <p style={{ marginBottom: '20px' }}>Solo aparecen respuestas recibidas por el ordenador de la clase. La falta de conexión puede retrasarlas.</p>
        {atras.length > 0 && <section aria-labelledby="apoyo" style={{ ...tarjeta, backgroundColor: '#fff7ed', borderColor: '#c2410c', color: '#9a3412', marginBottom: '24px' }}>
          <h2 id="apoyo" style={{ fontSize: '24px', marginBottom: '12px' }}>Se está quedando atrás</h2>
          <ul style={{ paddingLeft: '24px' }}>{atras.map(a => <li key={a.id} style={{ marginBottom: '12px' }}><strong>{a.nombre}</strong>: {a.motivos.join(' ')}</li>)}</ul>
          <p>Comprueba si necesita ayuda o si todavía no ha podido enviar sus respuestas.</p>
        </section>}
        {!datos.alumnos.length ? <p>No hay alumnos inscritos todavía.</p> : <>
          {!datos.lecciones.length && <p>No hay lecciones publicadas todavía.</p>}
          <p id="tabla-ayuda" style={{ marginBottom: '12px' }}>Desliza la tabla para ver todas las lecciones. Los tests incompletos muestran cuántas preguntas se han respondido.</p>
          <div role="region" aria-label="Notas por alumno y lección" aria-describedby="tabla-ayuda" tabIndex={0} style={{ overflowX: 'auto', maxWidth: '100%', backgroundColor: 'white', border: `1px solid ${COLOR.borde}`, borderRadius: '12px' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '18px' }}>
              <caption style={{ padding: '14px', textAlign: 'left', fontWeight: 'bold' }}>Aciertos por lección · {datos.codigo}</caption>
              <thead><tr><th scope="col" style={celda}>Alumno</th>{datos.lecciones.map(l => <th key={l.id} scope="col" style={{ ...celda, minWidth: '180px' }}>{l.titulo}</th>)}<th scope="col" style={{ ...celda, minWidth: '180px' }}>Última respuesta</th><th scope="col" style={celda}>Gestionar alumno</th></tr></thead>
              <tbody>{datos.alumnos.map(a => <tr key={a.id}>
                <th scope="row" style={celda}>{a.nombre}</th>
                {a.notas.map(n => <td key={n.leccion_id} style={celda}>
                  {n.respondidas ? <><strong>{n.aciertos}/{n.total} aciertos</strong>{n.respondidas < n.total && <p>En curso: {n.respondidas}/{n.total} respondidas</p>}<p style={{ marginTop: '8px' }}>{fecha(n.ultima_respuesta)}</p></> : 'Sin respuestas'}
                </td>)}
                <td style={celda}>{fecha(a.ultima_respuesta)}</td>
                <td style={celda}><button disabled={!!quitando || cargando} onClick={() => quitar(a)}
                  aria-label={`Quitar de la clase a ${a.nombre}`} style={boton(COLOR.gris, { minHeight: '48px', fontSize: '18px' })}>
                  {quitando === a.id ? 'Quitando…' : 'Quitar de la clase'}
                </button></td>
              </tr>)}</tbody>
            </table>
          </div>
        </>}
      </>}
    </div>
  )
}
