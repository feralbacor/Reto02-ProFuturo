# Mochila v2: qué llega a `main`

Rama **`v2-local`** unida a `main` (5 de noviembre de 2026). Trae dos cosas:

1. **Modo caja.** Un ordenador de la clase da la app y la IA a los móviles, tablets y ordenadores de una **wifi sin internet**. Probado en una wifi sin internet, con otros aparatos entrando en la app a través de la caja.
2. **Lección con pruebas y examen.** Venía de `main` (`f4e1981`) y ya estaba unido a esta rama.

El detalle del modo caja (cómo funciona, la API y las pruebas) está en **[CAMBIOS-V2-CAJA.md](CAMBIOS-V2-CAJA.md)**.

## Lo que cambia para cada uno

**El profe**
- **Lección**: con pruebas (casillas para cuestionario, sopa de letras, crucigrama y pregunta de desarrollo) o sin ellas. Si no marca ninguna casilla, sale una lección simple de texto.
- **Examen**: cuestionario, desarrollo o los dos, con número de preguntas y dificultad. Las preguntas las hace la IA o el profe a mano. La IA corrige el desarrollo, y **manda la nota que ponga el profe** («Revisar la nota»).
- **Sin conexión**:
  - Entra en cualquier aparato que haya visto la caja alguna vez, aunque él nunca lo haya usado, gracias a su paquete cifrado con su contraseña.
  - Ve sus clases, lecciones, notas, estadísticas y respuestas de desarrollo **como estaban la última vez**.
  - No puede crear ni subir nada: «Nueva lección», «Crear la clase» y los menús ⋮ se bloquean hasta que vuelve la caja.

**El alumno**
- Hace las pruebas de cada lección: test, sopa de letras, crucigrama y desarrollo.
- Todo funciona sin conexión, como antes. Las respuestas se envían al volver la red.

**Cualquier aparato**
- En la portada se ve si hay datos nuevos de los profes en la caja, cómo se descargan y cuándo ha terminado.

## En línea (`main` → https://51.95.206.229)

- **Sí cambia**:
  - La lección con pruebas y el examen.
  - El aviso «solo ver» del profe sin conexión.
  - Lo que ve el profe se guarda por separado para cada profe, y el service worker ya no lo guarda mezclado.
- **No cambia**: en línea no hay modo caja. La API solo sirve la web y reparte paquetes cuando la arranca `caja.sh`, con `MOCHILA_WEB`. En línea, las rutas `/api/paquetes-profe…` y `/api/profes/paquete` contestan 404.
- **Base de datos**: al arrancar se crean dos tablas nuevas y vacías, `paquetes_profe` (modo caja) y `desarrollos` (examen). No se cambia ninguna tabla que ya existía.

## Encender la caja

```bash
./caja.sh
```

1. Antes hay que tener Ollama abierto.
2. En cada aparato, conectado a la misma wifi, se abre el enlace que sale en la terminal: `http://IP:8080`.
3. La primera vez, la página pide permiso para descargar el certificado de la caja y explica cómo instalarlo en ese aparato. Después pasa sola a la app.
4. Si el ordenador cambia de wifi, la caja se adapta sola.

Notas:
- Las wifis que aíslan a los aparatos entre sí no sirven, por ejemplo las de invitados o la de la universidad.
- Para probar con una sola máquina: `./caja.sh` y `http://localhost:8080`, aunque la wifi esté apagada.

## Pruebas

Todas pasan:

```bash
cd api
.venv/bin/python comprobar_paquetes.py
.venv/bin/python comprobar_examen.py
.venv/bin/python comprobar_buscar_alumnos.py
.venv/bin/python comprobar_borrar.py
.venv/bin/python comprobar_a_mano.py
.venv/bin/python comprobar_estadisticas.py
.venv/bin/python comprobar_preparando.py
```

```bash
node web/comprobar-juegos.js
```

`comprobar_profe.py` sigue sin poder ejecutarse, porque le falta `httpx2`.

## Lo que falta

- **IA en cada aparato.** El plan es usar la IA de la caja si se ve; si no, un modelo pequeño en el navegador cuando haya WebGPU; y si tampoco, la corrección espera a la caja.
- **Contraseñas de profe.** Para el prototipo vale cualquiera. Para un uso real, pedir 8 o más, porque los paquetes cifrados están en todos los aparatos.
