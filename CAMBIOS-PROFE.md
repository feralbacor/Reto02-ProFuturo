# Cambios del profe: cuenta, modo sin conexión y título de la lección

Todo está en la rama **`profe-sin-conexion`**, que sale de `main` en `7bf15d1`. **Unida con `main` (ya con los idiomas) en la rama `union-profe`**: sus textos pasan por `t()`, con francés e inglés (los otros idiomas salen en inglés hasta que se traduzcan), y la lección que espera sin conexión guarda también su idioma.

| Commit | Qué hace |
|---|---|
| `3b51074` | El profe entra con usuario y contraseña y ve solo sus clases (es también la rama `profe-login`) |
| `af95dc1` | Sin conexión, el profe ve sus clases y lecciones y deja lecciones «por preparar» |
| `0184672` | Si la IA está apagada, el aviso lo dice en vez de «Sin conexión» |
| `daf4540` | El profe puede escribir el título de la lección; si lo deja vacío, lo pone la IA |
| `be44489` | El título es el paso 1 de «Nueva lección». El profe solo sale de sus clases con «Salir» |

## Archivos que se modifican

| Archivo | Líneas |
|---|---|
| `web/src/App.jsx` | +238 / −40 |
| `api/main.py` | +137 / −21 |
| `api/comprobar_profe.py` (nuevo) | +66 |
| `web/src/comun.jsx` | +4 / −1 |
| `REPARTO.md` (dos líneas en «Peticiones») | +2 |
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

- «Nueva lección» tiene ahora 5 pasos, y el **título es el primero**: 1. El título · 2. Las fotos · 3. El texto · 4. La materia · 5. El idioma de la lección (este viene de `main`).
- Si el profe escribe el título, se usa ese. Si lo deja vacío, se queda el que pone la IA.
- `POST /api/clases/{codigo}/lecciones` acepta un `titulo` opcional (sin espacios de sobra, como mucho 120 letras).

## Cómo comprobarlo

- Pruebas: `cd api && .venv/bin/python comprobar_profe.py` → «Cuentas de profe», «Lecciones del profe sin conexión» y «Título de la lección»: todo bien. Necesita `httpx` en el `.venv` (`pip install httpx`).
- A mano, con la API en marcha y Ollama encendido:
  1. Entra en «Soy profe» y crea una cuenta. Recarga: sigues dentro, sin «Volver». «Salir» te lleva a «Entrar como profe».
  2. Crea una clase y una lección con título: la lección se llama así.
  3. Chrome → DevTools → Network → «Offline». Haz otra lección: sale en «Por preparar».
  4. Quita «Offline»: en unos 30 s aparece como «Borrador».

## Ojo

- La API necesita **Python 3.11** (`api/.venv`). Con el Python 3.9 de Xcode no arranca y la web se queda cargando.
- Para leer fotos y preparar lecciones hace falta **Ollama** encendido con `qwen3-vl:4b-instruct`.
- Sin hacer: guardar cambios de una lección sin conexión, preparar lecciones con la app cerrada y un tiempo máximo de espera si el servidor no contesta.
