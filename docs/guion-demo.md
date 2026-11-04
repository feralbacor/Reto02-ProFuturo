# Mochila · Guion de demo

Textos contrastados con App.jsx del rediseño y «Tengo una duda», integrados en esta rama desde main. Falta el ensayo en un móvil real. Profe en el portátil; estudiante en el móvil. El docente prepara y revisa contenido; el estudiante lee, responde y pregunta.

## Preparación

1. Ejecutar la carga de AULA23 y comprobar las credenciales desde la pantalla del profe. PIN inicial 1234; estudiante aula23ana, contraseña inicial 1234. La carga conserva cambios previos de credenciales. [Accesos de demo](demo.md).
2. Tener una lección publicada y descargada en el móvil. No depender de que la IA cree una lección durante los tres minutos. AULA23 incluye cuatro lecciones y tres dudas ficticias: una respuesta preparada como ejemplo de IA, otra revisada por el profe y una pendiente. El hilo local puede contestar la pendiente después; no se reinicia al repetir la carga.
3. Preparar dos cuentas en el mismo móvil, entrar con ambas conectado al aula y descargar sus lecciones. Elegir una voz local si se quiere demostrar audio offline.
4. Servidores y Ollama preparados por una persona. Modelo qwen3-vl:4b-instruct descargado previamente; comprobar que se ejecuta en el ordenador del aula y no en un túnel a una GPU remota.
5. Usar versión compilada y origen HTTPS de confianza en el móvil. Esperar el aviso de que la aplicación y las lecciones están guardadas. No cambiar de dirección, borrar datos del navegador ni reinstalar entre pasos.
6. Para probar una instalación sin Internet, usar una wifi local y HTTPS local preparados de antemano. movil.sh facilita HTTPS mediante un túnel público: sirve para ensayar el corte del móvil, pero necesita Internet para reconectar con el ordenador.

## Recorrido principal · durante el pitch

| Paso | Quién | Acción exacta | Qué decir y comprobar |
| --- | --- | --- | --- |
| 1 | Profe, portátil | «Soy profe» → clase AULA23 → introducir el PIN si se pide. | «El PIN protege la clase del profe. El estudiante usa su propio usuario y contraseña.» |
| 2 | Estudiante, móvil | «Soy estudiante» → «¿Quién eres?» → elegir el perfil preparado o «Ya tengo usuario» → escribir credenciales → «Entrar». Abrir una lección descargada. | «Aquí está el material, organizado por materia.» No crear una cuenta por primera vez sin conexión. |
| 3 | Estudiante | Mostrar «1. Leer». Pulsar «Ya lo he leído» para ir a «2. Ejemplo». | «La lectura y el ejemplo están guardados en el móvil.» Puede usarse el control de audio si la voz local está ensayada. |
| 4 | Estudiante | Activar modo avión y comprobar que wifi y datos están desconectados. Regresar a la app. | Sin pendientes, la barra dice «Sin conexión · tus lecciones funcionan igual». No confundir ausencia de Internet con desconexión del servidor del aula. |
| 5 | Estudiante | En Leer o Ejemplo: «Tengo una duda» → escribir «¿Cómo se llama cuando el agua pasa a vapor?» → «Enviar mi duda». | Comprobar «Mientras tanto, esto dice la lección:» y los fragmentos con origen «Leer» o «Ejemplo», junto a «Se enviará cuando haya conexión.». Explicar: «El móvil busca en el texto guardado; todavía no es una respuesta de IA». Si no encuentra coincidencias, solo aparece la espera. |
| 6 | Estudiante | «Ir a las preguntas» → elegir opción → «Comprobar». Repetir con «Siguiente pregunta» y terminar con «Ver mi resultado». | «La corrección es inmediata, sin consultar al servidor.» Las respuestas se guardan. La barra muestra el número real de pendientes. |
| 7 | Estudiante | Quitar modo avión, reconectar y mantener la app abierta. | Esperar «Todo enviado a tu profe». La duda puede seguir en «Esperando la respuesta…»: confirmar el envío no significa que la IA ya haya contestado. |
| 8 | Estudiante | Abrir Leer, Ejemplo o el resultado para ver «Mis dudas». | La respuesta llega en la sincronización posterior. El equipo midió unos 5–10 s con IA disponible; si tarda, usar el plan B. |
| 9 | Profe | En la clase, «Dudas de tus alumnos» → «Cambiar la respuesta». Revisar el texto del diálogo y confirmarlo. | «El docente puede corregir la respuesta.» La pantalla muestra las 30 últimas dudas de estudiantes matriculados. No afirmar que solo se guardan 30. |
| 10 | Estudiante | Mantener conexión y esperar la actualización de la duda. | Comprobar «Te lo ha contestado tu profe.» |
| 11 | Profe | «Ver notas» → «Actualizar notas». | Identificar al estudiante y sus aciertos. La falta de resultados recibidos también puede significar falta de conexión. |

Para encajar en tres minutos, ensayar los movimientos en paralelo a la narración. Si se alarga, dejar la corrección del profe para la demostración ampliada y mostrar una duda de ejemplo claramente identificada.

## Creación de una lección · después del pitch

