import { useEffect, useState } from 'react'
import { Icono, api, leer, guardar, Cargando, Aviso } from './comun.jsx'
import { t, plural, idioma } from './idioma.js'

// «Hecha» es una lección con todas sus preguntas contestadas: de una lección sin preguntas
// el servidor no puede saber si la han leído, así que no cuenta.
export function progresoAlumno(notas) {
  const conPreguntas = notas.filter(n => n.total > 0)
  const hechas = conPreguntas.filter(n => n.respondidas === n.total)
  const aciertos = hechas.reduce((suma, n) => suma + n.aciertos, 0)
  const preguntas = hechas.reduce((suma, n) => suma + n.total, 0)
  return { hechas: hechas.length, de: conPreguntas.length, aciertos, preguntas }
}

const tanto = (parte, todo) => (todo ? Math.round(parte * 100 / todo) : 0)
const notaDe = (p) => (p.preguntas ? p.aciertos / p.preguntas : -1) // sin lecciones hechas, al final
const fecha = (valor) => (valor ? new Date(valor).toLocaleDateString(idioma(), { dateStyle: 'short' }) : t('Sin respuestas recibidas'))

// Del mejor al peor: primero la nota y, si empatan, quien ha hecho más lecciones.
function clasificar(alumnos) {
  return alumnos.map(a => ({ ...a, p: progresoAlumno(a.notas) }))
    .sort((a, b) => notaDe(b.p) - notaDe(a.p) || b.p.hechas - a.p.hechas || a.nombre.localeCompare(b.nombre, idioma()))
}

// Sin conexión se ve la copia de la última vez.
function useDatos(codigo, revision) {
  const clave = `profe-estadisticas:${codigo}`
  const [datos, setDatos] = useState(() => leer(clave, null))
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    const ruta = `/api/clases/${encodeURIComponent(codigo)}`
    setCargando(true)
    setError('')
    Promise.all([api(`${ruta}/panel`), api(`${ruta}/estadisticas`)])
      .then(([panel, extra]) => {
        if (!activo) return
        const nuevos = { ...panel, extra }
        setDatos(nuevos)
        guardar(clave, nuevos)
      })
      .catch(e => { if (activo) setError(e.message) })
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [clave, codigo, revision])

  return { datos, error, cargando }
}

function Cifra({ valor, texto, detalle }) {
  return (
    <div className="cifra">
      <span className="cifra-valor">{valor}</span>
      <span className="cifra-texto">{texto}</span>
      {detalle && <span className="nota" style={{ margin: 0 }}>{detalle}</span>}
    </div>
  )
}

function Barra({ titulo, detalle, valor, texto, tono = 'amarillo' }) {
  return (
    <span className="barra">
      <span className="barra-cabeza">
        <span className="barra-titulo">{titulo}</span>
        <strong>{texto}</strong>
      </span>
      <span className="barra-fondo" aria-hidden="true"><span className={`barra-relleno tono-${tono}`} style={{ width: `${valor}%` }} /></span>
      {detalle && <span className="nota" style={{ margin: 0 }}>{detalle}</span>}
    </span>
  )
}

const tonoDe = (porcentaje) => (porcentaje >= 80 ? 'verde' : porcentaje >= 60 ? 'amarillo' : 'rojo')

function Podio({ primeros }) {
  if (!primeros.length) {
    return <p className="frase podio-vacio">{t('El podio aparecerá cuando alguien termine una lección.')}</p>
  }
  const medallas = ['🥇', '🥈', '🥉']
  return (
    <section aria-label={t('Podio')}>
      <ol className="podio">
        {primeros.map((a, i) => (
          <li key={a.id} className={`podio-puesto podio-${i + 1}`}>
            <span className="podio-medalla" aria-hidden="true">{medallas[i]}</span>
            <span className="podio-nombre">{a.nombre}</span>
            <span className="podio-nota">{tanto(a.p.aciertos, a.p.preguntas)} %</span>
            <span className="podio-peana" aria-hidden="true">{i + 1}</span>
          </li>
        ))}
      </ol>
      <p className="nota" style={{ textAlign: 'center' }}>{t('Por los aciertos en las lecciones terminadas. Si empatan, gana quien ha hecho más.')}</p>
    </section>
  )
}

