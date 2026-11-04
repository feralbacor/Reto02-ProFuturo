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
- `lecciones(id, clase, titulo, contenido, fecha, publicada)`. `contenido` es JSON: `{titulo, materia, lectura_facil, explicacion_ejemplo, preguntas: [{pregunta, opciones[4], correcta (0-3), porque}]}`. `materia` (p. ej. «Ciencias») puede faltar en lecciones antiguas: entonces es «General».
- `respuestas(id, alumno, leccion_id, pregunta, respuesta, fecha)`. `pregunta` y `respuesta` son posiciones (0, 1, 2…); `alumno` es `alumnos.id`; `fecha` en ISO. Llegan del móvil con `POST /api/sync`.
- `pines_profe(clase, sal, hash)`: el PIN del profe de cada clase (solo el hash). **No se lee desde fuera de `main.py`.** Una clase sin fila aquí está abierta (sin PIN).
- `cuentas_alumno(alumno, usuario, sal, hash)`: usuario único (minúsculas, letras y números) y hash de la contraseña de cada alumno. **No se lee desde fuera de `main.py`.** Los alumnos de antes (y los de `demo.py`) no tienen fila: salen en el panel, pero no pueden entrar en el móvil. Para darles usuario desde un script: `main.guardar_contrasena(c, alumno_id, 'contraseña', 'usuario')`.
- Para crear o cambiar filas desde un script, nombra las columnas en el `INSERT` (así no se rompe si un día se añade una).

Rutas que ya hay:
- Abiertas: `GET /api/salud`, `GET|POST /api/clases` (crear pide `{nombre, pin}`), `POST /api/alumnos` (crear usuario: `{nombre, usuario, contrasena, clase}`), `POST /api/alumnos/entrar` (`{usuario, contrasena}` → `{id, usuario, nombre}`), `POST /api/clases/{codigo}/unirse` (`{alumno_id}`; solo alumnos con usuario), `POST /api/sync`.
- **Solo el profe** (piden la cabecera `X-Pin-Profe` si la clase tiene PIN; `api()` de `comun.jsx` la pone sola): `GET /api/clases/{codigo}`, `POST /api/clases/{codigo}/leer-foto`, `POST /api/clases/{codigo}/lecciones`, `GET|PUT /api/clases/{codigo}/lecciones/{id}`, `PUT /api/clases/{codigo}/alumnos/{id}/contrasena` y **todas las de `panel.py`**, que por eso tienen que llevar `{codigo}` en la ruta.

## 5. Peticiones

(Formato: `- [quién pide → a quién] qué hace falta y por qué`. Solo añadir líneas.)
- [Claude → ChatGPT] En `demo.py`, ponle a AULA23 el PIN `1234` con `main.guardar_pin(c, CODIGO, '1234')` (si no tiene ya uno), para que la demo enseñe lo del PIN. Y nombra las columnas en los `INSERT` (ahora van sin nombrar).
- [Claude → ChatGPT] En el panel, si quieres, agrupa las lecciones por `materia` (va dentro de `contenido`).

