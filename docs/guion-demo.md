# Mochila · Guion de demostración

## Reparto y estado de este guion

- **Profe / presentador:** portátil del aula, con la aplicación, la API y Ollama local preparados.
- **Alumno / segunda persona:** móvil con la aplicación instalada o abierta, una voz local probada y la lección descargada.
- **Antes del evento:** una persona comprueba el recorrido completo en ambos aparatos.

Este guion incorpora main (6163d10), con PIN, materias, cuentas de alumno y sincronización en segundo plano. Falta ensayar el recorrido completo en el portátil y el móvil. Los textos entre «comillas» son los facilitados por el equipo o los presentes en la interfaz revisada. No se inventa un texto para el botón que confirma el PIN: comprobar su rótulo al integrar.

## Preparar antes de presentar

1. Tener una clase accesible al profe y una lección **ya publicada y descargada en el móvil**. Usar esa misma lección en el recorrido principal y como plan B. Elegir cinco preguntas que ambos demostradores conozcan.
2. Preparar el PIN del docente (4 a 8 números) y anotar por separado el código de alumno generado (6 letras). No compartir el PIN con el alumnado.
3. **AULA23 es el código fijo de la clase de datos ficticios**, no un ejemplo de seis letras generadas. Contiene seis alumnos y dos lecciones. El script adaptado crea el PIN 1234 y las cuentas aula23ana, aula23bruno, aula23carla, aula23diego, aula23elena y aula23farid con contraseña inicial 1234. Conserva las credenciales existentes y añade un sufijo si un usuario está ocupado. Consultar [demo.md](demo.md) para el acceso.
4. Descargar previamente el modelo local qwen3-vl:4b (unos 3,3 GB). Comprobar que se ejecuta en el portátil del aula y que no depende del túnel a una GPU remota. La creación de material necesita ese ordenador encendido; el alumno puede usar el material descargado sin él.
5. Conectar portátil y móvil a la misma wifi local. Para demostrar que no se usa Internet, retirar la salida a Internet manteniendo esa red local, después de haber preparado la aplicación y el modelo.
6. Para el service worker y la reapertura offline en el móvil, preparar un origen HTTPS de confianza y una versión compilada. Una dirección `http://IP-del-portátil` no basta. Un túnel público HTTPS sirve para otros ensayos, pero depende de Internet y no demuestra que los datos permanezcan en el aula. Acordar con Claude la configuración local del evento.
7. Abrir la app con conexión al aula, descargar la lección, dejar que se active el service worker y recargar. Comprobar después la reapertura sin red. No borrar datos del navegador ni cambiar de origen o puerto durante la demo.
8. Ensayar «Escuchar» con una voz local en el móvil. Si no está disponible, mostrar lectura y test y explicar la limitación.
9. Tener una foto de reserva. La app permite hasta cinco imágenes; para una demo corta usar **una sola** y evitar tiempos variables innecesarios. La foto medida por el equipo quedó en unos 110 KB tras reducirla; el tamaño depende de la imagen.
10. Comprobar «Ver notas» a 360 px de ancho: letra legible, controles grandes y tabla desplazable. Los datos de AULA23 son ficticios; si se crearon hace días, puede haber más avisos de inactividad porque el script conserva sus fechas.

## Recorrido principal · incluido en el pitch

Preparar de antemano la clase, el perfil del alumno y la lección publicada. Reservar aproximadamente 50 segundos de la presentación; ensayar las respuestas para no agotar ese tiempo. Si se necesita más tiempo, completar la demostración después del pitch.

