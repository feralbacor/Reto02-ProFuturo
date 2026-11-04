import { useState, useEffect, useRef, useCallback } from 'react'
import {
  COLOR, pagina, boton, botonVolver, campo, tarjeta, etiqueta, titulo, SIN_CONEXION, api, leer, guardar, guardarPin, nuevoId, reducirFoto, Cargando, Aviso,
} from './comun.jsx'

// Agrupa una lista de lecciones por materia, en el orden en que aparece cada materia.
const porMateria = (lecciones, materiaDe) => {
  const grupos = new Map()
  for (const l of lecciones) {
    const m = materiaDe(l) || 'General'
    grupos.set(m, [...(grupos.get(m) || []), l])
  }
  return [...grupos]
}

const campoPin = { ...campo, fontSize: '26px', letterSpacing: '8px', fontFamily: 'ui-monospace, Menlo, monospace' }
const pinValido = (pin) => /^\d{4,8}$/.test(pin)
import PanelClase from './Panel.jsx'

// ---------- Inicio ----------
function App() {
  const [vista, setVista] = useState('inicio')
  const [salud, setSalud] = useState(null)

  useEffect(() => {
    api('/api/salud').then(setSalud).catch(() => setSalud({ estado: 'sin conexión' }))
  }, [vista])

  if (vista === 'profe') return <VistaProfe onVolver={() => setVista('inicio')} />
  if (vista === 'alumno') return <VistaAlumno onVolver={() => setVista('inicio')} />

  const estadoIA = { lista: 'IA lista en este ordenador', gpu: 'IA lista en la GPU', apagada: 'la IA está apagada (abre Ollama)' }
  return (
    <div style={{ ...pagina, minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <h1 style={{ fontSize: '48px', textAlign: 'center', marginBottom: '50px' }}>Mochila</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '420px', margin: '0 auto' }}>
        <button onClick={() => setVista('profe')} style={boton(COLOR.azul, { fontSize: '28px', padding: '28px' })}>Soy profe</button>
        <button onClick={() => setVista('alumno')} style={boton(COLOR.verde, { fontSize: '28px', padding: '28px' })}>Soy alumno</button>
      </div>
      <p style={{ marginTop: '50px', textAlign: 'center', color: COLOR.suave }}>
        {!salud ? 'Conectando…' : salud.estado === 'ok' ? `Conectado · ${estadoIA[salud.ia] || salud.ia}` : 'Sin conexión: puedes usar lo que ya tienes descargado'}
      </p>
    </div>
  )
}

// ---------- Profe ----------
function VistaProfe({ onVolver }) {
  const [pantalla, setPantalla] = useState('clases')
  const [codigo, setCodigo] = useState(null)
  const [editando, setEditando] = useState(null) // { id, leccion, publicada }

  const abrirClase = (c) => { setCodigo(c); setPantalla('clase') }
  const editar = (datos) => { setEditando(datos); setPantalla('revisar') }

  if (pantalla === 'clase') {
    return <ProfeClase codigo={codigo} onVolver={() => setPantalla('clases')} onNueva={() => setPantalla('nueva')} onNotas={() => setPantalla('notas')} onEditar={editar} />
  }
  if (pantalla === 'notas') {
    return <PanelClase codigo={codigo} onVolver={() => setPantalla('clase')} />
  }
  if (pantalla === 'nueva') {
    return <ProfeNuevaLeccion codigo={codigo} onVolver={() => setPantalla('clase')} onCreada={editar} />
  }
  if (pantalla === 'revisar' && editando) {
    return <ProfeRevisar codigo={codigo} inicial={editando} onVolver={() => setPantalla('clase')} />
  }
  return <ProfeClases onAbrir={abrirClase} onVolver={onVolver} />
}

