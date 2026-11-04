import { useState, useEffect, useRef, useCallback } from 'react'
import '@fontsource-variable/archivo/wght.css'
import './estilo.css'
import {
  COLOR, SIN_CONEXION, api, leer, guardar, guardarPin, nuevoId, reducirFoto, Cargando, Aviso, Icono, tomarDelSegundoPlano, hashLocal,
} from './comun.jsx'
import PanelClase from './Panel.jsx'
import { buscar } from './tutorBuscar.js'

// Si sale una versión nueva, su service worker toma el control: se recarga una vez para no seguir con la vieja.
if (navigator.serviceWorker?.controller) navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload())

// Agrupa una lista de lecciones por materia, en el orden en que aparece cada materia.
const porMateria = (lecciones, materiaDe) => {
  const grupos = new Map()
  for (const l of lecciones) {
    const m = materiaDe(l) || 'General'
    grupos.set(m, [...(grupos.get(m) || []), l])
  }
  return [...grupos]
}

const pinValido = (pin) => /^\d{4,8}$/.test(pin)
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

function Volver({ onClick, disabled, children = 'Volver' }) {
  return <button className="boton boton-fantasma volver" onClick={onClick} disabled={disabled}><Icono nombre="volver" />{children}</button>
}

// ---------- Inicio ----------
function App() {
  const [vista, setVista] = useState('inicio')
  const [conectado, setConectado] = useState(null)

  useEffect(() => {
    api('/api/salud').then(() => setConectado(true)).catch(() => setConectado(false))
  }, [vista])

  if (vista === 'profe') return <VistaProfe onVolver={() => setVista('inicio')} />
  if (vista === 'alumno') return <VistaAlumno onVolver={() => setVista('inicio')} />

  return (
    <div className="pagina">
      <header className="cabecera"><span className="marca">Mochila</span></header>
      <h1 className="titulo" style={{ marginTop: 20 }}>Aprende aunque <mark>no haya conexión</mark>.</h1>
      <p className="frase">Las lecciones se quedan guardadas en el móvil. Tus respuestas le llegan a tu profe cuando vuelve la red.</p>

      <div className="botones" style={{ marginTop: 32 }}>
        <button className="eleccion eleccion-principal" onClick={() => setVista('alumno')}>
          <span><span className="eleccion-titulo">Soy estudiante</span><span className="eleccion-detalle">Mis lecciones y mis preguntas</span></span>
          <Icono nombre="seguir" tam={30} className="icono-final" />
        </button>
        <button className="eleccion" onClick={() => setVista('profe')}>
          <span><span className="eleccion-titulo">Soy profe</span><span className="eleccion-detalle">Crear clases y lecciones</span></span>
          <Icono nombre="seguir" tam={30} className="icono-final" />
        </button>
      </div>

      <p className="nota" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 28 }}>
        <span className="punto" style={{ background: conectado ? COLOR.verde : conectado === false ? COLOR.suave : COLOR.amarillo }} />
        {conectado === null ? 'Buscando el ordenador de la clase…' : conectado ? 'Conectado con el ordenador de la clase' : 'Sin conexión: puedes usar lo que ya está descargado'}
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

  const hay = clases?.length > 0
  return (
    <div className="pagina">
      <header className="cabecera"><Volver onClick={onVolver} /></header>
      <h1 className="titulo">Mis clases</h1>
      <p className="frase">Cada clase tiene un código. Tus alumnos lo escriben para entrar.</p>

      <Aviso texto={error} />
      {clases === null && <Cargando texto="Cargando tus clases…" />}
      {hay && (
        <div className="lista" style={{ marginTop: 24 }}>
          {clases.map(c => (
            <button key={c.codigo} className="fila" onClick={() => onAbrir(c.codigo)}>
              <span className="fila-texto">
                <span className="fila-titulo">{c.nombre}</span>
                <span className="fila-detalle">
                  <span className="insignia" style={{ fontFamily: 'var(--mono)', letterSpacing: '0.08em' }}>{c.codigo}</span>
                  {plural(c.alumnos, 'alumno', 'alumnos')} · {plural(c.lecciones, 'lección', 'lecciones')}
                </span>
              </span>
              <Icono nombre="seguir" className="icono-final" />
            </button>
          ))}
        </div>
      )}

      <section className="seccion">
        <h2 className="seccion-titulo">{hay ? 'Crear otra clase' : 'Crea tu primera clase'}</h2>
        <form onSubmit={crear} className="tarjeta formulario">
          <div className="campo-grupo">
            <label htmlFor="nombre-clase" className="etiqueta">Nombre de la clase</label>
            <input id="nombre-clase" className="campo" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={60} placeholder="Por ejemplo: 5.º A · Ciencias" />
          </div>
          <div className="campo-grupo">
            <label htmlFor="pin-clase" className="etiqueta">Tu PIN de profe</label>
            <input id="pin-clase" className="campo campo-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={8}
              value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
            <p className="pista">De 4 a 8 números. Apúntalo: en otro móvil o tablet te lo pedirá para abrir la clase.</p>
          </div>
          <button type="submit" disabled={!nombre.trim() || !pinValido(pin) || creando} className={`boton boton-ancho ${hay ? 'boton-secundario' : 'boton-principal'}`}>
            {creando ? 'Creando…' : 'Crear la clase'}
          </button>
        </form>
      </section>
    </div>
  )
}

