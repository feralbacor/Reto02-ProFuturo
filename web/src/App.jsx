import { useState, useEffect } from 'react'

function App() {
  const [apiStatus, setApiStatus] = useState('Conectando...')

  useEffect(() => {
    fetch('/api/salud')
      .then(res => res.json())
      .then(data => setApiStatus(data.mensaje))
      .catch(() => setApiStatus('Sin conexión'))
  }, [])

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
        <button style={{
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

        <button style={{
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

export default App