function Reparto({ clasificados }) {
  const grupos = [
    { texto: t('Van bien'), tono: 'verde', n: clasificados.filter(a => notaDe(a.p) >= 0.8).length },
    { texto: t('Regular'), tono: 'amarillo', n: clasificados.filter(a => notaDe(a.p) >= 0.6 && notaDe(a.p) < 0.8).length },
    { texto: t('Necesitan repasar'), tono: 'rojo', n: clasificados.filter(a => notaDe(a.p) >= 0 && notaDe(a.p) < 0.6).length },
    { texto: t('Sin terminar ninguna'), tono: 'vacio', n: clasificados.filter(a => notaDe(a.p) < 0).length },
  ]
  return (
    <>
      <div className="reparto" aria-hidden="true">
        {grupos.filter(g => g.n).map(g => <span key={g.texto} className={`tono-${g.tono}`} style={{ flexGrow: g.n }}>{g.n}</span>)}
      </div>
      <ul className="reparto-leyenda">
        {grupos.map(g => <li key={g.texto}><span className={`reparto-punto tono-${g.tono}`} aria-hidden="true" />{g.texto}: <strong>{g.n}</strong></li>)}
      </ul>
    </>
  )
}

function Actividad({ dias }) {
  const mas = Math.max(1, ...dias.map(d => d.respuestas))
  return (
    <div className="actividad" role="list">
      {dias.map(d => (
        <div key={d.dia} className="actividad-dia" role="listitem">
          <strong>{d.respuestas}</strong>
          <div className="actividad-hueco" aria-hidden="true"><span style={{ height: `${tanto(d.respuestas, mas)}%` }} /></div>
          <span className="nota" style={{ margin: 0 }}>{new Date(`${d.dia}T12:00:00`).toLocaleDateString(idioma(), { weekday: 'short' })}</span>
        </div>
      ))}
    </div>
  )
}

