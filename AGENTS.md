# Mochila — la clase que funciona sin internet

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
- IA con Amazon Bedrock, desde `api/` con `boto3` y la API `converse`, región `us-east-1`, con las credenciales que ya tiene el Mac (perfil `default`). **Nunca escribas claves en el código.**
  - Leer la foto de la página: `global.moonshotai.kimi-k3` (sí ve imágenes). Se manda como bloque `image` con los bytes en JPEG.
  - Generar la lección: `zai.glm-5`. Pide **solo JSON** y quita los ```json si los pone. Si el JSON no es válido, reintenta una vez.
  - Pon `read_timeout=300` en boto3: Kimi puede tardar hasta un minuto. Mientras tanto, la web dice «Leyendo la página…».
- Antes de subir una foto, la web la reduce a 1600 px de lado en JPEG: menos datos móviles y Bedrock no acepta imágenes de más de 3,75 MB.
- Datos en el móvil: `localStorage`. Cada respuesta lleva un `id` (`crypto.randomUUID()`) y va a una cola «pendientes».
- Sincronización: `POST /api/sync` con los pendientes y la fecha del último sync. El servidor guarda con `INSERT OR IGNORE` por `id`: si llega dos veces, no se duplica. Devuelve las lecciones y los avisos nuevos desde esa fecha. Se sincroniza al abrir la app, con el evento `online` y cada 30 s.
- Sin cuentas ni contraseñas: hay un código de clase (p. ej. `CLASE-5A`) y una lista de nombres. Es una demo.

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
