# Cambios v2: modo caja

Rama **`v2-local`**, que sale de `main` en `98509fd` (5 de noviembre de 2026).

**La idea:** un ordenador de la clase hace de **caja**. Tiene la app, la base de datos y la IA (Ollama), y los móviles, tablets y ordenadores se conectan a él por una **wifi sin internet**. Probado con una wifi sin internet: los otros aparatos entran en la app a través de la caja.

## 1. Encender la caja

```bash
./caja.sh
```

Antes hay que tener Ollama abierto. Para cerrarla: Ctrl + C. El script hace esto:
- Compila la web y la sirve **desde la misma API**: es un único programa, con https en el puerto **8443**.
- Abre una **puerta de entrada sin https** en el puerto **8080**: es la dirección que se escribe en cada aparato.
- Escribe en la terminal el enlace para los aparatos: `http://IP-DE-LA-CAJA:8080`.
- **Si el ordenador cambia de red**, a los 5 segundos rehace su certificado para la nueva dirección y vuelve a empezar solo.
- **Sin ninguna red**, funciona solo en ese ordenador (`http://localhost:8080`). Sirve para probarla con una sola máquina.

La API sabe que está en modo caja por la variable `MOCHILA_WEB`, que la pone el script. `GET /api/salud` devuelve `"caja": true`. En línea (`main` → `en-linea`) no cambia nada: sin esa variable, la API no sirve la web ni reparte paquetes.

## 2. Certificado: una vez por aparato

El modo sin conexión (service worker) **solo funciona con https**, y una wifi sin internet no puede tener un certificado de internet. Por eso la caja tiene el suyo.

- **Certificado raíz «Mochila caja»** (`caja-cert/ca.crt`): se crea una sola vez y **se instala una sola vez en cada aparato**. Vale para todas las wifis.
- **Certificado de la dirección**: lo firma el raíz y la caja lo rehace en cada red. Los aparatos no tienen que hacer nada con él.
- La carpeta `caja-cert/`, con las claves, está en `.gitignore` y no se sube.

**La puerta de entrada** (`caja-inicio.html`, en `http://IP:8080`):
1. Comprueba sola si el aparato ya se fía de la caja. Si se fía, **pasa directamente a la app** (`https://IP:8443`).
2. Si no, **pide permiso** para descargar el certificado: «¿Descargamos el certificado?». Avisa de que viene del ordenador de la clase y no de internet, y de que es normal que el navegador diga que la descarga no es segura.
3. Muestra **solo los pasos del aparato** que la abre: Android, iPad/iPhone, Windows, Mac, Chromebook/Linux o Firefox.
4. Con «Ya lo he instalado: abrir Mochila», lo vuelve a comprobar y entra.

No hay forma de que una web instale sola un certificado de confianza, porque ningún sistema lo permite. Siempre queda un paso en los Ajustes del aparato.

## 3. El profe sin conexión: solo ver

Si el aparato del profe no ve la caja:
- Arriba sale el aviso «Sin conexión con el ordenador de la clase: ves tus clases, notas y estadísticas como estaban la última vez…».
- **Se puede ver**: sus clases, las lecciones, la lista de alumnos, «Ver notas» y las estadísticas de la clase y de cada alumno.
- **Se bloquea**:
  - «Nueva lección», «Preparar ahora», «Crear la clase» y «Añadirla a mis clases».
  - Los menús ⋮: publicar, ocultar y eliminar.
- Cuando vuelve la caja, en unos 10 segundos se quita el aviso y se desbloquea todo.
- Si la contraseña es incorrecta: «Usuario o contraseña incorrectos.». Si el aparato todavía no tiene sus datos: «Sin conexión con el ordenador de la clase, y este aparato todavía no tiene tus datos…».

Cómo funciona por dentro:
- `api()` (en `comun.jsx`) guarda una copia de cada petición GET del profe, **separada por profe** (`copia:USUARIO:RUTA`). Sin conexión, devuelve esa copia.
- `useConectado()` dice si se ve la caja.
- El service worker ya **no** guarda `/api/profes`, `/api/clases`, `/api/salud` ni `/api/paquetes…`. Antes los guardaba sin distinguir de qué profe eran, y en un aparato compartido otro profe podía verlos.

## 4. El profe entra sin conexión en un aparato que nunca ha usado

1. Cuando el profe entra con conexión, su aparato junta lo que ve (clases, lecciones, notas, estadísticas y su sesión). Lo **cifra con una llave sacada de su contraseña** (PBKDF2 de 600.000 vueltas + AES-GCM, con WebCrypto) y lo sube a la caja. Lo repite cada 5 minutos mientras sigue dentro.
2. **Todos los aparatos** que ven la caja se bajan esos paquetes, también los de los alumnos. Sin la contraseña de ese profe no se pueden leer: ni la caja puede leerlos.
3. Sin conexión, el profe escribe su usuario y su contraseña, y el aparato abre su paquete. Entra en modo «solo ver».
4. Al pulsar «Salir», en ese aparato no queda nada del profe a la vista, solo su paquete cifrado.