| Paso | Quién y dónde | Acción y texto de interfaz | Qué decir y qué comprobar |
| --- | --- | --- | --- |
| 1 | Profe, portátil | «Soy profe» → abrir la clase preparada. Introducir el PIN si se solicita. | «Esta clase está protegida para el docente. El alumno utiliza otro código.» Comprobar que se abre. |
| 2 | Alumno, móvil | «Soy alumno» → «¿Quién eres?» → elegir un perfil preparado, escribir su contraseña y pulsar «Entrar». Abrir la clase y una lección de su materia. | «El material ya está descargado y organizado por materia.» Para mostrar un alta nueva, usar «Crear mi usuario» y «Crear y entrar», como en el recorrido ampliado. |
| 3 | Alumno, móvil | Abrir «Leer» y «Ejemplo». Mostrar «Escuchar» y, solo si se ha ensayado la voz local, «▶ Escuchar». | «Tenemos una lectura sencilla, un ejemplo y la posibilidad de escucharla.» Detener el audio antes de continuar. |
| 4 | Alumno, móvil | Activar modo avión y comprobar que también están apagados wifi y datos móviles. Volver a la lección. | «Ahora el móvil no tiene conexión. El material sigue aquí.» La barra debe mostrar «Sin conexión · N respuestas por enviar», con el número real. |
| 5 | Alumno, móvil | Entrar en «Test», elegir una opción y pulsar «Responder». Continuar con «Siguiente» y, en la quinta pregunta, «Ver resultado». Estos rótulos están verificados en la interfaz local; contrastarlos al integrar la versión nueva. | «La corrección ocurre en el móvil y las respuestas se guardan para enviarlas después.» Con un perfil sin pendientes y un test de cinco preguntas, comprobar cinco respuestas pendientes. |
| 6 | Alumno, móvil | Desactivar modo avión y reconectar a la wifi del aula. | «Volvemos a conectar con el aula, aunque esa wifi no tenga salida a Internet.» Esperar «Todo enviado ✓». No anunciar éxito antes de verlo. |
| 7 | Profe, portátil | «Ver notas» → «Actualizar notas». | «El docente ya puede ver los aciertos y la fecha de la última respuesta.» Identificar al alumno de prueba y su nota. Una alerta invita a ayudar, no demuestra abandono. |

Si tarda la sincronización, esperar el siguiente intento periódico (hasta 30 segundos) y actualizar las notas después. Si sigue sin funcionar, usar el plan B y conservar la cola de pendientes.

## Recorrido ampliado · creación en directo

Esta parte se puede mostrar después del pitch. La generación requiere aproximadamente 45 segundos en el equipo probado; no incluye hacer la foto, leerla, revisar el texto y revisar la lección.

| Paso | Quién y dónde | Acción y botones | Qué decir y qué comprobar |
| --- | --- | --- | --- |
| 1 | Profe, portátil | «Soy profe». Escribir nombre de clase y PIN de 4 a 8 números; pulsar «Crear clase». | «El PIN protege el acceso del docente desde otro aparato. El código de seis letras permite entrar al alumnado.» Anotar el código generado. |
| 2 | Alumno, móvil | «Soy alumno» → «¿Quién eres?» → «Crear mi usuario». Escribir nombre, usuario, contraseña de al menos cuatro caracteres y código de la clase; pulsar «Crear y entrar». | «Cada alumno tiene su usuario y contraseña; no pedimos email ni apellidos.» No escribir el PIN del docente como código de alumno. |
| 3 | Profe, portátil | «+ Nueva lección». Completar «Materia», usando una sugerencia si encaja. | «La materia organiza lo que verá el alumno.» Si falta en datos antiguos, se presenta como «General». |
| 4 | Profe, portátil | «📷 Hacer foto» si hay cámara adecuada, o «🖼️ Elegir fotos» para una imagen preparada. Se admiten hasta cinco. | «Podemos partir del libro que ya utiliza el aula. Reducimos las fotos antes de enviarlas al ordenador local.» |
| 5 | Profe, portátil | Con una foto seleccionada, «Leer la foto». | «La IA transcribe la página en el ordenador del aula.» Con varias fotos el rótulo puede cambiar; la demostración usa una para conservar este texto exacto. |
| 6 | Profe, portátil | Revisar el texto reconocido y corregir cualquier error visible. | «El profesor comprueba lo que se ha leído antes de generar material.» No saltarse esta revisión. |
| 7 | Profe, portátil | «Crear lección». | «La generación tarda unos 45 segundos en nuestro equipo de prueba. Mientras trabaja, podemos explicar cómo continúa el aprendizaje sin red.» No prometer ese tiempo para cualquier ordenador. |
| 8 | Profe, portátil | Revisar lectura, ejemplo, preguntas y respuestas correctas; pulsar «Publicar». | «El docente decide qué material llega al alumno.» |
| 9 | Alumno, móvil | Esperar la sincronización o reabrir la app estando conectado al aula. Abrir la lección en su materia. | «El móvil descarga las novedades. Si no hay nada nuevo, no vuelve a descargar contenido.» Continuar con los pasos offline del recorrido principal. |

## Plan B · la demo continúa sin fingir resultados

