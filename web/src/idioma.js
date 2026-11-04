// Idioma de la app. Los textos se escriben en español dentro del código: t('Soy estudiante').
// Cada idioma es un JSON «texto en español → traducción» en textos/. Si falta uno, se usa el inglés y, si no, el español.
const archivos = import.meta.glob('./textos/*.json', { eager: true, import: 'default' })
const TEXTOS = Object.fromEntries(Object.entries(archivos).map(([ruta, textos]) => [ruta.match(/(\w+)\.json$/)[1], textos]))

// Bandera del país donde más se habla en África (para las lenguas europeas, la de su país de origen).
export const IDIOMAS = [
  { codigo: 'fr', nombre: 'Français', bandera: '🇫🇷' },
  { codigo: 'en', nombre: 'English', bandera: '🇬🇧' },
  { codigo: 'es', nombre: 'Español', bandera: '🇪🇸' },
  { codigo: 'ar', nombre: 'العربية', bandera: '🇪🇬', dir: 'rtl' },
  { codigo: 'pt', nombre: 'Português', bandera: '🇵🇹' },
  { codigo: 'sw', nombre: 'Kiswahili', bandera: '🇰🇪' },
  { codigo: 'am', nombre: 'አማርኛ', bandera: '🇪🇹' },
  { codigo: 'om', nombre: 'Afaan Oromoo', bandera: '🇪🇹' },
  { codigo: 'ti', nombre: 'ትግርኛ', bandera: '🇪🇷' },
  { codigo: 'so', nombre: 'Soomaali', bandera: '🇸🇴' },
  { codigo: 'ha', nombre: 'Hausa', bandera: '🇳🇬' },
  { codigo: 'yo', nombre: 'Yorùbá', bandera: '🇳🇬' },
  { codigo: 'ig', nombre: 'Igbo', bandera: '🇳🇬' },
  { codigo: 'ak', nombre: 'Twi', bandera: '🇬🇭' },
  { codigo: 'wo', nombre: 'Wolof', bandera: '🇸🇳' },
  { codigo: 'ln', nombre: 'Lingála', bandera: '🇨🇩' },
  { codigo: 'rw', nombre: 'Ikinyarwanda', bandera: '🇷🇼' },
  { codigo: 'mg', nombre: 'Malagasy', bandera: '🇲🇬' },
  { codigo: 'ny', nombre: 'Chichewa', bandera: '🇲🇼' },
  { codigo: 'sn', nombre: 'chiShona', bandera: '🇿🇼' },
  { codigo: 'zu', nombre: 'isiZulu', bandera: '🇿🇦' },
  { codigo: 'xh', nombre: 'isiXhosa', bandera: '🇿🇦' },
  { codigo: 'af', nombre: 'Afrikaans', bandera: '🇿🇦' },
].filter(i => i.codigo === 'es' || TEXTOS[i.codigo])

const existe = (codigo) => IDIOMAS.some(i => i.codigo === codigo)
let actual = (() => {
  let guardado = null
  try { guardado = localStorage.getItem('idioma') } catch { /* sin almacenamiento: el del móvil */ }
  return [guardado, (navigator.language || '').slice(0, 2)].find(existe) || 'es'
})()

const aplicar = () => {
  document.documentElement.lang = actual
  document.documentElement.dir = IDIOMAS.find(i => i.codigo === actual)?.dir || 'ltr'
}
aplicar()

export const idioma = () => actual

export function cambiarIdioma(codigo) {
  if (!existe(codigo)) return
  actual = codigo
  try { localStorage.setItem('idioma', codigo) } catch { /* solo para esta vez */ }
  aplicar()
}

// t('Hola, {nombre}', { nombre }) → «Bonjour, Amina». Lo que no está en ningún idioma (lo que escribe el profe) sale tal cual.
export function t(texto, datos) {
  const traducido = (actual !== 'es' && (TEXTOS[actual]?.[texto] || TEXTOS.en?.[texto])) || texto
  return datos ? traducido.replace(/\{(\w+)\}/g, (m, k) => (k in datos ? datos[k] : m)) : traducido
}

// ponytail: singular/plural nada más; el árabe y otros tienen más formas, el plural vale para la demo.
export const plural = (n, uno, varios) => t(n === 1 ? uno : varios, { n })
