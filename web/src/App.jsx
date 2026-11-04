import { useState, useEffect } from 'react'

function App() {
  const [apiStatus, setApiStatus] = useState('Conectando...')
  const [vista, setVista] = useState('inicio')

  useEffect(() => {
    fetch('/api/salud')
      .then(res => res.json())
      .then(data => setApiStatus(data.mensaje))
      .catch(() => setApiStatus('Sin conexión'))
  }, [])

  if (vista === 'profe') {
    return <VistaProfe onVolver={() => setVista('inicio')} />
  }

  if (vista === 'alumno') {
    return <VistaAlumno onVolver={() => setVista('inicio')} />
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      backgroundColor: '#f5f5f5'
    }}>
      <h1 style={{
        fontSize: '48px',
        marginBottom: '60px',
        color: '#333'
      }}>
        Mochila
      </h1>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        maxWidth: '400px'
      }}>
        <button
          onClick={() => setVista('profe')}
          style={{
            padding: '30px',
            fontSize: '28px',
            backgroundColor: '#4a90e2',
            color: 'white',
            border: 'none',
            borderRadius: '15px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}>
          Soy profe
        </button>

        <button
          onClick={() => setVista('alumno')}
          style={{
            padding: '30px',
            fontSize: '28px',
            backgroundColor: '#50c878',
            color: 'white',
            border: 'none',
            borderRadius: '15px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}>
          Soy alumno
        </button>
      </div>

      <div style={{
        marginTop: '60px',
        fontSize: '20px',
        color: '#666'
      }}>
        API: {apiStatus}
      </div>
    </div>
  )
}

function VistaAlumno({ onVolver }) {
  const [paso, setPaso] = useState('seleccion')
  const [clases, setClases] = useState([])
  const [claseSeleccionada, setClaseSeleccionada] = useState(null)
  const [alumnos, setAlumnos] = useState([])
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState('')
  const [lecciones, setLecciones] = useState([])
  const [leccionActual, setLeccionActual] = useState(null)
  const [pestana, setPestana] = useState('leer')
  const [preguntaActual, setPreguntaActual] = useState(0)
  const [respuestaSeleccionada, setRespuestaSeleccionada] = useState(null)
  const [respuestaEnviada, setRespuestaEnviada] = useState(false)

  useEffect(() => {
    const guardado = localStorage.getItem('alumno')
    if (guardado) {
      const datos = JSON.parse(guardado)
      setAlumnoSeleccionado(datos.alumno)
      setClaseSeleccionada(datos.clase)
      setPaso('lecciones')
      cargarLecciones(datos.clase)
    }
    
    const clasesGuardadas = localStorage.getItem('clases')
    if (clasesGuardadas) {
      setClases(JSON.parse(clasesGuardadas))
    }
    
    fetch('/api/clases')
      .then(res => res.json())
      .then(data => {
        setClases(data)
        localStorage.setItem('clases', JSON.stringify(data))
      })
      .catch(() => {
        const cache = localStorage.getItem('clases')
        if (cache) {
          setClases(JSON.parse(cache))
        }
      })
  }, [])

  const cargarLecciones = (codigo) => {
    const cacheKey = `lecciones-${codigo}`
    const leccionesGuardadas = localStorage.getItem(cacheKey)
    if (leccionesGuardadas) {
      setLecciones(JSON.parse(leccionesGuardadas))
    }

    fetch(`/api/clases/${codigo}/lecciones`)
      .then(res => res.json())
      .then(data => {
        setLecciones(data)
        localStorage.setItem(cacheKey, JSON.stringify(data))
      })
      .catch(() => {
        const cache = localStorage.getItem(cacheKey)
        if (cache) {
          setLecciones(JSON.parse(cache))
        }
      })
  }

  const handleSeleccionarClase = (codigo) => {
    setClaseSeleccionada(codigo)
    
    const cacheKey = `clase-${codigo}`
    const claseGuardada = localStorage.getItem(cacheKey)
    if (claseGuardada) {
      const datos = JSON.parse(claseGuardada)
      setAlumnos(datos.alumnos)
    }

    fetch(`/api/clases/${codigo}`)
      .then(res => res.json())
      .then(data => {
        setAlumnos(data.alumnos)
        localStorage.setItem(cacheKey, JSON.stringify(data))
      })
      .catch(() => {
        const cache = localStorage.getItem(cacheKey)
        if (cache) {
          setAlumnos(JSON.parse(cache).alumnos)
        }
      })
  }

  const handleSeleccionarAlumno = (nombre) => {
    setAlumnoSeleccionado(nombre)
    localStorage.setItem('alumno', JSON.stringify({ alumno: nombre, clase: claseSeleccionada }))
    setPaso('lecciones')
    cargarLecciones(claseSeleccionada)
  }

  const handleCerrarSesion = () => {
    localStorage.removeItem('alumno')
    setAlumnoSeleccionado('')
    setClaseSeleccionada(null)
    setPaso('seleccion')
  }

  const handleAbrirLeccion = async (leccion) => {
    const cacheKey = `leccion-${leccion.id}`
    const leccionGuardada = localStorage.getItem(cacheKey)
    
    if (leccionGuardada) {
      setLeccionActual(JSON.parse(leccionGuardada))
    }

    try {
      const res = await fetch(`/api/leccion/${leccion.id}`)
      const data = await res.json()
      setLeccionActual(data)
      localStorage.setItem(cacheKey, JSON.stringify(data))
    } catch {
      if (leccionGuardada) {
        setLeccionActual(JSON.parse(leccionGuardada))
      }
    }

    setPestana('leer')
    setPreguntaActual(0)
    setRespuestaSeleccionada(null)
    setRespuestaEnviada(false)
    setPaso('leccion')
  }

  const handleResponder = () => {
    setRespuestaEnviada(true)
    
    const respuesta = {
      id: crypto.randomUUID(),
      alumno: alumnoSeleccionado,
      leccion_id: leccionActual.id,
      pregunta: preguntaActual,
      respuesta: respuestaSeleccionada,
      fecha: new Date().toISOString()
    }

    const pendientes = JSON.parse(localStorage.getItem('pendientes') || '[]')
    pendientes.push(respuesta)
    localStorage.setItem('pendientes', JSON.stringify(pendientes))
  }

  const handleSiguientePregunta = () => {
    if (preguntaActual < leccionActual.contenido.preguntas.length - 1) {
      setPreguntaActual(preguntaActual + 1)
      setRespuestaSeleccionada(null)
      setRespuestaEnviada(false)
    } else {
      const pendientes = JSON.parse(localStorage.getItem('pendientes') || '[]')
      alert(`¡Terminaste el test!\n${pendientes.length} respuestas por enviar.`)
      setPaso('lecciones')
    }
  }

  if (paso === 'leccion' && leccionActual) {
    const pregunta = leccionActual.contenido.preguntas[preguntaActual]
    
    return (
      <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
        <button
          onClick={() => {
            setPaso('lecciones')
            setLeccionActual(null)
          }}
          style={{
            padding: '10px 20px',
            fontSize: '18px',
            backgroundColor: '#999',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            marginBottom: '20px'
          }}>
          Volver
        </button>

        <h1 style={{ marginBottom: '20px' }}>{leccionActual.titulo}</h1>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' }}>
          {['leer', 'ejemplo', 'escuchar', 'test'].map(p => (
            <button
              key={p}
              onClick={() => setPestana(p)}
              style={{
                flex: 1,
                minWidth: '100px',
                padding: '15px',
                fontSize: '18px',
                backgroundColor: pestana === p ? '#50c878' : '#ddd',
                color: pestana === p ? 'white' : '#333',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: pestana === p ? 'bold' : 'normal'
              }}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {pestana === 'leer' && (
          <div style={{ fontSize: '20px', lineHeight: '1.8' }}>
            {leccionActual.contenido.lectura_facil}
          </div>
        )}

        {pestana === 'ejemplo' && (
          <div style={{ fontSize: '20px', lineHeight: '1.8', backgroundColor: '#f0f8ff', padding: '20px', borderRadius: '10px' }}>
            {leccionActual.contenido.explicacion_ejemplo}
          </div>
        )}

        {pestana === 'escuchar' && <VistaEscuchar texto={leccionActual.contenido.lectura_facil} />}

        {pestana === 'test' && (
          <div>
            <p style={{ fontSize: '18px', marginBottom: '20px', color: '#666' }}>
              Pregunta {preguntaActual + 1} de {leccionActual.contenido.preguntas.length}
            </p>
            
            <h2 style={{ fontSize: '22px', marginBottom: '25px' }}>{pregunta.pregunta}</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {pregunta.opciones.map((opcion, idx) => (
                <button
                  key={idx}
                  onClick={() => !respuestaEnviada && setRespuestaSeleccionada(idx)}
                  disabled={respuestaEnviada}
                  style={{
                    padding: '20px',
                    fontSize: '20px',
                    backgroundColor: respuestaEnviada
                      ? idx === pregunta.correcta
                        ? '#50c878'
                        : idx === respuestaSeleccionada
                        ? '#e74c3c'
                        : '#f5f5f5'
                      : respuestaSeleccionada === idx
                      ? '#4a90e2'
                      : '#f5f5f5',
                    color: respuestaEnviada && (idx === pregunta.correcta || idx === respuestaSeleccionada)
                      ? 'white'
                      : '#333',
                    border: '2px solid #ddd',
                    borderRadius: '10px',
                    cursor: respuestaEnviada ? 'default' : 'pointer',
                    textAlign: 'left'
                  }}>
                  {opcion}
                </button>
              ))}
            </div>

            {!respuestaEnviada && (
              <button
                onClick={handleResponder}
                disabled={respuestaSeleccionada === null}
                style={{
                  width: '100%',
                  marginTop: '25px',
                  padding: '20px',
                  fontSize: '22px',
                  backgroundColor: respuestaSeleccionada !== null ? '#4a90e2' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: respuestaSeleccionada !== null ? 'pointer' : 'not-allowed'
                }}>
                Responder
              </button>
            )}

            {respuestaEnviada && (
              <div style={{ marginTop: '25px' }}>
                <div style={{
                  padding: '20px',
                  backgroundColor: '#fff3cd',
                  borderRadius: '10px',
                  fontSize: '18px',
                  marginBottom: '15px'
                }}>
                  <strong>{respuestaSeleccionada === pregunta.correcta ? '¡Correcto!' : 'Incorrecto'}</strong>
                  <p style={{ marginTop: '10px' }}>{pregunta.porque}</p>
                </div>
                <button
                  onClick={handleSiguientePregunta}
                  style={{
                    width: '100%',
                    padding: '20px',
                    fontSize: '22px',
                    backgroundColor: '#50c878',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer'
                  }}>
                  {preguntaActual < leccionActual.contenido.preguntas.length - 1 ? 'Siguiente' : 'Terminar'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (paso === 'lecciones') {
    return (
      <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div>
            <h2 style={{ margin: 0 }}>Hola, {alumnoSeleccionado}</h2>
            <button
              onClick={handleCerrarSesion}
              style={{
                padding: '8px 15px',
                fontSize: '16px',
                backgroundColor: '#999',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                marginTop: '5px'
              }}>
              Cerrar sesión
            </button>
          </div>
        </div>

        <h1 style={{ marginBottom: '30px' }}>Mis lecciones</h1>

        {lecciones.length === 0 ? (
          <p style={{ fontSize: '20px', color: '#666' }}>No hay lecciones disponibles.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {lecciones.map(leccion => (
              <button
                key={leccion.id}
                onClick={() => handleAbrirLeccion(leccion)}
                style={{
                  padding: '25px',
                  fontSize: '22px',
                  backgroundColor: '#fff',
                  border: '3px solid #50c878',
                  borderRadius: '15px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}>
                {leccion.titulo}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <button
        onClick={onVolver}
        style={{
          padding: '10px 20px',
          fontSize: '18px',
          backgroundColor: '#999',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}>
        Volver
      </button>

      <h1 style={{ marginBottom: '30px' }}>¿Quién eres?</h1>

      {clases.length === 0 ? (
        <p style={{ fontSize: '20px', color: '#666' }}>No hay clases disponibles.</p>
      ) : (
        <>
          <label style={{ fontSize: '20px', fontWeight: 'bold', display: 'block', marginBottom: '15px' }}>
            Elige tu clase:
          </label>
          <select
            value={claseSeleccionada || ''}
            onChange={(e) => handleSeleccionarClase(e.target.value)}
            style={{
              width: '100%',
              padding: '20px',
              fontSize: '22px',
              border: '2px solid #ddd',
              borderRadius: '10px',
              marginBottom: '30px'
            }}>
            <option value="">Selecciona...</option>
            {clases.map(c => (
              <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
            ))}
          </select>

          {claseSeleccionada && alumnos.length > 0 && (
            <>
              <label style={{ fontSize: '20px', fontWeight: 'bold', display: 'block', marginBottom: '15px' }}>
                Tu nombre:
              </label>
              <select
                value={alumnoSeleccionado}
                onChange={(e) => handleSeleccionarAlumno(e.target.value)}
                style={{
                  width: '100%',
                  padding: '20px',
                  fontSize: '22px',
                  border: '2px solid #ddd',
                  borderRadius: '10px'
                }}>
                <option value="">Selecciona...</option>
                {alumnos.map(nombre => (
                  <option key={nombre} value={nombre}>{nombre}</option>
                ))}
              </select>
            </>
          )}
        </>
      )}
    </div>
  )
}

function VistaEscuchar({ texto }) {
  const [reproduciendo, setReproduendo] = useState(false)

  const handleReproducir = () => {
    const utterance = new SpeechSynthesisUtterance(texto)
    utterance.lang = 'es-ES'
    utterance.rate = 0.9
    utterance.onend = () => setReproduendo(false)
    
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setReproduendo(true)
  }

  const handleParar = () => {
    window.speechSynthesis.cancel()
    setReproduendo(false)
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
        <button
          onClick={handleReproducir}
          disabled={reproduciendo}
          style={{
            padding: '25px 40px',
            fontSize: '24px',
            backgroundColor: reproduciendo ? '#ccc' : '#50c878',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: reproduciendo ? 'not-allowed' : 'pointer'
          }}>
          Reproducir
        </button>
        <button
          onClick={handleParar}
          disabled={!reproduciendo}
          style={{
            padding: '25px 40px',
            fontSize: '24px',
            backgroundColor: !reproduciendo ? '#ccc' : '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: !reproduciendo ? 'not-allowed' : 'pointer'
          }}>
          Parar
        </button>
      </div>
      <p style={{ marginTop: '30px', fontSize: '18px', color: '#666' }}>
        {reproduciendo ? 'Reproduciendo...' : 'Pulsa Reproducir para escuchar la lectura'}
      </p>
    </div>
  )
}

function VistaProfe({ onVolver }) {
  const [paso, setPaso] = useState('formulario')
  const [texto, setTexto] = useState('')
  const [imagen, setImagen] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [leccion, setLeccion] = useState(null)
  const [leccionId, setLeccionId] = useState(null)

  const reducirImagen = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxLado = 1600
          
          let ancho = img.width
          let alto = img.height
          
          if (ancho > alto) {
            if (ancho > maxLado) {
              alto = (alto * maxLado) / ancho
              ancho = maxLado
            }
          } else {
            if (alto > maxLado) {
              ancho = (ancho * maxLado) / alto
              alto = maxLado
            }
          }
          
          canvas.width = ancho
          canvas.height = alto
          
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, ancho, alto)
          
          canvas.toBlob((blob) => {
            const reader2 = new FileReader()
            reader2.onload = () => resolve(reader2.result)
            reader2.readAsDataURL(blob)
          }, 'image/jpeg', 0.85)
        }
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMensaje('')
    setPaso('procesando')

    try {
      let textoFinal = texto

      if (imagen) {
        setMensaje('Leyendo la página...')
        const imagenReducida = await reducirImagen(imagen)
        
        const resTranscripcion = await fetch('/api/transcribir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imagen: imagenReducida })
        })
        
        if (!resTranscripcion.ok) {
          throw new Error('Error al transcribir la imagen')
        }
        
        const dataTranscripcion = await resTranscripcion.json()
        textoFinal = dataTranscripcion.texto
      }

      if (!textoFinal.trim()) {
        throw new Error('No hay texto para crear la lección')
      }

      setMensaje('Preparando la lección...')
      
      const resLeccion = await fetch('/api/generar-leccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: textoFinal })
      })
      
      if (!resLeccion.ok) {
        const error = await resLeccion.json()
        throw new Error(error.detail || 'Error al generar la lección')
      }
      
      const dataLeccion = await resLeccion.json()
      setLeccion(dataLeccion.leccion)
      setLeccionId(dataLeccion.id)
      setPaso('revision')
      setMensaje('')
    } catch (error) {
      setMensaje(error.message)
      setPaso('error')
    }
  }

  const handlePublicar = async () => {
    try {
      const res = await fetch(`/api/leccion/${leccionId}/publicar`, {
        method: 'POST'
      })
      
      if (!res.ok) throw new Error('Error al publicar')
      
      setMensaje('¡Lección publicada!')
      setPaso('publicada')
    } catch (error) {
      setMensaje(error.message)
    }
  }

  const handleReintentar = () => {
    setPaso('formulario')
    setMensaje('')
  }

  const handleGuardarCambios = async () => {
    try {
      await fetch(`/api/leccion/${leccionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: leccion.titulo,
          contenido: leccion
        })
      })
      setMensaje('Cambios guardados')
    } catch (error) {
      setMensaje('Error al guardar cambios')
    }
  }

  if (paso === 'publicada') {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ color: '#50c878', marginBottom: '30px' }}>¡Lección publicada!</h1>
        <p style={{ fontSize: '20px', marginBottom: '30px' }}>Los alumnos ya pueden verla.</p>
        <button
          onClick={() => {
            setPaso('formulario')
            setTexto('')
            setImagen(null)
            setLeccion(null)
            setLeccionId(null)
            setMensaje('')
          }}
          style={{
            padding: '20px 40px',
            fontSize: '22px',
            backgroundColor: '#4a90e2',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer'
          }}>
          Crear otra lección
        </button>
        <button
          onClick={onVolver}
          style={{
            marginLeft: '10px',
            padding: '20px 40px',
            fontSize: '22px',
            backgroundColor: '#999',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer'
          }}>
          Volver al inicio
        </button>
      </div>
    )
  }

  if (paso === 'revision' && leccion) {
    return (
      <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
        <button
          onClick={onVolver}
          style={{
            padding: '10px 20px',
            fontSize: '18px',
            backgroundColor: '#999',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            marginBottom: '20px'
          }}>
          Volver
        </button>

        <h1 style={{ marginBottom: '30px' }}>Revisar y publicar</h1>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '18px', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>
            Título:
          </label>
          <input
            type="text"
            value={leccion.titulo}
            onChange={(e) => setLeccion({ ...leccion, titulo: e.target.value })}
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '20px',
              border: '2px solid #ddd',
              borderRadius: '10px'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '18px', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>
            Lectura fácil:
          </label>
          <textarea
            value={leccion.lectura_facil}
            onChange={(e) => setLeccion({ ...leccion, lectura_facil: e.target.value })}
            rows={4}
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '18px',
              border: '2px solid #ddd',
              borderRadius: '10px'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '18px', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>
            Explicación con ejemplo:
          </label>
          <textarea
            value={leccion.explicacion_ejemplo}
            onChange={(e) => setLeccion({ ...leccion, explicacion_ejemplo: e.target.value })}
            rows={3}
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '18px',
              border: '2px solid #ddd',
              borderRadius: '10px'
            }}
          />
        </div>

        <h2 style={{ marginTop: '30px', marginBottom: '15px' }}>Preguntas del test</h2>
        
        {leccion.preguntas.map((p, idx) => (
          <div key={idx} style={{ marginBottom: '25px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '10px' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>
              Pregunta {idx + 1}:
            </label>
            <input
              type="text"
              value={p.pregunta}
              onChange={(e) => {
                const nuevas = [...leccion.preguntas]
                nuevas[idx].pregunta = e.target.value
                setLeccion({ ...leccion, preguntas: nuevas })
              }}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                marginBottom: '10px',
                border: '2px solid #ddd',
                borderRadius: '8px'
              }}
            />
            
            {p.opciones.map((op, opIdx) => (
              <div key={opIdx} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                <input
                  type="radio"
                  checked={p.correcta === opIdx}
                  onChange={() => {
                    const nuevas = [...leccion.preguntas]
                    nuevas[idx].correcta = opIdx
                    setLeccion({ ...leccion, preguntas: nuevas })
                  }}
                  style={{ marginRight: '10px', width: '20px', height: '20px' }}
                />
                <input
                  type="text"
                  value={op}
                  onChange={(e) => {
                    const nuevas = [...leccion.preguntas]
                    nuevas[idx].opciones[opIdx] = e.target.value
                    setLeccion({ ...leccion, preguntas: nuevas })
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontSize: '16px',
                    border: '2px solid #ddd',
                    borderRadius: '8px'
                  }}
                />
              </div>
            ))}
            
            <input
              type="text"
              placeholder="Por qué es correcta"
              value={p.porque}
              onChange={(e) => {
                const nuevas = [...leccion.preguntas]
                nuevas[idx].porque = e.target.value
                setLeccion({ ...leccion, preguntas: nuevas })
              }}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                marginTop: '10px',
                border: '2px solid #ddd',
                borderRadius: '8px'
              }}
            />
          </div>
        ))}

        <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }}>
          <button
            onClick={handleGuardarCambios}
            style={{
              flex: 1,
              padding: '20px',
              fontSize: '20px',
              backgroundColor: '#999',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer'
            }}>
            Guardar cambios
          </button>
          <button
            onClick={handlePublicar}
            style={{
              flex: 1,
              padding: '20px',
              fontSize: '20px',
              backgroundColor: '#50c878',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}>
            Publicar
          </button>
        </div>

        {mensaje && (
          <p style={{ marginTop: '20px', fontSize: '18px', color: '#50c878' }}>
            {mensaje}
          </p>
        )}
      </div>
    )
  }

  if (paso === 'procesando') {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          border: '6px solid #4a90e2',
          borderTop: '6px solid #f5f5f5',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 30px'
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <p style={{ fontSize: '24px', color: '#4a90e2' }}>{mensaje}</p>
      </div>
    )
  }

  if (paso === 'error') {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ color: '#e74c3c', marginBottom: '20px' }}>Error</h2>
        <p style={{ fontSize: '20px', color: '#666', marginBottom: '30px' }}>{mensaje}</p>
        <button
          onClick={handleReintentar}
          style={{
            padding: '20px 40px',
            fontSize: '22px',
            backgroundColor: '#4a90e2',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            marginRight: '10px'
          }}>
          Reintentar
        </button>
        <button
          onClick={onVolver}
          style={{
            padding: '20px 40px',
            fontSize: '22px',
            backgroundColor: '#999',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer'
          }}>
          Volver
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <button
        onClick={onVolver}
        style={{
          padding: '10px 20px',
          fontSize: '18px',
          backgroundColor: '#999',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}>
        Volver
      </button>

      <h1 style={{ marginBottom: '30px' }}>Crear una lección</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '30px' }}>
          <label style={{ fontSize: '20px', fontWeight: 'bold', display: 'block', marginBottom: '15px' }}>
            Pega el texto de la página del libro:
          </label>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={6}
            placeholder="O sube una foto después..."
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '18px',
              border: '2px solid #ddd',
              borderRadius: '10px'
            }}
          />
        </div>

        <div style={{ marginBottom: '30px' }}>
          <label style={{ fontSize: '20px', fontWeight: 'bold', display: 'block', marginBottom: '15px' }}>
            O sube una foto de la página:
          </label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setImagen(e.target.files[0])}
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '18px',
              border: '2px solid #ddd',
              borderRadius: '10px',
              backgroundColor: 'white'
            }}
          />
          {imagen && (
            <p style={{ marginTop: '10px', color: '#50c878', fontSize: '18px' }}>
              ✓ Foto seleccionada: {imagen.name}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!texto && !imagen}
          style={{
            width: '100%',
            padding: '25px',
            fontSize: '24px',
            backgroundColor: texto || imagen ? '#4a90e2' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: texto || imagen ? 'pointer' : 'not-allowed',
            fontWeight: 'bold'
          }}>
          Crear lección
        </button>
      </form>
    </div>
  )
}

export default App
