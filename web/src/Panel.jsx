import { useEffect, useState } from 'react'
import { Icono, api, Cargando, Aviso } from './comun.jsx'

const fecha = valor => valor ? new Date(valor).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin respuestas recibidas'
const celda = { padding: '14px', textAlign: 'left', borderBottom: '1px solid var(--borde)', verticalAlign: 'top' }

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
    if (quitando || !window.confirm(`¿Quitar a ${alumno.nombre} de la clase? Se borran sus respuestas y dudas de esta clase.`)) return
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
    <div className="pagina">
      <header className="cabecera">
        <button onClick={onVolver} className="boton boton-fantasma volver"><Icono nombre="volver" />Volver a la clase</button>
      </header>
      <h1 className="titulo">Notas de la clase</h1>
      <p className="frase">{datos ? datos.nombre : 'El progreso de tus estudiantes, en un vistazo.'}</p>
      <div className="botones-fila" style={{ marginTop: 20 }}>
        <button disabled={cargando || !!quitando} onClick={() => { setErrorBaja(''); setRevision(r => r + 1) }} className="boton boton-principal">
          <Icono nombre="buscar" />Actualizar notas
        </button>
      </div>
      {cargando && <Cargando texto="Cargando notas…" />}
      <Aviso texto={error || errorBaja} />
      {datos && <>
        <p className="frase">Solo aparecen respuestas recibidas por el ordenador de la clase. La falta de conexión puede retrasarlas.</p>
        {atras.length > 0 && <section aria-labelledby="apoyo" className="aviso aviso-atencion">
          <h2 id="apoyo" className="seccion-titulo">Se está quedando atrás</h2>
          <ul style={{ paddingLeft: 24 }}>{atras.map(a => <li key={a.id} style={{ marginBottom: 12 }}><strong>{a.nombre}</strong>: {a.motivos.join(' ')}</li>)}</ul>
          <p>Comprueba si necesita ayuda o si todavía no ha podido enviar sus respuestas.</p>
        </section>}
        <section className="seccion" aria-labelledby="notas">
          <h2 id="notas" className="seccion-titulo">Aciertos por lección</h2>
          {!datos.alumnos.length ? <p className="frase">No hay alumnos inscritos todavía.</p> : <>
            {!datos.lecciones.length && <p className="frase">No hay lecciones publicadas todavía.</p>}
            <p id="tabla-ayuda" className="nota" style={{ fontSize: 18, marginBottom: 14 }}>Desliza la tabla para ver todas las lecciones. Los tests incompletos muestran cuántas preguntas se han respondido.</p>
            <div className="tarjeta" style={{ padding: 0, minWidth: 0 }}>
              <div role="region" aria-label="Notas por alumno y lección" aria-describedby="tabla-ayuda" tabIndex={0} style={{ overflowX: 'auto', maxWidth: '100%' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 18 }}>
                  <caption style={{ padding: 14, textAlign: 'left', fontWeight: 700 }}>Clase {datos.codigo}</caption>
                  <thead><tr><th scope="col" style={celda}>Estudiante</th>{datos.lecciones.map(l => <th key={l.id} scope="col" style={{ ...celda, minWidth: 180 }}>{l.titulo}</th>)}<th scope="col" style={{ ...celda, minWidth: 180 }}>Última respuesta</th><th scope="col" style={celda}>Gestionar estudiante</th></tr></thead>
                  <tbody>{datos.alumnos.map(a => <tr key={a.id}>
                    <th scope="row" style={{ ...celda, overflowWrap: 'anywhere', minWidth: 120 }}>{a.nombre}</th>
                    {a.notas.map(n => <td key={n.leccion_id} style={celda}>
                      {n.respondidas ? <><strong>{n.aciertos}/{n.total} aciertos</strong>{n.respondidas < n.total && <p>En curso: {n.respondidas}/{n.total} respondidas</p>}<p className="nota" style={{ fontSize: 18 }}>{fecha(n.ultima_respuesta)}</p></> : <span className="nota" style={{ fontSize: 18 }}>Sin respuestas</span>}
                    </td>)}
                    <td style={celda}>{fecha(a.ultima_respuesta)}</td>
                    <td style={celda}><button disabled={!!quitando || cargando} onClick={() => quitar(a)}
                      aria-label={`Quitar de la clase a ${a.nombre}`} className="boton boton-secundario">
                      {quitando === a.id ? 'Quitando…' : 'Quitar de la clase'}
                    </button></td>
                  </tr>)}</tbody>
                </table>
              </div>
            </div>
          </>}
        </section>
      </>}
    </div>
  )
}
