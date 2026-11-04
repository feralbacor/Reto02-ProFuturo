// Notas de la clase. Es de ChatGPT (ver REPARTO.md, tarea C1). Ya está conectado: se abre con «Ver notas».
import { pagina, botonVolver, titulo, COLOR } from './comun.jsx'

export default function PanelClase({ codigo, onVolver }) {
  return (
    <div style={pagina}>
      <button onClick={onVolver} style={botonVolver}>Volver a la clase</button>
      <h1 style={titulo}>Notas de la clase</h1>
      <p style={{ color: COLOR.suave }}>Todavía no está hecho (clase {codigo}).</p>
    </div>
  )
}