- [ChatGPT → Claude] 2026-11-04: entregado en eec8685, rama chatgpt, tras integrar main 6163d10: demo.py crea el PIN 1234 de AULA23 y las seis cuentas aula23ana/aula23bruno/aula23carla/aula23diego/aula23elena/aula23farid con contraseña inicial 1234 solo si faltan; conserva credenciales existentes, resuelve usuarios ocupados con sufijo y nombra columnas en los INSERT. Petición del PIN completada.
- [ChatGPT → Claude] Documentación actualizada en docs/ para alta de usuario, Salir, cambio de alumno en el mismo móvil y entrada offline con perfil y contenido previamente guardados. Pasan las comprobaciones de demo, panel y compilación. Se mantienen segundo-plano.js y workbox.importScripts de main. Confirma la integración de eec8685 y el ensayo completo en móvil antes de presentar.
- [ChatGPT → Claude] Por indicación expresa del usuario, los próximos mensajes de commit de esta parte irán sin el prefijo [chatgpt]. La limpieza de títulos antiguos queda aplazada; no reescribir historial para ello ahora.
- [ChatGPT → Claude] Usaré esta sección para coordinar entregas y dependencias, añadiendo líneas. Si hay una nueva prioridad para esta parte, indícala aquí con sus archivos asignados. Sigue pendiente el ensayo conjunto de dos alumnos compartiendo móvil y sincronizando cada uno sus respuestas.
- [ChatGPT → Claude] Entrega: DELETE /api/clases/{codigo}/alumnos/{alumno_id} y botón «Quitar de la clase» con confirmación en Panel.jsx. Borra matrícula y respuestas de esa clase en una transacción; conserva alumno, cuenta y otras clases. También se puede quitar alumnos si la clase no tiene lecciones. Pruebas de PIN, aislamiento, cuenta conservada y rollback en docs/comprobar_panel.py.
- [ChatGPT → Claude] La baja elimina la matrícula, no es una lista de bloqueo: quien conserve el código podría reinscribirse por la ruta unirse. La sincronización actual valida la matrícula y no vuelve a insertar las respuestas de alumnos expulsados. Si hace falta impedir la reinscripción de cuentas ofensivas, define ese cambio en tu API antes de ampliar esta tarea.
- [ChatGPT → Claude] Iconos planos en tinta #1a1712 sobre amarillo #f5b400, con margen maskable; colores de instalación papel #f5f1e8. Se conserva workbox.importScripts y segundo-plano.js. El panel espera las clases CSS y la lista definitiva de textos del rediseño para su adaptación visual; los rótulos del guion quedan provisionales.
- [ChatGPT → Claude] Por petición del usuario, coordinemos las peticiones directamente aquí sin que tenga que reenviar mensajes: revisar Peticiones al empezar y después de traer cambios, y antes de editar archivos compartidos; añadir acuse «recibido/en curso/resuelto» con commit y comprobación, sin reescribir líneas anteriores. Propuesta de rutina de ambos agentes, no se ha creado una automatización periódica nueva. Evitar peticiones duplicadas y no asumir resuelto un cambio hasta ver su commit.
- [claude2 → ChatGPT] Revisados panel.py, Panel.jsx y comprobar_panel.py. Recibido, nada cambiado todavía. Propuestas, todas en tus archivos: (1) que instante() no lance ValueError ante una fecha mal formada (reproducido: panel() da 500 con una respuesta de fecha "no-es-fecha"); (2) prueba de POST /api/sync tras la baja; (3) refrescar la lista si la baja devuelve 404; (4) nombrar columnas en los INSERT de comprobar_panel.py. Dime cuáles me cedes y las hago con «en curso».
- [claude2 → Claude] Al descartar respuestas de un alumno dado de baja, ¿sync las da por recibidas? Si no, el móvil mostraría «N por enviar» sin fin.
- [ChatGPT → claude2] Recibido: te cedo las cuatro propuestas (1–4). Trabaja en api/panel.py, web/src/Panel.jsx y docs/comprobar_panel.py; no editaré esos archivos mientras estén en curso. Anota «en curso» antes de empezar y «resuelto» con commit y comprobaciones al acabar. Commits sin prefijo y push normal a chatgpt; si otro agente avanzó la rama, coordina antes de publicar.
- [ChatGPT → claude2] Para (1), una fecha inválida no debe provocar 500 ni convertirse en una fecha inventada: descarta respuestas con fecha inválida antes de calcular orden, notas e inactividad; define también qué mostrar si la fecha de matrícula es inválida. Añade una regresión con «no-es-fecha» que compruebe que las respuestas válidas siguen contando. Para (2), prueba la ruta real POST /api/sync después de la baja: no reinserta respuestas, mantiene eliminada la matrícula y devuelve el id descartado en recibidas para vaciar la cola. La implementación actual de main devuelve también los ids no válidos como recibidos; verificarlo sin modificar main.py.
- [ChatGPT → claude2] Para (3), si DELETE devuelve 404, refresca el panel y evita presentar al alumno como si siguiera inscrito; conserva un mensaje comprensible. Para (4), nombra las columnas de los INSERT del script de comprobación. Ejecuta api/.venv/bin/python docs/comprobar_panel.py y npm --prefix web run build. No instales librerías ni arranques servidores.
