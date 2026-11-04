# Cambios del profe: cuenta, modo sin conexión, título y archivos de la lección

Todo está en la rama **`profe-sin-conexion`**, que sale de `main` en `7bf15d1`. Todavía no está unida a `main`.

| Commit | Qué hace |
|---|---|
| `3b51074` | El profe entra con usuario y contraseña y ve solo sus clases (es también la rama `profe-login`) |
| `af95dc1` | Sin conexión, el profe ve sus clases y lecciones y deja lecciones «por preparar» |
| `0184672` | Si la IA está apagada, el aviso lo dice en vez de «Sin conexión» |
| `daf4540` | El profe puede escribir el título de la lección; si lo deja vacío, lo pone la IA |
| `be44489` | El título es el paso 1 de «Nueva lección». El profe solo sale de sus clases con «Salir» |
| `5ae19ea` | «Subir un archivo»: la lección se puede hacer con un PDF, Word, PowerPoint, LibreOffice o texto |

## Archivos que se modifican

| Archivo | Líneas |
|---|---|
| `web/src/App.jsx` | +275 / −48 |
| `api/main.py` | +199 / −21 |
| `api/comprobar_profe.py` (nuevo) | +111 |
| `web/src/comun.jsx` | +5 / −1 |
| `REPARTO.md` (tres líneas en «Peticiones») | +3 |
| `CAMBIOS-PROFE.md` (este archivo) | |

Para verlo: `git diff --stat main...profe-sin-conexion` (con tres puntos: solo lo de la rama).

## 1. Cuenta de profe

**Lo que ve el profe**
- «Soy profe» abre «Entrar como profe» (usuario y contraseña) o «Crear mi cuenta de profe».
- Después: «Hola, nombre» y **solo sus clases**.
- Las clases nuevas ya no piden PIN: son de quien las crea.
- «¿Tienes una clase de antes, con PIN?»: con el código y el PIN, una clase antigua (por ejemplo AULA23) pasa a su cuenta.
- **Solo se sale con «Salir»**: en sus clases no hay botón «Volver». Si cierra la app sin salir, al abrirla entra directo en sus clases, así nadie más entra como profe desde el inicio.

**API (`api/main.py`)**
- Tablas nuevas (solo se añaden): `cuentas_profe(usuario, nombre, sal, hash)` y `clases_profe(clase, profe)`.
- Rutas nuevas: `POST /api/profes` (crear cuenta), `POST /api/profes/entrar`, `GET /api/profes/clases` (sus clases), `POST /api/profes/clases` (añadir una clase de antes con su PIN).
- La sesión es `usuario.firma`: la firma sale del hash de la contraseña. No se guarda en el servidor y deja de valer si cambia la contraseña.
- Las rutas del profe (también las de `panel.py`) aceptan la cabecera `X-Sesion-Profe` del profe dueño **o** el PIN de siempre.
- `POST /api/clases`: el PIN pasa a ser opcional si llega una sesión de profe.

**Web**
- `comun.jsx`: `api()` añade sola la cabecera `X-Sesion-Profe` (guardada en `localStorage` como `profe-sesion`).
- `App.jsx`: pantalla `ProfeEntrar`, `ProfeClases` con las clases del profe y el botón «Salir».

## 2. Profe sin conexión

**Lo que ve el profe**
- Sus clases, cada clase y sus lecciones salen al momento, también sin conexión (la última copia descargada).
- Sin conexión, «Preparar la lección» guarda el título, las fotos y el texto en el móvil. En la clase aparece «Por preparar (N)», con «Quitar».
- Al volver la conexión (al abrir la app, con el evento `online` y cada 30 s) se leen las fotos, la IA prepara la lección y queda como **borrador** para revisarla y publicarla.
- Si hay conexión pero la IA (Ollama) está apagada, pasa lo mismo, y el aviso dice que la IA está apagada en vez de «Sin conexión».

**API**
- `GET /api/clases/{codigo}` trae cada lección con su `contenido` entero (solo se añade un campo).
- `POST /api/clases/{codigo}/lecciones` acepta un `id` opcional (UUID del móvil): si ya existe, devuelve esa lección sin llamar otra vez a la IA. Así no se duplica.

