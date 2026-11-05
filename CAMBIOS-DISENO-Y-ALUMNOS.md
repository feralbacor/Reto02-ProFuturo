# Cambios: la app se adapta a la pantalla y el profe mete alumnos al crear la clase

Rama **`profe-sin-conexion`**, unida a `main` (5 de noviembre de 2026). Solo trae lo nuevo de esta subida.

## 1. Diseño adaptable: móvil, iPad y ordenador

Antes la app era una columna de móvil de 640 px, también en el ordenador. Ahora se adapta al ancho de la pantalla. **En el móvil no cambia nada**: todas las reglas nuevas empiezan a partir de 768 px.

| Pantalla | Listas (clases, lecciones, estudiantes) | Lectura, test y formularios |
|---|---|---|
| Móvil (hasta 767 px) | 1 columna, como antes | 1 columna, como antes |
| iPad (768–1199 px) | 1 columna, una encima de otra | página de hasta 800 px; opciones del test de 2 en 2 |
| Ordenador (1200 px o más) | lecciones en 2 columnas (cada una de 480 px como mínimo); «Mis clases» y «¿Quién eres?» con tarjetas pequeñas, hasta 3 por fila | igual que en el iPad |

Además:
- **La fila y su ⋮ son una sola tarjeta**, con una raya en medio. Así no hay duda de a qué lección o clase pertenece cada ⋮. Esto también se ve en el móvil.
- En «Mis clases», **«Crear otra clase» y «¿Tienes una clase de antes, con PIN?» van lado a lado**, igual de altas y con los botones a la misma altura. La del PIN ya no es desplegable. En el móvil siguen una debajo de otra.
- En el ordenador, los apartados con formularios o dudas no pasan de 720 px y van centrados.
- La portada pone «Soy estudiante» y «Soy profe» una al lado de la otra.
- La tabla de notas usa todo el ancho. No se ha tocado `Panel.jsx`: se adapta porque usa la clase `pagina`.

Todo está en `web/src/estilo.css`, al final, en «Pantallas grandes». En `App.jsx` solo se añadió el `div.lado-a-lado` y se cambió `<details>` por `<section>`.

## 2. Buscar alumnos al crear una clase

En «Crear otra clase» hay un campo nuevo, **«Alumnos (si quieres)»**:
1. El profe escribe un nombre o un usuario. Salen los alumnos que coinciden, cada uno con un **+**.
2. Al pulsar **+**, el alumno pasa a «Entran N alumnos», con una **×** para quitarlo. La tarjeta crece según se añaden.
3. Al pulsar «Crear la clase», esos alumnos ya están dentro de la clase.

**Privacidad**: por nombre solo se encuentran los alumnos de **las otras clases de ese profe**. A cualquier otro alumno solo se le encuentra escribiendo **su usuario exacto**. Así ningún profe puede ver la lista de todos los alumnos de la app.

API (`api/main.py`), sin cambiar ninguna tabla ni las rutas que ya había:
- **Nueva**: `GET /api/profes/alumnos?q=…` → `[{id, nombre, usuario}]`, como mucho 20. Pide la sesión del profe; sin ella contesta 401.
- `POST /api/clases` acepta `alumnos` (lista de ids). Solo se tienen en cuenta si el profe crea la clase con su sesión, y solo entran alumnos con usuario: los ids que no existen, los repetidos y los alumnos sin cuenta se ignoran.

Buscar necesita conexión. Sin ella sale «Para buscar alumnos hace falta conexión.».

## Archivos

| Archivo | Qué cambia |
|---|---|
| `web/src/estilo.css` | «Pantallas grandes», la tarjeta fila + ⋮ y los estilos del buscador de alumnos |
| `web/src/App.jsx` | `ElegirAlumnos`, `lado-a-lado` y «¿Tienes una clase de antes?» sin desplegable |
| `api/main.py` | `buscar_alumnos()` y el campo `alumnos` de `crear_clase()` |
| `api/comprobar_buscar_alumnos.py` | prueba nueva |
| `REPARTO.md` | una línea en «Peticiones» |
| `CAMBIOS-DISENO-Y-ALUMNOS.md` | este archivo |

## Cómo comprobarlo

- Sin IA: `cd api && .venv/bin/python comprobar_buscar_alumnos.py` → «todo bien».
- Diseño: abre la app en Chrome → DevTools → icono del móvil, y cambia entre iPhone, iPad y pantalla completa. Mira «Mis clases», una clase con lecciones y una pregunta del test.
- Alumnos:
  1. Entra como profe y escribe en «Alumnos» parte del nombre de un alumno de otra clase tuya. Debe salir con **+**.
  2. Elígelo y crea la clase.
  3. Al abrirla, debe estar en «Alumnos (1)».