function ProfeClases({ onAbrir, onVolver }) {
  const [clases, setClases] = useState(null)
  const [nombre, setNombre] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    api('/api/clases').then(setClases).catch(e => { setError(e.message); setClases([]) })
  }, [])

  const crear = async (ev) => {
    ev.preventDefault()
    setError('')
    setCreando(true)
    try {
      const clase = await api('/api/clases', { method: 'POST', body: { nombre, pin } })
      guardarPin(clase.codigo, pin)
      onAbrir(clase.codigo)
    } catch (e) {
      setError(e.message)
      setCreando(false)
    }
  }

  return (
    <div style={pagina}>
      <button onClick={onVolver} style={botonVolver}>Volver</button>
      <h1 style={titulo}>Mis clases</h1>

      <form onSubmit={crear} style={{ ...tarjeta, marginBottom: '30px' }}>
        <label htmlFor="nombre-clase" style={etiqueta}>Crear una clase nueva</label>
        <input id="nombre-clase" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={60}
          placeholder="Por ejemplo: 5.º A · Ciencias" style={{ ...campo, marginBottom: '16px' }} />
        <label htmlFor="pin-clase" style={{ ...etiqueta, fontSize: '18px' }}>Tu PIN de profe para esta clase (4 a 8 números)</label>
        <input id="pin-clase" type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))} style={{ ...campoPin, marginBottom: '8px' }} />
        <p style={{ color: COLOR.suave, marginBottom: '14px', fontSize: '17px' }}>Apúntalo: solo tú podrás abrir la clase y crear lecciones. En otro móvil o tablet te lo pedirá.</p>
        <button type="submit" disabled={!nombre.trim() || !pinValido(pin) || creando} style={boton(COLOR.azul, { width: '100%' })}>
          {creando ? 'Creando…' : 'Crear clase'}
        </button>
      </form>

      <Aviso texto={error} />
      {clases === null && <Cargando texto="Cargando clases…" />}
      {clases?.length === 0 && !error && <p style={{ color: COLOR.suave }}>Todavía no tienes clases. Crea la primera arriba.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {clases?.map(c => (
          <button key={c.codigo} onClick={() => onAbrir(c.codigo)} style={{ ...tarjeta, textAlign: 'left', cursor: 'pointer', fontSize: '18px' }}>
            <strong style={{ fontSize: '24px', display: 'block', marginBottom: '6px' }}>{c.nombre}</strong>
            Código {c.codigo} · {c.alumnos} {c.alumnos === 1 ? 'alumno' : 'alumnos'} · {c.lecciones} {c.lecciones === 1 ? 'lección' : 'lecciones'}
          </button>
        ))}
      </div>
    </div>
  )
}