| Situación | Qué hacer | Qué decir |
| --- | --- | --- |
| La IA sigue generando al llegar al tiempo ensayado o devuelve un error. | No encadenar nuevas peticiones. Pasar a la lección publicada de reserva en el móvil. | «Esta generación está tardando. Vamos a mostrar el aprendizaje con una lección preparada y revisada antes.» |
| No se puede leer la imagen. | Probar una vez la foto de reserva; si no funciona, usar la lección publicada. | «El docente necesita revisar la lectura. Utilizaremos material que ya está validado.» |
| Falla Internet, pero sigue funcionando la wifi local. | Mantener el recorrido contra el servidor del aula. | «La wifi del aula conecta nuestros dispositivos; no necesita salida a Internet.» |
| Falla también la conexión entre el móvil y el portátil. | Abrir la lección descargada y completar el test. Mantener pendientes las respuestas; no borrar almacenamiento ni reinstalar. | «El alumno puede continuar. Sus respuestas llegarán cuando vuelva a conectarse con el aula.» |
| La red vuelve pero no se confirma el envío. | Esperar el siguiente intento; si sigue pendiente, enseñar el panel de datos ficticios claramente identificado. | «Este envío aún no se ha confirmado. Este panel contiene los datos de ejemplo; no vamos a presentarlos como resultados recién recibidos.» |
| Falla el audio offline. | Usar «Leer», «Ejemplo» y «Test». | «La lectura en voz alta necesita una voz local instalada. Las demás actividades siguen disponibles.» |
| El docente introduce mal el PIN cinco veces. | Esperar el minuto de bloqueo. Mientras tanto, continuar con el móvil y la lección descargada. | «El acceso del docente se bloquea temporalmente tras cinco fallos. El alumno conserva su material.» |

## Arranque y comprobaciones técnicas antes del ensayo

Los servidores los arranca una persona, en terminales separadas, desde la raíz del proyecto:

```sh
cd api
.venv/bin/uvicorn main:app --reload --port 8000
```

```sh
cd web
npm run dev
```

La web de desarrollo está en http://localhost:5173. Para probar la reapertura offline en el portátil con la configuración actual, compilar y abrir preview:

```sh
cd web
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Abrir http://localhost:4173 y mantener la API en el puerto 8000. En esta versión, preview hereda el proxy de `/api`. Esto no configura por sí solo el acceso HTTPS del móvil: prepararlo con Claude antes del evento.

El nuevo main ya está integrado. demo.py nombra las columnas de los INSERT, crea el PIN solo si falta y añade las cuentas de ejemplo solo si el alumno no tiene ya una. Usa las funciones de main para guardar las credenciales; repetir la carga no regenera sus sales ni restablece las contraseñas.

Ejecutar desde la raíz:

```sh
api/.venv/bin/python api/demo.py --comprobar
api/.venv/bin/python api/demo.py
api/.venv/bin/python docs/comprobar_panel.py
```

Ensayar también que una petición sin autorización al panel devuelve 401 y que el panel abre desde una clase autorizada. Según la integración comunicada, main incluye su router con `dependencies=SOLO_PROFE`, y `api()` añade `X-Pin-Profe` desde `pines-profe`. El panel conserva `{codigo}` en su ruta y utiliza `api()`. Las clases antiguas sin PIN siguen abiertas hasta que se les asigne uno.

## Ensayo adicional · dos alumnos, un mismo móvil

1. Con conexión al aula, entrar con el primer alumno y descargar sus lecciones. Pulsar «Salir».
2. En «¿Quién eres?», pulsar «Ya tengo usuario», entrar con el segundo alumno y descargar también su contenido. Pulsar «Salir».
3. Desconectar wifi y datos. Elegir el perfil del primer alumno, escribir su contraseña y pulsar «Entrar». Leer y responder; comprobar su nombre y que no aparece el perfil del compañero.
4. Pulsar «Salir» y repetir con el segundo perfil, todavía sin conexión. El acceso offline requiere que esa cuenta y su contenido ya se hayan guardado en ese aparato.
5. Reconectar. Esperar «Todo enviado ✓» y comprobar en «Ver notas» las filas de ambos alumnos. Crear una cuenta por primera vez requiere conexión al aula.
6. Si se quiere mostrar recuperación de acceso, hacerlo conectado y al final: «Nueva contraseña» junto al alumno en la vista del profe. Probar el nuevo acceso con red; no presentar el cambio como revocación inmediata de una copia offline.

## Sincronización en segundo plano

Se conservan `web/public/segundo-plano.js` y `workbox.importScripts` en `web/vite.config.js`. El service worker puede sincronizar pendientes y buscar novedades cuando el navegador admita esas capacidades y le permita ejecutarse. No prometer un plazo fijo con la app cerrada ni soporte universal. En navegadores sin soporte se usa la sincronización con la página abierta; mantenerla abierta para el recorrido principal.