export function EstadisticasClase({ codigo, onVolver, onTabla, onAlumno }) {
  const [revision, setRevision] = useState(0)
  const { datos, error, cargando } = useDatos(codigo, revision)
  useEffect(() => { window.scrollTo(0, 0) }, [])

  const clasificados = datos ? clasificar(datos.alumnos) : []
  const leccionesCon = datos ? datos.lecciones.map((l, i) => {
    const notas = datos.alumnos.map(a => a.notas[i]).filter(Boolean)
    return {
      ...l,
      total: notas[0]?.total || 0,
      aciertos: notas.reduce((s, n) => s + n.aciertos, 0),
      respondidas: notas.reduce((s, n) => s + n.respondidas, 0),
      terminada: notas.filter(n => n.total > 0 && n.respondidas === n.total).length,
    }
  }).filter(l => l.total > 0) : []
  const aciertos = clasificados.reduce((s, a) => s + a.p.aciertos, 0)
  const preguntas = clasificados.reduce((s, a) => s + a.p.preguntas, 0)
  const hechas = clasificados.reduce((s, a) => s + a.p.hechas, 0)
  const posibles = clasificados.reduce((s, a) => s + a.p.de, 0)
  const hace7Dias = Date.now() - 7 * 24 * 3600 * 1000
  const activos = clasificados.filter(a => a.ultima_respuesta && new Date(a.ultima_respuesta).getTime() >= hace7Dias).length
  const cuestan = (datos?.extra.preguntas || []).filter(p => p.aciertos < p.respuestas).slice(0, 5)
  const recibidas = (datos?.extra.actividad || []).reduce((s, d) => s + d.respuestas, 0)
  const dudas = Object.values(datos?.extra.dudas || {}).reduce((s, n) => s + n, 0)

  return (
    <div className="pagina pagina-estadisticas">
      <header className="cabecera">
        <button onClick={onVolver} className="boton boton-fantasma volver"><Icono nombre="volver" />{t('Volver a la clase')}</button>
      </header>
      <h1 className="titulo">{t('Notas de la clase')}</h1>
      {datos && <p className="frase">{datos.nombre}</p>}
      {cargando && !datos && <Cargando texto={t('Cargando notas…')} />}
      <Aviso texto={t(error)} />
      {datos && !datos.alumnos.length && <p className="frase">{t('No hay alumnos inscritos todavía.')}</p>}
      {datos && datos.alumnos.length > 0 && <>
        <Podio primeros={clasificados.filter(a => a.p.preguntas > 0).slice(0, 3)} />

        <section className="seccion">
          <h2 className="seccion-titulo">{t('La clase de un vistazo')}</h2>
          <div className="cifras">
            <Cifra valor={preguntas ? `${tanto(aciertos, preguntas)} %` : '—'} texto={t('Aciertos de media')} />
            <Cifra valor={`${hechas}/${posibles}`} texto={t('Lecciones terminadas')} detalle={t('Sumando las de todos los alumnos')} />
            <Cifra valor={`${activos}/${clasificados.length}`} texto={t('Han respondido esta semana')} />
            <Cifra valor={clasificados.filter(a => a.motivos.length).length} texto={t('Necesitan ayuda')} />
            <Cifra valor={recibidas} texto={t('Respuestas esta semana')} />
            <Cifra valor={dudas} texto={t('Dudas enviadas')} />
          </div>
        </section>

        <section className="seccion">
          <h2 className="seccion-titulo">{t('Cómo van los alumnos')}</h2>
          <div className="tarjeta"><Reparto clasificados={clasificados} /></div>
        </section>

        <section className="seccion">
          <h2 className="seccion-titulo">{t('Cómo va cada lección')}</h2>
          {!leccionesCon.length ? <p className="frase">{t('Todavía no hay lecciones publicadas con preguntas.')}</p> : (
            <div className="tarjeta barras">
              {leccionesCon.map(l => {
                const porcentaje = tanto(l.aciertos, l.respondidas)
                return <Barra key={l.id} titulo={l.titulo} valor={porcentaje} tono={tonoDe(porcentaje)} texto={l.respondidas ? `${porcentaje} %` : t('Sin respuestas')}
                  detalle={t('La han terminado {n} de {total}', { n: l.terminada, total: clasificados.length })} />
              })}
            </div>
          )}
        </section>

        <section className="seccion">
          <h2 className="seccion-titulo">{t('Respuestas de los últimos 7 días')}</h2>
          <div className="tarjeta"><Actividad dias={datos.extra.actividad} /></div>
        </section>

        {cuestan.length > 0 && (
          <section className="seccion">
            <h2 className="seccion-titulo">{t('Las preguntas que más cuestan')}</h2>
            <div className="tarjeta barras">
              {cuestan.map(p => {
                const porcentaje = tanto(p.aciertos, p.respuestas)
                return <Barra key={`${p.leccion}${p.pregunta}`} titulo={p.pregunta} valor={porcentaje} tono={tonoDe(porcentaje)}
                  texto={t('{aciertos} de {total}', { aciertos: p.aciertos, total: p.respuestas })} detalle={p.leccion} />
              })}
            </div>
          </section>
        )}

        <section className="seccion">
          <h2 className="seccion-titulo">{t('Clasificación')}</h2>
          <p className="nota" style={{ marginTop: -6, marginBottom: 12 }}>{t('Toca un alumno para ver sus estadísticas.')}</p>
          <div className="clasificacion">
            {clasificados.map((a, i) => {
              const porcentaje = tanto(a.p.aciertos, a.p.preguntas)
              return (
                <button key={a.id} className="clasificacion-fila" onClick={() => onAlumno(a)}>
                  <span className="clasificacion-puesto">{a.p.preguntas ? i + 1 : '–'}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <Barra titulo={a.nombre} valor={porcentaje} tono={tonoDe(porcentaje)} texto={a.p.preguntas ? `${porcentaje} %` : t('Sin nota')}
                      detalle={t('Lecciones {hechas}/{de}', { hechas: a.p.hechas, de: a.p.de })} />
                    {a.motivos.length > 0 && <span className="insignia insignia-rojo" style={{ marginTop: 6 }}>{t('Necesita ayuda')}</span>}
                  </span>
                  <Icono nombre="seguir" className="icono-final" />
                </button>
              )
            })}
          </div>
        </section>

        <p className="frase">{t('Solo aparecen respuestas recibidas por el ordenador de la clase. La falta de conexión puede retrasarlas.')}</p>
      </>}
      <div className="botones-fila" style={{ marginTop: 20 }}>
        <button onClick={onTabla} className="boton boton-secundario"><Icono nombre="notas" />{t('Ver la tabla de notas')}</button>
        <button disabled={cargando} onClick={() => setRevision(r => r + 1)} className="boton boton-secundario"><Icono nombre="buscar" />{t('Actualizar notas')}</button>
      </div>
    </div>
  )
}

