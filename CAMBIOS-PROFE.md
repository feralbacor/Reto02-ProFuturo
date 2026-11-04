# Cambios del profe: cuenta y modo sin conexión

Dos ramas, una encima de la otra. **Todavía no están unidas a `main`**: este archivo solo cuenta qué cambian.

| Rama | Commit | Qué hace |
|---|---|---|
| `profe-login` | `84db0a6` | El profe entra con usuario y contraseña y ve solo sus clases |
| `profe-sin-conexion` | `b4c5792` | Sin conexión, el profe ve sus clases y lecciones y deja lecciones «por preparar» |

## Archivos que se modifican

| Archivo | `profe-login` | `profe-sin-conexion` |
|---|---|---|
| `api/main.py` | +124 / −18 | +10 / −3 |
| `web/src/App.jsx` | +109 / −16 | +116 / −23 |
| `web/src/comun.jsx` | +4 / −1 | — |
| `api/comprobar_profe.py` (nuevo) | +43 | +15 |
| `REPARTO.md` (una línea en «Peticiones») | +1 | +1 |

Para verlo: `git diff --stat main...profe-sin-conexion` (con tres puntos: solo lo de la rama)

## Rama 1: `profe-login`

**Lo que ve el profe**
- «Soy profe» abre «Entrar como profe» (usuario y contraseña) o «Crear mi cuenta de profe».
- Después: «Hola, nombre», **solo sus clases** y un botón «Salir».
- Las clases nuevas ya no piden PIN: son de quien las crea.
- «¿Tienes una clase de antes, con PIN?»: con el código y el PIN, una clase antigua (por ejemplo AULA23) pasa a su cuenta.

**API (`api/main.py`)**
- Tablas nuevas (solo se añaden): `cuentas_profe(usuario, nombre, sal, hash)` y `clases_profe(clase, profe)`.
- Rutas nuevas: `POST /api/profes` (crear cuenta), `POST /api/profes/entrar`, `GET /api/profes/clases` (sus clases), `POST /api/profes/clases` (añadir una clase de antes con su PIN).
- La sesión es `usuario.firma`: la firma sale del hash de la contraseña. No se guarda en el servidor y deja de valer si cambia la contraseña.
- Las rutas del profe (también las de `panel.py`) aceptan la cabecera `X-Sesion-Profe` del profe dueño **o** el PIN de siempre.
- `POST /api/clases`: el PIN pasa a ser opcional si llega una sesión de profe.

**Web**
- `comun.jsx`: `api()` añade sola la cabecera `X-Sesion-Profe` (guardada en `localStorage` como `profe-sesion`).
- `App.jsx`: pantalla `ProfeEntrar` y `ProfeClases` con las clases del profe.

## Rama 2: `profe-sin-conexion`

**Lo que ve el profe**
- Sus clases, cada clase y sus lecciones salen al momento, también sin conexión (la última copia descargada).
- Sin conexión, «Preparar la lección» guarda las fotos y el texto en el móvil. En la clase aparece «Por preparar (N)», con «Quitar».
- Al volver la conexión (al abrir la app, con el evento `online` y cada 30 s) se leen las fotos, la IA prepara la lección y queda como **borrador** para revisarla y publicarla.

**API**
- `GET /api/clases/{codigo}` trae cada lección con su `contenido` entero (solo se añade un campo).
- `POST /api/clases/{codigo}/lecciones` acepta un `id` opcional (UUID del móvil): si ya existe, devuelve esa lección sin llamar otra vez a la IA. Así no se duplica.

**Web (`App.jsx`)**
- En `localStorage`: `profe-clases`, `profe-clase:CODIGO` y la cola `profe-pendientes`.
- Si no cabe en el móvil (muchas fotos), avisa: «No cabe en este aparato».

## Cómo comprobarlo

- Pruebas: `cd api && .venv/bin/python comprobar_profe.py` → «Cuentas de profe: todo bien» y «Lecciones del profe sin conexión: todo bien».
- A mano, con la API en marcha:
  1. Entra en «Soy profe» y crea una cuenta.
  2. Crea una clase.
  3. Chrome → DevTools → Network → «Offline». Haz una lección con texto: sale en «Por preparar».
  4. Quita «Offline»: en unos 30 s aparece como «Borrador».

## Ojo

- La API necesita **Python 3.11** (`api/.venv`). Con el Python 3.9 de Xcode no arranca y la web se queda cargando.
- Sin hacer: guardar cambios de una lección sin conexión, preparar lecciones con la app cerrada y un tiempo máximo de espera si el servidor no contesta.