function ProfeClase({ codigo, onVolver, onNueva, onNotas, onEditar }) {
  const [clase, setClase] = useState(null)
  const [error, setError] = useState('')
  const [abriendo, setAbriendo] = useState(false)
  const [pidePin, setPidePin] = useState(false)
  const [pin, setPin] = useState('')
  const [intentado, setIntentado] = useState(false)

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
    setIntentado(true)
    cargar()
  }

  // Si un alumno olvida su contraseña, el profe le pone otra y se la dice (sin email: no todos tienen).
  const nuevaContrasena = async (a) => {
    const nueva = window.prompt(`Nueva contraseña para ${a.nombre} (al menos 4 letras o números):`)
    if (nueva === null) return
    try {
      await api(`/api/clases/${encodeURIComponent(codigo)}/alumnos/${a.id}/contrasena`, { method: 'PUT', body: { contrasena: nueva } })
      window.alert(`Listo. Dile a ${a.nombre} su usuario («${a.usuario}») y su nueva contraseña. La primera vez tendrá que entrar con conexión.`)
    } catch (e) {
      window.alert(e.message)
    }
  }

  const cambiarRespuesta = async (d) => {
    const nueva = window.prompt(`Tu respuesta a «${d.pregunta}»:`, d.respuesta || '')
    if (!nueva?.trim()) return
    try {
      await api(`/api/clases/${encodeURIComponent(codigo)}/dudas/${d.id}`, { method: 'PUT', body: { respuesta: nueva } })
      cargar()
    } catch (e) {
      window.alert(e.message)
    }
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
      <div className="pagina">
        <header className="cabecera"><Volver onClick={onVolver}>Mis clases</Volver></header>
        <h1 className="titulo">Abrir la clase</h1>
        <p className="frase">Escribe tu PIN de profe de la clase <strong style={{ fontFamily: 'var(--mono)' }}>{codigo}</strong>.</p>
        <form onSubmit={entrarConPin} className="formulario" style={{ marginTop: 24 }}>
          <div className="campo-grupo">
            <label htmlFor="pin-entrar" className="etiqueta">PIN</label>
            <input id="pin-entrar" className="campo campo-pin" type="password" inputMode="numeric" autoComplete="current-password" maxLength={8} autoFocus
              value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
          </div>
          <Aviso texto={intentado ? error : ''} />
          <button type="submit" disabled={!pinValido(pin)} className="boton boton-principal boton-ancho boton-grande">Abrir la clase</button>
        </form>
      </div>
    )
  }

  if (!clase) {
    return (
      <div className="pagina">
        <header className="cabecera"><Volver onClick={onVolver}>Mis clases</Volver></header>
        {error ? <Aviso texto={error} /> : <Cargando texto="Cargando la clase…" />}
      </div>
    )
  }

  return (
    <div className="pagina">
      <header className="cabecera"><Volver onClick={onVolver}>Mis clases</Volver></header>
      <h1 className="titulo">{clase.nombre}</h1>

      <div className="codigo-clase" style={{ marginTop: 20 }}>
        <span className="nota" style={{ margin: 0 }}>Código para que entren tus alumnos</span>
        <span className="codigo-clase-texto">{clase.codigo}</span>
      </div>

      <Aviso texto={error} />

      <div className="botones-fila" style={{ marginTop: 20 }}>
        <button onClick={onNueva} className="boton boton-principal boton-grande"><Icono nombre="mas" />Nueva lección</button>
        <button onClick={onNotas} className="boton boton-secundario boton-grande"><Icono nombre="notas" />Ver notas</button>
      </div>

      <section className="seccion">
        <h2 className="seccion-titulo">Lecciones</h2>
        {clase.lecciones.length === 0 && <p className="frase" style={{ marginTop: 0 }}>Todavía no hay lecciones. Pulsa «Nueva lección» y haz una foto a una página del libro.</p>}
        {porMateria(clase.lecciones, l => l.materia).map(([materia, lecciones]) => (
          <div key={materia}>
            <h3 className="subtitulo">{materia}</h3>
            <div className="lista">
              {lecciones.map(l => (
                <button key={l.id} disabled={abriendo} onClick={() => abrirLeccion(l.id)} className="fila">
                  <span className="fila-texto"><span className="fila-titulo">{l.titulo}</span></span>
                  <span className={`insignia ${l.publicada ? 'insignia-verde' : ''}`}>{l.publicada ? 'Publicada' : 'Borrador'}</span>
                  <Icono nombre="seguir" className="icono-final" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {clase.dudas?.length > 0 && (
        <section className="seccion">
          <h2 className="seccion-titulo">Dudas de tus alumnos</h2>
          <p className="frase" style={{ marginTop: -4, marginBottom: 14 }}>Las contesta Mochila con lo que dice la lección. Si una respuesta no te convence, cámbiala: le llegará al alumno.</p>
          {clase.dudas.map(d => (
            <div key={d.id} className="tarjeta duda">
              <p className="nota" style={{ marginTop: 0, marginBottom: 6 }}>{d.alumno} · {d.leccion} · {cuando(d.fecha)}</p>
              <p className="duda-pregunta">{d.pregunta}</p>
              {d.respuesta
                ? <p className="duda-respuesta">{d.respuesta}</p>
                : <p className="nota">Mochila todavía no la ha contestado.</p>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                {d.corregida ? <span className="insignia insignia-verde">Contestada por ti</span> : null}
                <button onClick={() => cambiarRespuesta(d)} className="boton boton-fantasma boton-pequeno" style={{ marginLeft: -12 }}>Cambiar la respuesta</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="seccion">
        <h2 className="seccion-titulo">Alumnos ({clase.alumnos.length})</h2>
        {clase.alumnos.length === 0
          ? <p className="frase" style={{ marginTop: 0 }}>Todavía no ha entrado nadie. Diles el código de arriba.</p>
          : (
            <div className="tarjeta" style={{ padding: '2px 16px' }}>
              {clase.alumnos.map(a => (
                <div key={a.id} className="alumno-fila">
                  <span>
                    <span style={{ fontSize: 19, fontWeight: 650 }}>{a.nombre}</span>
                    {a.usuario && <span className="nota" style={{ display: 'block', marginTop: 2 }}>Usuario: {a.usuario}</span>}
                  </span>
                  {a.usuario && <button onClick={() => nuevaContrasena(a)} className="boton boton-secundario boton-pequeno">Nueva contraseña</button>}
                </div>
              ))}
            </div>
          )}
      </section>
    </div>
  )
}

function ProfeNuevaLeccion({ codigo, onVolver, onCreada }) {
  const MAX_FOTOS = 5
  const [fotos, setFotos] = useState([]) // { id, nombre, datos }
  const [texto, setTexto] = useState('')
  const [leidas, setLeidas] = useState(false)
  const [ocupado, setOcupado] = useState('') // qué está haciendo
  const [leyendo, setLeyendo] = useState(false) // para enseñar la espera junto a las fotos o junto al botón final
  const [error, setError] = useState('')
  const camara = useRef(null)
  const galeria = useRef(null)
  const [materia, setMateria] = useState('')
  const [materias, setMaterias] = useState([])
  const [ia, setIa] = useState(null)

  useEffect(() => {
    // Sugiere las materias que ya tiene la clase y deja puesta la última usada.
    api(`/api/clases/${encodeURIComponent(codigo)}`)
      .then(c => { setMaterias(c.materias); setMateria(m => m || c.materias[0] || '') })
      .catch(() => {})
    api('/api/salud').then(s => setIa(s.ia)).catch(() => {})
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
    setLeyendo(true)
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
      setLeyendo(false)
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
  const espera = ocupado && <Cargando texto={ocupado} />

  return (
    <div className="pagina">
      <header className="cabecera"><Volver onClick={onVolver} disabled={!!ocupado}>La clase</Volver></header>
      <h1 className="titulo">Nueva lección</h1>
      <p className="frase">Haz una foto a una página del libro. Mochila la lee y prepara una lectura fácil, un ejemplo y 5 preguntas. Tú la revisas antes de publicarla.</p>
      {ia === 'apagada' && (
        <p className="aviso aviso-atencion"><strong>La lectura de fotos está apagada</strong>Enciende Ollama en el ordenador de la clase. Mientras, puedes escribir o pegar el texto.</p>
      )}

      <section className="seccion">
        <h2 className="paso-profe"><span className="paso-profe-num">1</span>Las fotos de la página</h2>
        <div className="botones-fila">
          <button onClick={() => camara.current.click()} disabled={!!ocupado || fotos.length >= MAX_FOTOS} className="boton boton-secundario"><Icono nombre="camara" />Hacer una foto</button>
          <button onClick={() => galeria.current.click()} disabled={!!ocupado || fotos.length >= MAX_FOTOS} className="boton boton-secundario"><Icono nombre="fotos" />Elegir fotos</button>
        </div>
        <p className="pista">Hasta {MAX_FOTOS} fotos. Que se vea la página entera y con buena luz.</p>
        <input ref={camara} type="file" accept="image/*" capture="environment" onChange={alElegir} hidden />
        <input ref={galeria} type="file" accept="image/*" multiple onChange={alElegir} hidden />

        {fotos.length > 0 && (
          <>
            <div className="fotos" style={{ marginTop: 16 }}>
              {fotos.map((f, i) => (
                <div key={f.id} className="tarjeta foto">
                  <img src={f.datos} alt={`Foto ${i + 1}`} />
                  <button onClick={() => setFotos(fs => fs.filter(x => x.id !== f.id))} disabled={!!ocupado} className="boton boton-fantasma boton-ancho">Quitar</button>
                </div>
              ))}
            </div>
            <button onClick={leerFotos} disabled={!!ocupado} className="boton boton-principal boton-ancho" style={{ marginTop: 16 }}>
              Leer {fotos.length === 1 ? 'la foto' : `las ${fotos.length} fotos`}
            </button>
          </>
        )}
        {leyendo && espera}
      </section>

      <section className="seccion">
        <h2 className="paso-profe"><span className="paso-profe-num">2</span>{leidas ? 'Revisa el texto' : 'El texto'}</h2>
        <label htmlFor="texto-leccion" className="pista" style={{ display: 'block', margin: '0 0 10px' }}>
          {leidas ? 'Esto es lo que pone en las fotos. Corrige lo que haga falta.' : 'Lo que pone en la página. Si no tienes foto, escríbelo o pégalo aquí.'}
        </label>
        <textarea id="texto-leccion" className="campo" value={texto} onChange={e => setTexto(e.target.value)} rows={10} disabled={!!ocupado}
          placeholder="El texto de la página del libro…" />
        {!suficiente && texto.trim() && <p className="pista">Hace falta un poco más de texto: al menos un par de frases.</p>}
      </section>

      <section className="seccion">
        <h2 className="paso-profe"><span className="paso-profe-num">3</span>La materia</h2>
        <input id="materia" className="campo" list="materias-clase" value={materia} onChange={e => setMateria(e.target.value)} maxLength={40}
          placeholder="Por ejemplo: Ciencias" disabled={!!ocupado} aria-label="Materia" />
        <datalist id="materias-clase">{materias.map(m => <option key={m} value={m} />)}</datalist>
      </section>

      <Aviso texto={error} />
      {!leyendo && espera}
      <div className="acciones-pie" style={{ marginTop: 28 }}>
        <button onClick={crear} disabled={!suficiente || !!ocupado} className="boton boton-principal boton-ancho boton-grande">Preparar la lección</button>
      </div>
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
        texto: publicar ? 'Publicada. Tus alumnos la tendrán la próxima vez que se conecten.' : 'Guardado.',
        color: COLOR.verde,
      })
    } catch (e) {
      setAviso({ texto: e.message, color: COLOR.rojo })
    } finally {
      setGuardando(false)
    }
  }

  const area = (id, clave, filas) => (
    <textarea id={id} className="campo" value={leccion[clave]} onChange={e => cambiar(clave, e.target.value)} rows={filas} />
  )

  return (
    <div className="pagina">
      <header className="cabecera">
        <Volver onClick={onVolver}>La clase</Volver>
        {publicada && <span className="insignia insignia-verde">Publicada</span>}
      </header>
      <h1 className="titulo">{publicada ? 'Lección publicada' : 'Revisa la lección'}</h1>
      <p className="frase">{publicada
        ? 'Si cambias algo, tus alumnos lo verán la próxima vez que se conecten.'
        : 'Léela y corrige lo que haga falta. Tus alumnos solo ven las lecciones publicadas.'}</p>

      <div className="formulario" style={{ marginTop: 28 }}>
        <div className="campo-grupo">
          <label htmlFor="r-titulo" className="etiqueta">Título</label>
          <input id="r-titulo" className="campo" value={leccion.titulo} onChange={e => cambiar('titulo', e.target.value)} />
        </div>
        <div className="campo-grupo">
          <label htmlFor="r-materia" className="etiqueta">Materia</label>
          <input id="r-materia" className="campo" value={leccion.materia || ''} onChange={e => cambiar('materia', e.target.value)} maxLength={40} placeholder="General" />
        </div>
        <div className="campo-grupo">
          <label htmlFor="r-lectura" className="etiqueta">Lectura fácil</label>
          {area('r-lectura', 'lectura_facil', 8)}
        </div>
        <div className="campo-grupo">
          <label htmlFor="r-ejemplo" className="etiqueta">Un ejemplo</label>
          {area('r-ejemplo', 'explicacion_ejemplo', 5)}
        </div>
      </div>

      <section className="seccion">
        <h2 className="seccion-titulo">Las preguntas</h2>
        <p className="frase" style={{ marginTop: -4, marginBottom: 16 }}>Comprueba que la respuesta marcada en verde es la buena. Si no, marca el círculo de la buena.</p>
        {leccion.preguntas.map((p, i) => (
          <fieldset key={i} className="tarjeta" style={{ marginBottom: 16 }}>
            <legend className="etiqueta" style={{ padding: '0 6px', marginBottom: 0 }}>Pregunta {i + 1}</legend>
            <input className="campo" value={p.pregunta} onChange={e => cambiarPregunta(i, { pregunta: e.target.value })} aria-label={`Pregunta ${i + 1}`}
              style={{ marginBottom: 14, fontWeight: 650 }} />
            {p.opciones.map((o, k) => (
              <div key={k} className={`opcion-editar ${p.correcta === k ? 'opcion-editar-buena' : ''}`}>
                <input type="radio" name={`correcta-${i}`} checked={p.correcta === k} onChange={() => cambiarPregunta(i, { correcta: k })}
                  aria-label={`La opción ${'ABCD'[k]} es la buena`} />
                <input className="campo" value={o} onChange={e => cambiarOpcion(i, k, e.target.value)} aria-label={`Opción ${'ABCD'[k]}`} />
              </div>
            ))}
            <label htmlFor={`porque-${i}`} className="etiqueta" style={{ marginTop: 14, fontSize: 16 }}>Por qué es la buena</label>
            <input id={`porque-${i}`} className="campo" value={p.porque} onChange={e => cambiarPregunta(i, { porque: e.target.value })} style={{ fontSize: 18 }} />
          </fieldset>
        ))}
      </section>

      <Aviso texto={aviso.texto} color={aviso.color} />
      <div className="acciones-pie">
        <div className="botones-fila">
          {publicada
            ? <button onClick={() => enviar(true)} disabled={guardando} className="boton boton-principal">{guardando ? 'Guardando…' : 'Guardar los cambios'}</button>
            : (
              <>
                <button onClick={() => enviar(false)} disabled={guardando} className="boton boton-secundario">Guardar sin publicar</button>
                <button onClick={() => enviar(true)} disabled={guardando} className="boton boton-principal">{guardando ? 'Publicando…' : 'Publicar'}</button>
              </>
            )}
        </div>
      </div>
    </div>
  )
}

// ---------- Estudiante ----------
// Una línea fija arriba: dice si las respuestas guardadas en el móvil ya han llegado al profe.
function BarraEnvio({ estado, pendientes }) {
  const n = plural(pendientes, 'respuesta', 'respuestas')
  const [clase, texto] =
    estado === 'enviando' ? ['estado-enviando', pendientes ? `Enviando ${n}…` : 'Buscando lecciones nuevas…']
      : estado === 'sin-conexion' ? ['', pendientes ? `Sin conexión · ${n} por enviar` : 'Sin conexión · tus lecciones funcionan igual']
        : estado === 'error' ? ['estado-error', `No se ha podido enviar · ${n} por enviar · se reintentará solo`]
          : pendientes ? ['estado-pendiente', `${n} por enviar`]
            : ['estado-ok', 'Todo enviado a tu profe']
  return <div role="status" className={`estado ${clase}`}><span className="punto" />{texto}</div>
}

const respuestaBienFormada = (r) => r && typeof r.id === 'string' && typeof r.alumno === 'string'
  && typeof r.leccion_id === 'string' && Number.isInteger(r.pregunta) && Number.isInteger(r.respuesta) && typeof r.fecha === 'string'

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

// Círculo verde con la flecha hacia abajo: «esto ya está en el móvil».
function IconoDescargado({ tam = 22 }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="12" fill={COLOR.verde} />
      <path d="M12 5.5v9m-4-4 4 4 4-4M7 18h10" stroke="white" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ResumenDescargado({ lecciones, appGuardada, actualizado }) {
  if (appGuardada === null) {
    return <p className="aviso aviso-atencion"><strong>Sin conexión, la app no se abrirá</strong>Este navegador no puede guardarla. Entra con el enlace https que te dé tu profe.</p>
  }
  return (
    <div className="frase" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      {appGuardada ? <IconoDescargado tam={26} /> : <span className="ruedita" style={{ width: 24, height: 24, borderWidth: 3, flexShrink: 0 }} />}
      <span>
        {appGuardada
          ? `Tienes ${plural(lecciones, 'lección guardada', 'lecciones guardadas')} en este móvil. Funcionan sin conexión.`
          : 'Guardando la app en este móvil… Espera un momento antes de quedarte sin conexión.'}
        {actualizado && <span className="nota" style={{ display: 'block', marginTop: 4 }}>Lecciones nuevas buscadas {cuando(actualizado)}.</span>}
      </span>
    </div>
  )
}

// Varios niños pueden compartir un móvil: cada uno entra con su usuario y su contraseña, también sin conexión.
// En el aparato: «perfiles» (los que han entrado aquí, con un hash de su contraseña) y, por alumno,
// «clases:ID», «version:ID», «actualizado:ID» y «progreso:ID». Las respuestas pendientes son del aparato.
const COLORES_AVATAR = ['#8a5a00', '#17784b', '#a4462e', '#3d5a73', '#6b4a7a', '#4f483c']

function Avatar({ nombre, tam = 52 }) {
  const color = COLORES_AVATAR[[...nombre].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORES_AVATAR.length]
  return <span aria-hidden="true" className="avatar" style={{ width: tam, height: tam, fontSize: tam * 0.44, backgroundColor: color }}>{nombre.trim()[0]?.toUpperCase()}</span>
}

// Guarda (o actualiza) al alumno en este aparato con un hash de su contraseña, para que pueda entrar sin conexión.
async function recordarEnAparato(alumno, contrasena) {
  const sal = nuevoId()
  const hash = await hashLocal(contrasena, sal).catch(() => null) // sin https no hay WebCrypto: entonces solo entrará con conexión
  guardar('perfiles', [...leer('perfiles', []).filter(p => p.id !== alumno.id), { id: alumno.id, usuario: alumno.usuario, nombre: alumno.nombre, sal, hash }])
}

const sugerirUsuario = (nombre) => nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
const usuarioValido = (u) => /^[a-z0-9]{3,20}$/.test(u)
const limpiarCodigo = (codigo) => codigo.toUpperCase().replace(/[^A-Z0-9]/g, '')

function CampoContrasena({ id, valor, onCambio, nueva = false, autoFocus = false }) {
  const [ver, setVer] = useState(false)
  return (
    <div className="campo-con-boton">
      {/* autoComplete: en un móvil compartido el navegador no debe rellenar la contraseña de otro niño */}
      <input id={id} className="campo" type={ver ? 'text' : 'password'} value={valor} onChange={e => onCambio(e.target.value)} maxLength={64} autoFocus={autoFocus}
        autoComplete={nueva ? 'new-password' : 'off'} autoCapitalize="off" autoCorrect="off" spellCheck={false} style={{ fontSize: 24 }} />
      <button type="button" onClick={() => setVer(!ver)} aria-pressed={ver} className="boton boton-secundario boton-pequeno" style={{ minHeight: 56 }}>
        {ver ? 'Ocultar' : 'Ver'}
      </button>
    </div>
  )
}

function CampoCodigo({ valor, onCambio }) {
  return (
    <div className="campo-grupo">
      <label htmlFor="codigo-clase" className="etiqueta">Código de la clase</label>
      <input id="codigo-clase" className="campo campo-codigo" value={valor} onChange={e => onCambio(e.target.value.toUpperCase())} maxLength={12}
        autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="ABC123" />
      <p className="pista">Son 6 letras y números. Te lo dice tu profe.</p>
    </div>
  )
}

function VistaAlumno({ onVolver }) {
  // Quién usa el aparato ahora: solo en memoria, así al volver a abrir la app se pregunta otra vez.
  const [alumno, setAlumno] = useState(null)
  if (!alumno) return <AlumnoQuienEres onEntrar={setAlumno} onVolver={onVolver} />
  return <AlumnoCasa key={alumno.id} alumno={alumno} onSalir={() => setAlumno(null)} />
}

// Alumno de antes de los usuarios (entraba solo con su nombre) que sigue en este aparato.
const LEGADO = ['alumno-perfil', 'alumno-clases', 'alumno-version', 'alumno-actualizado']

function AlumnoQuienEres({ onEntrar, onVolver }) {
  const [vista, setVista] = useState(null) // null | 'nuevo' | 'antiguo' | 'usuario' | un perfil
  const perfiles = leer('perfiles', [])
  const antiguo = leer('alumno-perfil', null)
  if (vista === 'nuevo' || vista === 'antiguo') return <AlumnoNuevo antiguo={vista === 'antiguo' ? antiguo : null} onEntrar={onEntrar} onVolver={() => setVista(null)} />
  if (vista) return <AlumnoContrasena perfil={vista === 'usuario' ? null : vista} onEntrar={onEntrar} onVolver={() => setVista(null)} />

  const hay = perfiles.length > 0 || !!antiguo?.nombre
  return (
    <div className="pagina">
      <header className="cabecera"><Volver onClick={onVolver} /></header>
      <h1 className="titulo">¿Quién eres?</h1>
      <p className="frase">{hay ? 'Toca tu nombre.' : 'Crea tu usuario para empezar. Si ya tienes uno, entra con él.'}</p>

      {hay && (
        <div className="lista" style={{ marginTop: 24 }}>
          {antiguo?.nombre && (
            <button onClick={() => setVista('antiguo')} className="fila fila-toca">
              <Avatar nombre={antiguo.nombre} />
              <span className="fila-texto"><span className="fila-titulo">{antiguo.nombre}</span><span className="fila-detalle">Ponle usuario y contraseña para seguir</span></span>
              <Icono nombre="seguir" className="icono-final" />
            </button>
          )}
          {perfiles.map(p => (
            <button key={p.id} onClick={() => setVista(p)} className="fila">
              <Avatar nombre={p.nombre} />
              <span className="fila-texto"><span className="fila-titulo">{p.nombre}</span><span className="fila-detalle">{p.usuario}</span></span>
              <Icono nombre="seguir" className="icono-final" />
            </button>
          ))}
        </div>
      )}

      <div className={hay ? 'botones-fila' : 'botones'} style={{ marginTop: 28 }}>
        <button onClick={() => setVista('nuevo')} className={`boton ${hay ? 'boton-secundario' : 'boton-principal boton-grande'}`}><Icono nombre="mas" />Crear mi usuario</button>
        <button onClick={() => setVista('usuario')} className={`boton boton-secundario ${hay ? '' : 'boton-grande'}`}>Ya tengo usuario</button>
      </div>
      <p className="nota" style={{ marginTop: 22 }}>En un mismo móvil pueden entrar varios estudiantes, cada uno con su usuario y su contraseña.</p>
    </div>
  )
}

function AlumnoContrasena({ perfil, onEntrar, onVolver }) {
  const [usuario, setUsuario] = useState(perfil?.usuario || '')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const entrar = async (ev) => {
    ev.preventDefault()
    setError('')
    setEnviando(true)
    // Sin conexión: se compara con el hash guardado en este aparato.
    if (perfil?.hash && await hashLocal(contrasena, perfil.sal).catch(() => null) === perfil.hash) return onEntrar(perfil)
    // Con conexión: la primera vez en este aparato, o si el profe le ha puesto otra contraseña.
    try {
      const a = await api('/api/alumnos/entrar', { method: 'POST', body: { usuario, contrasena } })
      await recordarEnAparato(a, contrasena)
      onEntrar(a)
    } catch (e) {
      setError(e.message !== SIN_CONEXION ? e.message
        : perfil?.hash ? 'Contraseña incorrecta.' : 'La primera vez en este móvil hace falta conexión con el ordenador de la clase.')
      setEnviando(false)
    }
  }

  return (
    <div className="pagina">
      <header className="cabecera"><Volver onClick={onVolver}>{perfil ? 'No soy yo' : 'Volver'}</Volver></header>
      {perfil
        ? <h1 className="titulo titulo-con-avatar"><Avatar nombre={perfil.nombre} />Hola, {perfil.nombre}</h1>
        : <h1 className="titulo">Entrar con mi usuario</h1>}
      <p className="frase">{perfil ? 'Escribe tu contraseña.' : 'Escribe tu usuario y tu contraseña.'}</p>
      <form onSubmit={entrar} className="formulario" style={{ marginTop: 24 }}>
        {!perfil && (
          <div className="campo-grupo">
            <label htmlFor="entrar-usuario" className="etiqueta">Usuario</label>
            <input id="entrar-usuario" className="campo" value={usuario} onChange={e => setUsuario(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} maxLength={20}
              autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false} style={{ fontSize: 24 }} />
          </div>
        )}
        <div className="campo-grupo">
          <label htmlFor="entrar-contrasena" className="etiqueta">Contraseña</label>
          <CampoContrasena id="entrar-contrasena" valor={contrasena} onCambio={setContrasena} autoFocus={!!perfil} />
          <p className="pista">¿Se te ha olvidado? Pídele a tu profe una nueva.</p>
        </div>
        <Aviso texto={error} />
        <button type="submit" disabled={enviando || !usuarioValido(usuario) || contrasena.length < 4} className="boton boton-principal boton-ancho boton-grande">
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

function AlumnoNuevo({ antiguo, onEntrar, onVolver }) {
  const [nombre, setNombre] = useState(antiguo?.nombre || '')
  const [usuario, setUsuario] = useState(null) // null: se saca del nombre hasta que lo cambie él
  const [contrasena, setContrasena] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const elUsuario = usuario ?? sugerirUsuario(nombre)
  const codigoLimpio = limpiarCodigo(codigo)

  const crear = async (ev) => {
    ev.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const a = await api('/api/alumnos', { method: 'POST', body: antiguo
        ? { nombre, usuario: elUsuario, contrasena, alumno_id: antiguo.id }
        : { nombre, usuario: elUsuario, contrasena, clase: codigoLimpio } })
      await recordarEnAparato(a, contrasena)
      if (antiguo) {
        guardar(`clases:${a.id}`, leer('alumno-clases', [])) // sus lecciones siguen en el aparato sin conexión
        try { LEGADO.forEach(k => localStorage.removeItem(k)) } catch { /* nada */ }
      }
      onEntrar(a)
    } catch (e) {
      if (e.detalle?.sugerencia) setUsuario(e.detalle.sugerencia)
      setError(e.message === SIN_CONEXION ? 'Para crear tu usuario hace falta conexión con el ordenador de la clase.' : e.message)
      setEnviando(false)
    }
  }

  return (
    <div className="pagina">
      <header className="cabecera"><Volver onClick={onVolver} /></header>
      <h1 className="titulo">{antiguo ? 'Ponle usuario y contraseña' : 'Crear mi usuario'}</h1>
      <p className="frase">{antiguo
        ? 'Antes se entraba solo con el nombre. Ahora cada estudiante tiene usuario y contraseña, para que nadie entre como tú. No pierdes tus clases ni tus respuestas.'
        : 'Te pediremos la contraseña cada vez que entres. Así nadie más puede entrar como tú.'}</p>
      <form onSubmit={crear} className="formulario" style={{ marginTop: 24 }}>
        <div className="campo-grupo">
          <label htmlFor="nuevo-nombre" className="etiqueta">¿Cómo te llamas?</label>
          <input id="nuevo-nombre" className="campo" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={40} autoComplete="off" placeholder="Tu nombre" />
        </div>
        <div className="campo-grupo">
          <label htmlFor="nuevo-usuario" className="etiqueta">Tu usuario</label>
          <input id="nuevo-usuario" className="campo" value={elUsuario} onChange={e => setUsuario(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} maxLength={20}
            autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false} style={{ fontSize: 24 }} />
          <p className="pista">Solo letras y números, sin espacios. Apúntalo: lo necesitas para entrar.</p>
        </div>
        <div className="campo-grupo">
          <label htmlFor="nuevo-contrasena" className="etiqueta">Tu contraseña</label>
          <CampoContrasena id="nuevo-contrasena" valor={contrasena} onCambio={setContrasena} nueva />
          <p className="pista">Al menos 4 letras o números. Que la recuerdes bien y no se la digas a nadie.</p>
        </div>
        {!antiguo && <CampoCodigo valor={codigo} onCambio={setCodigo} />}
        <Aviso texto={error} />
        <button type="submit" disabled={enviando || !nombre.trim() || !usuarioValido(elUsuario) || contrasena.length < 4 || (!antiguo && codigoLimpio.length !== 6)}
          className="boton boton-principal boton-ancho boton-grande">
          {enviando ? 'Guardando…' : antiguo ? 'Guardar y entrar' : 'Crear y entrar'}
        </button>
      </form>
    </div>
  )
}

function AlumnoCasa({ alumno, onSalir }) {
  const clave = (que) => `${que}:${alumno.id}`
  const [clases, setClases] = useState(() => leer(clave('clases'), []))
  const [pendientes, setPendientes] = useState(() => leer('pendientes', []).length)
  const [estado, setEstado] = useState('ok') // ok | enviando | sin-conexion | error
  const [otraClase, setOtraClase] = useState(false)
  const [leccion, setLeccion] = useState(null)
  const [actualizado, setActualizado] = useState(() => leer(clave('actualizado'), null))
  const [progreso, setProgreso] = useState(() => leer(clave('progreso'), {})) // { leccion_id: { empezada, hecha, aciertos, total } }
  const [dudas, setDudas] = useState(() => leer(clave('dudas'), [])) // las que ya tiene el servidor, con su respuesta si la hay
  const [dudasCola, setDudasCola] = useState(() => leer('dudas-pendientes', [])) // las escritas aquí que aún no han llegado
  const appGuardada = useAppGuardada()
  const enCurso = useRef(false)

  // Recoge lo que el service worker envió o descargó con la app cerrada (segundo-plano.js), para todos los alumnos del aparato.
  const recoger = useCallback(async () => {
    const sw = await tomarDelSegundoPlano()
    if (!sw) return
    const recibidas = new Set(sw.recibidas)
    const quedan = leer('pendientes', []).filter(p => !recibidas.has(p.id))
    guardar('pendientes', quedan)
    setPendientes(quedan.length)
    const dudasRecibidas = new Set(sw.dudas_recibidas || [])
    const dudasQuedan = leer('dudas-pendientes', []).filter(d => !dudasRecibidas.has(d.id))
    guardar('dudas-pendientes', dudasQuedan)
    setDudasCola(dudasQuedan)
    for (const [id, d] of Object.entries(sw.alumnos || {})) {
      if (d.clases) {
        guardar(`clases:${id}`, d.clases)
        guardar(`version:${id}`, d.version)
      }
      if (d.dudas) guardar(`dudas:${id}`, d.dudas)
      if (sw.fecha > (leer(`actualizado:${id}`, null) || '')) guardar(`actualizado:${id}`, sw.fecha)
    }
    setClases(leer(`clases:${alumno.id}`, []))
    setDudas(leer(`dudas:${alumno.id}`, []))
    setActualizado(leer(`actualizado:${alumno.id}`, null))
  }, [alumno.id])

  // Envía las respuestas guardadas sin conexión (las de todos los alumnos del aparato) y se trae las lecciones nuevas.
  const sincronizar = useCallback(async () => {
    if (enCurso.current) return
    enCurso.current = true
    setEstado('enviando')
    await recoger()
    const enviadas = leer('pendientes', []).filter(respuestaBienFormada)
    try {
      const r = await api('/api/sync', {
        method: 'POST',
        body: {
          alumno_id: alumno.id, respuestas: enviadas, dudas: leer('dudas-pendientes', []),
          version: leer(`clases:${alumno.id}`, null) ? leer(`version:${alumno.id}`, null) : null,
        },
      })
      const recibidas = new Set(r.recibidas)
      // Las respuestas que se dieron mientras se enviaba se quedan para la próxima vez.
      const quedan = leer('pendientes', []).filter(p => respuestaBienFormada(p) && !recibidas.has(p.id))
      guardar('pendientes', quedan)
      setPendientes(quedan.length)
      if (r.clases) {
        setClases(r.clases)
        guardar(`clases:${alumno.id}`, r.clases) // así las lecciones se pueden usar sin conexión
      }
      const dudasRecibidas = new Set(r.dudas_recibidas)
      const dudasQuedan = leer('dudas-pendientes', []).filter(d => !dudasRecibidas.has(d.id))
      guardar('dudas-pendientes', dudasQuedan)
      setDudasCola(dudasQuedan)
      guardar(`dudas:${alumno.id}`, r.dudas)
      setDudas(r.dudas)
      guardar(`version:${alumno.id}`, r.version)
      const ahora = new Date().toISOString()
      guardar(`actualizado:${alumno.id}`, ahora)
      setActualizado(ahora)
      setEstado('ok')
    } catch (e) {
      setEstado(e.message === SIN_CONEXION ? 'sin-conexion' : 'error')
    } finally {
      enCurso.current = false
    }
  }, [alumno.id, recoger])

  // Mientras espera la respuesta a una duda, pregunta cada 5 segundos en vez de cada 30.
  const esperando = dudasCola.some(d => d.alumno === alumno.id) || dudas.some(d => !d.respuesta)
  useEffect(() => {
    if (!esperando) return undefined
    const t = setInterval(sincronizar, 5000)
    return () => clearInterval(t)
  }, [esperando, sincronizar])

  useEffect(() => {
    sincronizar()
    const cada30s = setInterval(sincronizar, 30000)
    const desconectado = () => setEstado('sin-conexion')
    const alVolver = () => { if (document.visibilityState === 'visible') sincronizar() }
    const delServiceWorker = (e) => { if (e.data === 'mochila-sincronizada') recoger() }
    window.addEventListener('online', sincronizar)
    window.addEventListener('offline', desconectado)
    document.addEventListener('visibilitychange', alVolver)
    navigator.serviceWorker?.addEventListener('message', delServiceWorker)
    return () => {
      clearInterval(cada30s)
      window.removeEventListener('online', sincronizar)
      window.removeEventListener('offline', desconectado)
      document.removeEventListener('visibilitychange', alVolver)
      navigator.serviceWorker?.removeEventListener('message', delServiceWorker)
    }
  }, [sincronizar, recoger])

  // Lo que lleva hecho en cada lección, para decirle cuál le toca.
  const apuntar = (leccionId, datos) => {
    const todo = leer(clave('progreso'), {})
    const nuevo = { ...todo, [leccionId]: { ...todo[leccionId], ...datos } }
    guardar(clave('progreso'), nuevo)
    setProgreso(nuevo)
  }

  // La duda se guarda en el móvil y viaja con la sincronización: sirve también sin conexión.
  const preguntar = (leccionId, pregunta) => {
    const cola = [...leer('dudas-pendientes', []), { id: nuevoId(), alumno: alumno.id, leccion_id: leccionId, pregunta, fecha: new Date().toISOString() }]
    guardar('dudas-pendientes', cola)
    setDudasCola(cola)
    sincronizar()
  }
  const dudasDe = (leccionId) => {
    const delServidor = dudas.filter(d => d.leccion_id === leccionId)
    const ids = new Set(delServidor.map(d => d.id))
    return [...delServidor, ...dudasCola.filter(d => d.alumno === alumno.id && d.leccion_id === leccionId && !ids.has(d.id))]
  }

  if (otraClase) {
    return <AlumnoOtraClase alumno={alumno} onVolver={() => setOtraClase(false)} onDentro={() => { setOtraClase(false); sincronizar() }} />
  }

  const barra = <BarraEnvio estado={estado} pendientes={pendientes} />
  if (leccion) {
    return (
      <>
        {barra}
        <AlumnoLeccion leccion={leccion} alumnoId={alumno.id} onVolver={() => { setLeccion(null); window.scrollTo(0, 0) }}
          onRespuesta={() => { setPendientes(leer('pendientes', []).length); apuntar(leccion.id, { empezada: true }) }}
          onTerminar={(aciertos, total) => { apuntar(leccion.id, { hecha: true, aciertos, total }); sincronizar() }}
          dudas={dudasDe(leccion.id)} sinConexion={estado === 'sin-conexion'} onPreguntar={(texto) => preguntar(leccion.id, texto)} />
      </>
    )
  }

  const grupos = clases.map(c => [c, porMateria(c.lecciones, l => l.contenido?.materia)])
  const total = clases.reduce((n, c) => n + c.lecciones.length, 0)
  const toca = grupos.flatMap(([, g]) => g.flatMap(([, ls]) => ls)).find(l => !progreso[l.id]?.hecha)?.id

  return (
    <>
      {barra}
      <div className="pagina">
        <header className="cabecera">
          <span className="marca">Mochila</span>
          <button onClick={onSalir} className="boton boton-secundario boton-pequeno"><Icono nombre="salir" tam={20} />Salir</button>
        </header>
        <h1 className="titulo titulo-con-avatar"><Avatar nombre={alumno.nombre} />Hola, {alumno.nombre}</h1>
        {total > 0 && <ResumenDescargado lecciones={total} appGuardada={appGuardada} actualizado={actualizado} />}
        {clases.length === 0 && (
          <p className="frase">{estado === 'sin-conexion'
            ? 'Cuando haya conexión aparecerán tus clases.'
            : 'Todavía no estás en ninguna clase. Pulsa «Entrar en otra clase» y escribe el código que te dé tu profe.'}</p>
        )}

        {grupos.map(([c, materias]) => {
          const conTitulos = materias.length > 1 || (materias[0] && materias[0][0] !== 'General')
          return (
            <section key={c.codigo} className="seccion">
              <h2 className="seccion-titulo">{c.nombre}</h2>
              {c.lecciones.length === 0 && <p className="frase" style={{ marginTop: 0 }}>Tu profe todavía no ha publicado lecciones.</p>}
              {materias.map(([materia, lecciones]) => (
                <div key={materia}>
                  {conTitulos && <h3 className="subtitulo">{materia}</h3>}
                  <div className="lista">
                    {lecciones.map(l => {
                      const p = progreso[l.id]
                      return (
                        <button key={l.id} onClick={() => { setLeccion(l); window.scrollTo(0, 0) }} className={`fila ${l.id === toca ? 'fila-toca' : ''}`}>
                          <span className="fila-texto">
                            <span className="fila-titulo">{l.titulo}</span>
                            <span className="fila-detalle">
                              <span className="descargada"><IconoDescargado tam={18} />Descargada</span>
                              {p?.hecha
                                ? <span className="descargada"><Icono nombre="bien" tam={18} />Hecha · {p.aciertos} de {p.total}</span>
                                : <span>{p?.empezada ? 'Empezada' : 'Sin empezar'}</span>}
                              {dudasDe(l.id).length > 0 && <span className="descargada" style={{ color: 'var(--ocre)' }}><Icono nombre="duda" tam={18} />{plural(dudasDe(l.id).filter(d => d.respuesta).length, 'duda contestada', 'dudas contestadas')}</span>}
                            </span>
                          </span>
                          {l.id === toca ? <span className="insignia insignia-amarilla">Te toca</span> : <Icono nombre="seguir" className="icono-final" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </section>
          )
        })}

        <div className="botones" style={{ marginTop: 36 }}>
          <button onClick={sincronizar} disabled={estado === 'enviando'} className="boton boton-secundario boton-ancho">
            <Icono nombre="buscar" />{estado === 'enviando' ? 'Buscando…' : 'Buscar lecciones nuevas'}
          </button>
          <button onClick={() => setOtraClase(true)} className="boton boton-fantasma boton-ancho">Entrar en otra clase</button>
        </div>
        <p className="nota" style={{ textAlign: 'center', marginTop: 18 }}>Cuando termines, pulsa «Salir» para que pueda entrar otro estudiante.</p>
      </div>
    </>
  )
}

function AlumnoOtraClase({ alumno, onVolver, onDentro }) {
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const codigoLimpio = limpiarCodigo(codigo)

  const entrar = async (ev) => {
    ev.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await api(`/api/clases/${codigoLimpio}/unirse`, { method: 'POST', body: { alumno_id: alumno.id } })
      onDentro()
    } catch (e) {
      setError(e.message === SIN_CONEXION ? 'Para entrar en una clase nueva hace falta conexión con el ordenador de la clase.' : e.message)
      setEnviando(false)
    }
  }

  return (
    <div className="pagina">
      <header className="cabecera"><Volver onClick={onVolver} /></header>
      <h1 className="titulo">Entrar en otra clase</h1>
      <p className="frase">Escribe el código que te dé tu profe.</p>
      <form onSubmit={entrar} className="formulario" style={{ marginTop: 24 }}>
        <CampoCodigo valor={codigo} onCambio={setCodigo} />
        <Aviso texto={error} />
        <button type="submit" disabled={enviando || codigoLimpio.length !== 6} className="boton boton-principal boton-ancho boton-grande">
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

// La lección es un camino de 3 pasos: leer, ver un ejemplo y contestar las preguntas.
function AlumnoLeccion({ leccion, alumnoId, onVolver, onRespuesta, onTerminar, dudas, sinConexion, onPreguntar }) {
  const { lectura_facil, explicacion_ejemplo, preguntas } = leccion.contenido
  const [paso, setPaso] = useState(0)
  const [n, setN] = useState(0)
  const [elegida, setElegida] = useState(null)
  const [respondida, setRespondida] = useState(false)
  const [fallada, setFallada] = useState(null) // la opción del primer intento, si falló y hay pista
  const [aciertos, setAciertos] = useState(0)
  const [terminado, setTerminado] = useState(false)
  const pregunta = preguntas[n]
  const acierto = elegida === pregunta.correcta
  // Al fallar, antes de dar la solución, la lección enseña dónde está la respuesta (sin red).
  const pista = buscar(leccion.contenido, `${pregunta.pregunta} ${pregunta.opciones[pregunta.correcta]}`)

  const irA = (p) => { setPaso(p); window.scrollTo(0, 0) }

  const responder = () => {
    if (fallada !== null) return setRespondida(true) // segundo intento: no cuenta para la nota
    if (acierto) setAciertos(a => a + 1)
    const pendientes = leer('pendientes', [])
    pendientes.push({ id: nuevoId(), alumno: alumnoId, leccion_id: leccion.id, pregunta: n, respuesta: elegida, fecha: new Date().toISOString() })
    guardar('pendientes', pendientes)
    onRespuesta()
    if (!acierto && pista.length) { setFallada(elegida); setElegida(null) }
    else setRespondida(true)
  }

  const siguiente = () => {
    window.scrollTo(0, 0)
    if (n < preguntas.length - 1) {
      setN(n + 1)
      setElegida(null)
      setRespondida(false)
      setFallada(null)
    } else {
      setTerminado(true)
      onTerminar(aciertos, preguntas.length) // si hay conexión, la nota le llega al profe ya
    }
  }

  const repetir = () => { setN(0); setElegida(null); setRespondida(false); setFallada(null); setAciertos(0); setTerminado(false); window.scrollTo(0, 0) }

  return (
    <div className="pagina">
      <header className="cabecera"><Volver onClick={onVolver}>Mis lecciones</Volver></header>
      <h1 className="titulo">{leccion.titulo}</h1>

      <nav className="pasos" aria-label="Pasos de la lección">
        {['Leer', 'Ejemplo', 'Preguntas'].map((t, i) => (
          <button key={t} onClick={() => irA(i)} aria-current={i === paso ? 'step' : undefined}
            className={`paso ${i === paso ? 'paso-actual' : i < paso ? 'paso-hecho' : ''}`}>{i + 1}. {t}</button>
        ))}
      </nav>

      {paso < 2 && (
        <>
          <article className="hoja">
            <div className="hoja-arriba"><Escuchar key={paso} texto={paso === 0 ? lectura_facil : explicacion_ejemplo} /></div>
            <p className="hoja-texto">{paso === 0 ? lectura_facil : explicacion_ejemplo}</p>
          </article>
          <button onClick={() => irA(paso + 1)} className="boton boton-principal boton-ancho boton-grande" style={{ marginTop: 24 }}>
            {paso === 0 ? 'Ya lo he leído' : 'Ir a las preguntas'}<Icono nombre="seguir" />
          </button>
          <Dudas dudas={dudas} contenido={leccion.contenido} sinConexion={sinConexion} onPreguntar={onPreguntar} />
        </>
      )}

      {paso === 2 && terminado && (
        <div className="resultado">
          <p className="pregunta-num">Tu resultado</p>
          <p className="resultado-cifra"><mark>{aciertos} de {preguntas.length}</mark></p>
          <p className="resultado-texto">{aciertos === preguntas.length ? '¡Perfecto! Las has acertado todas.'
            : aciertos >= Math.ceil(preguntas.length * 0.6) ? 'Muy bien. Repasa las que has fallado.'
              : 'Vuelve a leer la lección y prueba otra vez.'}</p>
          <div className="botones">
            <button onClick={onVolver} className="boton boton-principal boton-ancho boton-grande">Volver a mis lecciones</button>
            <button onClick={repetir} className="boton boton-secundario boton-ancho">Repetir las preguntas</button>
            <button onClick={() => irA(0)} className="boton boton-fantasma boton-ancho">Volver a leer</button>
          </div>
          <p className="nota">Tus respuestas le llegan a tu profe cuando hay conexión.</p>
          <div style={{ textAlign: 'left' }}><Dudas dudas={dudas} contenido={leccion.contenido} sinConexion={sinConexion} onPreguntar={onPreguntar} /></div>
        </div>
      )}

      {paso === 2 && !terminado && (
        <>
          <p className="pregunta-num">Pregunta {n + 1} de {preguntas.length}</p>
          <h2 className="pregunta-texto">{pregunta.pregunta}</h2>
          <div className="opciones">
            {pregunta.opciones.map((opcion, i) => {
              const como = respondida
                ? (i === pregunta.correcta ? 'opcion-buena' : i === elegida ? 'opcion-mala' : 'opcion-apagada')
                : (i === fallada ? 'opcion-mala' : i === elegida ? 'opcion-elegida' : '')
              return (
                <button key={i} onClick={() => setElegida(i)} disabled={respondida || i === fallada} aria-pressed={i === elegida} className={`opcion ${como}`}>
                  <span className="letra">
                    {respondida && i === pregunta.correcta ? <Icono nombre="bien" tam={20} /> : (respondida && i === elegida) || (!respondida && i === fallada) ? <Icono nombre="mal" tam={20} /> : 'ABCD'[i]}
                  </span>
                  <span>{opcion}</span>
                </button>
              )
            })}
          </div>
          {!respondida && fallada !== null && (
            <div role="status" className="aviso aviso-atencion" style={{ marginTop: 22 }}>
              <strong>No es esa. Te doy una pista.</strong>
              <span style={{ display: 'block', marginTop: 4 }}>Mira lo que dice la lección:</span>
              {pista.map((t, i) => <span key={i} style={{ display: 'block', marginTop: 6 }}>«{t.texto}» <span className="nota">(en «{t.parte}»)</span></span>)}
              <div style={{ marginTop: 10 }}><Escuchar key={n} texto={pista.map(t => t.texto).join(' ')} /></div>
            </div>
          )}
          {!respondida
            ? <button onClick={responder} disabled={elegida === null} className="boton boton-principal boton-ancho boton-grande" style={{ marginTop: 22 }}>{fallada === null ? 'Comprobar' : 'Probar otra vez'}</button>
            : (
              <>
                <div role="status" className={`aviso ${acierto ? 'aviso-ok' : 'aviso-error'}`} style={{ marginTop: 22 }}>
                  <strong>{acierto ? '¡Bien hecho!' : 'No es esa.'}</strong>
                  {!acierto && <span style={{ display: 'block', marginTop: 4 }}>La buena es la {'ABCD'[pregunta.correcta]}: «{pregunta.opciones[pregunta.correcta]}»</span>}
                  {pregunta.porque && <span style={{ display: 'block', marginTop: 6 }}>{pregunta.porque}</span>}
                </div>
                <button onClick={siguiente} className="boton boton-principal boton-ancho boton-grande">
                  {n < preguntas.length - 1 ? 'Siguiente pregunta' : 'Ver mi resultado'}<Icono nombre="seguir" />
                </button>
              </>
            )}
        </>
      )}
    </div>
  )
}

// «Tengo una duda»: la pregunta se guarda en el móvil y se envía al sincronizar; la contesta la IA del ordenador
// de la clase solo con lo que dice la lección, y el profe la ve (y puede cambiar la respuesta).
function Dudas({ dudas, contenido, sinConexion, onPreguntar }) {
  const [abierta, setAbierta] = useState(false)
  const [texto, setTexto] = useState('')
  const campo = useRef(null)
  // Para quien escribe con dificultad: la duda ya empieza escrita y solo falta la palabra.
  const empezar = (inicio) => { setTexto(inicio); campo.current?.focus() }

  const enviar = (ev) => {
    ev.preventDefault()
    onPreguntar(texto.trim())
    setTexto('')
    setAbierta(false)
  }

  return (
    <section className="seccion">
      {dudas.length > 0 && (
        <>
          <h2 className="seccion-titulo">Mis dudas</h2>
          <div style={{ marginBottom: 16 }}>
            {dudas.map(d => (
              <div key={d.id} className="tarjeta duda">
                <p className="duda-pregunta">{d.pregunta}</p>
                {d.respuesta
                  ? <><p className="duda-respuesta">{d.respuesta}{d.corregida ? <span className="nota" style={{ display: 'block' }}>Te lo ha contestado tu profe.</span> : null}</p><div style={{ marginTop: 10 }}><Escuchar texto={d.respuesta} /></div></>
                  : <EnLaLeccion contenido={contenido} pregunta={d.pregunta} nota={sinConexion ? 'Se enviará cuando haya conexión.' : 'Esperando la respuesta…'} />}
              </div>
            ))}
          </div>
        </>
      )}
      {abierta
        ? (
          <form onSubmit={enviar} className="formulario">
            <div className="campo-grupo">
              <label htmlFor="duda-texto" className="etiqueta">¿Qué no has entendido?</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {['¿Qué es ', 'No entiendo ', '¿Por qué '].map(inicio => (
                  <button key={inicio} type="button" onClick={() => empezar(inicio)} className="boton boton-secundario boton-pequeno">{inicio.trim()}…</button>
                ))}
              </div>
              <textarea id="duda-texto" ref={campo} className="campo" rows={3} maxLength={300} autoFocus value={texto} onChange={e => setTexto(e.target.value)}
                style={{ minHeight: 110 }} />
              <p className="pista">Pregunta sobre esta lección. Te contesta Mochila con lo que dice la lección, y tu profe también lo verá.</p>
            </div>
            <div className="botones-fila">
              <button type="button" onClick={() => setAbierta(false)} className="boton boton-fantasma">Cancelar</button>
              <button type="submit" disabled={texto.trim().length < 3} className="boton boton-secundario">Enviar mi duda</button>
            </div>
          </form>
        )
        : <button onClick={() => setAbierta(true)} className="boton boton-secundario boton-ancho"><Icono nombre="duda" />Tengo una duda</button>}
    </section>
  )
}

// Mientras no llega la respuesta de la IA de la clase, el móvil busca en la lección, sin internet.
function EnLaLeccion({ contenido, pregunta, nota }) {
  const trozos = buscar(contenido, pregunta)
  return (
    <>
      {trozos.length > 0 && <p className="nota" style={{ marginTop: 10 }}>Mientras tanto, esto dice la lección:</p>}
      {trozos.map((t, i) => <p key={i} className="duda-respuesta">{t.texto} <span className="nota">(en «{t.parte}»)</span></p>)}
      {trozos.length > 0 && <div style={{ marginTop: 10 }}><Escuchar texto={trozos.map(t => t.texto).join(' ')} /></div>}
      <p className="nota" style={{ marginTop: 10 }}>{nota}</p>
    </>
  )
}

// Lee en voz alta con la voz del propio móvil (sin internet si el móvil tiene la voz instalada).
function Escuchar({ texto }) {
  const [sonando, setSonando] = useState(false)
  const hayVoz = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => () => { if (hayVoz) window.speechSynthesis.cancel() }, [hayVoz]) // al salir, que se calle

  if (!hayVoz) return null

  const alternar = () => {
    window.speechSynthesis.cancel()
    if (sonando) { setSonando(false); return }
    const voz = new SpeechSynthesisUtterance(texto)
    voz.lang = 'es-ES'
    voz.rate = 0.9
    voz.onend = () => setSonando(false)
    voz.onerror = () => setSonando(false)
    window.speechSynthesis.speak(voz)
    setSonando(true)
  }

  return (
    <button onClick={alternar} aria-pressed={sonando} className="boton boton-secundario boton-pequeno">
      <Icono nombre={sonando ? 'parar' : 'altavoz'} tam={20} />{sonando ? 'Parar' : 'Escuchar'}
    </button>
  )
}

export default App
