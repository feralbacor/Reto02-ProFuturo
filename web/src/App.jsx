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
      <h1>Soy alumno (en desarrollo)</h1>
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
