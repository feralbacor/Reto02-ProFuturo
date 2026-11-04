import { useState, useEffect, useRef, useCallback } from 'react'

// ---------- Estilos ----------
const COLOR = { azul: '#2563eb', verde: '#16a34a', rojo: '#dc2626', gris: '#57534e', borde: '#d6d3d1', suave: '#78716c' }
const pagina = { padding: '20px 16px 60px', maxWidth: '720px', margin: '0 auto' }
const boton = (color = COLOR.azul, extra = {}) => ({
  padding: '14px 22px', minHeight: '56px', fontSize: '20px', fontWeight: 'bold', color: 'white',
  backgroundColor: color, border: 'none', borderRadius: '12px', cursor: 'pointer', ...extra,
})
const botonVolver = boton(COLOR.gris, { fontSize: '18px', minHeight: '48px', padding: '10px 18px', marginBottom: '20px' })
const campo = { width: '100%', padding: '14px', fontSize: '20px', border: `2px solid ${COLOR.borde}`, borderRadius: '10px', fontFamily: 'inherit', backgroundColor: 'white' }
const tarjeta = { padding: '18px', backgroundColor: 'white', border: `2px solid ${COLOR.borde}`, borderRadius: '14px' }
const etiqueta = { display: 'block', fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' }
const titulo = { fontSize: '30px', marginBottom: '20px' }

// ---------- Utilidades ----------
const SIN_CONEXION = 'No hay conexión con el ordenador de la clase.'

async function api(ruta, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(ruta, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error(SIN_CONEXION)
  }
  let datos = null
  try { datos = await res.json() } catch { /* respuesta sin JSON */ }
  if (!res.ok) {
    const detalle = datos?.detail
    if (typeof detalle === 'string') throw new Error(detalle)
    throw new Error(res.status >= 500 ? 'El ordenador de la clase no responde. Prueba otra vez.' : 'Algo no ha ido bien. Prueba otra vez.')
  }
  return datos
}

const leer = (clave, porDefecto) => {
  try { const v = localStorage.getItem(clave); return v ? JSON.parse(v) : porDefecto } catch { return porDefecto }
}
const guardar = (clave, valor) => {
  try { localStorage.setItem(clave, JSON.stringify(valor)) } catch { /* sin espacio o bloqueado */ }
}

// crypto.randomUUID solo existe con https o en localhost
const nuevoId = () => crypto.randomUUID
  ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16))

// Reduce la foto a 1600 px en JPEG: lee igual de bien y gasta muchos menos datos.
function reducirFoto(archivo, ladoMax = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, ladoMax / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * escala)
      canvas.height = Math.round(img.naturalHeight * escala)
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`No se puede abrir «${archivo.name}». Prueba con una foto en JPG o PNG.`))
    }
    img.src = url
  })
}

function Cargando({ texto }) {
  return (
    <div style={{ textAlign: 'center', padding: '30px 0' }}>
      <div style={{ width: '56px', height: '56px', margin: '0 auto 20px', border: `6px solid ${COLOR.borde}`, borderTopColor: COLOR.azul, borderRadius: '50%', animation: 'girar 1s linear infinite' }} />
      <p style={{ fontSize: '22px', color: COLOR.azul }}>{texto}</p>
    </div>
  )
}

function Aviso({ texto, color = COLOR.rojo }) {
  if (!texto) return null
  return <p role="alert" style={{ margin: '16px 0', padding: '14px', borderRadius: '10px', backgroundColor: color === COLOR.rojo ? '#fee2e2' : '#dcfce7', color, fontSize: '19px' }}>{texto}</p>
}

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
    return <ProfeClase codigo={codigo} onVolver={() => setPantalla('clases')} onNueva={() => setPantalla('nueva')} onEditar={editar} />
  }
  if (pantalla === 'nueva') {
    return <ProfeNuevaLeccion codigo={codigo} onVolver={() => setPantalla('clase')} onCreada={editar} />
  }
  if (pantalla === 'revisar' && editando) {
    return <ProfeRevisar inicial={editando} onVolver={() => setPantalla('clase')} />
  }
  return <ProfeClases onAbrir={abrirClase} onVolver={onVolver} />
}

