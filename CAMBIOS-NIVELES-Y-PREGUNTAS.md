# Cambios: lecciones con nivel, preguntas a medida y la IA Qwen en local

Rama **`profe-sin-conexion`**. Esta subida trae lo que no estaba en GitHub desde `1f78d66`. El detalle de todo lo de la rama está en `CAMBIOS-PROFE.md`.

## Resumen

| Commit | Qué hace |
|---|---|
| `5ae19ea` | «Subir un archivo»: la lección se puede hacer con un PDF, Word, PowerPoint, LibreOffice o texto |
| `343fa75` | Editar lecciones publicadas y borradores, también sin conexión, y las que esperan en «Por preparar» |
| `2c29a5e` | Unión con `main` (idiomas, dudas, tutor), con los choques resueltos |
| `3ed1b14` | **Nivel de dificultad de la lección, de 0 a 5** |
| `9477a78` | Sin límite de palabras ni de tiempo, y **sin cola de la IA** |
| `0c02277`, `37e3531` | Barra para el nivel, nuevo orden de los pasos, y **la clase es la materia** |
| `74c194e` | La IA usa siempre el mismo contexto (16 384), para que no se cuelgue |
| `256f28f` | **Cuántas preguntas (0 a 30) y su dificultad (0 a 5)** |
| `485da6e` | Al guardar o publicar una lección, **vuelve sola a la clase** |

## Archivos que se modifican (solo lo nuevo desde la unión con `main`, `2c29a5e`)

| Archivo | Líneas |
|---|---|
| `api/main.py` | +93 / −17 |
| `web/src/App.jsx` | +101 / −55 |
| `web/src/estilo.css` | +7 (la barra) |
| `api/comprobar_profe.py` | +26 / −1 |
| `CAMBIOS-PROFE.md`, `REPARTO.md` | documentación |
| `CAMBIOS-NIVELES-Y-PREGUNTAS.md` (este archivo) | nuevo |

Para verlo: `git diff --stat 2c29a5e..profe-sin-conexion`.

## 1. «Nueva lección» paso a paso

Ahora tiene 6 pasos:

1. **El título** (si se deja vacío, lo pone la IA)
2. **Las fotos o los archivos** (foto, galería, o PDF, Word, PowerPoint, LibreOffice, texto)
3. **El nivel**: una barra del 0 al 5
4. **Las preguntas**: dos barras, cuántas y de qué dificultad
5. **El texto**
6. **El idioma**

**Ya no se pide la materia: la clase es la materia.** Se entra en la clase, se pulsa «Nueva lección» y la lección se guarda con el nombre de la clase como materia, que se ve encima del título.

Todas las barras son iguales (el componente `Barra` de `App.jsx`): se arrastran o se toca el número de debajo. Debajo explica lo elegido.

## 2. Nivel de la lección (0 a 5)

| Nivel | Cómo es |
|---|---|
| 0 · Lo esencial | Solo la idea principal, muy corta y sencilla (unas 60–120 palabras) |
| 1 · Básico | Las ideas principales, con frases cortas (como eran antes) |
| 2 · Normal | Lo que se espera en ese curso, con sus palabras técnicas explicadas |
| 3 · Completo | Todas las ideas del texto, con definiciones (al menos 350 palabras, sin máximo) |
| 4 · Avanzado | Técnico: cómo funciona, tipos, causas y consecuencias (al menos 550, sin máximo) |
| 5 · Experto | Lo más extenso y técnico (al menos 800, sin máximo) |

- **El nivel depende del tema.** La IA mira primero para qué curso es el texto (primaria, ESO, bachillerato, FP o universidad) y el nivel sube o baja dentro de ese curso. Un 4 de 2.º de la ESO es más fácil que un 2 de 3.º de carrera.
- Del nivel 3 al 5 se leen hasta 20 000 letras del texto (antes 8 000).

## 3. Las preguntas: cuántas y de qué dificultad

- **Cuántas:** 0, 5, 10, 15, 20, 25 o 30. Con 0, la lección no lleva test: el alumno lee, ve el ejemplo y vuelve a sus lecciones.
- **Dificultad (0 a 5):** Muy fáciles · Fáciles · Normales · Algo difíciles · Difíciles · Muy difíciles. Va aparte del nivel de la lección, y también según el curso del texto.
- Con muchas preguntas, Qwen repite alguna: se quitan las repetidas y se queda el resto. Si quedan menos de la mitad, lo intenta otra vez.