| Paso | Quién | Acción | Comprobación y frase |
| --- | --- | --- | --- |
| 1 | Profe | «Soy profe». Crear una clase con nombre y PIN de 4–8 números usando «Crear clase», o abrir AULA23. | «Este código de seis letras y números lo utiliza el estudiante; el PIN es del profe.» AULA23 es el código fijo de la demo. |
| 2 | Estudiante | «Soy estudiante» → «¿Quién eres?» → «Crear mi usuario». Nombre, usuario único de 3–20 minúsculas o números, contraseña de 4–64 caracteres, código de clase → «Crear y entrar». | «Varios niños pueden compartir un móvil sin compartir cuenta. No pedimos email ni apellidos.» |
| 3 | Profe | «Nueva lección» → paso 1, «Las fotos de la página». «Hacer una foto» o «Elegir fotos»; máximo cinco. | Para el ensayo corto, usar una sola imagen preparada. |
| 4 | Profe | «Leer la foto» con una sola imagen → paso 2, «El texto». | Revisar y corregir la transcripción antes de continuar. Con varias imágenes cambia el rótulo de lectura. |
| 5 | Profe | Paso 3, «La materia»: escribir o elegir una sugerencia. Paso 4, «El idioma de la lección»: elegir el idioma y pulsar «Preparar la lección». | «El tiempo depende del equipo y del idioma: Claude midió 103 s para francés.» No prometer un tiempo fijo; la lectura y la revisión añaden tiempo. |
| 6 | Profe | «Revisa la lección». Revisar lectura, ejemplo y preguntas; pulsar «Publicar». | Comprobar cuál es la opción correcta antes de publicar. |
| 7 | Estudiante | Reabrir la app conectado al aula o esperar la sincronización. | Comprobar que la nueva lección aparece en su materia y está descargada antes de desconectar. |

## Móvil compartido y recuperación

- Con red, entrar con el primer estudiante y descargar. «Salir» → «¿Quién eres?» → «Ya tengo usuario» → entrar con el segundo y descargar también.
- «Salir», activar modo avión y elegir el perfil guardado del primero. Contraseña → «Entrar». Comprobar nombre, lección y preguntas. Repetir con el segundo perfil.
- Al reconectar, comprobar las notas de ambos. No borrar pendientes al cambiar de perfil.
- Si olvida la contraseña, el profe utiliza «Nueva contraseña» en su clase protegida, con conexión. Probar el nuevo acceso conectado. No prometer revocación inmediata en un dispositivo que sigue offline.

## Plan B

| Falla | Acción | Qué decir |
| --- | --- | --- |
| IA tarda o está apagada. | Usar una lección ya publicada y una duda de ejemplo contestada. No encadenar peticiones. | «Esta generación no ha terminado. El material y esta respuesta se prepararon antes.» |
| La duda se envía pero no llega respuesta. | Mantener la app abierta; enseñar el estado pendiente. El profe puede responder mediante «Cambiar la respuesta» cuando la duda llegue al servidor. | «Estos fragmentos ya estaban en la lección. La respuesta de IA aún no ha llegado; el profe también puede contestar.» |
| Falla Internet, permanece la wifi local con servidor accesible. | Continuar contra el ordenador local. | «La red del aula conecta los dispositivos sin necesitar Internet.» Si se usa un túnel público, este caso no aplica. |
| Se pierde también la conexión al servidor. | Seguir leyendo, respondiendo y guardando dudas; mostrar fragmentos relacionados cuando la búsqueda local los encuentre. Conservar los datos del navegador. | «Las respuestas y preguntas se enviarán al volver a conectar.» |
| No aparece confirmación de sincronización. | Esperar un nuevo intento; si no llega, mostrar pendientes reales y el panel de ejemplo identificado. | «Todavía no hemos confirmado este envío.» |
| No funciona el audio. | Continuar con lectura, ejemplo y preguntas. | «Escuchar sin red necesita una voz local instalada.» |
| PIN bloqueado tras cinco fallos. | Esperar un minuto y continuar mientras con el móvil preparado. | «El bloqueo temporal protege la clase del profe.» |

## Arranque y límites

[README del proyecto](../README.md) para instalación y arranque. [Ensayo de diez minutos](ensayo.md) para el móvil real.

El service worker conserva las respuestas y dudas pendientes mediante el espejo local. La sincronización con la app cerrada depende del soporte y de cuándo el navegador permita ejecutarla: no garantizar un plazo. Para demostrar el envío de forma predecible, mantener la app abierta.

El botón «Quitar de la clase» elimina matrícula, respuestas y dudas de esa clase; conserva la cuenta y las demás clases. No es una lista de bloqueo permanente: conservar el código puede permitir reinscribirse.

Antes de presentar, ejecutar las comprobaciones y confirmar la compilación. Dependencias sincronizadas con autorización de Fernando: comprobaciones de demo y panel y build de producción correctos. No arrancar servidores desde el agente ni afirmar que el móvil real está probado hasta completar ensayo.md.

## Idioma de la interfaz, del contenido y de la voz

1. En la portada, elegir **Français** en el selector. «Soy estudiante» pasa a «Je suis élève». Entrar con «J'ai déjà un identifiant» y «Entrer», usando aula23ana y su contraseña de demo.
2. Abrir **L'eau et ses états**, materia **Sciences**, de AULA23. En la lectura, pulsar **Écouter**. El contenido lleva `idioma: fr`; comprobar que la voz disponible es francesa. El idioma de la interfaz no debe convertir en francesa una lección española.
3. Con esa lección descargada y una voz francesa local instalada, repetir sin red. Si falta la voz, demostrar la lectura y explicar la limitación; no inventar soporte de audio offline.
4. Repetir con English y **The parts of a plant**, materia **Science**, si hay tiempo. Los títulos de las lecciones son contenido: no cambian al modificar el selector de portada.
5. En «Nueva lección», el paso 4 selecciona el idioma del contenido. La API ya genera la lección en el idioma elegido y las dudas se contestan en el idioma de esa lección. Claude probó francés en 103 s; ensayar antes de generar en directo y conservar las lecciones manuales como plan B.

Francés e inglés están revisados por el equipo. Las demás traducciones son borradores automáticos; los textos faltantes intentan aparecer en inglés y luego en español. Las claves nuevas del panel ya están traducidas en los 23 idiomas; comprobar los rótulos en el móvil del ensayo.
