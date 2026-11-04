# Mochila — la clase que funciona sin internet

> **Antes de tocar nada, lee `REPARTO.md`**: dos IAs trabajan a la vez en esta carpeta y cada una solo edita sus archivos.

Hackathon, Reto 02 de ProFuturo «Aprender sin conexión». Tenemos **2 días**.
Lo que importa es una demo que funcione de principio a fin, no tener muchas funciones.

## Qué es

Una web que se instala en el móvil (PWA) para escuelas donde internet es lento, caro o no llega.

- **Profe (cuando tiene conexión):** hace una foto a la página del libro (o pega el texto). La IA la convierte en una lección con 4 partes:
  1. Lectura fácil (frases cortas, palabras sencillas).
  2. Explicación con un ejemplo de la vida diaria.
  3. Test de 5 preguntas con 4 opciones y el porqué de la respuesta correcta.
  4. Escuchar: la lectura fácil en voz alta, con la voz del propio navegador (`speechSynthesis`, sin internet y sin coste).
- **Alumno (sin conexión):** las lecciones se descargan la primera vez que hay red. Lee, escucha y hace el test **sin internet**. Sus respuestas se guardan en el móvil.
- **Sincronización:** cuando vuelve la red, el móvil envía solo lo que falta y recibe las lecciones y los avisos nuevos. Arriba siempre se ve el estado: «Sin conexión · 3 respuestas por enviar» o «Todo enviado».
- **Panel del profe:** qué ha hecho cada alumno, su nota en cada test y quién se está quedando atrás.
- Varios alumnos pueden compartir un móvil: al entrar se elige «¿Quién eres?».

## Cómo está hecho (no cambiar sin preguntar)

- `web/`: Vite + React (JavaScript, sin TypeScript). PWA con `vite-plugin-pwa`.
- `api/`: Python 3.11 + FastAPI + SQLite (módulo `sqlite3`, sin ORM).
- **IA local y sin internet**: Ollama en el ordenador del profe, modelo `qwen3-vl:4b-instruct` (3,3 GB) para leer las fotos y para preparar la lección. Elegido midiendo: leyó 184 de 185 palabras de una foto muy mala sin inventarse nada. **No vuelvas a Bedrock ni a otra IA en la nube**: es la idea del reto. Nunca escribas claves en el código.
  - La API prueba primero `localhost:11435` (un túnel a una GPU, si está abierto) y si no, `localhost:11434` (el Ollama del Mac). Todo está en `preguntar_ia()` de `api/main.py`.
  - La lección sale con «structured outputs» de Ollama (`format` = esquema JSON), se valida con `leccion_valida()` y se barajan las opciones.
- Antes de subir una foto, la web la reduce a 1600 px de lado en JPEG (unos 100-300 KB): lee igual de bien y gasta muchos menos datos. Una petición por foto.
- Clases: el profe crea la clase y sale un código de 6 letras. El alumno escribe su nombre y el código. El alumno vive en el móvil (`alumno-perfil` en `localStorage`, con un id) y puede estar en varias clases. `GET /api/alumnos/{id}/clases` devuelve sus clases con las lecciones publicadas enteras, para poder usarlas sin conexión.
- Datos en el móvil: `localStorage`. Cada respuesta lleva un `id` (`nuevoId()`) y el id del alumno, y va a una cola «pendientes».
- Sincronización: `POST /api/sync` con los pendientes y la fecha del último sync. El servidor guarda con `INSERT OR IGNORE` por `id`: si llega dos veces, no se duplica. Devuelve las lecciones y los avisos nuevos desde esa fecha. Se sincroniza al abrir la app, con el evento `online` y cada 30 s.
- Sin cuentas ni contraseñas: basta con el código de la clase. Es una demo.

## Reglas

- Pasos pequeños. Al acabar cada paso, dime **cómo comprobarlo** (qué abrir y qué debería salir) y propón un `git commit`.
- Lo más sencillo que funcione. No añadas librerías si se puede hacer con pocas líneas.
- **A la IA solo le llega el contenido de la lección, nunca nombres ni datos de alumnos.** Esto es un punto fuerte del proyecto: no lo rompas.
- Interfaz en español, letra grande, botones grandes, palabras sencillas. Tiene que ir bien en un Android barato y con pantalla pequeña.
- Que pese poco: nada de imágenes ni fuentes pesadas.
- **No ejecutes comandos `aws`** ni borres nada fuera de esta carpeta.
- Tú no ves imágenes. Si te paso una captura, dime que no la ves y pídeme que te copie el texto. **No te inventes lo que pone.**
- Si algo falla dos veces seguidas, para y explícame qué pasa antes de seguir cambiando cosas.
- **No ejecutes uvicorn ni npm run dev**: se quedan esperando para siempre. Los servidores los arranco yo en otras pestañas.

## Cómo arrancarlo (ir actualizando)

- API: `cd api && source .venv/bin/activate && uvicorn main:app --reload --port 8000`
- Web: `cd web && npm run dev` (el proxy de Vite manda `/api` al puerto 8000)
- El modo sin conexión (service worker) **solo funciona en `localhost` o con https**. Para la demo: Chrome en el Mac → DevTools → Network → «Offline». Para enseñarlo en un móvil hace falta https (por ejemplo, un túnel de `cloudflared`).

## La demo (todo tiene que llevar a esto)

1. El profe hace una foto a una página de un libro de texto real → en menos de un minuto tiene la lección.
2. La publica. El alumno abre la app y la lección se descarga.
3. **Modo avión.** El alumno lee, escucha y hace el test. Arriba pone «3 respuestas por enviar».
4. Vuelve la red → «Todo enviado» → en el panel del profe aparece la nota.
