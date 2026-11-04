# Guion de la demo

## Preparación en este ordenador

Desde la raíz del proyecto, en la rama `chatgpt`:

```sh
git branch --show-current
cd api
.venv/bin/python demo.py --comprobar
.venv/bin/python demo.py
cd ..
api/.venv/bin/python docs/comprobar_panel.py
```

El script crea AULA23, seis alumnos y dos lecciones publicadas. No reinicia los datos al repetirlo. En el panel inicial Diego tiene 2/5 en cada lección y Elena no responde desde hace cinco días; los otros cuatro tienen al menos 3/5 y respuestas recientes. Son datos ficticios. Si se prepararon hace días, las fechas conservadas pueden hacer que aparezcan más avisos de inactividad.

Arranque manual en terminales separadas (los agentes no arrancan servidores):

```sh
cd api
.venv/bin/uvicorn main:app --reload --port 8000
```

```sh
cd web
npm run dev
```

Desarrollo: http://localhost:5173. Sirve para revisar el panel. **Para probar la reapertura offline hay que usar la compilación de producción:** el service worker no está activado en desarrollo.

En otra terminal, sin cambiar el puerto de una sesión durante la demo:

```sh
cd web
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Abrir http://localhost:4173. El proxy de preview hereda `/api` de la configuración del servidor y requiere la API en el puerto 8000. Esperar a que el service worker esté activado y recargar una vez con conexión. No mezclar puertos: cada origen guarda sus propios datos.

En un móvil hace falta HTTPS para instalar y usar el service worker; `http://IP-del-ordenador` no basta. Claude mantiene `movil.sh` y la integración móvil. Para usar IA sin Internet, descargar antes el modelo y comprobar Ollama local sin depender de un túnel a una GPU remota. Para mis tareas, Ollama puede estar apagado.

## Recorrido ante el jurado

| Paso | Acción | Resultado que se debe comprobar |
| --- | --- | --- |
| 1 | «Soy profe» → «5.º A · Ciencias» → «Ver notas». | Seis alumnos, dos lecciones, notas y fechas. Diego y Elena aparecen en naranja. Aclarar que son datos ficticios. |
| 2 | Volver al inicio → «Soy alumno». Crear un perfil de prueba y unirse con AULA23. | Aparecen las dos lecciones completas. Este alumno adicional empezará sin respuestas. |
| 3 | Abrir una lección y después activar Offline en las herramientas del navegador. | Lectura, ejemplo y test siguen disponibles. Recargar para comprobar que la aplicación también vuelve a abrir sin red. |
| 4 | Responder las cinco preguntas. | Corrección inmediata y respuestas conservadas localmente. Con A1 integrada, la barra muestra las pendientes. |
| 5 | Desactivar Offline, esperar la sincronización. | Con A1 integrada, pendientes a cero y respuestas guardadas en el servidor. |
| 6 | Volver a «Soy profe» → clase → «Ver notas» → «Actualizar notas». | La fila del alumno de prueba muestra sus aciertos y la fecha. |
| 7 | Opcional: crear una lección con una foto del libro y revisarla. | Lectura, ejemplo y preguntas editables antes de publicar. Ensayar previamente con Ollama local. |

En un teléfono, modo avión también desconecta la wifi: el material descargado debe seguir funcionando. Al recuperar la red del aula, comprobar el envío. Una red wifi local puede conectar el móvil con el ordenador sin ofrecer Internet.

## Qué comprobar antes del ensayo

- C1 y C2 funcionan sin Ollama: ejecutar ambos comandos de comprobación anteriores.
- A1 (sincronización) es de Claude y no está implementada en el commit base de esta rama. Los pasos 4–6 completos requieren integrar y probar su trabajo. No presentar el flujo como completado hasta verlo funcionar.
- Un test repetido cuenta la última respuesta de cada pregunta. El panel no penaliza como nota baja un test todavía incompleto; muestra las preguntas respondidas. El umbral es menos del 60 % en tests completos.
- La inactividad se mide por la fecha de las respuestas; sin ellas, desde la matrícula. El servidor no dispone de una fecha separada de recepción: no equivale a una prueba de abandono escolar.
- Revisar el panel a 360 px: texto de al menos 18 px, botones de al menos 48 px y tabla desplazable horizontalmente sin ensanchar toda la página.
- En Android compatible, instalar desde el menú del navegador. En Safari iOS, «Añadir a pantalla de inicio». Verificar que se utiliza el icono de la mochila y que la app abre.
- Escuchar offline exige una voz local disponible en el dispositivo. Si no la hay, demostrar lectura y test; no prometer audio offline universal.
- Si falla la IA, usar las dos lecciones preparadas y explicar que no son una generación en directo.
- Si no llega la sincronización, conservar los pendientes y enseñar el panel con datos ficticios, indicando expresamente qué parte no se ha podido demostrar. No manipular notas para simular un envío.

## Entrega a Claude

Archivos de integración: `api/panel.py`, `web/src/Panel.jsx`, `api/demo.py`, iconos en `web/public/`, `web/vite.config.js`, `web/index.html` y `docs/`.

La ruta existente `GET /api/clases/{codigo}/panel` solo lee las tablas compartidas. Devuelve `codigo`, `nombre`, `lecciones: [{id,titulo}]` y `alumnos: [{id,nombre,notas,ultima_respuesta,motivos}]`. Cada nota contiene `leccion_id`, `aciertos`, `total`, `respondidas` y `ultima_respuesta`. No hay cambios de esquema ni de las rutas de Claude.

Los commits llevan prefijo `[chatgpt]` y deben integrarse desde la rama `chatgpt`. No publicar esta rama sobre `main` directamente desde este ordenador.