export function EstadisticasAlumno({ codigo, alumno, onVolver }) {
  const { datos, error, cargando } = useDatos(codigo, 0)
  const [abierta, setAbierta] = useState(null)
  useEffect(() => { window.scrollTo(0, 0) }, [])

  const clasificados = datos ? clasificar(datos.alumnos) : []
  const puesto = clasificados.findIndex(a => a.id === alumno.id)
  const fila = clasificados[puesto]
  const respuestas = datos?.extra.respuestas?.[alumno.id] || {}
  // Al cerrarse otra lección más arriba, esta sube: que no se quede fuera de la pantalla.
  const alternar = (id, boton) => { setAbierta(abierta === id ? null : id); requestAnimationFrame(() => boton.scrollIntoView({ block: 'nearest' })) }
  const media = (i) => {
    const notas = datos.alumnos.map(a => a.notas[i]).filter(n => n?.respondidas)
    return tanto(notas.reduce((s, n) => s + n.aciertos, 0), notas.reduce((s, n) => s + n.respondidas, 0))
  }

  return (
    <div className="pagina pagina-estadisticas">
      <header className="cabecera">
        <button onClick={onVolver} className="boton boton-fantasma volver"><Icono nombre="volver" />{t('Volver')}</button>
      </header>
      <h1 className="titulo">{alumno.nombre}</h1>
      {alumno.usuario && <p className="frase">{t('Usuario: {usuario}', { usuario: alumno.usuario })}</p>}
      {cargando && !datos && <Cargando texto={t('Cargando notas…')} />}
      <Aviso texto={t(error)} />
      {datos && !fila && !cargando && <p className="frase">{t('Este alumno ya no está en la clase.')}</p>}
      {fila && <>
        <section className="seccion">
          <div className="cifras">
            <Cifra valor={fila.p.preguntas ? `${tanto(fila.p.aciertos, fila.p.preguntas)} %` : '—'} texto={t('Aciertos de media')}
              detalle={fila.p.preguntas ? t('{aciertos} de {total} preguntas', { aciertos: fila.p.aciertos, total: fila.p.preguntas }) : t('Sin nota')} />
            <Cifra valor={fila.p.preguntas ? `${puesto + 1}.º` : '—'} texto={t('Puesto en la clase')} detalle={plural(clasificados.length, 'De {n} estudiante', 'De {n} estudiantes')} />
            <Cifra valor={`${fila.p.hechas}/${fila.p.de}`} texto={t('Lecciones terminadas')} />
            <Cifra valor={datos.extra.dudas[alumno.id] || 0} texto={t('Dudas enviadas')} />
          </div>
          <p className="nota">{t('Última respuesta: {fecha}', { fecha: fecha(fila.ultima_respuesta) })}</p>
          {fila.motivos.length > 0 && <p className="aviso aviso-atencion" style={{ marginTop: 12 }}>{t('Necesita ayuda: revisa sus lecciones o comprueba si todavía no ha podido enviar sus respuestas.')}</p>}
        </section>

        <section className="seccion">
          <h2 className="seccion-titulo">{t('Sus lecciones')}</h2>
          {!fila.p.de ? <p className="frase">{t('Todavía no hay lecciones publicadas con preguntas.')}</p> : (
            <div className="tarjeta barras">
              {datos.lecciones.map((l, i) => ({ l, i, n: fila.notas[i] })).filter(({ n }) => n?.total > 0).map(({ l, i, n }) => {
                const hecha = n.respondidas === n.total
                const porcentaje = tanto(n.aciertos, n.respondidas)
                return (
                  <div key={l.id}>
                    <button className="leccion-abrir" aria-expanded={abierta === l.id} onClick={e => alternar(l.id, e.currentTarget)}>
                      <Barra titulo={l.titulo} valor={porcentaje} tono={tonoDe(porcentaje)}
                        texto={n.respondidas ? t('{aciertos}/{total} aciertos', { aciertos: n.aciertos, total: n.total }) : t('Sin empezar')}
                        detalle={[!n.respondidas ? '' : hecha ? t('Terminada') : t('En curso: {respondidas}/{total} respondidas', { respondidas: n.respondidas, total: n.total }),
                          n.respondidas ? t('Media de la clase: {n} %', { n: media(i) }) : ''].filter(Boolean).join(' · ')} />
                      <Icono nombre="seguir" />
                    </button>
                    {abierta === l.id && (
                      <div className="respuestas-leccion">
                        {(datos.extra.lecciones?.[l.id] || []).map((p, j) => {
                          const elegida = respuestas[l.id]?.[j]
                          const bien = elegida === p.correcta
                          return (
                            <div key={j} className="respuesta-leccion">
                              <p style={{ fontWeight: 650, margin: '0 0 8px' }}>{j + 1}. {p.pregunta}</p>
                              {elegida === undefined ? <p className="nota" style={{ margin: 0 }}>{t('Sin responder')}</p> : (
                                <p className="respuesta-dada" style={{ color: `var(--${bien ? 'verde' : 'rojo'})` }}>
                                  <Icono nombre={bien ? 'bien' : 'mal'} tam={20} />
                                  <span>{t('Respondió: {texto}', { texto: p.opciones[elegida] })}</span>
                                </p>
                              )}
                              {!bien && <p style={{ color: 'var(--verde)' }}>{t('Correcta: {texto}', { texto: p.opciones[p.correcta] })}</p>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </>}
    </div>
  )
}