function ProfeClases({ onAbrir, onVolver }) {
  const [clases, setClases] = useState(null)
  const [nombre, setNombre] = useState('')
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
      const clase = await api('/api/clases', { method: 'POST', body: { nombre } })
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
          placeholder="Por ejemplo: 5.º A · Ciencias" style={{ ...campo, marginBottom: '14px' }} />
        <button type="submit" disabled={!nombre.trim() || creando} style={boton(COLOR.azul, { width: '100%' })}>
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

function ProfeClase({ codigo, onVolver, onNueva, onEditar }) {
  const [clase, setClase] = useState(null)
  const [error, setError] = useState('')
  const [abriendo, setAbriendo] = useState(false)

  const cargar = useCallback(() => {
    api(`/api/clases/${encodeURIComponent(codigo)}`).then(c => { setClase(c); setError('') }).catch(e => setError(e.message))
  }, [codigo])

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 10000) // para ver entrar a los alumnos sin recargar
    return () => clearInterval(t)
  }, [cargar])

  const abrirLeccion = async (id) => {
    setAbriendo(true)
    try {
      const l = await api(`/api/leccion/${id}`)
      onEditar({ id: l.id, leccion: l.contenido, publicada: l.publicada })
    } catch (e) {
      setError(e.message)
      setAbriendo(false)
    }
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

      <button onClick={onNueva} style={boton(COLOR.verde, { width: '100%', fontSize: '24px', marginBottom: '28px' })}>+ Nueva lección</button>

      <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>Lecciones</h2>
      {clase.lecciones.length === 0 && <p style={{ color: COLOR.suave, marginBottom: '24px' }}>Todavía no hay lecciones. Haz una foto a una página del libro para crear la primera.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
        {clase.lecciones.map(l => (
          <button key={l.id} disabled={abriendo} onClick={() => abrirLeccion(l.id)}
            style={{ ...tarjeta, textAlign: 'left', cursor: 'pointer', fontSize: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <span>{l.titulo}</span>
            <span style={{ fontSize: '16px', fontWeight: 'bold', whiteSpace: 'nowrap', padding: '6px 10px', borderRadius: '8px', color: 'white', backgroundColor: l.publicada ? COLOR.verde : COLOR.suave }}>
              {l.publicada ? 'Publicada' : 'Borrador'}
            </span>
          </button>
        ))}
      </div>

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
        const r = await api('/api/leer-foto', { method: 'POST', body: { imagen: lista[i].datos } })
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
      const r = await api(`/api/clases/${encodeURIComponent(codigo)}/lecciones`, { method: 'POST', body: { texto } })
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

function ProfeRevisar({ inicial, onVolver }) {
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
      await api(`/api/leccion/${inicial.id}`, { method: 'PUT', body: { leccion, publicar } })
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
function VistaAlumno({ onVolver }) {
  const [perfil, setPerfil] = useState(() => leer('alumno-perfil', null)) // { id, nombre }
  const [clases, setClases] = useState(() => leer('alumno-clases', []))
  const [sinConexion, setSinConexion] = useState(!navigator.onLine)
  const [actualizando, setActualizando] = useState(false)
  const [entrando, setEntrando] = useState(false)
  const [leccion, setLeccion] = useState(null)

  const actualizar = useCallback(async () => {
    if (!perfil) return
    setActualizando(true)
    try {
      const datos = await api(`/api/alumnos/${perfil.id}/clases`)
      setClases(datos)
      guardar('alumno-clases', datos) // así las lecciones se pueden usar sin conexión
      setSinConexion(!navigator.onLine)
    } catch {
      setSinConexion(true)
    } finally {
      setActualizando(false)
    }
  }, [perfil])

  useEffect(() => {
    actualizar()
    const conectado = () => actualizar()
    const desconectado = () => setSinConexion(true)
    window.addEventListener('online', conectado)
    window.addEventListener('offline', desconectado)
    return () => {
      window.removeEventListener('online', conectado)
      window.removeEventListener('offline', desconectado)
    }
  }, [actualizar])

  const alEntrar = (p) => {
    guardar('alumno-perfil', p)
    setPerfil(p)
    setEntrando(false)
  }

  const cambiarDeAlumno = () => {
    if (!window.confirm(`¿Seguro que no eres ${perfil.nombre}?`)) return
    try { localStorage.removeItem('alumno-perfil'); localStorage.removeItem('alumno-clases') } catch { /* nada */ }
    setPerfil(null)
    setClases([])
  }

  if (!perfil || entrando) {
    return <AlumnoEntrar perfil={perfil} onEntrado={alEntrar} onVolver={perfil ? () => setEntrando(false) : onVolver} />
  }
  if (leccion) {
    return <AlumnoLeccion leccion={leccion} alumnoId={perfil.id} onVolver={() => setLeccion(null)} />
  }

  return (
    <div style={pagina}>
      <button onClick={onVolver} style={botonVolver}>Volver</button>
      <h1 style={{ ...titulo, marginBottom: '6px' }}>Hola, {perfil.nombre}</h1>
      <button onClick={cambiarDeAlumno} style={{ background: 'none', border: 'none', color: COLOR.azul, fontSize: '17px', textDecoration: 'underline', cursor: 'pointer', minHeight: '44px', marginBottom: '16px' }}>
        No soy {perfil.nombre}
      </button>

      {sinConexion && <Aviso texto="Sin conexión. Puedes usar las lecciones que ya tienes descargadas." color={COLOR.gris} />}

      {clases.length === 0 && <p style={{ color: COLOR.suave, marginBottom: '20px' }}>{sinConexion ? 'Cuando haya conexión aparecerán tus clases.' : 'Todavía no estás en ninguna clase.'}</p>}

      {clases.map(c => (
        <section key={c.codigo} style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>{c.nombre}</h2>
          {c.lecciones.length === 0
            ? <p style={{ color: COLOR.suave }}>Tu profe todavía no ha publicado lecciones.</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {c.lecciones.map(l => (
                  <button key={l.id} onClick={() => setLeccion(l)}
                    style={{ ...tarjeta, borderColor: COLOR.verde, borderWidth: '3px', textAlign: 'left', fontSize: '22px', fontWeight: 'bold', cursor: 'pointer' }}>
                    {l.titulo}
                  </button>
                ))}
              </div>
            )}
        </section>
      ))}

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={actualizar} disabled={actualizando} style={boton(COLOR.azul, { flex: '1 1 200px' })}>
          {actualizando ? 'Buscando…' : 'Buscar lecciones nuevas'}
        </button>
        <button onClick={() => setEntrando(true)} style={boton(COLOR.gris, { flex: '1 1 200px' })}>Entrar en otra clase</button>
      </div>
    </div>
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

function AlumnoLeccion({ leccion, alumnoId, onVolver }) {
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
  }

  const siguiente = () => {
    if (n < preguntas.length - 1) {
      setN(n + 1)
      setElegida(null)
      setRespondida(false)
    } else {
      setTerminado(true)
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
