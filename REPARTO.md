# Reparto: quién toca qué

En esta carpeta trabajan **dos IAs a la vez**: **Claude** y **ChatGPT**. Para no pisarse, cada una tiene **sus archivos** y solo edita esos.
**Si dudas de si un archivo es tuyo, no lo es.**

## 1. Archivos de cada una

| Archivo | De quién | La otra… |
|---|---|---|
| `api/main.py` | Claude | lo puede leer |
| `web/src/App.jsx` | Claude | lo puede leer |
| `web/src/comun.jsx` (estilos, `api()`, `Cargando`, `Aviso`…) | Claude | lo puede **importar**, no editar |
| `web/package.json`, `web/package-lock.json`, `api/.venv` | Claude | pide las librerías nuevas en «Peticiones» |
| `api/panel.py` | **ChatGPT** | lo puede leer |
| `web/src/Panel.jsx` | **ChatGPT** | lo puede leer |
| `api/demo.py` (nuevo) | **ChatGPT** | lo puede leer |
| `web/public/`, `web/vite.config.js`, `web/index.html` | **ChatGPT** | lo puede leer |
| `docs/` (nueva) | **ChatGPT** | lo puede leer |
| `AGENTS.md`, `REPARTO.md`, `PROMPTS para GLM-5.txt`, `movil.sh`, `.gitignore` | Fernando | solo se añaden líneas en «Peticiones» |

`panel.py` y `Panel.jsx` **ya están conectados** a la app: «Ver notas» en la pantalla de una clase abre `Panel.jsx`, y las rutas de `router` en `panel.py` ya funcionan. ChatGPT no necesita tocar `main.py` ni `App.jsx`.

## 2. Tareas

### ChatGPT
- **C1. Notas de la clase** (`api/panel.py` + `web/src/Panel.jsx`). Una tabla con un alumno por fila y una lección por columna, con los aciertos (por ejemplo 4/5) y la fecha de su última respuesta. Arriba y en naranja, «Se está quedando atrás»: quien saca menos de 3 de 5 o lleva más de 3 días sin enviar nada.
  - Los datos ya están en la base de datos (ver apartado 4). Una respuesta es correcta si `respuestas.respuesta` es igual a `preguntas[respuestas.pregunta].correcta` del JSON `lecciones.contenido`. Si un alumno repite el test, cuenta su última respuesta a cada pregunta.
  - Las respuestas reales llegan cuando Claude termine la tarea A1. Mientras tanto, prueba con los datos de C2.
- **C2. Datos para la demo** (`api/demo.py`). Un script que se lanza con `cd api && .venv/bin/python demo.py` y crea la clase `AULA23` («5.º A · Ciencias») con 6 alumnos, 2 lecciones publicadas y respuestas repartidas en varios días (dos alumnos «quedándose atrás»). Si se lanza dos veces, no duplica nada. **Solo borra o cambia lo de la clase `AULA23`.**
- **C3. Iconos para instalar la app**: PNG de 192 y 512 px, `apple-touch-icon` de 180 px, el manifiesto en `vite.config.js` y el enlace en `index.html`.
- **C4. Presentación** (`docs/`): el pitch de 3 minutos y el guion de la demo paso a paso.

### Claude
- **A1. Sincronización**: enviar las respuestas «pendientes» del móvil al servidor (`POST /api/sync`, sin duplicados) y una barra arriba con «Sin conexión · N por enviar» / «Todo enviado».
- **A2. Avisos del profe** a sus alumnos, que llegan con la sincronización.
- **A3. Juntarlo todo y probarlo** de punta a punta, también en el móvil.

## 3. Reglas

1. **Solo editas tus archivos.** Tampoco «pequeños arreglos» en los de la otra.
2. ¿Necesitas un cambio en un archivo que no es tuyo? **Escríbelo en «Peticiones»** (al final, solo añadiendo líneas) y sigue con otra cosa.
3. **Commit a menudo y solo de tus archivos**, nombrándolos, con tu prefijo:
   `git add api/panel.py web/src/Panel.jsx && git commit -m "[chatgpt] notas de la clase"`
   **Nunca** `git add -A` ni `git add .`: te llevarías el trabajo a medias de la otra.
4. **Prohibido**: `git checkout -- .`, `git restore`, `git reset`, `git stash`, `git clean`, `git rebase`, `git commit --amend`, `git push --force`. Borran o reescriben el trabajo de la otra.
5. No formatees, ordenes ni renombres archivos que no son tuyos (nada de `prettier`/`black` sobre todo el proyecto).
6. **No arranques servidores**: la API (8000) y la web (5173) ya están encendidas y se recargan solas al guardar.
7. **No cambies la base de datos** (tablas y columnas) **ni las rutas que ya existen**. Puedes leer todo.
8. No instales librerías: pídelas en «Peticiones».
9. Al empezar: lee `AGENTS.md` y este archivo, y mira `git log --oneline -5`.

## 4. Lo que no cambia (para poder trabajar a la vez)

Tablas de `api/mochila.db`:
- `clases(codigo, nombre, creada)`
- `alumnos(id, nombre)`
- `matriculas(clase, alumno, fecha)`: qué alumno está en qué clase.
- `lecciones(id, clase, titulo, contenido, fecha, publicada)`. `contenido` es JSON: `{titulo, lectura_facil, explicacion_ejemplo, preguntas: [{pregunta, opciones[4], correcta (0-3), porque}]}`.
- `respuestas(id, alumno, leccion_id, pregunta, respuesta, fecha)`. `pregunta` y `respuesta` son posiciones (0, 1, 2…); `alumno` es `alumnos.id`; `fecha` en ISO.

Rutas que ya hay: `GET /api/salud`, `GET|POST /api/clases`, `GET /api/clases/{codigo}`, `POST /api/clases/{codigo}/unirse`, `GET /api/alumnos/{id}/clases`, `POST /api/leer-foto`, `POST /api/clases/{codigo}/lecciones`, `GET|PUT /api/leccion/{id}`, `GET /api/clases/{codigo}/panel` (de ChatGPT).

## 5. Peticiones

(Formato: `- [quién pide → a quién] qué hace falta y por qué`. Solo añadir líneas.)