**Web (`App.jsx`)**
- En `localStorage`: `profe-clases`, `profe-clase:CODIGO` y la cola `profe-pendientes`.
- Si no cabe en el móvil (muchas fotos), avisa: «No cabe en este aparato».

## 3. Título de la lección

- «Nueva lección» tiene ahora 4 pasos, y el **título es el primero**: 1. El título · 2. Las fotos · 3. El texto · 4. La materia.
- Si el profe escribe el título, se usa ese. Si lo deja vacío, se queda el que pone la IA.
- `POST /api/clases/{codigo}/lecciones` acepta un `titulo` opcional (sin espacios de sobra, como mucho 120 letras).

## 4. Lecciones desde un archivo

**Lo que ve el profe**
- En el paso 2 («Las fotos o los archivos») hay un botón nuevo, **«Subir un archivo»**, junto a «Hacer una foto» y «Elegir fotos».
- Vale: **PDF, Word (.docx), PowerPoint (.pptx), LibreOffice (.odt, .odp), texto (.txt, .md, .csv) y HTML**, y también imágenes. Hasta 5 entre fotos y archivos, y como mucho 10 MB cada archivo.
- Los textos (.txt, .md, .csv) se ponen directamente en el paso 3, también sin conexión.
- Los demás salen como una tarjeta con su nombre. «Leer el archivo» pone su texto en el paso 3 para revisarlo. Si no se lee antes, se lee al pulsar «Preparar la lección».
- **Sin conexión**, los archivos esperan en «Por preparar» igual que las fotos, y se leen solos al volver la conexión.
- Leer un archivo **no necesita la IA**: funciona aunque Ollama esté apagado. La IA solo hace falta para preparar la lección.
- Si no se puede: «Este archivo no se puede leer…» (por ejemplo un .zip) o «No encuentro texto en el archivo. Si es un PDF escaneado, haz fotos de sus páginas».

**API**
- Ruta nueva: `POST /api/clases/{codigo}/leer-archivo` con `{archivo}` (en base64) → `{texto}`. Solo el profe, como `leer-foto`.
- El tipo se sabe por el contenido, no por el nombre. Word, PowerPoint y LibreOffice se abren con `zipfile` (de Python, sin librerías). Del PDF se saca el texto de hasta 40 páginas, con la librería **`pypdf`**.
- Se devuelven como mucho 20 000 letras (la lección usa las primeras 8 000).

**Web**
- `App.jsx`: botón, tarjeta del archivo y `leerAdjunto()`, que manda cada cosa a su ruta (las imágenes a `leer-foto` y lo demás a `leer-archivo`).
- `comun.jsx`: icono `archivo`.

## Cómo comprobarlo

- Pruebas: `cd api && .venv/bin/python comprobar_profe.py` → «Cuentas de profe», «Lecciones del profe sin conexión» y «Título de la lección» y «Leer archivos»: todo bien. Necesita `httpx` en el `.venv` (`pip install httpx`).
- A mano, con la API en marcha y Ollama encendido:
  1. Entra en «Soy profe» y crea una cuenta. Recarga: sigues dentro, sin «Volver». «Salir» te lleva a «Entrar como profe».
  2. Crea una clase y una lección con título: la lección se llama así.
  3. Chrome → DevTools → Network → «Offline». Haz otra lección: sale en «Por preparar».
  4. Quita «Offline»: en unos 30 s aparece como «Borrador».
  5. En «Nueva lección», «Subir un archivo» con un PDF o un Word y «Leer el archivo»: su texto sale en el paso 3.

## Ojo

- La API necesita **Python 3.11** (`api/.venv`). Con el Python 3.9 de Xcode no arranca y la web se queda cargando.
- **Librería nueva: `pypdf`**, solo para los PDF. En cada ordenador que arranque la API: `cd api && source .venv/bin/activate && pip install pypdf`. Sin ella, todo lo demás funciona y al subir un PDF sale «Para leer PDF falta pypdf…».
- Para leer fotos y preparar lecciones hace falta **Ollama** encendido con `qwen3-vl:4b-instruct`.
- Sin hacer: guardar cambios de una lección sin conexión, preparar lecciones con la app cerrada y un tiempo máximo de espera si el servidor no contesta.