**En la portada** se ve el estado:
- «Comprobando si hay datos nuevos de los profes…»
- «Hay datos nuevos de N profes: descargando…»
- «Descarga completada: N profes actualizados.»
- «Todo al día: datos de N profes en este aparato.»

Primero pide solo las fechas y después baja solo los paquetes que han cambiado. Lo comprueba al abrir la app, al volver la red y cada 5 minutos.

Conviene saber:
- Los datos son los de la **última vez que ese profe estuvo conectado** en algún aparato.
- **Es un prototipo: vale cualquier contraseña.** Con una contraseña corta, quien copie el paquete de una tablet podría adivinarla probando. Para un uso real, habría que pedir 8 caracteres o más. Está marcado en el código con `shortcut:` en `paqueteProfe.js`.
- Solo funciona en modo caja: el servidor en línea no reparte paquetes, porque desde internet cualquiera podría bajarlos y probar contraseñas.

## API (`api/main.py`)

- **Tabla nueva** `paquetes_profe(usuario, sal, iv, cifrado, fecha)`: un paquete cifrado por profe. No cambia ninguna tabla que ya existía.
- **Rutas nuevas.** Las tres solo funcionan en modo caja; fuera de él contestan 404.
  - `PUT /api/profes/paquete`: el profe, con su sesión, sube su paquete. Se comprueban el formato y el tamaño, como mucho 3 MB.
  - `GET /api/paquetes-profe/fechas`: `[{usuario, fecha}]`.
  - `GET /api/paquetes-profe?usuarios=a,b`: los paquetes pedidos. Sin `usuarios`, devuelve todos.
- `GET /api/salud` añade `"caja"`.
- Al final del archivo: si existe `MOCHILA_WEB`, se sirve la web. Va detrás de todas las rutas `/api`, para que estas ganen siempre.

## Archivos

| Archivo | Qué cambia |
|---|---|
| `caja.sh` (nuevo) | Encender la caja: certificados, compilar, puerta de entrada y API con https; cambio de red automático |
| `caja-inicio.html` (nuevo) | La puerta de entrada: comprueba el certificado, pide permiso, descarga y muestra los pasos de cada aparato |
| `api/main.py` | Servir la web en modo caja, `"caja"` en salud, tabla y rutas de paquetes |
| `api/comprobar_paquetes.py` (nuevo) | Prueba de los paquetes: guardar, sustituir, fechas, filtro y que fuera de la caja no se reparten |
| `web/src/paqueteProfe.js` (nuevo) | Cifrar, subir, bajar solo lo nuevo, abrir con la contraseña y borrar al salir |
| `web/src/comun.jsx` | Copias por profe en `api()` y `useConectado()` |
| `web/src/App.jsx` | Estado de la descarga en la portada, entrar sin conexión, aviso «solo ver», botones bloqueados y subir el paquete |
| `web/vite.config.js` | El service worker ya no guarda lo del profe, la salud ni los paquetes |
| `.gitignore` | `caja-cert/` |

## Cómo comprobarlo

- Sin IA:

  ```bash
  cd api && .venv/bin/python comprobar_paquetes.py
  ```

  Debería decir «Paquetes del profe: todo bien». Las demás pruebas de `api/` siguen pasando. `comprobar_profe.py` no se puede ejecutar porque le falta `httpx2`, como antes.
- **Con una sola máquina**:
  1. `./caja.sh`, con la wifi apagada.
  2. Abre `http://localhost:8080`. Entra como profe con conexión y pulsa «Salir».
  3. En una ventana de incógnito, abre la misma dirección: debe decir «Descarga completada».
  4. Pon DevTools en «Offline» y entra como ese profe: debe entrar en modo «solo ver».
- **Con varios aparatos**:
  1. Conecta la caja y los aparatos a la misma wifi sin internet.
  2. En cada aparato abre el enlace que sale en la terminal, instala el certificado y entra.
  3. Las wifis que aíslan a los aparatos entre sí, como las de invitados o de la universidad, no sirven.

## Lo que falta de la v2

- ~~Lección con pruebas o sin ellas, y examen~~: ya está unido a esta rama desde `main` (`f4e1981`). Sin conexión, el profe ve las respuestas de desarrollo y sus notas, pero no puede crear exámenes ni lecciones, porque se hacen desde «Nueva lección» y ese botón está bloqueado. «Revisar la nota» de una respuesta de desarrollo no se bloquea: sin conexión da el error de «sin conexión».
- **IA en cada aparato.** El plan es usar la de la caja si se ve; si no, un modelo pequeño en el navegador cuando haya WebGPU; y si tampoco, la corrección espera a que vuelva la caja.