function ProfeClase({ codigo, onVolver, onNueva, onNotas, onEditar }) {
  const [clase, setClase] = useState(null)
  const [error, setError] = useState('')
  const [abriendo, setAbriendo] = useState(false)
  const [pidePin, setPidePin] = useState(false)
  const [pin, setPin] = useState('')

  const cargar = useCallback(() => {
    api(`/api/clases/${encodeURIComponent(codigo)}`)
      .then(c => { setClase(c); setError(''); setPidePin(false) })
      .catch(e => {
        if (e.estado === 401 || e.estado === 429) { setClase(null); setPidePin(true) }
        setError(e.message)
      })
  }, [codigo])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    if (pidePin) return undefined // sin PIN no se insiste: cada intento fallido cuenta
    const t = setInterval(cargar, 10000) // para ver entrar a los alumnos sin recargar
    return () => clearInterval(t)
  }, [cargar, pidePin])

  const entrarConPin = (ev) => {
    ev.preventDefault()
    guardarPin(codigo, pin)
    setPin('')
    cargar()
  }

  const abrirLeccion = async (id) => {
    setAbriendo(true)
    try {
      const l = await api(`/api/clases/${encodeURIComponent(codigo)}/lecciones/${id}`)
      onEditar({ id: l.id, leccion: l.contenido, publicada: l.publicada })
    } catch (e) {
      setError(e.message)
      setAbriendo(false)
    }
  }

  if (pidePin) {
    return (
      <div style={pagina}>
        <button onClick={onVolver} style={botonVolver}>Volver</button>
        <h1 style={titulo}>Clase {codigo}</h1>
        <form onSubmit={entrarConPin} style={tarjeta}>
          <label htmlFor="pin-entrar" style={etiqueta}>Escribe tu PIN de profe</label>
          <input id="pin-entrar" type="password" inputMode="numeric" autoComplete="current-password" maxLength={8} autoFocus
            value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} style={{ ...campoPin, marginBottom: '14px' }} />
          <Aviso texto={error} />
          <button type="submit" disabled={!pinValido(pin)} style={boton(COLOR.azul, { width: '100%' })}>Entrar</button>
        </form>
      </div>
    )
  }

  if (!clase) {
    return (
      <div style={pagina}>
        <button onClick={onVolver} style={botonVolver}>Volver</button>
        {error ? <Aviso texto={error} /> : <Cargando texto="Cargando la clase…" />}
      </div>
    )
  }

  return (
    <div style={pagina}>
      <button onClick={onVolver} style={botonVolver}>Mis clases</button>
      <h1 style={titulo}>{clase.nombre}</h1>

      <div style={{ ...tarjeta, textAlign: 'center', marginBottom: '24px', borderColor: COLOR.azul }}>
        <p style={{ fontSize: '19px' }}>Código para que entren los alumnos:</p>
        <p style={{ fontSize: '46px', fontWeight: 'bold', letterSpacing: '6px', fontFamily: 'ui-monospace, Menlo, monospace', color: COLOR.azul }}>{clase.codigo}</p>
      </div>

      <Aviso texto={error} />

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '28px' }}>
        <button onClick={onNueva} style={boton(COLOR.verde, { flex: '1 1 200px', fontSize: '22px' })}>+ Nueva lección</button>
        <button onClick={onNotas} style={boton(COLOR.azul, { flex: '1 1 200px', fontSize: '22px' })}>Ver notas</button>
      </div>

      <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>Lecciones</h2>
      {clase.lecciones.length === 0 && <p style={{ color: COLOR.suave, marginBottom: '24px' }}>Todavía no hay lecciones. Haz una foto a una página del libro para crear la primera.</p>}
      {porMateria(clase.lecciones, l => l.materia).map(([materia, lecciones]) => (
        <section key={materia} style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '20px', color: COLOR.gris, marginBottom: '10px' }}>{materia}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {lecciones.map(l => (
              <button key={l.id} disabled={abriendo} onClick={() => abrirLeccion(l.id)}
                style={{ ...tarjeta, textAlign: 'left', cursor: 'pointer', fontSize: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <span>{l.titulo}</span>
                <span style={{ fontSize: '16px', fontWeight: 'bold', whiteSpace: 'nowrap', padding: '6px 10px', borderRadius: '8px', color: 'white', backgroundColor: l.publicada ? COLOR.verde : COLOR.suave }}>
                  {l.publicada ? 'Publicada' : 'Borrador'}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}

      <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>Alumnos ({clase.alumnos.length})</h2>
      {clase.alumnos.length === 0
        ? <p style={{ color: COLOR.suave }}>Todavía no ha entrado nadie. Diles el código de arriba.</p>
        : (
          <ul style={{ ...tarjeta, listStyle: 'none', fontSize: '20px', lineHeight: '1.9' }}>
            {clase.alumnos.map(a => <li key={a.id}>{a.nombre}</li>)}
          </ul>
        )}
    </div>
  )
}

function ProfeNuevaLeccion({ codigo, onVolver, onCreada }) {
  const MAX_FOTOS = 5
  const [fotos, setFotos] = useState([]) // { id, nombre, datos }
  const [texto, setTexto] = useState('')
  const [leidas, setLeidas] = useState(false)
  const [ocupado, setOcupado] = useState('')
  const [error, setError] = useState('')
  const camara = useRef(null)
  const galeria = useRef(null)
  const [materia, setMateria] = useState('')
  const [materias, setMaterias] = useState([])

  useEffect(() => {
    // Sugiere las materias que ya tiene la clase y deja puesta la última usada.
    api(`/api/clases/${encodeURIComponent(codigo)}`)
      .then(c => { setMaterias(c.materias); setMateria(m => m || c.materias[0] || '') })
      .catch(() => {})
  }, [codigo])

  const anadir = async (archivos) => {
    setError('')
    for (const archivo of Array.from(archivos || [])) {
      try {
        const datos = await reducirFoto(archivo)
        setFotos(f => f.length >= MAX_FOTOS ? f : [...f, { id: nuevoId(), nombre: archivo.name, datos }])
      } catch (e) {
        setError(e.message)
      }
    }
  }

  const alElegir = (ev) => {
    anadir(ev.target.files)
    ev.target.value = '' // para poder elegir otra vez la misma foto
  }

  const leerFotos = async () => {
    setError('')
    const lista = fotos
    try {
      for (let i = 0; i < lista.length; i++) {
        setOcupado(lista.length > 1 ? `Leyendo la foto ${i + 1} de ${lista.length}…` : 'Leyendo la foto…')
        const r = await api(`/api/clases/${encodeURIComponent(codigo)}/leer-foto`, { method: 'POST', body: { imagen: lista[i].datos } })
        setTexto(t => (t.trim() ? t.trim() + '\n\n' : '') + r.texto)
        setFotos(f => f.filter(x => x.id !== lista[i].id))
        setLeidas(true)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setOcupado('')
    }
  }

  const crear = async () => {
    setError('')
    setOcupado('Preparando la lección… Tarda alrededor de un minuto.')
    try {
      const r = await api(`/api/clases/${encodeURIComponent(codigo)}/lecciones`, { method: 'POST', body: { texto, materia } })
      onCreada({ id: r.id, leccion: r.leccion, publicada: 0 })
    } catch (e) {
      setError(e.message)
      setOcupado('')
    }
  }

  const suficiente = texto.trim().length >= 40

  return (
    <div style={pagina}>
      <button onClick={onVolver} disabled={!!ocupado} style={botonVolver}>Volver</button>
      <h1 style={titulo}>Nueva lección</h1>

      <label htmlFor="materia" style={etiqueta}>Materia</label>
      <input id="materia" list="materias-clase" value={materia} onChange={e => setMateria(e.target.value)} maxLength={40}
        placeholder="Por ejemplo: Ciencias" disabled={!!ocupado} style={{ ...campo, marginBottom: '24px' }} />
      <datalist id="materias-clase">{materias.map(m => <option key={m} value={m} />)}</datalist>

      <p style={{ fontSize: '20px', marginBottom: '16px' }}>Haz una foto a la página del libro, o elige fotos que ya tengas (hasta {MAX_FOTOS}).</p>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => camara.current.click()} disabled={!!ocupado || fotos.length >= MAX_FOTOS} style={boton(COLOR.azul, { flex: '1 1 200px' })}>📷 Hacer foto</button>
        <button onClick={() => galeria.current.click()} disabled={!!ocupado || fotos.length >= MAX_FOTOS} style={boton(COLOR.azul, { flex: '1 1 200px' })}>🖼️ Elegir fotos</button>
      </div>
      <input ref={camara} type="file" accept="image/*" capture="environment" onChange={alElegir} hidden />
      <input ref={galeria} type="file" accept="image/*" multiple onChange={alElegir} hidden />

      {fotos.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            {fotos.map((f, i) => (
              <div key={f.id} style={{ ...tarjeta, padding: '8px', textAlign: 'center' }}>
                <img src={f.datos} alt={`Foto ${i + 1}`} style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '8px' }} />
                <button onClick={() => setFotos(fs => fs.filter(x => x.id !== f.id))} disabled={!!ocupado}
                  style={boton(COLOR.gris, { width: '100%', fontSize: '16px', minHeight: '48px', marginTop: '8px', padding: '8px' })}>Quitar</button>
              </div>
            ))}
          </div>
          <button onClick={leerFotos} disabled={!!ocupado} style={boton(COLOR.verde, { width: '100%', marginBottom: '24px' })}>
            Leer {fotos.length === 1 ? 'la foto' : `las ${fotos.length} fotos`}
          </button>
        </>
      )}

      <Aviso texto={error} />
      {ocupado && <Cargando texto={ocupado} />}

      <label htmlFor="texto-leccion" style={{ ...etiqueta, marginTop: '10px' }}>
        {leidas ? 'Esto es lo que pone en las fotos. Revísalo y corrige lo que haga falta:' : 'O escribe o pega aquí el texto:'}
      </label>
      <textarea id="texto-leccion" value={texto} onChange={e => setTexto(e.target.value)} rows={10} disabled={!!ocupado}
        placeholder="El texto de la página del libro…" style={{ ...campo, fontSize: '18px', lineHeight: '1.5', marginBottom: '16px' }} />

      <button onClick={crear} disabled={!suficiente || !!ocupado} style={boton(COLOR.verde, { width: '100%', fontSize: '24px' })}>Crear lección</button>
      {!suficiente && texto.trim() && <p style={{ marginTop: '10px', color: COLOR.suave }}>Hace falta un poco más de texto.</p>}
    </div>
  )
}

