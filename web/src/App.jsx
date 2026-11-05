import { useState, useEffect, useRef, useCallback } from 'react'
import '@fontsource-variable/archivo/wght.css'
import './estilo.css'
import {
  COLOR, SIN_CONEXION, api, leer, guardar, guardarPin, nuevoId, reducirFoto, Cargando, Aviso, Icono, tomarDelSegundoPlano, hashLocal,
} from './comun.jsx'
import PanelClase from './Panel.jsx'
import { t, plural, idioma, IDIOMAS, cambiarIdioma } from './idioma.js'
import { buscar } from './tutorBuscar.js'

// shortcut: libera los 150 MB del ayudante que se probó y se quitó (rama tutor-offline); se puede borrar cuando ningún móvil lo tenga.
try { globalThis.caches?.delete('transformers-cache'); localStorage.removeItem('ayudante') } catch { /* sin almacenamiento */ }

// Si sale una versión nueva, su service worker toma el control: se recarga una vez para no seguir con la vieja.
if (navigator.serviceWorker?.controller) navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload())
// La app instalada no recarga la página al volver a ella: al abrirla de nuevo o al volver la red, mira si hay versión nueva.
const buscarVersion = () => navigator.serviceWorker?.getRegistration().then(r => r?.update()).catch(() => {})
document.addEventListener('visibilitychange', () => { if (!document.hidden) buscarVersion() })
window.addEventListener('online', buscarVersion)

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

function Volver({ onClick, disabled, children }) {
  return <button className="boton boton-fantasma volver" onClick={onClick} disabled={disabled}><Icono nombre="volver" />{children ?? t('Volver')}</button>
}