## 4. La IA (Qwen) en este ordenador

- **Instalado:** Ollama 0.40.14 en `~/.local/ollama` (sin Homebrew ni permisos de administrador) y el modelo `qwen3-vl:4b-instruct` (3,3 GB), el mismo que usa el equipo.
- Se arranca con `~/.local/bin/ollama serve`. Si dice «address already in use», ya estaba en marcha.
- **Sin límite de palabras ni prisa:** la IA escribe hasta terminar, con un tope de seguridad al llenar su memoria, para que no se quede repitiendo sin fin. La API la espera hasta 30 minutos.
- **Contexto fijo de 16 384 (unos 5,7 GB de RAM):** antes cambiaba entre 8 192 y 16 384, Ollama recargaba el modelo en cada cambio y una vez se quedó colgado.
- **Sin cola de la IA:** si la IA está apagada, tarda demasiado o falla, el error sale al momento. «Por preparar» queda solo para cuando no hay conexión, y ya no se prepara sola: se pulsa «Preparar ahora».

## 5. Revisar la lección

- Al pulsar «Publicar» o «Guardar los cambios», vuelve sola a la clase con el aviso arriba («Publicada…», «Guardado.» o «Sin conexión: guardado en este aparato…»).

## API (`api/main.py`)

`POST /api/clases/{codigo}/lecciones` acepta, además de lo de antes:

| Campo | Valores | Si no llega |
|---|---|---|
| `nivel` | 0 a 5 | 1 (como antes) |
| `preguntas` | 0, 5, 10… 30 | las del nivel (5 a 10) |
| `dificultad_preguntas` | 0 a 5 | la del nivel |

La lección guarda `nivel` y `dificultad_preguntas` en `contenido`. Una lección válida puede tener ahora de 0 a 30 preguntas (antes de 1 a 10).

## Probado con Qwen (Mac M3, el PDF del tema 5 de Arquitectura de Computadores)

- Nivel 1: 45 s, 115 palabras, sencillo.
- Nivel 5: entre 4 y 5 minutos, unas 420 palabras técnicas.
- 15 preguntas de dificultad 0: 89 s, quedaron 12, con respuestas falsas evidentes.
- 15 preguntas de dificultad 5: 161 s, las 15, con respuestas falsas parecidas a la buena.

## Cómo comprobarlo

- Pruebas: `cd api && .venv/bin/python comprobar_profe.py` → todas «todo bien», también «Nivel de dificultad» y «Número y dificultad de las preguntas». Necesita `httpx` en el `.venv`.
- A mano, con la API y Ollama en marcha, en `http://localhost:4173` (o `npm run dev`):
  1. Entra como profe, abre una clase y pulsa «Nueva lección»: no pide la materia.
  2. Sube un PDF, pon el nivel en 1 y 5 preguntas «Normales», y prepara la lección.
  3. Repite con el nivel 5 y 15 preguntas «Muy difíciles»: es más larga y técnica, y las preguntas más difíciles.
  4. Haz otra con 0 preguntas. Publícala: vuelve sola a la clase con «Publicada…». Como alumno, la lección solo tiene «Leer» y «Ejemplo».

## Ojo

- **`main` ha avanzado** desde la unión: entre otras cosas, el profe puede añadir preguntas a mano «hasta 10» (`8489587`). Al unir esta rama con `main` hay que mirarlo, porque aquí una lección puede tener hasta 30 preguntas.
- **Túnel de Cloudflare:** corta las peticiones que tardan más de unos 100 s. Desde el móvil por el túnel, las lecciones largas acaban en «Por preparar», aunque se siguen preparando en el ordenador. En el Mac (localhost) no pasa.
- Los textos nuevos (barras, niveles, dificultades) pasan por `t()`, pero aún no están traducidos: en otros idiomas salen en español.
- Qwen es un modelo pequeño: en el nivel 5 escribe menos de lo que se le pide y la dificultad 5 no llega a la de un examen de carrera exigente.