function ProfeRevisar({ codigo, inicial, onVolver }) {
  const [leccion, setLeccion] = useState(inicial.leccion)
  const [publicada, setPublicada] = useState(!!inicial.publicada)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState({ texto: '', color: COLOR.verde })

  const cambiar = (clave, valor) => setLeccion(l => ({ ...l, [clave]: valor }))
  const cambiarPregunta = (i, cambios) => setLeccion(l => ({
    ...l, preguntas: l.preguntas.map((p, j) => j === i ? { ...p, ...cambios } : p),
  }))
  const cambiarOpcion = (i, k, valor) => setLeccion(l => ({
    ...l, preguntas: l.preguntas.map((p, j) => j === i ? { ...p, opciones: p.opciones.map((o, m) => m === k ? valor : o) } : p),
  }))

  const enviar = async (publicar) => {
    setGuardando(true)
    setAviso({ texto: '' })
    try {
      const r = await api(`/api/clases/${encodeURIComponent(codigo)}/lecciones/${inicial.id}`, { method: 'PUT', body: { leccion, publicar } })
      cambiar('materia', r.materia) // por si se ha unido a una que ya existía con otras mayúsculas
      if (publicar) setPublicada(true)
      setAviso({
        texto: publicar ? '¡Publicada! Los alumnos la tendrán la próxima vez que se conecten.' : 'Guardado.',
        color: COLOR.verde,
      })
    } catch (e) {
      setAviso({ texto: e.message, color: COLOR.rojo })
    } finally {
      setGuardando(false)
    }
  }

  const area = (clave, filas) => (
    <textarea value={leccion[clave]} onChange={e => cambiar(clave, e.target.value)} rows={filas}
      style={{ ...campo, fontSize: '18px', lineHeight: '1.5', marginBottom: '20px' }} />
  )

  return (
    <div style={pagina}>
      <button onClick={onVolver} style={botonVolver}>Volver a la clase</button>
      <h1 style={titulo}>{publicada ? 'Lección publicada' : 'Revisa la lección'}</h1>
      {!publicada && <p style={{ fontSize: '19px', marginBottom: '20px' }}>La ha preparado la IA: léela y corrige lo que haga falta antes de publicarla.</p>}

      <label style={etiqueta}>Título</label>
      <input value={leccion.titulo} onChange={e => cambiar('titulo', e.target.value)} style={{ ...campo, marginBottom: '20px' }} />
      <label style={etiqueta}>Materia</label>
      <input value={leccion.materia || ''} onChange={e => cambiar('materia', e.target.value)} maxLength={40} placeholder="General" style={{ ...campo, marginBottom: '20px' }} />
      <label style={etiqueta}>Lectura fácil</label>
      {area('lectura_facil', 7)}
      <label style={etiqueta}>Explicación con un ejemplo</label>
      {area('explicacion_ejemplo', 4)}

      <h2 style={{ fontSize: '24px', margin: '10px 0 14px' }}>Preguntas del test</h2>
      <p style={{ marginBottom: '14px', color: COLOR.suave }}>Marca el círculo de la respuesta correcta.</p>
      {leccion.preguntas.map((p, i) => (
        <fieldset key={i} style={{ ...tarjeta, marginBottom: '18px' }}>
          <legend style={{ fontWeight: 'bold', fontSize: '19px', padding: '0 6px' }}>Pregunta {i + 1}</legend>
          <input value={p.pregunta} onChange={e => cambiarPregunta(i, { pregunta: e.target.value })} style={{ ...campo, fontSize: '18px', marginBottom: '12px' }} />
          {p.opciones.map((o, k) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <input type="radio" name={`correcta-${i}`} checked={p.correcta === k} onChange={() => cambiarPregunta(i, { correcta: k })}
                aria-label={`Opción ${k + 1} es la correcta`} style={{ width: '26px', height: '26px', flexShrink: 0 }} />
              <input value={o} onChange={e => cambiarOpcion(i, k, e.target.value)}
                style={{ ...campo, fontSize: '18px', padding: '10px', borderColor: p.correcta === k ? COLOR.verde : COLOR.borde }} />
            </div>
          ))}
          <label style={{ display: 'block', margin: '10px 0 6px', color: COLOR.suave }}>Por qué es la correcta</label>
          <input value={p.porque} onChange={e => cambiarPregunta(i, { porque: e.target.value })} style={{ ...campo, fontSize: '17px', padding: '10px' }} />
        </fieldset>
      ))}

      <Aviso texto={aviso.texto} color={aviso.color} />
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {publicada
          ? <button onClick={() => enviar(true)} disabled={guardando} style={boton(COLOR.verde, { flex: 1 })}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
          : (
            <>
              <button onClick={() => enviar(false)} disabled={guardando} style={boton(COLOR.gris, { flex: '1 1 180px' })}>Guardar borrador</button>
              <button onClick={() => enviar(true)} disabled={guardando} style={boton(COLOR.verde, { flex: '1 1 180px' })}>{guardando ? 'Publicando…' : 'Publicar'}</button>
            </>
          )}
      </div>
    </div>
  )
}