// El botón ⋮ a la derecha de una fila: abre debajo sus opciones. Cada opción es [texto, acción, peligrosa].
function Menu({ nombre, opciones }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div className="menu">
      <button className="boton boton-secundario menu-boton" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}
        aria-label={t('Opciones de «{nombre}»', { nombre })}>⋮</button>
      {abierto && (
        <div className="menu-lista">
          {opciones.map(([texto, accion, peligrosa]) => (
            <button key={texto} className={`boton boton-secundario ${peligrosa ? 'menu-peligro' : ''}`} onClick={() => { setAbierto(false); accion() }}>{texto}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Inicio ----------
function App() {
  // Con la sesión del profe abierta se entra directo en sus clases: solo se sale con «Salir».
  const [vista, setVista] = useState(() => leer('profe-sesion', null) ? 'profe' : 'inicio')
  const [conectado, setConectado] = useState(null)
  const [lengua, setLengua] = useState(idioma())

  useEffect(() => {
    api('/api/salud').then(() => setConectado(true)).catch(() => setConectado(false))
  }, [vista])

  if (vista === 'profe') return <VistaProfe onVolver={() => setVista('inicio')} />
  if (vista === 'alumno') return <VistaAlumno onVolver={() => setVista('inicio')} />

  return (
    <div className="pagina">
      <header className="cabecera">
        <span className="marca">Mochila</span>
        <select aria-label="Idioma · Language · Langue" className="campo selector-idioma" value={lengua}
          onChange={e => { cambiarIdioma(e.target.value); setLengua(e.target.value) }}>
          {IDIOMAS.map(i => <option key={i.codigo} value={i.codigo}>{i.bandera} {i.nombre}</option>)}
        </select>
      </header>
      <h1 className="titulo" style={{ marginTop: 20 }}>{t('Aprende aunque')} <mark>{t('no haya conexión')}</mark>.</h1>
      <p className="frase">{t('Las lecciones se quedan guardadas en el móvil. Tus respuestas le llegan a tu profe cuando vuelve la red.')}</p>

      <div className="botones" style={{ marginTop: 32 }}>
        <button className="eleccion eleccion-principal" onClick={() => setVista('alumno')}>
          <span><span className="eleccion-titulo">{t('Soy estudiante')}</span><span className="eleccion-detalle">{t('Mis lecciones y mis preguntas')}</span></span>
          <Icono nombre="seguir" tam={30} className="icono-final" />
        </button>
        <button className="eleccion" onClick={() => setVista('profe')}>
          <span><span className="eleccion-titulo">{t('Soy profe')}</span><span className="eleccion-detalle">{t('Crear clases y lecciones')}</span></span>
          <Icono nombre="seguir" tam={30} className="icono-final" />
        </button>
      </div>

      <p className="nota" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 28 }}>
        <span className="punto" style={{ background: conectado ? COLOR.verde : conectado === false ? COLOR.suave : COLOR.amarillo }} />
        {conectado === null ? t('Buscando el ordenador de la clase…') : conectado ? t('Conectado con el ordenador de la clase') : t('Sin conexión: puedes usar lo que ya está descargado')}
      </p>
    </div>
  )
}

// ---------- Profe ----------
// Sin conexión el profe ve lo último que descargó y puede dejar lecciones «por preparar» (fotos y texto)
// en «profe-pendientes». Al volver la conexión se leen las fotos, la IA prepara cada una y quedan como borrador.
const leerPendientesProfe = () => leer('profe-pendientes', [])
function guardarPendientesProfe(lista) {
  guardar('profe-pendientes', lista)
  window.dispatchEvent(new Event('profe-pendientes'))
  return JSON.stringify(leerPendientesProfe()) === JSON.stringify(lista) // false: no cabe en el aparato
}
const cambiarPendienteProfe = (item) => guardarPendientesProfe(leerPendientesProfe().map(p => p.id === item.id ? item : p))

// Cambios a lecciones ya preparadas (publicadas o borradores) hechos sin conexión: el último de cada una.
const leerCambiosProfe = () => leer('profe-cambios', [])
function guardarCambiosProfe(lista) {
  guardar('profe-cambios', lista)
  window.dispatchEvent(new Event('profe-pendientes'))
  return JSON.stringify(leerCambiosProfe()) === JSON.stringify(lista) // false: no cabe en el aparato
}
const guardarCambioProfe = (cambio) => {
  const antes = leerCambiosProfe().find(c => c.id === cambio.id)
  return guardarCambiosProfe([...leerCambiosProfe().filter(c => c.id !== cambio.id), { ...cambio, publicar: cambio.publicar || !!antes?.publicar }])
}

// Lo mismo que comprueba la API (leccion_valida), para avisar ya sin conexión.
const textoLleno = (t) => typeof t === 'string' && t.trim() !== ''
const leccionValida = (l) => ['titulo', 'lectura_facil', 'explicacion_ejemplo'].every(k => textoLleno(l[k]))
  && new Set(l.preguntas.map(p => p.pregunta.trim().toLowerCase())).size === l.preguntas.length
  && l.preguntas.every(p => textoLleno(p.pregunta) && p.opciones.every(textoLleno) && new Set(p.opciones.map(o => o.trim().toLowerCase())).size === 4)

function useEnAparato(leerLista) {
  const [lista, setLista] = useState(leerLista)
  useEffect(() => {
    const ver = () => setLista(leerLista())
    window.addEventListener('profe-pendientes', ver)
    return () => window.removeEventListener('profe-pendientes', ver)
  }, [leerLista])
  return lista
}
const usePendientesProfe = () => useEnAparato(leerPendientesProfe)
const useCambiosProfe = () => useEnAparato(leerCambiosProfe)

// Errores que se arreglan solos (sin red, IA apagada u ocupada): se vuelve a probar más tarde.
const esPasajero = (e) => e.message === SIN_CONEXION || !e.estado || e.estado >= 500 || e.estado === 429
// La IA ha contestado con un error (apagada, lenta o mal): se dice al momento, no se deja esperando en «Por preparar».
const fallaLaIa = (e) => typeof e.detalle === 'string' && e.estado >= 502 && e.estado <= 504

// Las fotos las lee la IA; los PDF, Word, PowerPoint… los abre la API y saca su texto.
const esImagen = (datos) => datos.startsWith('data:image/')
const leerAdjunto = (codigo, datos) => esImagen(datos)
  ? api(`/api/clases/${encodeURIComponent(codigo)}/leer-foto`, { method: 'POST', body: { imagen: datos } })
  : api(`/api/clases/${encodeURIComponent(codigo)}/leer-archivo`, { method: 'POST', body: { archivo: datos } })

const leerComoDatos = (archivo) => new Promise((resolve, reject) => {
  const lector = new FileReader()
  lector.onload = () => resolve(lector.result)
  lector.onerror = () => reject(new Error(`No se puede abrir «${archivo.name}».`))
  lector.readAsDataURL(archivo)
})

// Lee las fotos y archivos que falten y prepara la lección. Tras cada foto llama a alAvanzar con lo que lleva, para no repetirla.
async function prepararLeccion(item, alAvanzar) {
  while (item.fotos.length) {
    const r = await leerAdjunto(item.codigo, item.fotos[0])
    item = { ...item, texto: (item.texto.trim() ? item.texto.trim() + '\n\n' : '') + r.texto, fotos: item.fotos.slice(1) }
    alAvanzar(item)
  }
  return api(`/api/clases/${encodeURIComponent(item.codigo)}/lecciones`, { method: 'POST', body: { texto: item.texto, materia: item.materia, titulo: item.titulo || '', idioma: item.idioma || 'es', nivel: item.nivel ?? 1, preguntas: item.preguntas, dificultad_preguntas: item.dificultad_preguntas, id: item.id } })
}

// La IA tarda minutos y Cloudflare corta la espera a los 100 s, aunque la API siga trabajando: se le va preguntando.
// Devuelve la lección cuando está. Si de verdad no hay conexión, lanza SIN_CONEXION; si la IA ha dejado de prepararla, lo dice.
async function esperarLeccion(item) {
  for (let fallos = 0; fallos < 3;) {
    try {
      const clase = await api(`/api/clases/${encodeURIComponent(item.codigo)}`)
      fallos = 0
      if (clase.lecciones.some(l => l.id === item.id)) return prepararLeccion(item) // ya está hecha: la API la devuelve sin volver a prepararla
      if (!clase.preparando?.includes(item.id)) throw Object.assign(new Error('La IA no ha podido preparar la lección. Prueba otra vez.'), { estado: 409 })
    } catch (e) {
      if (!esPasajero(e)) throw e
      fallos++
    }
    await new Promise(seguir => setTimeout(seguir, 10000))
  }
  throw new Error(SIN_CONEXION)
}

let preparandoPendientes = false
async function prepararPendientesProfe() {
  if (preparandoPendientes) return
  preparandoPendientes = true
  try {
    for (const c of leerCambiosProfe().filter(c => !c.error)) {
      try {
        await api(`/api/clases/${encodeURIComponent(c.codigo)}/lecciones/${c.id}`, { method: 'PUT', body: { leccion: c.leccion, publicar: c.publicar } })
        // Solo se quita si el profe no lo ha vuelto a cambiar mientras se enviaba.
        const ahora = leerCambiosProfe()
        if (JSON.stringify(ahora.find(x => x.id === c.id)) === JSON.stringify(c)) guardarCambiosProfe(ahora.filter(x => x.id !== c.id))
      } catch (e) {
        if (esPasajero(e)) return
        guardarCambioProfe({ ...c, error: e.message })
      }
    }
    // Las lecciones «por preparar» ya no se preparan solas (sin cola de la IA): el profe pulsa «Preparar ahora».
  } finally {
    preparandoPendientes = false
  }
}

function VistaProfe({ onVolver }) {
  // El profe sigue dentro en este aparato hasta que pulsa «Salir» (así abre sus clases también sin conexión).
  const [sesion, setSesion] = useState(() => leer('profe-sesion', null))
  const [pantalla, setPantalla] = useState('clases')
  const [codigo, setCodigo] = useState(null)
  const [editando, setEditando] = useState(null) // { id, leccion, publicada, cambio }
  const [porPreparar, setPorPreparar] = useState(null) // la lección «por preparar» que se edita
  const [materiaNueva, setMateriaNueva] = useState('') // la materia en la que se crea la lección
  const [avisoClase, setAvisoClase] = useState('') // «Publicada…» al volver de revisar una lección
  const salir = useCallback(() => {
    try { localStorage.removeItem('profe-sesion') } catch { /* nada */ }
    setSesion(null)
  }, [])

  useEffect(() => {
    if (!sesion) return undefined
    prepararPendientesProfe()
    window.addEventListener('online', prepararPendientesProfe)
    const t = setInterval(prepararPendientesProfe, 30000)
    return () => { window.removeEventListener('online', prepararPendientesProfe); clearInterval(t) }
  }, [sesion])

  const abrirClase = (c) => { setCodigo(c); setPantalla('clase') }
  const editar = (datos) => { setEditando(datos); setPantalla('revisar') }

  if (pantalla === 'clase') {
    return <ProfeClase codigo={codigo} aviso={avisoClase} onVolver={() => { setAvisoClase(''); setPantalla('clases') }} onNueva={(m) => { setAvisoClase(''); setPorPreparar(null); setMateriaNueva(m.slice(0, 40)); setPantalla('nueva') }} onNotas={() => setPantalla('notas')} onEditar={editar}
      onEditarPendiente={(p) => { setPorPreparar(p); setPantalla('nueva') }} />
  }
  if (pantalla === 'notas') {
    return <PanelClase codigo={codigo} onVolver={() => setPantalla('clase')} />
  }
  if (pantalla === 'nueva') {
    return <ProfeNuevaLeccion codigo={codigo} materia={porPreparar?.materia || materiaNueva} inicial={porPreparar} onVolver={() => setPantalla('clase')} onCreada={editar} />
  }
  if (pantalla === 'revisar' && editando) {
    return <ProfeRevisar codigo={codigo} inicial={editando} onVolver={(aviso = '') => { setAvisoClase(aviso); setPantalla('clase'); window.scrollTo(0, 0) }} />
  }
  if (!sesion) return <ProfeEntrar onEntrar={(s) => { guardar('profe-sesion', s); setSesion(s) }} onVolver={onVolver} />
  return <ProfeClases profe={sesion} onAbrir={abrirClase} onSalir={salir} />
}

function ProfeEntrar({ onEntrar, onVolver }) {
  const [nueva, setNueva] = useState(false)
  const [nombre, setNombre] = useState('')
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (ev) => {
    ev.preventDefault()
    setError('')
    setEnviando(true)
    try {
      onEntrar(await api(nueva ? '/api/profes' : '/api/profes/entrar', { method: 'POST', body: { nombre, usuario, contrasena } }))
    } catch (e) {
      setError(e.message === SIN_CONEXION ? 'Para entrar la primera vez hace falta conexión con el ordenador de la clase.' : e.message)
      setEnviando(false)
    }
  }

  return (
    <div className="pagina">
      <header className="cabecera"><Volver onClick={onVolver} /></header>
      <h1 className="titulo">{nueva ? t('Crear mi cuenta de profe') : t('Entrar como profe')}</h1>
      <p className="frase">{nueva ? t('Con tu cuenta verás todas tus clases en cualquier móvil o tablet.') : t('Escribe tu usuario y tu contraseña para ver tus clases.')}</p>
      <form onSubmit={enviar} className="formulario" style={{ marginTop: 24 }}>
        {nueva && (
          <div className="campo-grupo">
            <label htmlFor="profe-nombre" className="etiqueta">{t('Tu nombre')}</label>
            <input id="profe-nombre" className="campo" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={60} autoComplete="name" />
          </div>
        )}
        <div className="campo-grupo">
          <label htmlFor="profe-usuario" className="etiqueta">{t('Usuario')}</label>
          <input id="profe-usuario" className="campo" value={usuario} onChange={e => setUsuario(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} maxLength={20}
            autoCapitalize="off" autoComplete="username" autoCorrect="off" spellCheck={false} style={{ fontSize: 24 }} />
          {nueva && <p className="pista">{t('Solo letras y números, sin espacios.')}</p>}
        </div>
        <div className="campo-grupo">
          <label htmlFor="profe-contrasena" className="etiqueta">{t('Contraseña')}</label>
          <CampoContrasena id="profe-contrasena" valor={contrasena} onCambio={setContrasena} nueva={nueva} />
          {nueva && <p className="pista">{t('Al menos 4 letras o números.')}</p>}
        </div>
        <Aviso texto={error} />
        <button type="submit" disabled={enviando || (nueva && !nombre.trim()) || !usuarioValido(usuario) || contrasena.length < 4} className="boton boton-principal boton-ancho boton-grande">
          {enviando ? t('Un momento…') : nueva ? t('Crear y entrar') : t('Entrar')}
        </button>
      </form>
      <button onClick={() => { setNueva(!nueva); setError('') }} className="boton boton-secundario boton-ancho" style={{ marginTop: 16 }}>
        {nueva ? t('Ya tengo cuenta') : t('Crear mi cuenta de profe')}
      </button>
    </div>
  )
}

// Buscar alumnos para meterlos en la clase nueva: los de tus otras clases por nombre o usuario, y cualquier otro con su usuario exacto.
function ElegirAlumnos({ elegidos, onCambio }) {
  const [buscado, setBuscado] = useState('')
  const [encontrados, setEncontrados] = useState([])
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    const q = buscado.trim()
    if (!q) { setEncontrados([]); setAviso(''); return }
    let vale = true
    const espera = setTimeout(() => {
      api(`/api/profes/alumnos?q=${encodeURIComponent(q)}`)
        .then(r => { if (vale) { setEncontrados(r); setAviso(r.length ? '' : 'No hay nadie con ese nombre en tus clases. Si es nuevo, escribe su usuario exacto.') } })
        .catch(e => { if (vale) { setEncontrados([]); setAviso(esPasajero(e) ? 'Para buscar alumnos hace falta conexión.' : e.message) } })
    }, 300) // espera a que acabe de escribir
    return () => { vale = false; clearTimeout(espera) }
  }, [buscado])

  const quedan = encontrados.filter(a => !elegidos.some(e => e.id === a.id))
  return (
    <div className="campo-grupo">
      <label htmlFor="buscar-alumnos" className="etiqueta">{t('Alumnos (si quieres)')}</label>
      <input id="buscar-alumnos" className="campo" type="search" value={buscado} onChange={e => setBuscado(e.target.value)}
        autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={t('Busca por nombre o usuario')} />
      {aviso && <p className="pista">{t(aviso)}</p>}
      {quedan.length > 0 && (
        <div className="elegir-lista">
          {quedan.map(a => (
            <button key={a.id} type="button" className="boton boton-secundario boton-pequeno elegir-alumno" onClick={() => onCambio([...elegidos, a])}>
              <Icono nombre="mas" tam={20} /><span className="elegir-texto">{a.nombre} <span className="nota">· {a.usuario}</span></span>
            </button>
          ))}
        </div>
      )}
      {elegidos.length > 0 && (
        <>
          <p className="subtitulo" style={{ margin: '16px 0 8px' }}>{plural(elegidos.length, 'Entra {n} alumno', 'Entran {n} alumnos')}</p>
          <div className="elegir-lista">
            {elegidos.map(a => (
              <span key={a.id} className="elegido">
                <Avatar nombre={a.nombre} tam={32} />
                <span className="elegir-texto">{a.nombre} <span className="nota">· {a.usuario}</span></span>
                <button type="button" className="elegido-quitar" onClick={() => onCambio(elegidos.filter(e => e.id !== a.id))}
                  aria-label={t('Quitar a {nombre}', { nombre: a.nombre })}><Icono nombre="mal" tam={20} /></button>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ProfeClases({ profe, onAbrir, onSalir }) {
  const [clases, setClases] = useState(() => leer('profe-clases', null)) // la copia de la última vez, al momento
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [creando, setCreando] = useState(false)
  const [elegidos, setElegidos] = useState([]) // alumnos que entran ya en la clase nueva

  useEffect(() => {
    api('/api/profes/clases').then(c => { setClases(c); guardar('profe-clases', c) }).catch(e => {
      if (e.estado === 401) return onSalir() // ha cambiado la contraseña en otro aparato
      setError(esPasajero(e) ? 'Sin conexión: ves tus clases como estaban la última vez.' : e.message)
      setClases(c => c || [])
    })
  }, [onSalir])

  const pendientes = usePendientesProfe()

  const crear = async (ev) => {
    ev.preventDefault()
    setError('')
    setCreando(true)
    try {
      const clase = await api('/api/clases', { method: 'POST', body: { nombre, alumnos: elegidos.map(a => a.id) } })
      onAbrir(clase.codigo)
    } catch (e) {
      setError(e.message)
      setCreando(false)
    }
  }

  // Las clases de antes de las cuentas tienen PIN: con él pasan a ser tuyas.
  const traer = async (ev) => {
    ev.preventDefault()
    setError('')
    try {
      const clase = await api('/api/profes/clases', { method: 'POST', body: { codigo: limpiarCodigo(codigo), pin } })
      guardarPin(clase.codigo, pin)
      onAbrir(clase.codigo)
    } catch (e) {
      setError(e.message)
    }
  }

  const ocultarClase = async (c) => {
    try {
      await api(`/api/clases/${encodeURIComponent(c.codigo)}/oculta`, { method: 'PUT', body: { oculta: !c.oculta } })
      setClases(todas => { const nuevas = todas.map(x => x.codigo === c.codigo ? { ...x, oculta: c.oculta ? 0 : 1 } : x); guardar('profe-clases', nuevas); return nuevas })
    } catch (e) {
      setError(e.message)
    }
  }

  const borrarClase = async (c) => {
    if (!window.confirm(t('¿Eliminar la clase «{nombre}»? Se borran sus lecciones y las notas de sus alumnos. No se puede deshacer.', { nombre: c.nombre }))) return
    try {
      await api(`/api/clases/${encodeURIComponent(c.codigo)}`, { method: 'DELETE' })
      // Lo que quedara por enviar de esa clase ya no tiene adónde ir.
      guardarCambiosProfe(leerCambiosProfe().filter(x => x.codigo !== c.codigo))
      guardarPendientesProfe(leerPendientesProfe().filter(x => x.codigo !== c.codigo))
      setClases(todas => { const quedan = todas.filter(x => x.codigo !== c.codigo); guardar('profe-clases', quedan); return quedan })
    } catch (e) {
      setError(e.message)
    }
  }

  const hay = clases?.length > 0
  return (
    <div className="pagina">
      <header className="cabecera">
        <span className="marca">Mochila</span>
        <button onClick={onSalir} className="boton boton-secundario boton-pequeno"><Icono nombre="salir" tam={20} />{t('Salir')}</button>
      </header>
      <h1 className="titulo">{t('Hola, {nombre}', { nombre: profe.nombre })}</h1>
      <p className="frase">{t('Estas son tus clases. Cada una tiene un código: tus alumnos lo escriben para entrar.')}</p>

      <Aviso texto={error} />
      {clases === null && <Cargando texto={t('Cargando tus clases…')} />}
      {hay && (
        <div className="lista" style={{ marginTop: 24 }}>
          {clases.map(c => (
            <div key={c.codigo} className="fila-con-menu">
            <button className="fila" onClick={() => onAbrir(c.codigo)}>
              <span className="fila-texto">
                <span className="fila-titulo">{c.nombre}</span>
                <span className="fila-detalle">
                  <span className="insignia" style={{ fontFamily: 'var(--mono)', letterSpacing: '0.08em' }}>{c.codigo}</span>
                  {!!c.oculta && <span className="insignia">{t('Oculta')}</span>}
                  {plural(c.alumnos, '{n} alumno', '{n} alumnos')} · {plural(c.lecciones, '{n} lección', '{n} lecciones')}
                  {pendientes.some(p => p.codigo === c.codigo) && ` · ${t('{n} por preparar', { n: pendientes.filter(p => p.codigo === c.codigo).length })}`}
                </span>
              </span>
              <Icono nombre="seguir" className="icono-final" />
            </button>
            <Menu nombre={c.nombre} opciones={[
              [c.oculta ? t('Mostrar a los alumnos') : t('Ocultar a los alumnos'), () => ocultarClase(c)],
              [t('Eliminar la clase'), () => borrarClase(c), true],
            ]} />
            </div>
          ))}
        </div>
      )}

      <div className="lado-a-lado">
      <section className="seccion">
        <h2 className="seccion-titulo">{hay ? t('Crear otra clase') : t('Crea tu primera clase')}</h2>
        <form onSubmit={crear} className="tarjeta formulario">
          <div className="campo-grupo">
            <label htmlFor="nombre-clase" className="etiqueta">{t('Nombre de la clase')}</label>
            <input id="nombre-clase" className="campo" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={60} placeholder={t('Por ejemplo: 5.º A · Ciencias')} />
          </div>
          <ElegirAlumnos elegidos={elegidos} onCambio={setElegidos} />
          <button type="submit" disabled={!nombre.trim() || creando} className={`boton boton-ancho ${hay ? 'boton-secundario' : 'boton-principal'}`}>
            {creando ? t('Creando…') : t('Crear la clase')}
          </button>
        </form>
      </section>

      <section className="seccion">
        <h2 className="seccion-titulo">{t('¿Tienes una clase de antes, con PIN?')}</h2>
        <form onSubmit={traer} className="tarjeta formulario">
          <div className="campo-grupo">
            <label htmlFor="codigo-traer" className="etiqueta">{t('Código de la clase')}</label>
            <input id="codigo-traer" className="campo campo-codigo" value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} maxLength={12}
              autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="ABC123" />
          </div>
          <div className="campo-grupo">
            <label htmlFor="pin-traer" className="etiqueta">{t('El PIN de esa clase')}</label>
            <input id="pin-traer" className="campo campo-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={8}
              value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
          </div>
          <button type="submit" disabled={limpiarCodigo(codigo).length !== 6 || !pinValido(pin)} className="boton boton-secundario boton-ancho">{t('Añadirla a mis clases')}</button>
        </form>
      </section>
      </div>
    </div>
  )
}

function ProfeClase({ codigo, aviso, onVolver, onNueva, onNotas, onEditar, onEditarPendiente }) {
  const [clase, setClase] = useState(() => leer(`profe-clase:${codigo}`, null)) // la copia de la última vez, al momento
  const [error, setError] = useState('')
  const [pidePin, setPidePin] = useState(false)
  const [pin, setPin] = useState('')
  const [intentado, setIntentado] = useState(false)

  const cargar = useCallback(() => {
    api(`/api/clases/${encodeURIComponent(codigo)}`)
      .then(c => { setClase(c); setError(''); setPidePin(false); guardar(`profe-clase:${c.codigo}`, c) })
      .catch(e => {
        if (e.estado === 401 || e.estado === 429) { setClase(null); setPidePin(true) }
        setError(!esPasajero(e) ? e.message : 'Sin conexión: ves la clase como estaba la última vez. Las lecciones nuevas se prepararán al volver la conexión.')
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
    const nueva = window.prompt(t('Nueva contraseña para {nombre} (al menos 4 letras o números):', { nombre: a.nombre }))
    if (nueva === null) return
    try {
      await api(`/api/clases/${encodeURIComponent(codigo)}/alumnos/${a.id}/contrasena`, { method: 'PUT', body: { contrasena: nueva } })
      window.alert(t('Listo. Dile a {nombre} su usuario («{usuario}») y su nueva contraseña. La primera vez tendrá que entrar con conexión.', { nombre: a.nombre, usuario: a.usuario }))
    } catch (e) {
      window.alert(t(e.message))
    }
  }

  const cambiarRespuesta = async (d) => {
    const nueva = window.prompt(t('Tu respuesta a «{pregunta}»:', { pregunta: d.pregunta }), d.respuesta || '')
    if (!nueva?.trim()) return
    try {
      await api(`/api/clases/${encodeURIComponent(codigo)}/dudas/${d.id}`, { method: 'PUT', body: { respuesta: nueva } })
      cargar()
    } catch (e) {
      window.alert(t(e.message))
    }
  }

  const pendientes = usePendientesProfe().filter(p => p.codigo === codigo)
  // Los cambios sin enviar se ven ya, encima de lo que dice el ordenador de la clase.
  const cambios = useCambiosProfe()
  const conCambios = (l) => {
    const c = cambios.find(x => x.id === l.id)
    return c ? { ...l, titulo: c.leccion.titulo, materia: c.leccion.materia || l.materia, contenido: c.leccion, publicada: l.publicada || (c.publicar ? 1 : 0), cambio: c } : l
  }
  // La lección entera ya viene con la clase: se abre también sin conexión.
  const abrirLeccion = (l) => onEditar({ id: l.id, leccion: { ...l.contenido, materia: l.materia }, publicada: l.publicada, respondida: l.respondida, cambio: l.cambio })
  const cambiarLeccion = async (l, borrar) => {
    if (borrar && !window.confirm(t('¿Eliminar la lección «{titulo}»? Se borran también las notas y las dudas de tus alumnos. No se puede deshacer.', { titulo: l.titulo }))) return
    try {
      const ruta = `/api/clases/${encodeURIComponent(codigo)}/lecciones/${l.id}`
      await (borrar ? api(ruta, { method: 'DELETE' }) : api(`${ruta}/publicada`, { method: 'PUT', body: { publicada: !l.publicada } }))
      guardarCambiosProfe(borrar
        ? leerCambiosProfe().filter(x => x.id !== l.id) // su cambio sin enviar ya no tiene adónde ir
        : leerCambiosProfe().map(x => x.id === l.id ? { ...x, publicar: !l.publicada } : x)) // que al enviarse no la vuelva a publicar
      cargar()
    } catch (e) {
      setError(e.message)
    }
  }
  const quitarPendiente = (p) => {
    if (window.confirm(t('¿Quitar esta lección sin preparar? Se borran sus fotos y su texto de este aparato.'))) {
      guardarPendientesProfe(leerPendientesProfe().filter(x => x.id !== p.id))
    }
  }

  if (pidePin) {
    return (
      <div className="pagina">
        <header className="cabecera"><Volver onClick={onVolver}>{t('Mis clases')}</Volver></header>
        <h1 className="titulo">{t('Abrir la clase')}</h1>
        <p className="frase">{t('Escribe tu PIN de profe de la clase')} <strong style={{ fontFamily: 'var(--mono)' }}>{codigo}</strong>.</p>
        <form onSubmit={entrarConPin} className="formulario" style={{ marginTop: 24 }}>
          <div className="campo-grupo">
            <label htmlFor="pin-entrar" className="etiqueta">PIN</label>
            <input id="pin-entrar" className="campo campo-pin" type="password" inputMode="numeric" autoComplete="current-password" maxLength={8} autoFocus
              value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
          </div>
          <Aviso texto={intentado ? error : ''} />
          <button type="submit" disabled={!pinValido(pin)} className="boton boton-principal boton-ancho boton-grande">{t('Abrir la clase')}</button>
        </form>
      </div>
    )
  }

  if (!clase) {
    return (
      <div className="pagina">
        <header className="cabecera"><Volver onClick={onVolver}>{t('Mis clases')}</Volver></header>
        {error ? <Aviso texto={error} /> : <Cargando texto={t('Cargando la clase…')} />}
      </div>
    )
  }

  return (
    <div className="pagina">
      <header className="cabecera"><Volver onClick={onVolver}>{t('Mis clases')}</Volver></header>
      <h1 className="titulo">{clase.nombre}</h1>

      <div className="codigo-clase" style={{ marginTop: 20 }}>
        <span className="nota" style={{ margin: 0 }}>{t('Código para que entren tus alumnos')}</span>
        <span className="codigo-clase-texto">{clase.codigo}</span>
      </div>
      {!!clase.oculta && <p className="aviso aviso-atencion">{t('Esta clase está oculta: tus alumnos no la ven y su código no deja entrar. Para mostrarla, pulsa ⋮ en «Mis clases».')}</p>}

      <Aviso texto={error} />
      <Aviso texto={aviso} color={COLOR.verde} />

      <div className="botones-fila" style={{ marginTop: 20 }}>
        <button onClick={() => onNueva(clase.nombre)} className="boton boton-principal boton-grande"><Icono nombre="mas" />{t('Nueva lección')}</button>
        <button onClick={onNotas} className="boton boton-secundario boton-grande"><Icono nombre="notas" />{t('Ver notas')}</button>
      </div>

      {pendientes.length > 0 && (
        <section className="seccion">
          <h2 className="seccion-titulo">{t('Por preparar ({n})', { n: pendientes.length })}</h2>
          <p className="frase" style={{ marginTop: -4, marginBottom: 14 }}>{t('Cuando haya conexión con el ordenador de la clase, pulsa «Preparar ahora». Después las revisas y las publicas.')}</p>
          <div className="lista">
            {pendientes.map(p => (
              <div key={p.id} className="tarjeta">
                <p className="fila-titulo" style={{ margin: 0 }}>{p.titulo ? `${p.titulo} · ` : ''}{t(p.materia || 'General')} · {p.fotos.length ? plural(p.fotos.length, '{n} foto o archivo', '{n} fotos o archivos') : t('texto')}</p>
                <p className="nota" style={{ margin: '4px 0 0' }}>{p.texto.trim().slice(0, 80) || t('Sin texto todavía')}</p>
                {p.error && <Aviso texto={t('No se ha podido preparar: {error}', { error: t(p.error) })} />}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginLeft: -12 }}>
                  <button onClick={() => onEditarPendiente(p)} className="boton boton-fantasma boton-pequeno">{t('Preparar ahora')}</button>
                  <button onClick={() => quitarPendiente(p)} className="boton boton-fantasma boton-pequeno">{t('Quitar')}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="seccion">
        <h2 className="seccion-titulo">{t('Lecciones')}</h2>
        {clase.lecciones.length === 0 && <p className="frase" style={{ marginTop: 0 }}>{t('Todavía no hay lecciones. Pulsa «Nueva lección» y haz una foto a una página del libro.')}</p>}
        {porMateria(clase.lecciones.map(conCambios), l => l.materia).map(([materia, lecciones]) => (
          <div key={materia}>
            <h3 className="subtitulo">{t(materia)}</h3>
            <div className="lista">
              {lecciones.map(l => (
                <div key={l.id} className="fila-con-menu">
                  <button onClick={() => abrirLeccion(l)} className="fila">
                    <span className="fila-texto"><span className="fila-titulo">{l.titulo}</span></span>
                    {l.cambio && <span className="insignia">{l.cambio.error ? t('Error al guardar') : t('Sin enviar')}</span>}
                    <span className={`insignia ${l.publicada ? 'insignia-verde' : ''}`}>{l.publicada ? t('Publicada') : t('Borrador')}</span>
                    <Icono nombre="seguir" className="icono-final" />
                  </button>
                  <Menu nombre={l.titulo} opciones={[
                    [l.publicada ? t('Ocultar a los alumnos') : t('Publicar'), () => cambiarLeccion(l, false)],
                    [t('Eliminar la lección'), () => cambiarLeccion(l, true), true],
                  ]} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {clase.dudas?.length > 0 && (
        <section className="seccion">
          <h2 className="seccion-titulo">{t('Dudas de tus alumnos')}</h2>
          <p className="frase" style={{ marginTop: -4, marginBottom: 14 }}>{t('Las contesta Mochila con lo que dice la lección. Si una respuesta no te convence, cámbiala: le llegará al alumno.')}</p>
          {clase.dudas.map(d => (
            <div key={d.id} className="tarjeta duda">
              <p className="nota" style={{ marginTop: 0, marginBottom: 6 }}>{d.alumno} · {d.leccion} · {cuando(d.fecha)}</p>
              <p className="duda-pregunta">{d.pregunta}</p>
              {d.respuesta
                ? <p className="duda-respuesta">{t(d.respuesta)}</p>
                : <p className="nota">{t('Mochila todavía no la ha contestado.')}</p>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                {d.corregida ? <span className="insignia insignia-verde">{t('Contestada por ti')}</span> : null}
                <button onClick={() => cambiarRespuesta(d)} className="boton boton-fantasma boton-pequeno" style={{ marginLeft: -12 }}>{t('Cambiar la respuesta')}</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="seccion">
        <h2 className="seccion-titulo">{t('Alumnos ({n})', { n: clase.alumnos.length })}</h2>
        {clase.alumnos.length === 0
          ? <p className="frase" style={{ marginTop: 0 }}>{t('Todavía no ha entrado nadie. Diles el código de arriba.')}</p>
          : (
            <div className="tarjeta" style={{ padding: '2px 16px' }}>
              {clase.alumnos.map(a => (
                <div key={a.id} className="alumno-fila">
                  <span>
                    <span style={{ fontSize: 19, fontWeight: 650 }}>{a.nombre}</span>
                    {a.usuario && <span className="nota" style={{ display: 'block', marginTop: 2 }}>{t('Usuario: {usuario}', { usuario: a.usuario })}</span>}
                  </span>
                  {a.usuario && <button onClick={() => nuevaContrasena(a)} className="boton boton-secundario boton-pequeno">{t('Nueva contraseña')}</button>}
                </div>
              ))}
            </div>
          )}
      </section>
    </div>
  )
}

// Los mismos niveles que NIVELES de api/main.py: de lo más corto y sencillo a lo más extenso y técnico, según el tema.
const NIVELES = [
  { nombre: 'Lo esencial', pista: 'Solo la idea principal, muy corta y muy sencilla.' },
  { nombre: 'Básico', pista: 'Las ideas principales, con frases cortas.' },
  { nombre: 'Normal', pista: 'Lo que se espera en ese curso, con sus palabras técnicas explicadas.' },
  { nombre: 'Completo', pista: 'Todas las ideas del texto, con definiciones. Más largo.' },
  { nombre: 'Avanzado', pista: 'Técnico y detallado: cómo funciona, tipos, causas y consecuencias.' },
  { nombre: 'Experto', pista: 'Lo más extenso y técnico. Tarda más.' },
]

// Los mismos que DIFICULTAD_PREGUNTAS de api/main.py.
const DIFICULTADES = [
  { nombre: 'Muy fáciles', pista: 'Recordar un dato que sale tal cual en el texto.' },
  { nombre: 'Fáciles', pista: 'Recordar y entender las ideas principales.' },
  { nombre: 'Normales', pista: 'Entender lo que dice el texto, no copiar frases.' },
  { nombre: 'Algo difíciles', pista: 'Relacionar ideas de distintas partes del texto.' },
  { nombre: 'Difíciles', pista: 'Aplicar lo aprendido a un caso concreto o comparar conceptos.' },
  { nombre: 'Muy difíciles', pista: 'Razonar en varios pasos, con casos nuevos y excepciones. Las opciones malas son casi correctas.' },
]

// Barra para elegir un valor de una lista (nivel, preguntas…), con los valores debajo para tocarlos.
function Barra({ id, valores, valor, onCambio, disabled, nombre, extremos }) {
  const i = Math.max(0, valores.indexOf(valor))
  return (
    <div className="barra-nivel">
      <input id={id} type="range" min={0} max={valores.length - 1} step={1} value={i} onChange={e => onCambio(valores[Number(e.target.value)])}
        disabled={disabled} aria-valuetext={nombre(valor)} />
      <div className="barra-nivel-marcas" aria-hidden="true">
        {valores.map(v => <button key={v} type="button" tabIndex={-1} onClick={() => onCambio(v)} disabled={disabled} className={v === valor ? 'elegido' : ''}>{v}</button>)}
      </div>
      <div className="barra-nivel-extremos" aria-hidden="true"><span>{extremos[0]}</span><span>{extremos[1]}</span></div>
    </div>
  )
}

function ProfeNuevaLeccion({ codigo, materia, inicial, onVolver, onCreada }) {
  const MAX_FOTOS = 5
  // inicial: una lección «por preparar» que se edita (con su id, para que no se duplique).
  const [fotos, setFotos] = useState(() => (inicial?.fotos || []).map((datos, i) => ({ id: nuevoId(), nombre: inicial.nombres?.[i] || `Archivo ${i + 1}`, datos })))
  const [texto, setTexto] = useState(inicial?.texto || '')
  const [leidas, setLeidas] = useState(false)
  const [ocupado, setOcupado] = useState('') // qué está haciendo
  const [leyendo, setLeyendo] = useState(false) // para enseñar la espera junto a las fotos o junto al botón final
  const [error, setError] = useState('')
  const camara = useRef(null)
  const galeria = useRef(null)
  const documento = useRef(null)
  const [titulo, setTitulo] = useState(inicial?.titulo || '')
  const [ia, setIa] = useState(null)
  const [lenguaLeccion, setLenguaLeccion] = useState(inicial?.idioma || idioma())
  const [nivel, setNivel] = useState(inicial?.nivel ?? 2)
  const [cuantas, setCuantas] = useState(inicial?.preguntas ?? 5)
  const [dificultad, setDificultad] = useState(inicial?.dificultad_preguntas ?? 2)

  useEffect(() => {
    api('/api/salud').then(s => setIa(s.ia)).catch(() => {})
  }, [])

  const anadir = async (archivos) => {
    setError('')
    for (const archivo of Array.from(archivos || [])) {
      try {
        if (archivo.type.startsWith('text/plain') || /\.(txt|md|csv)$/i.test(archivo.name)) {
          // Un texto se pone directamente en el paso 3 (también sin conexión).
          const leido = (await archivo.text()).trim()
          setTexto(t => (t.trim() ? t.trim() + '\n\n' : '') + leido)
          setLeidas(true)
          continue
        }
        if (!archivo.type.startsWith('image/') && archivo.size > 10 * 1024 * 1024) throw new Error(`«${archivo.name}» pesa demasiado: como mucho 10 MB.`)
        const datos = archivo.type.startsWith('image/') ? await reducirFoto(archivo) : await leerComoDatos(archivo)
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
        const nombre = lista[i].nombre
        setOcupado(esImagen(lista[i].datos)
          ? (lista.length > 1 ? t('Leyendo la foto {i} de {n}…', { i: i + 1, n: lista.length }) : t('Leyendo la foto…'))
          : t('Leyendo «{nombre}»…', { nombre }))
        const r = await leerAdjunto(codigo, lista[i].datos)
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
    setOcupado(t(fotos.length ? 'Leyendo las fotos y los archivos y preparando la lección… Puede tardar entre 1 y 10 minutos, según el nivel y las preguntas elegidas. Ten paciencia.' : 'Preparando la lección… Puede tardar entre 1 y 10 minutos, según el nivel y las preguntas elegidas. Ten paciencia.'))
    // shortcut: si justo se está enviando la versión anterior en segundo plano, gana esa (mismo id); se corrige al revisarla.
    let item = { id: inicial?.id || nuevoId(), codigo, texto, materia, titulo, idioma: lenguaLeccion, nivel, preguntas: cuantas, dificultad_preguntas: dificultad, fotos: fotos.map(f => f.datos), nombres: fotos.map(f => f.nombre), fecha: new Date().toISOString() }
    try {
      const r = await prepararLeccion(item, (i) => { item = i }).catch((e) => {
        // 409: ya se estaba preparando (se pulsó otra vez o «Preparar ahora»). Pasajero: puede que solo se haya cortado la espera.
        if (e.estado !== 409 && (!esPasajero(e) || fallaLaIa(e))) throw e
        return esperarLeccion(item)
      })
      if (inicial) guardarPendientesProfe(leerPendientesProfe().filter(p => p.id !== item.id))
      onCreada({ id: r.id, leccion: r.leccion, publicada: 0 })
    } catch (e) {
      if (!esPasajero(e) || fallaLaIa(e)) {
        setTexto(item.texto) // lo que se haya leído de las fotos no se pierde
        setFotos(f => f.slice(f.length - item.fotos.length))
        setError(e.message)
        setOcupado('')
        return
      }
      // Sin conexión (o la IA apagada): se guarda en el aparato y se prepara sola más tarde.
      const antes = leerPendientesProfe() // si se está editando, la nueva sustituye a la de antes
      if (!guardarPendientesProfe([...antes.filter(p => p.id !== item.id), item])) {
        guardarPendientesProfe(antes)
        setError('No cabe en este aparato. Quita alguna foto o escribe el texto.')
        setOcupado('')
        return
      }
      window.alert(t('Sin conexión con el ordenador de la clase. La lección queda guardada en «Por preparar»: cuando vuelva la conexión, pulsa «Preparar ahora».'))
      onVolver()
    }
  }

  const suficiente = texto.trim().length >= 40 || fotos.length > 0
  const espera = ocupado && <Cargando texto={ocupado} />

  return (
    <div className="pagina">
      <header className="cabecera"><Volver onClick={onVolver} disabled={!!ocupado}>{t('La clase')}</Volver></header>
      <p className="subtitulo" style={{ margin: '0 0 4px' }}>{t(materia || 'General')}</p>
      <h1 className="titulo">{inicial ? t('Lección por preparar') : t('Nueva lección')}</h1>
      <p className="frase">{t('Haz una foto a una página del libro. Mochila la lee y prepara una lectura, un ejemplo y las preguntas. Tú la revisas antes de publicarla.')}</p>
      {ia === 'apagada' && (
        <p className="aviso aviso-atencion"><strong>{t('La lectura de fotos está apagada')}</strong>{t('Enciende Ollama en el ordenador de la clase. Mientras, puedes subir un archivo (PDF, Word…) o escribir el texto.')}</p>
      )}

      <section className="seccion">
        <h2 className="paso-profe"><span className="paso-profe-num">1</span><label htmlFor="titulo-leccion">{t('El título')}</label></h2>
        <input id="titulo-leccion" className="campo" value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={120}
          placeholder={t('Por ejemplo: Las ecuaciones')} disabled={!!ocupado} />
        <p className="pista">{t('Si lo dejas vacío, Mochila le pone uno.')}</p>
      </section>

      <section className="seccion">
        <h2 className="paso-profe"><span className="paso-profe-num">2</span>{t('Contenido')}</h2>
        <div className="botones-fila">
          <button onClick={() => camara.current.click()} disabled={!!ocupado || fotos.length >= MAX_FOTOS} className="boton boton-secundario"><Icono nombre="camara" />{t('Hacer una foto')}</button>
          <button onClick={() => galeria.current.click()} disabled={!!ocupado || fotos.length >= MAX_FOTOS} className="boton boton-secundario"><Icono nombre="fotos" />{t('Elegir fotos')}</button>
          <button onClick={() => documento.current.click()} disabled={!!ocupado || fotos.length >= MAX_FOTOS} className="boton boton-secundario"><Icono nombre="archivo" />{t('Subir un archivo')}</button>
        </div>
        <p className="pista">{t('Hasta {n}. Fotos de la página (que se vea entera y con buena luz), o un PDF, Word, PowerPoint, LibreOffice o texto.', { n: MAX_FOTOS })}</p>
        <input ref={camara} type="file" accept="image/*" capture="environment" onChange={alElegir} hidden />
        <input ref={galeria} type="file" accept="image/*" multiple onChange={alElegir} hidden />
        <input ref={documento} type="file" multiple onChange={alElegir} hidden
          accept=".pdf,.docx,.pptx,.odt,.odp,.txt,.md,.csv,.html,.htm,image/*,application/pdf,text/*" />

        {fotos.length > 0 && (
          <>
            <div className="fotos" style={{ marginTop: 16 }}>
              {fotos.map((f, i) => (
                <div key={f.id} className="tarjeta foto">
                  {esImagen(f.datos)
                    ? <img src={f.datos} alt={t('Foto {n}', { n: i + 1 })} />
                    : <p className="fila-titulo" style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 4px', wordBreak: 'break-word' }}><Icono nombre="archivo" />{f.nombre}</p>}
                  <button onClick={() => setFotos(fs => fs.filter(x => x.id !== f.id))} disabled={!!ocupado} className="boton boton-fantasma boton-ancho">{t('Quitar')}</button>
                </div>
              ))}
            </div>
            <button onClick={leerFotos} disabled={!!ocupado} className="boton boton-principal boton-ancho" style={{ marginTop: 16 }}>
              {!fotos.every(f => esImagen(f.datos))
                ? (fotos.length === 1 ? t('Leer el archivo') : t('Leer los {n} archivos', { n: fotos.length }))
                : (fotos.length === 1 ? t('Leer la foto') : t('Leer las {n} fotos', { n: fotos.length }))}
            </button>
          </>
        )}
        {leyendo && espera}
        <label htmlFor="texto-leccion" className="pista" style={{ display: 'block', margin: '20px 0 10px' }}>
          {leidas ? t('Esto es lo que pone en las fotos y archivos. Corrige lo que haga falta.') : t('Si no tienes foto ni archivo, escribe o pega aquí el texto o la información.')}
        </label>
        <textarea id="texto-leccion" className="campo" value={texto} onChange={e => setTexto(e.target.value)} rows={10} disabled={!!ocupado}
          placeholder={t('El texto de la página del libro…')} />
        {!suficiente && texto.trim() && <p className="pista">{t('Hace falta un poco más de texto: al menos un par de frases.')}</p>}
      </section>

      <section className="seccion">
        <h2 className="paso-profe"><span className="paso-profe-num">3</span><label htmlFor="nivel-leccion">{t('El nivel')}</label></h2>
        <Barra id="nivel-leccion" valores={[0, 1, 2, 3, 4, 5]} valor={nivel} onCambio={setNivel} disabled={!!ocupado}
          nombre={i => t(NIVELES[i].nombre)} extremos={[t('Más corto y sencillo'), t('Más extenso y técnico')]} />
        <p className="pista"><strong>{nivel} · {t(NIVELES[nivel].nombre)}.</strong> {t(NIVELES[nivel].pista)} {t('Va según el tema: un 4 de primaria es más fácil que un 2 de la universidad.')}</p>
      </section>

      <section className="seccion">
        <h2 className="paso-profe"><span className="paso-profe-num">4</span>{t('Las preguntas')}</h2>
        <label htmlFor="cuantas-preguntas" className="etiqueta" style={{ fontSize: 17 }}>{t('Cantidad')}</label>
        <Barra id="cuantas-preguntas" valores={[0, 5, 10, 15, 20, 25, 30]} valor={cuantas} onCambio={setCuantas} disabled={!!ocupado}
          nombre={i => plural(i, '{n} pregunta', '{n} preguntas')} extremos={[t('Sin preguntas'), t('30 preguntas')]} />
        {cuantas > 0 && (
          <>
            <label htmlFor="dificultad-preguntas" className="etiqueta" style={{ fontSize: 17, marginTop: 18 }}>{t('Dificultad')}</label>
            <Barra id="dificultad-preguntas" valores={[0, 1, 2, 3, 4, 5]} valor={dificultad} onCambio={setDificultad} disabled={!!ocupado}
              nombre={i => t(DIFICULTADES[i].nombre)} extremos={[t('Muy fáciles'), t('Muy difíciles')]} />
          </>
        )}
        <p className="pista">
          {cuantas === 0 ? t('La lección no llevará test: solo la lectura y el ejemplo.')
            : <><strong>{plural(cuantas, '{n} pregunta', '{n} preguntas')} · {t(DIFICULTADES[dificultad].nombre)}.</strong> {t(DIFICULTADES[dificultad].pista)}</>}
          {cuantas >= 20 && ` ${t('Con muchas preguntas tarda más.')}`}
        </p>
      </section>

      <section className="seccion">
        <h2 className="paso-profe"><span className="paso-profe-num">5</span>{t('El idioma de la lección')}</h2>
        <select className="campo" value={lenguaLeccion} onChange={e => setLenguaLeccion(e.target.value)} disabled={!!ocupado} aria-label={t('El idioma de la lección')}>
          {IDIOMAS.map(i => <option key={i.codigo} value={i.codigo}>{i.bandera} {i.nombre}</option>)}
        </select>
        <p className="pista">{t('Mochila escribe la lección en este idioma, aunque el libro esté en otro.')}</p>
      </section>

      <Aviso texto={error} />
      <div className="acciones-pie" style={{ marginTop: 28 }}>
        {!leyendo && espera}
        <button onClick={crear} disabled={!suficiente || !!ocupado} className="boton boton-principal boton-ancho boton-grande">{t('Preparar la lección')}</button>
      </div>
    </div>
  )
}

function ProfeRevisar({ codigo, inicial, onVolver }) {
  const [leccion, setLeccion] = useState(inicial.leccion)
  const [publicada] = useState(!!inicial.publicada)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(() => !inicial.cambio ? { texto: '', color: COLOR.verde }
    : inicial.cambio.error ? { texto: `No se han podido guardar tus cambios: ${inicial.cambio.error}`, color: COLOR.rojo }
      : { texto: 'Tienes cambios guardados en este aparato que se enviarán al volver la conexión.', color: COLOR.verde })

  const cambiar = (clave, valor) => setLeccion(l => ({ ...l, [clave]: valor }))
  const cambiarPregunta = (i, cambios) => setLeccion(l => ({
    ...l, preguntas: l.preguntas.map((p, j) => j === i ? { ...p, ...cambios } : p),
  }))
  const cambiarOpcion = (i, k, valor) => setLeccion(l => ({
    ...l, preguntas: l.preguntas.map((p, j) => j === i ? { ...p, opciones: p.opciones.map((o, m) => m === k ? valor : o) } : p),
  }))

  const quitarPregunta = (i) => {
    // Las respuestas guardan la posición de la pregunta: la API tampoco deja quitarla si ya hay respuestas.
    if (inicial.respondida) return window.alert(t('No se puede borrar esta pregunta: tus alumnos ya han contestado esta lección. Puedes cambiar su texto.'))
    if (window.confirm(t('¿Borrar la pregunta {n}? Se quitará al guardar la lección.', { n: i + 1 }))) cambiar('preguntas', leccion.preguntas.filter((_, j) => j !== i))
  }

  const enviar = async (publicar) => {
    setGuardando(true)
    setAviso({ texto: '' })
    try {
      const r = await api(`/api/clases/${encodeURIComponent(codigo)}/lecciones/${inicial.id}`, { method: 'PUT', body: { leccion, publicar } })
      cambiar('materia', r.materia) // por si se ha unido a una que ya existía con otras mayúsculas
      // Un cambio viejo de esta lección que esperaba en el aparato ya no vale: lo de ahora es lo último.
      if (leerCambiosProfe().some(c => c.id === inicial.id)) guardarCambiosProfe(leerCambiosProfe().filter(c => c.id !== inicial.id))
      onVolver(publicar ? t('Publicada. Tus alumnos la tendrán la próxima vez que se conecten.') : t('Guardado.'))
    } catch (e) {
      // Sin conexión: el cambio se queda en el aparato y se envía solo al volver la conexión.
      if (!esPasajero(e)) return setAviso({ texto: e.message, color: COLOR.rojo })
      if (!leccionValida(leccion)) return setAviso({ texto: 'Falta algún texto, o hay dos opciones o dos preguntas iguales. Revísalo.', color: COLOR.rojo })
      if (!guardarCambioProfe({ id: inicial.id, codigo, leccion, publicar })) return setAviso({ texto: 'No cabe en este aparato.', color: COLOR.rojo })
      onVolver(t('Sin conexión: guardado en este aparato. Se enviará solo cuando vuelva la conexión.'))
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
        <Volver onClick={() => onVolver()}>{t('La clase')}</Volver>
        {publicada && <span className="insignia insignia-verde">{t('Publicada')}</span>}
      </header>
      <h1 className="titulo">{publicada ? t('Lección publicada') : t('Revisa la lección')}</h1>
      <p className="frase">{publicada
        ? t('Si cambias algo, tus alumnos lo verán la próxima vez que se conecten.')
        : t('Léela y corrige lo que haga falta. Tus alumnos solo ven las lecciones publicadas.')}</p>

      <div className="formulario" style={{ marginTop: 28 }}>
        <div className="campo-grupo">
          <label htmlFor="r-titulo" className="etiqueta">{t('Título')}</label>
          <input id="r-titulo" className="campo" value={leccion.titulo} onChange={e => cambiar('titulo', e.target.value)} />
        </div>
        <div className="campo-grupo">
          <label htmlFor="r-materia" className="etiqueta">{t('Materia')}</label>
          <input id="r-materia" className="campo" value={leccion.materia || ''} onChange={e => cambiar('materia', e.target.value)} maxLength={40} placeholder={t('General')} />
        </div>
        <div className="campo-grupo">
          <label htmlFor="r-lectura" className="etiqueta">{t('Lectura fácil')}</label>
          {area('r-lectura', 'lectura_facil', 8)}
        </div>
        <div className="campo-grupo">
          <label htmlFor="r-ejemplo" className="etiqueta">{t('Un ejemplo')}</label>
          {area('r-ejemplo', 'explicacion_ejemplo', 5)}
        </div>
      </div>

      <section className="seccion">
        <h2 className="seccion-titulo">{t('Las preguntas')}</h2>
        <p className="frase" style={{ marginTop: -4, marginBottom: 16 }}>{leccion.preguntas.length
          ? t('Comprueba que la respuesta marcada en verde es la buena. Si no, marca el círculo de la buena.')
          : t('Esta lección no lleva preguntas: los alumnos solo leen y ven el ejemplo.')}</p>
        {leccion.preguntas.map((p, i) => (
          <fieldset key={i} className="tarjeta" style={{ marginBottom: 16, position: 'relative' }}>
            <legend className="etiqueta" style={{ padding: '0 6px', marginBottom: 0 }}>{t('Pregunta {n}', { n: i + 1 })}</legend>
            <button type="button" onClick={() => quitarPregunta(i)} aria-label={t('Borrar la pregunta {n}', { n: i + 1 })}
              style={{ position: 'absolute', top: 2, insetInlineEnd: 6, width: 40, height: 40, display: 'grid', placeItems: 'center', background: 'none', border: 0, color: 'var(--tinta-suave)', cursor: 'pointer' }}>
              <Icono nombre="mal" tam={18} />
            </button>
            <input className="campo" value={p.pregunta} onChange={e => cambiarPregunta(i, { pregunta: e.target.value })} aria-label={t('Pregunta {n}', { n: i + 1 })}
              style={{ marginTop: 24, marginBottom: 14, fontWeight: 650 }} />
            {p.opciones.map((o, k) => (
              <div key={k} className={`opcion-editar ${p.correcta === k ? 'opcion-editar-buena' : ''}`}>
                <input type="radio" name={`correcta-${i}`} checked={p.correcta === k} onChange={() => cambiarPregunta(i, { correcta: k })}
                  aria-label={t('La opción {letra} es la buena', { letra: 'ABCD'[k] })} />
                <input className="campo" value={o} onChange={e => cambiarOpcion(i, k, e.target.value)} aria-label={t('Opción {letra}', { letra: 'ABCD'[k] })} />
              </div>
            ))}
            <label htmlFor={`porque-${i}`} className="etiqueta" style={{ marginTop: 14, fontSize: 16 }}>{t('Por qué es la buena')}</label>
            <input id={`porque-${i}`} className="campo" value={p.porque} onChange={e => cambiarPregunta(i, { porque: e.target.value })} style={{ fontSize: 18 }} />
          </fieldset>
        ))}
        {/* va al final: las respuestas de los alumnos guardan la posición de cada pregunta. La API admite hasta 30. */}
        {leccion.preguntas.length < 30 && (
          <button onClick={() => cambiar('preguntas', [...leccion.preguntas, { pregunta: '', opciones: ['', '', '', ''], correcta: 0, porque: '' }])}
            className="boton boton-secundario boton-ancho">{t('+ Añadir una pregunta')}</button>
        )}
      </section>

      <Aviso texto={aviso.texto} color={aviso.color} />
      <div className="acciones-pie">
        <div className="botones-fila">
          {publicada
            ? <button onClick={() => enviar(true)} disabled={guardando} className="boton boton-principal">{guardando ? t('Guardando…') : t('Guardar los cambios')}</button>
            : (
              <>
                <button onClick={() => enviar(false)} disabled={guardando} className="boton boton-secundario">{t('Guardar sin publicar')}</button>
                <button onClick={() => enviar(true)} disabled={guardando} className="boton boton-principal">{guardando ? t('Publicando…') : t('Publicar')}</button>
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
  const n = plural(pendientes, '{n} respuesta', '{n} respuestas')
  const [clase, texto] =
    estado === 'enviando' ? ['estado-enviando', pendientes ? t('Enviando {n}…', { n }) : t('Buscando lecciones nuevas…')]
      : estado === 'sin-conexion' ? ['', pendientes ? t('Sin conexión · {n} por enviar', { n }) : t('Sin conexión · tus lecciones funcionan igual')]
        : estado === 'error' ? ['estado-error', t('No se ha podido enviar · {n} por enviar · se reintentará solo', { n })]
          : pendientes ? ['estado-pendiente', t('{n} por enviar', { n })]
            : ['estado-ok', t('Todo enviado a tu profe')]
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
  const hora = d.toLocaleTimeString(idioma(), { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString() ? t('hoy a las {hora}', { hora })
    : t('el {dia} a las {hora}', { dia: d.toLocaleDateString(idioma(), { day: 'numeric', month: 'long' }), hora })
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
    return <p className="aviso aviso-atencion"><strong>{t('Sin conexión, la app no se abrirá')}</strong>{t('Este navegador no puede guardarla. Entra con el enlace https que te dé tu profe.')}</p>
  }
  return (
    <div className="frase" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      {appGuardada ? <IconoDescargado tam={26} /> : <span className="ruedita" style={{ width: 24, height: 24, borderWidth: 3, flexShrink: 0 }} />}
      <span>
        {appGuardada
          ? t('Tienes {n} en este móvil. Funcionan sin conexión.', { n: plural(lecciones, '{n} lección guardada', '{n} lecciones guardadas') })
          : t('Guardando la app en este móvil… Espera un momento antes de quedarte sin conexión.')}
        {actualizado && <span className="nota" style={{ display: 'block', marginTop: 4 }}>{t('Lecciones nuevas buscadas {cuando}.', { cuando: cuando(actualizado) })}</span>}
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
        {ver ? t('Ocultar') : t('Ver')}
      </button>
    </div>
  )
}

function CampoCodigo({ valor, onCambio, opcional = false }) {
  return (
    <div className="campo-grupo">
      <label htmlFor="codigo-clase" className="etiqueta">{opcional ? t('Código de la clase (opcional)') : t('Código de la clase')}</label>
      <input id="codigo-clase" className="campo campo-codigo" value={valor} onChange={e => onCambio(e.target.value.toUpperCase())} maxLength={12}
        autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="ABC123" />
      <p className="pista">{t('Son 6 letras y números. Te lo dice tu profe.')}{opcional && ` ${t('Si no lo tienes, déjalo vacío: podrás entrar en tu clase más tarde.')}`}</p>
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
      <h1 className="titulo">{t('¿Quién eres?')}</h1>
      <p className="frase">{hay ? t('Toca tu nombre.') : t('Crea tu usuario para empezar. Si ya tienes uno, entra con él.')}</p>

      {hay && (
        <div className="lista" style={{ marginTop: 24 }}>
          {antiguo?.nombre && (
            <button onClick={() => setVista('antiguo')} className="fila fila-toca">
              <Avatar nombre={antiguo.nombre} />
              <span className="fila-texto"><span className="fila-titulo">{antiguo.nombre}</span><span className="fila-detalle">{t('Ponle usuario y contraseña para seguir')}</span></span>
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
        <button onClick={() => setVista('nuevo')} className={`boton ${hay ? 'boton-secundario' : 'boton-principal boton-grande'}`}><Icono nombre="mas" />{t('Crear mi usuario')}</button>
        <button onClick={() => setVista('usuario')} className={`boton boton-secundario ${hay ? '' : 'boton-grande'}`}>{t('Ya tengo usuario')}</button>
      </div>
      <p className="nota" style={{ marginTop: 22 }}>{t('En un mismo móvil pueden entrar varios estudiantes, cada uno con su usuario y su contraseña.')}</p>
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
        : perfil?.hash ? t('Contraseña incorrecta.') : t('La primera vez en este móvil hace falta conexión con el ordenador de la clase.'))
      setEnviando(false)
    }
  }

  return (
    <div className="pagina">
      <header className="cabecera"><Volver onClick={onVolver}>{perfil ? t('No soy yo') : t('Volver')}</Volver></header>
      {perfil
        ? <h1 className="titulo titulo-con-avatar"><Avatar nombre={perfil.nombre} />{t('Hola, {nombre}', { nombre: perfil.nombre })}</h1>
        : <h1 className="titulo">{t('Entrar con mi usuario')}</h1>}
      <p className="frase">{perfil ? t('Escribe tu contraseña.') : t('Escribe tu usuario y tu contraseña.')}</p>
      <form onSubmit={entrar} className="formulario" style={{ marginTop: 24 }}>
        {!perfil && (
          <div className="campo-grupo">
            <label htmlFor="entrar-usuario" className="etiqueta">{t('Usuario')}</label>
            <input id="entrar-usuario" className="campo" value={usuario} onChange={e => setUsuario(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} maxLength={20}
              autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false} style={{ fontSize: 24 }} />
          </div>
        )}
        <div className="campo-grupo">
          <label htmlFor="entrar-contrasena" className="etiqueta">{t('Contraseña')}</label>
          <CampoContrasena id="entrar-contrasena" valor={contrasena} onCambio={setContrasena} autoFocus={!!perfil} />
          <p className="pista">{t('¿Se te ha olvidado? Pídele a tu profe una nueva.')}</p>
        </div>
        <Aviso texto={error} />
        <button type="submit" disabled={enviando || !usuarioValido(usuario) || contrasena.length < 4} className="boton boton-principal boton-ancho boton-grande">
          {enviando ? t('Entrando…') : t('Entrar')}
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
        : { nombre, usuario: elUsuario, contrasena, clase: codigoLimpio || null } })
      await recordarEnAparato(a, contrasena)
      if (antiguo) {
        guardar(`clases:${a.id}`, leer('alumno-clases', [])) // sus lecciones siguen en el aparato sin conexión
        try { LEGADO.forEach(k => localStorage.removeItem(k)) } catch { /* nada */ }
      }
      onEntrar(a)
    } catch (e) {
      if (e.detalle?.sugerencia) setUsuario(e.detalle.sugerencia)
      setError(e.message === SIN_CONEXION ? t('Para crear tu usuario hace falta conexión con el ordenador de la clase.')
        : e.detalle?.sugerencia ? t('Ese usuario ya lo tiene otra persona. Te proponemos «{usuario}».', { usuario: e.detalle.sugerencia }) : e.message)
      setEnviando(false)
    }
  }

  return (
    <div className="pagina">
      <header className="cabecera"><Volver onClick={onVolver} /></header>
      <h1 className="titulo">{antiguo ? t('Ponle usuario y contraseña') : t('Crear mi usuario')}</h1>
      <p className="frase">{antiguo
        ? t('Antes se entraba solo con el nombre. Ahora cada estudiante tiene usuario y contraseña, para que nadie entre como tú. No pierdes tus clases ni tus respuestas.')
        : t('Te pediremos la contraseña cada vez que entres. Así nadie más puede entrar como tú.')}</p>
      <form onSubmit={crear} className="formulario" style={{ marginTop: 24 }}>
        <div className="campo-grupo">
          <label htmlFor="nuevo-nombre" className="etiqueta">{t('¿Cómo te llamas?')}</label>
          <input id="nuevo-nombre" className="campo" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={40} autoComplete="off" placeholder={t('Tu nombre')} />
        </div>
        <div className="campo-grupo">
          <label htmlFor="nuevo-usuario" className="etiqueta">{t('Tu usuario')}</label>
          <input id="nuevo-usuario" className="campo" value={elUsuario} onChange={e => setUsuario(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} maxLength={20}
            autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false} style={{ fontSize: 24 }} />
          <p className="pista">{t('Solo letras y números, sin espacios. Apúntalo: lo necesitas para entrar.')}</p>
        </div>
        <div className="campo-grupo">
          <label htmlFor="nuevo-contrasena" className="etiqueta">{t('Tu contraseña')}</label>
          <CampoContrasena id="nuevo-contrasena" valor={contrasena} onCambio={setContrasena} nueva />
          <p className="pista">{t('Al menos 4 letras o números. Que la recuerdes bien y no se la digas a nadie.')}</p>
        </div>
        {!antiguo && <CampoCodigo valor={codigo} onCambio={setCodigo} opcional />}
        <Aviso texto={error} />
        <button type="submit" disabled={enviando || !nombre.trim() || !usuarioValido(elUsuario) || contrasena.length < 4 || ![0, 6].includes(codigoLimpio.length)}
          className="boton boton-principal boton-ancho boton-grande">
          {enviando ? t('Guardando…') : antiguo ? t('Guardar y entrar') : t('Crear y entrar')}
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
  const [dudasQuitadas, setDudasQuitadas] = useState(() => leer(clave('dudas-quitadas'), [])) // las que el estudiante ya no quiere ver
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
  // Si aún no se ha enviado, ya no se envía. Si ya se envió, deja de verse en este móvil (el profe la sigue viendo).
  const quitarDuda = (id) => {
    const cola = leer('dudas-pendientes', []).filter(d => d.id !== id)
    guardar('dudas-pendientes', cola)
    setDudasCola(cola)
    const quitadas = [...dudasQuitadas, id]
    guardar(clave('dudas-quitadas'), quitadas)
    setDudasQuitadas(quitadas)
  }
  const dudasDe = (leccionId) => {
    const delServidor = dudas.filter(d => d.leccion_id === leccionId)
    const ids = new Set(delServidor.map(d => d.id))
    return [...delServidor, ...dudasCola.filter(d => d.alumno === alumno.id && d.leccion_id === leccionId && !ids.has(d.id))]
      .filter(d => !dudasQuitadas.includes(d.id))
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
          dudas={dudasDe(leccion.id)} sinConexion={estado === 'sin-conexion'} onPreguntar={(texto) => preguntar(leccion.id, texto)} onQuitar={quitarDuda} />
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
          <button onClick={onSalir} className="boton boton-secundario boton-pequeno"><Icono nombre="salir" tam={20} />{t('Salir')}</button>
        </header>
        <h1 className="titulo titulo-con-avatar"><Avatar nombre={alumno.nombre} />{t('Hola, {nombre}', { nombre: alumno.nombre })}</h1>
        {total > 0 && <ResumenDescargado lecciones={total} appGuardada={appGuardada} actualizado={actualizado} />}
        {clases.length === 0 && (
          <p className="frase">{estado === 'sin-conexion'
            ? t('Cuando haya conexión aparecerán tus clases.')
            : t('Todavía no estás en ninguna clase. Pulsa «Entrar en otra clase» y escribe el código que te dé tu profe.')}</p>
        )}

        {grupos.map(([c, materias]) => {
          const conTitulos = materias.length > 1 || (materias[0] && materias[0][0] !== 'General')
          return (
            <section key={c.codigo} className="seccion">
              <h2 className="seccion-titulo">{c.nombre}</h2>
              {c.lecciones.length === 0 && <p className="frase" style={{ marginTop: 0 }}>{t('Tu profe todavía no ha publicado lecciones.')}</p>}
              {materias.map(([materia, lecciones]) => (
                <div key={materia}>
                  {conTitulos && <h3 className="subtitulo">{t(materia)}</h3>}
                  <div className="lista">
                    {lecciones.map(l => {
                      const p = progreso[l.id]
                      return (
                        <button key={l.id} onClick={() => { setLeccion(l); window.scrollTo(0, 0) }} className={`fila ${l.id === toca ? 'fila-toca' : ''}`}>
                          <span className="fila-texto">
                            <span className="fila-titulo">{l.titulo}</span>
                            <span className="fila-detalle">
                              <span className="descargada"><IconoDescargado tam={18} />{t('Descargada')}</span>
                              {p?.hecha
                                ? <span className="descargada"><Icono nombre="bien" tam={18} />{t('Hecha · {a} de {b}', { a: p.aciertos, b: p.total })}</span>
                                : <span>{p?.empezada ? t('Empezada') : t('Sin empezar')}</span>}
                              {dudasDe(l.id).length > 0 && <span className="descargada" style={{ color: 'var(--ocre)' }}><Icono nombre="duda" tam={18} />{plural(dudasDe(l.id).filter(d => d.respuesta).length, '{n} duda contestada', '{n} dudas contestadas')}</span>}
                            </span>
                          </span>
                          {l.id === toca ? <span className="insignia insignia-amarilla">{t('Te toca')}</span> : <Icono nombre="seguir" className="icono-final" />}
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
            <Icono nombre="buscar" />{estado === 'enviando' ? t('Buscando…') : t('Buscar lecciones nuevas')}
          </button>
          <button onClick={() => setOtraClase(true)} className="boton boton-fantasma boton-ancho">{t('Entrar en otra clase')}</button>
        </div>
        <p className="nota" style={{ textAlign: 'center', marginTop: 18 }}>{t('Cuando termines, pulsa «Salir» para que pueda entrar otro estudiante.')}</p>
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
      setError(e.message === SIN_CONEXION ? t('Para entrar en una clase nueva hace falta conexión con el ordenador de la clase.') : e.message)
      setEnviando(false)
    }
  }

  return (
    <div className="pagina">
      <header className="cabecera"><Volver onClick={onVolver} /></header>
      <h1 className="titulo">{t('Entrar en otra clase')}</h1>
      <p className="frase">{t('Escribe el código que te dé tu profe.')}</p>
      <form onSubmit={entrar} className="formulario" style={{ marginTop: 24 }}>
        <CampoCodigo valor={codigo} onCambio={setCodigo} />
        <Aviso texto={error} />
        <button type="submit" disabled={enviando || codigoLimpio.length !== 6} className="boton boton-principal boton-ancho boton-grande">
          {enviando ? t('Entrando…') : t('Entrar')}
        </button>
      </form>
    </div>
  )
}

// La lección es un camino de 3 pasos: leer, ver un ejemplo y contestar las preguntas.
function AlumnoLeccion({ leccion, alumnoId, onVolver, onRespuesta, onTerminar, dudas, sinConexion, onPreguntar, onQuitar }) {
  const { lectura_facil, explicacion_ejemplo, preguntas } = leccion.contenido
  const [paso, setPaso] = useState(0)
  const [n, setN] = useState(0)
  const [elegida, setElegida] = useState(null)
  const [respondida, setRespondida] = useState(false)
  const [fallada, setFallada] = useState(null) // la opción del primer intento, si falló y hay pista
  const [aciertos, setAciertos] = useState(0)
  const [terminado, setTerminado] = useState(false)
  const conTest = preguntas.length > 0 // el profe puede hacer lecciones sin preguntas
  const pregunta = preguntas[n] || { pregunta: '', opciones: [], correcta: 0 }
  const acierto = elegida === pregunta.correcta
  // Al fallar, antes de dar la solución, la lección enseña dónde está la respuesta (sin red).
  const pista = conTest ? buscar(leccion.contenido, `${pregunta.pregunta} ${pregunta.opciones[pregunta.correcta]}`) : []

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
      <header className="cabecera"><Volver onClick={onVolver}>{t('Mis lecciones')}</Volver></header>
      <h1 className="titulo">{leccion.titulo}</h1>

      <nav className="pasos" aria-label={t('Pasos de la lección')}>
        {[t('Leer'), t('Ejemplo'), t('Preguntas')].slice(0, conTest ? 3 : 2).map((nombre, i) => (
          <button key={i} onClick={() => irA(i)} aria-current={i === paso ? 'step' : undefined}
            className={`paso ${i === paso ? 'paso-actual' : i < paso ? 'paso-hecho' : ''}`}>{i + 1}. {nombre}</button>
        ))}
      </nav>

      {paso < 2 && (
        <>
          <article className="hoja">
            <div className="hoja-arriba"><Escuchar key={paso} texto={paso === 0 ? lectura_facil : explicacion_ejemplo} lengua={leccion.contenido.idioma} /></div>
            <p className="hoja-texto">{paso === 0 ? lectura_facil : explicacion_ejemplo}</p>
          </article>
          <button onClick={() => paso === 1 && !conTest ? onVolver() : irA(paso + 1)} className="boton boton-principal boton-ancho boton-grande" style={{ marginTop: 24 }}>
            {paso === 0 ? t('Ya lo he leído') : conTest ? t('Ir a las preguntas') : t('Volver a mis lecciones')}<Icono nombre="seguir" />
          </button>
          <Dudas dudas={dudas} contenido={leccion.contenido} sinConexion={sinConexion} onPreguntar={onPreguntar} onQuitar={onQuitar} />
        </>
      )}

      {paso === 2 && terminado && (
        <div className="resultado">
          <p className="pregunta-num">{t('Tu resultado')}</p>
          <p className="resultado-cifra"><mark>{t('{a} de {b}', { a: aciertos, b: preguntas.length })}</mark></p>
          <p className="resultado-texto">{aciertos === preguntas.length ? t('¡Perfecto! Las has acertado todas.')
            : aciertos >= Math.ceil(preguntas.length * 0.6) ? t('Muy bien. Repasa las que has fallado.')
              : t('Vuelve a leer la lección y prueba otra vez.')}</p>
          <div className="botones">
            <button onClick={onVolver} className="boton boton-principal boton-ancho boton-grande">{t('Volver a mis lecciones')}</button>
            <button onClick={repetir} className="boton boton-secundario boton-ancho">{t('Repetir las preguntas')}</button>
            <button onClick={() => irA(0)} className="boton boton-fantasma boton-ancho">{t('Volver a leer')}</button>
          </div>
          <p className="nota">{t('Tus respuestas le llegan a tu profe cuando hay conexión.')}</p>
          <div style={{ textAlign: 'start' }}><Dudas dudas={dudas} contenido={leccion.contenido} sinConexion={sinConexion} onPreguntar={onPreguntar} onQuitar={onQuitar} /></div>
        </div>
      )}

      {paso === 2 && !terminado && (
        <>
          <p className="pregunta-num">{t('Pregunta {a} de {b}', { a: n + 1, b: preguntas.length })}</p>
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
              <strong>{t('No es esa. Te doy una pista.')}</strong>
              <span style={{ display: 'block', marginTop: 4 }}>{t('Mira lo que dice la lección:')}</span>
              {pista.map((trozo, i) => <span key={i} style={{ display: 'block', marginTop: 6 }}>«{trozo.texto}» <span className="nota">{t('(en «{parte}»)', { parte: t(trozo.parte) })}</span></span>)}
              <div style={{ marginTop: 10 }}><Escuchar key={n} texto={pista.map(trozo => trozo.texto).join(' ')} lengua={leccion.contenido.idioma} /></div>
            </div>
          )}
          {!respondida
            ? <button onClick={responder} disabled={elegida === null} className="boton boton-principal boton-ancho boton-grande" style={{ marginTop: 22 }}>{fallada === null ? t('Comprobar') : t('Probar otra vez')}</button>
            : (
              <>
                <div role="status" className={`aviso ${acierto ? 'aviso-ok' : 'aviso-error'}`} style={{ marginTop: 22 }}>
                  <strong>{acierto ? t('¡Bien hecho!') : t('No es esa.')}</strong>
                  {!acierto && <span style={{ display: 'block', marginTop: 4 }}>{t('La buena es la {letra}: «{texto}»', { letra: 'ABCD'[pregunta.correcta], texto: pregunta.opciones[pregunta.correcta] })}</span>}
                  {pregunta.porque && <span style={{ display: 'block', marginTop: 6 }}>{pregunta.porque}</span>}
                </div>
                <button onClick={siguiente} className="boton boton-principal boton-ancho boton-grande">
                  {n < preguntas.length - 1 ? t('Siguiente pregunta') : t('Ver mi resultado')}<Icono nombre="seguir" />
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
function Dudas({ dudas, contenido, sinConexion, onPreguntar, onQuitar }) {
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
          <h2 className="seccion-titulo">{t('Mis dudas')}</h2>
          <div style={{ marginBottom: 16 }}>
            {dudas.map(d => (
              <div key={d.id} className="tarjeta duda" style={{ position: 'relative' }}>
                <button onClick={() => window.confirm(t('¿Borrar esta duda?')) && onQuitar(d.id)} aria-label={t('Borrar esta duda')}
                  style={{ position: 'absolute', top: 6, insetInlineEnd: 6, width: 40, height: 40, display: 'grid', placeItems: 'center', background: 'none', border: 0, color: 'var(--tinta-suave)', cursor: 'pointer' }}>
                  <Icono nombre="mal" tam={18} />
                </button>
                <p className="duda-pregunta" style={{ paddingInlineEnd: 30 }}>{d.pregunta}</p>
                {d.respuesta
                  ? <><p className="duda-respuesta">{t(d.respuesta)}{d.corregida ? <span className="nota" style={{ display: 'block' }}>{t('Te lo ha contestado tu profe.')}</span> : null}</p><div style={{ marginTop: 10 }}><Escuchar texto={t(d.respuesta)} lengua={contenido?.idioma} /></div></>
                  : <EnLaLeccion contenido={contenido} pregunta={d.pregunta} nota={sinConexion ? t('Se enviará cuando haya conexión.') : t('Esperando la respuesta…')} />}
              </div>
            ))}
          </div>
        </>
      )}
      {abierta
        ? (
          <form onSubmit={enviar} className="formulario">
            <div className="campo-grupo">
              <label htmlFor="duda-texto" className="etiqueta">{t('¿Qué no has entendido?')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {[t('¿Qué es'), t('No entiendo'), t('¿Por qué')].map(inicio => (
                  <button key={inicio} type="button" onClick={() => empezar(inicio + ' ')} className="boton boton-secundario boton-pequeno">{inicio}…</button>
                ))}
              </div>
              <textarea id="duda-texto" ref={campo} className="campo" rows={3} maxLength={300} autoFocus value={texto} onChange={e => setTexto(e.target.value)}
                style={{ minHeight: 110 }} />
              <p className="pista">{t('Pregunta sobre esta lección. Te contesta Mochila con lo que dice la lección, y tu profe también lo verá.')}</p>
            </div>
            <div className="botones-fila">
              <button type="button" onClick={() => setAbierta(false)} className="boton boton-fantasma">{t('Cancelar')}</button>
              <button type="submit" disabled={texto.trim().length < 3} className="boton boton-secundario">{t('Enviar mi duda')}</button>
            </div>
          </form>
        )
        : <button onClick={() => setAbierta(true)} className="boton boton-secundario boton-ancho"><Icono nombre="duda" />{t('Tengo una duda')}</button>}
    </section>
  )
}

// Mientras no llega la respuesta de la IA de la clase, el móvil busca en la lección, sin internet.
function EnLaLeccion({ contenido, pregunta, nota }) {
  const trozos = buscar(contenido, pregunta)
  return (
    <>
      {trozos.length > 0 && <p className="nota" style={{ marginTop: 10 }}>{t('Mientras tanto, esto dice la lección:')}</p>}
      {trozos.map((trozo, i) => <p key={i} className="duda-respuesta">{trozo.texto} <span className="nota">{t('(en «{parte}»)', { parte: t(trozo.parte) })}</span></p>)}
      {trozos.length > 0 && <div style={{ marginTop: 10 }}><Escuchar texto={trozos.map(trozo => trozo.texto).join(' ')} lengua={contenido?.idioma} /></div>}
      <p className="nota" style={{ marginTop: 10 }}>{nota}</p>
    </>
  )
}

// Lee en voz alta con la voz del propio móvil (sin internet si el móvil tiene la voz instalada).
function Escuchar({ texto, lengua = 'es' }) {
  const [sonando, setSonando] = useState(false)
  const hayVoz = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => () => { if (hayVoz) window.speechSynthesis.cancel() }, [hayVoz]) // al salir, que se calle

  if (!hayVoz) return null

  const alternar = () => {
    window.speechSynthesis.cancel()
    if (sonando) { setSonando(false); return }
    const voz = new SpeechSynthesisUtterance(texto)
    voz.lang = lengua
    voz.rate = 0.9
    voz.onend = () => setSonando(false)
    voz.onerror = () => setSonando(false)
    window.speechSynthesis.speak(voz)
    setSonando(true)
  }

  return (
    <button onClick={alternar} aria-pressed={sonando} className="boton boton-secundario boton-pequeno">
      <Icono nombre={sonando ? 'parar' : 'altavoz'} tam={20} />{sonando ? t('Parar') : t('Escuchar')}
    </button>
  )
}

export default App
