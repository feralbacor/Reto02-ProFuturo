# Ensayo de Mochila en móvil · 10 minutos

Lo realiza Fernando en un móvil real, con un profe en el portátil. **Estado: pendiente de ejecutar; este documento no certifica que el móvil esté probado.**

## Antes de poner el cronómetro

- API y web compilada encendidas. Ollama local con qwen3-vl:4b-instruct listo, si se va a contestar la duda con IA.
- Demo AULA23 cargada, PIN inicial 1234. Lección publicada; elegir «El ciclo del agua». La carga de demo conserva contraseñas y fechas modificadas anteriormente.
- Enlace HTTPS accesible desde el teléfono. Puede obtenerse con movil.sh; en ese caso el túnel necesita Internet al reconectar. Para la prueba enteramente local, usar la red y HTTPS local ya preparados.
- Dos nombres de usuario de ensayo disponibles. La contraseña debe tener al menos cuatro caracteres. Son cuentas ficticias; no introducir datos reales de menores.
- Navegador normal, almacenamiento disponible. No usar navegación privada. No borrar datos ni cambiar el enlace entre pasos.
- El portátil permanece conectado al servidor. Solo se desconecta el móvil del estudiante.

## Recorrido cronometrado

| Tiempo | Acción | Resultado esperado | Si falla |
| --- | --- | --- | --- |
| 0:00–1:00 | Abrir el enlace HTTPS y añadir Mochila a la pantalla de inicio desde el menú del navegador. Abrir el icono. | Mochila abre desde el icono, con su mochila amarilla y tinta. | Comprobar HTTPS y terminar la primera carga con red. Si no ofrece instalación, usar «Añadir a pantalla de inicio» según el navegador; no afirmar instalación hasta comprobarla. |
| 1:00–2:00 | «Soy estudiante» → «¿Quién eres?» → «Crear mi usuario». Nombre ficticio, usuario disponible, contraseña y código AULA23 → «Crear y entrar». | Entra el primer estudiante y aparecen sus lecciones. | Revisar el código y los mensajes. Si el usuario ya existe, elegir otro o «Ya tengo usuario» con las credenciales correctas. |
| 2:00–3:00 | «Salir» → «Crear mi usuario». Crear el segundo estudiante. Esperar sus lecciones y salir. | Se guardan dos perfiles distintos en ese móvil. | No borrar el primero. Confirmar que ambos se crearon con conexión al aula y que sus nombres aparecen en «¿Quién eres?». |
| 3:00–4:00 | Volver al primer perfil con contraseña. Esperar el aviso de app y lecciones guardadas; abrir «El ciclo del agua». | La lección muestra «Descargada» y la aplicación se ha podido guardar. | Si avisa «Sin conexión, la app no se abrirá», resolver HTTPS/almacenamiento antes de continuar. Esperar a la descarga y al service worker. |
| 4:00–5:00 | Activar modo avión. Comprobar wifi y datos apagados. Cerrar y reabrir la app desde su icono. Entrar al perfil ya guardado si se pide. | La app vuelve a abrir y permite leer la lección sin red. Sin pendientes, «Sin conexión · tus lecciones funcionan igual». | Si solo funcionaba una pestaña ya abierta, la reapertura offline no está superada. Recuperar red, abrir el mismo origen y repetir la preparación. |
| 5:00–6:00 | «Ya lo he leído» → «Ir a las preguntas». Responder con «Comprobar», «Siguiente pregunta» y «Ver mi resultado». | Hay feedback y resultado sin red; las respuestas quedan pendientes. | Revisar que es una lección descargada. No reinstalar ni borrar pendientes. Registrar la pregunta y el mensaje que impiden avanzar. |
| 6:00–7:00 | Volver a Leer o Ejemplo. «Tengo una duda» → «¿Cómo se llama cuando el agua pasa a vapor?» → «Enviar mi duda». | Aparecen la pregunta, «Mientras tanto, esto dice la lección:», fragmentos con su origen y «Se enviará cuando haya conexión.». La búsqueda local no es una respuesta generada por IA. | Usar al menos tres caracteres y una duda sobre evaporación. Si no hay coincidencias, se conserva la espera; no se inventan fragmentos. Si ni la pregunta aparece, conservar la app y registrar el fallo. |
| 7:00–8:00 | Quitar modo avión y conectar al mismo servidor del aula. Mantener la app abierta. | «Todo enviado a tu profe» y después respuesta bajo «Mis dudas». Referencia del equipo: 5–10 s para IA disponible; no es garantía. | Si no confirma envío, revisar red/API y esperar un intento. Si confirma envío pero no hay respuesta, revisar Ollama; el profe puede contestar desde «Cambiar la respuesta». |
| 8:00–9:00 | Profe, portátil: «Ver notas» → «Actualizar notas». Volver a la clase, «Dudas de tus alumnos» → «Cambiar la respuesta». Estudiante espera la siguiente actualización. | Nota en la fila correcta; pregunta visible para el profe; respuesta corregida con «Te lo ha contestado tu profe.» en el móvil. | Comprobar que se usa el mismo alumno, clase y servidor. No presentar los datos ficticios existentes como si fueran el nuevo envío. |
| 9:00–10:00 | Móvil: «Salir», activar modo avión y entrar al segundo perfil con su contraseña; comprobar su identidad y material. Salir y volver al primero. | Ambos pueden usar su perfil guardado sin conexión y ven su identidad correcta. | Si el segundo no descargó, volver a conectarlo y preparar sus lecciones. No crear cuentas nuevas offline. Si aparecen datos del compañero, marcar fallo y registrar los pasos. |

## Resultado que se debe anotar

- Fecha, navegador y modelo del móvil: ____________________
- [ ] Instalación / acceso desde el icono.
- [ ] Dos perfiles en el mismo móvil.
- [ ] Reapertura real sin wifi ni datos.
- [ ] Lección y preguntas sin red.
- [ ] Duda guardada sin red.
- [ ] Fragmentos de la lección visibles al instante con su origen, sin red ni IA.
- [ ] Pregunta fuera de la lección: sin fragmentos, se mantiene el aviso de espera.
- [ ] Confirmación real del envío al volver.
- [ ] Nota atribuida al estudiante correcto.
- [ ] Respuesta a la duda recibida.
- [ ] Corrección del profe visible en el móvil.
- [ ] Cambio de perfil offline sin confundir identidades.
- Fallos, paso y texto exacto: ____________________

Si un paso falla, marcarlo como pendiente; el cronómetro no sustituye la comprobación. Usar [el plan B del guion](guion-demo.md#plan-b) para presentar material ya publicado y dudas de ejemplo, identificándolos como preparados.

## Prueba adicional · segundo plano

Después del ensayo principal: enviar una nueva duda o responder offline, cerrar la app, recuperar red y comprobar el servidor sin reabrir el móvil. Registrar si el navegador ejecuta la sincronización en segundo plano. Si no ocurre, abrir la app y verificar el envío normal. El navegador decide soporte y planificación: no prometer envío inmediato ni universal con la app cerrada.

No se ha ejecutado esta prueba física desde el agente. El ensayo anterior de Claude en Chrome con tamaño móvil es evidencia distinta.