// ---------- Alumno ----------
// Barra fija arriba: dice si las respuestas guardadas en el móvil ya han llegado al profe.
function BarraEnvio({ estado, pendientes }) {
  const n = `${pendientes} ${pendientes === 1 ? 'respuesta' : 'respuestas'}`
  const [fondo, texto] =
    estado === 'enviando' ? ['#fef08a', pendientes ? `Enviando ${n}…` : 'Buscando lecciones nuevas…']
      : estado === 'sin-conexion' ? ['#fecaca', pendientes ? `Sin conexión · ${n} por enviar` : 'Sin conexión · puedes seguir usando lo descargado']
        : estado === 'error' ? ['#fecaca', `No se ha podido enviar · ${n} por enviar · se reintentará solo`]
          : pendientes ? ['#fef08a', `${n} por enviar`]
            : ['#bbf7d0', 'Todo enviado ✓']
  return (
    <div role="status" style={{ position: 'sticky', top: 0, zIndex: 10, padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px', backgroundColor: fondo, color: '#1c1917' }}>
      {texto}
    </div>
  )
}

// ¿Está la app guardada en el aparato (service worker activo) para abrirla sin conexión?
// true: sí · false: guardándose · null: este navegador no puede (hace falta https o localhost).
function useAppGuardada() {
  const sw = navigator.serviceWorker
  const [lista, setLista] = useState(import.meta.env.DEV || !!sw?.controller)
  useEffect(() => { sw?.ready.then(() => setLista(true)) }, [sw])
  return sw || import.meta.env.DEV ? lista : null
}

const cuando = (iso) => {
  const d = new Date(iso)
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString() ? `hoy a las ${hora}`
    : `el ${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} a las ${hora}`
}

// Círculo verde con la flecha hacia abajo: «esto ya está en el aparato».
function IconoDescargado({ tam = 22 }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="12" fill={COLOR.verde} />
      <path d="M12 5.5v9m-4-4 4 4 4-4M7 18h10" stroke="white" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AvisoDescargado({ lecciones, appGuardada, actualizado }) {
  const n = lecciones === 1 ? '1 lección guardada' : `${lecciones} lecciones guardadas`
  const [fondo, borde, color, cabecera, texto] =
    appGuardada === true ? ['#f0fdf4', COLOR.verde, COLOR.verde, 'Descargado en este aparato', `${n}: ${lecciones === 1 ? 'la' : 'las'} puedes hacer sin conexión.`]
      : appGuardada === false ? ['#fefce8', '#ca8a04', '#854d0e', 'Guardando la app en este aparato…', `${n}. Espera un momento antes de quedarte sin conexión.`]
        : ['#fef2f2', COLOR.rojo, COLOR.rojo, 'Sin conexión no se abrirá la app', `${n}, pero este navegador no puede guardar la app. Entra con el enlace https.`]
  return (
    <div style={{ ...tarjeta, backgroundColor: fondo, borderColor: borde, marginBottom: '24px' }}>
      <p style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '20px', fontWeight: 'bold', color }}>
        {appGuardada === true && <IconoDescargado tam={28} />}{cabecera}
      </p>
      <p style={{ fontSize: '18px', marginTop: '6px' }}>{texto}</p>
      {actualizado && <p style={{ fontSize: '16px', color: COLOR.suave, marginTop: '6px' }}>Última vez que se buscaron lecciones nuevas: {cuando(actualizado)}.</p>}
    </div>
  )
}

const respuestaBienFormada = (r) => r && typeof r.id === 'string' && typeof r.alumno === 'string'
  && typeof r.leccion_id === 'string' && Number.isInteger(r.pregunta) && Number.isInteger(r.respuesta) && typeof r.fecha === 'string'

function VistaAlumno({ onVolver }) {
  const [perfil, setPerfil] = useState(() => leer('alumno-perfil', null)) // { id, nombre }
  const [clases, setClases] = useState(() => leer('alumno-clases', []))
  const [pendientes, setPendientes] = useState(() => leer('pendientes', []).length)
  const [estado, setEstado] = useState('ok') // ok | enviando | sin-conexion | error
  const [entrando, setEntrando] = useState(false)
  const [leccion, setLeccion] = useState(null)
  const [actualizado, setActualizado] = useState(() => leer('alumno-actualizado', null))
  const appGuardada = useAppGuardada()
  const enCurso = useRef(false)

  // Envía las respuestas guardadas sin conexión y se trae las lecciones nuevas (solo si algo ha cambiado).
  const sincronizar = useCallback(async () => {
    if (!perfil || enCurso.current) return
    enCurso.current = true
    setEstado('enviando')
    const enviadas = leer('pendientes', []).filter(respuestaBienFormada)
    try {
      const r = await api('/api/sync', {
        method: 'POST',
        body: { alumno_id: perfil.id, respuestas: enviadas, version: leer('alumno-clases', null) ? leer('alumno-version', null) : null },
      })
      const recibidas = new Set(r.recibidas)
      // Las respuestas que se dieron mientras se enviaba se quedan para la próxima vez.
      const quedan = leer('pendientes', []).filter(p => respuestaBienFormada(p) && !recibidas.has(p.id))
      guardar('pendientes', quedan)
      setPendientes(quedan.length)
      if (r.clases) {
        setClases(r.clases)
        guardar('alumno-clases', r.clases) // así las lecciones se pueden usar sin conexión
      }
      guardar('alumno-version', r.version)
      const ahora = new Date().toISOString()
      guardar('alumno-actualizado', ahora)
      setActualizado(ahora)
      setEstado('ok')
    } catch (e) {
      setEstado(e.message === SIN_CONEXION ? 'sin-conexion' : 'error')
    } finally {
      enCurso.current = false
    }
  }, [perfil])

  useEffect(() => {
    sincronizar()
    const cada30s = setInterval(sincronizar, 30000)
    const desconectado = () => setEstado('sin-conexion')
    window.addEventListener('online', sincronizar)
    window.addEventListener('offline', desconectado)
    return () => {
      clearInterval(cada30s)
      window.removeEventListener('online', sincronizar)
      window.removeEventListener('offline', desconectado)
    }
  }, [sincronizar])

  const alEntrar = (p) => {
    guardar('alumno-perfil', p)
    setPerfil(p)
    setEntrando(false)
  }

  const cambiarDeAlumno = () => {
    if (!window.confirm(`¿Seguro que no eres ${perfil.nombre}?`)) return
    // Las respuestas pendientes se quedan: se enviarán igual, cada una lleva su alumno.
    try { ['alumno-perfil', 'alumno-clases', 'alumno-version', 'alumno-actualizado'].forEach(k => localStorage.removeItem(k)) } catch { /* nada */ }
    setPerfil(null)
    setClases([])
    setActualizado(null)
  }

  if (!perfil || entrando) {
    return <AlumnoEntrar perfil={perfil} onEntrado={alEntrar} onVolver={perfil ? () => setEntrando(false) : onVolver} />
  }

  const barra = <BarraEnvio estado={estado} pendientes={pendientes} />
  const total = clases.reduce((n, c) => n + c.lecciones.length, 0)
  if (leccion) {
    return (
      <>
        {barra}
        <AlumnoLeccion leccion={leccion} alumnoId={perfil.id} onVolver={() => setLeccion(null)}
          onRespuesta={() => setPendientes(leer('pendientes', []).length)} onTerminar={sincronizar} />
      </>
    )
  }

  return (
    <>
      {barra}
      <div style={pagina}>
        <button onClick={onVolver} style={botonVolver}>Volver</button>
        <h1 style={{ ...titulo, marginBottom: '6px' }}>Hola, {perfil.nombre}</h1>
        <button onClick={cambiarDeAlumno} style={{ background: 'none', border: 'none', color: COLOR.azul, fontSize: '17px', textDecoration: 'underline', cursor: 'pointer', minHeight: '44px', marginBottom: '16px' }}>
          No soy {perfil.nombre}
        </button>

        {total > 0 && <AvisoDescargado lecciones={total} appGuardada={appGuardada} actualizado={actualizado} />}

        {clases.length === 0 && <p style={{ color: COLOR.suave, marginBottom: '20px' }}>{estado === 'sin-conexion' ? 'Cuando haya conexión aparecerán tus clases.' : 'Todavía no estás en ninguna clase.'}</p>}

        {clases.map(c => {
          const grupos = porMateria(c.lecciones, l => l.contenido?.materia)
          const conTitulos = grupos.length > 1 || (grupos[0] && grupos[0][0] !== 'General')
          return (
            <section key={c.codigo} style={{ marginBottom: '30px' }}>
              <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>{c.nombre}</h2>
              {c.lecciones.length === 0 && <p style={{ color: COLOR.suave }}>Tu profe todavía no ha publicado lecciones.</p>}
              {grupos.map(([materia, lecciones]) => (
                <div key={materia} style={{ marginBottom: '18px' }}>
                  {conTitulos && <h3 style={{ fontSize: '20px', color: COLOR.gris, marginBottom: '10px' }}>{materia}</h3>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {lecciones.map(l => (
                      <button key={l.id} onClick={() => setLeccion(l)}
                        style={{ ...tarjeta, borderColor: COLOR.verde, borderWidth: '3px', textAlign: 'left', fontSize: '22px', fontWeight: 'bold', cursor: 'pointer' }}>
                        {l.titulo}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '16px', fontWeight: 'normal', color: COLOR.verde }}>
                          <IconoDescargado />Descargada
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )
        })}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={sincronizar} disabled={estado === 'enviando'} style={boton(COLOR.azul, { flex: '1 1 200px' })}>
            {estado === 'enviando' ? 'Buscando…' : 'Buscar lecciones nuevas'}
          </button>
          <button onClick={() => setEntrando(true)} style={boton(COLOR.gris, { flex: '1 1 200px' })}>Entrar en otra clase</button>
        </div>
      </div>
    </>
  )
}

function AlumnoEntrar({ perfil, onEntrado, onVolver }) {
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const codigoLimpio = codigo.toUpperCase().replace(/[^A-Z0-9]/g, '')

  const entrar = async (ev) => {
    ev.preventDefault()
    setError('')
    setEnviando(true)
    const p = perfil || { id: nuevoId(), nombre: nombre.trim() }
    try {
      await api(`/api/clases/${codigoLimpio}/unirse`, { method: 'POST', body: { alumno_id: p.id, nombre: p.nombre } })
      onEntrado(p)
    } catch (e) {
      setError(e.message === SIN_CONEXION ? 'Para entrar en una clase nueva hace falta conexión con el ordenador de la clase.' : e.message)
      setEnviando(false)
    }
  }

  return (
    <div style={pagina}>
      <button onClick={onVolver} style={botonVolver}>Volver</button>
      <h1 style={titulo}>{perfil ? 'Entrar en otra clase' : 'Entrar en tu clase'}</h1>
      <form onSubmit={entrar} style={tarjeta}>
        {!perfil && (
          <>
            <label htmlFor="nombre-alumno" style={etiqueta}>¿Cómo te llamas?</label>
            <input id="nombre-alumno" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={40} autoComplete="given-name"
              placeholder="Tu nombre" style={{ ...campo, marginBottom: '20px' }} />
          </>
        )}
        <label htmlFor="codigo-clase" style={etiqueta}>Código de la clase</label>
        <input id="codigo-clase" value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} maxLength={12}
          autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="Te lo dice tu profe"
          style={{ ...campo, fontSize: '28px', letterSpacing: '4px', fontFamily: 'ui-monospace, Menlo, monospace', marginBottom: '20px' }} />
        <Aviso texto={error} />
        <button type="submit" disabled={enviando || codigoLimpio.length !== 6 || (!perfil && !nombre.trim())} style={boton(COLOR.verde, { width: '100%', fontSize: '24px' })}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

function AlumnoLeccion({ leccion, alumnoId, onVolver, onRespuesta, onTerminar }) {
  const { lectura_facil, explicacion_ejemplo, preguntas } = leccion.contenido
  const [pestana, setPestana] = useState('leer')
  const [n, setN] = useState(0)
  const [elegida, setElegida] = useState(null)
  const [respondida, setRespondida] = useState(false)
  const [aciertos, setAciertos] = useState(0)
  const [terminado, setTerminado] = useState(false)
  const pregunta = preguntas[n]

  const responder = () => {
    setRespondida(true)
    if (elegida === pregunta.correcta) setAciertos(a => a + 1)
    const pendientes = leer('pendientes', [])
    pendientes.push({ id: nuevoId(), alumno: alumnoId, leccion_id: leccion.id, pregunta: n, respuesta: elegida, fecha: new Date().toISOString() })
    guardar('pendientes', pendientes)
    onRespuesta()
  }

  const siguiente = () => {
    if (n < preguntas.length - 1) {
      setN(n + 1)
      setElegida(null)
      setRespondida(false)
    } else {
      setTerminado(true)
      onTerminar() // si hay conexión, la nota le llega al profe ya
    }
  }

  const repetir = () => { setN(0); setElegida(null); setRespondida(false); setAciertos(0); setTerminado(false) }

  const pestanas = [['leer', 'Leer'], ['ejemplo', 'Ejemplo'], ['escuchar', 'Escuchar'], ['test', 'Test']]
  return (
    <div style={pagina}>
      <button onClick={onVolver} style={botonVolver}>Volver</button>
      <h1 style={titulo}>{leccion.titulo}</h1>

      <div role="tablist" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '26px' }}>
        {pestanas.map(([clave, texto]) => (
          <button key={clave} role="tab" aria-selected={pestana === clave} onClick={() => setPestana(clave)}
            style={boton(pestana === clave ? COLOR.verde : '#e7e5e4', { color: pestana === clave ? 'white' : '#1c1917', fontSize: '17px', padding: '10px 4px' })}>
            {texto}
          </button>
        ))}
      </div>

      {pestana === 'leer' && <p style={{ fontSize: '22px', lineHeight: '1.8', whiteSpace: 'pre-line' }}>{lectura_facil}</p>}
      {pestana === 'ejemplo' && <p style={{ ...tarjeta, fontSize: '22px', lineHeight: '1.8', backgroundColor: '#eff6ff', whiteSpace: 'pre-line' }}>{explicacion_ejemplo}</p>}
      {pestana === 'escuchar' && <Escuchar texto={lectura_facil} />}

      {pestana === 'test' && terminado && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '30px', fontWeight: 'bold', marginBottom: '12px' }}>Has acertado {aciertos} de {preguntas.length}</p>
          <p style={{ fontSize: '20px', marginBottom: '24px' }}>{aciertos === preguntas.length ? '¡Perfecto!' : 'Puedes volver a leer la lección y repetir el test.'}</p>
          <button onClick={repetir} style={boton(COLOR.azul, { width: '100%' })}>Repetir el test</button>
        </div>
      )}

      {pestana === 'test' && !terminado && (
        <div>
          <p style={{ color: COLOR.suave, marginBottom: '14px' }}>Pregunta {n + 1} de {preguntas.length}</p>
          <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>{pregunta.pregunta}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pregunta.opciones.map((opcion, i) => {
              const fondo = respondida
                ? (i === pregunta.correcta ? COLOR.verde : i === elegida ? COLOR.rojo : 'white')
                : (i === elegida ? COLOR.azul : 'white')
              const claro = fondo !== 'white'
              return (
                <button key={i} onClick={() => !respondida && setElegida(i)} disabled={respondida && !claro}
                  style={{ ...tarjeta, fontSize: '21px', textAlign: 'left', cursor: respondida ? 'default' : 'pointer', backgroundColor: fondo, color: claro ? 'white' : '#1c1917', borderColor: claro ? fondo : COLOR.borde }}>
                  {opcion}
                </button>
              )
            })}
          </div>
          {!respondida
            ? <button onClick={responder} disabled={elegida === null} style={boton(COLOR.azul, { width: '100%', marginTop: '22px', fontSize: '22px' })}>Responder</button>
            : (
              <>
                <div style={{ marginTop: '22px', padding: '16px', borderRadius: '12px', backgroundColor: '#fef9c3', fontSize: '20px' }}>
                  <strong>{elegida === pregunta.correcta ? '¡Correcto!' : 'No es esa.'}</strong>
                  {pregunta.porque && <p style={{ marginTop: '8px' }}>{pregunta.porque}</p>}
                </div>
                <button onClick={siguiente} style={boton(COLOR.verde, { width: '100%', marginTop: '14px', fontSize: '22px' })}>
                  {n < preguntas.length - 1 ? 'Siguiente' : 'Ver resultado'}
                </button>
              </>
            )}
        </div>
      )}
    </div>
  )
}

function Escuchar({ texto }) {
  const [sonando, setSonando] = useState(false)
  const hayVoz = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => () => { if (hayVoz) window.speechSynthesis.cancel() }, [hayVoz]) // al salir, que se calle

  if (!hayVoz) return <p style={{ fontSize: '20px' }}>Este móvil no puede leer en voz alta.</p>

  const reproducir = () => {
    window.speechSynthesis.cancel()
    const voz = new SpeechSynthesisUtterance(texto)
    voz.lang = 'es-ES'
    voz.rate = 0.9
    voz.onend = () => setSonando(false)
    voz.onerror = () => setSonando(false)
    window.speechSynthesis.speak(voz)
    setSonando(true)
  }
  const parar = () => { window.speechSynthesis.cancel(); setSonando(false) }

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={reproducir} disabled={sonando} style={boton(COLOR.verde, { fontSize: '24px', padding: '22px 36px' })}>▶ Escuchar</button>
        <button onClick={parar} disabled={!sonando} style={boton(COLOR.rojo, { fontSize: '24px', padding: '22px 36px' })}>■ Parar</button>
      </div>
      <p style={{ marginTop: '24px', color: COLOR.suave }}>{sonando ? 'Leyendo en voz alta…' : 'Pulsa Escuchar y el móvil te lee la lección.'}</p>
    </div>
  )
}

export default App
