# Mochila · Preguntas del jurado

Respuestas para el flujo comunicado por el equipo. Las novedades están integradas desde main con rediseño y dudas; queda el ensayo completo en dispositivos antes de presentar. Las cifras son mediciones aportadas por el equipo, no resultados repetidos en este ordenador.

## ¿Cómo puede funcionar si no hay Internet?

El móvil guarda la aplicación, las lecciones descargadas y las respuestas. El ordenador del aula ejecuta la IA y recibe el progreso. Una wifi local conecta ambos sin Internet; si tampoco hay wifi, el móvil sigue con lo descargado y envía los pendientes cuando vuelve al aula. El modelo y la aplicación deben prepararse previamente.

## ¿Qué significa «nada sale del aula»?

En el despliegue local, el contenido y el progreso se procesan y guardan en el ordenador del aula y los dispositivos del alumnado, sin enviarlos a una IA externa. No pedimos email ni apellidos. Esta afirmación exige usar la instalación local: un túnel externo o una GPU remota cambiarían ese recorrido de los datos.

## ¿La IA recibe información del alumnado?

No: recibe el contenido educativo necesario para leer la página y preparar la lección. Los nombres y las respuestas del alumnado no se incluyen en las peticiones al modelo. El progreso se utiliza en el panel del docente.

## ¿Cómo protegéis el acceso del profesor?

La clase tiene un PIN de 4 a 8 números. En otro aparato, el docente debe introducirlo para abrirla. Tras cinco intentos fallidos, el acceso se bloquea durante un minuto. El código de seis letras y números para el alumnado es distinto del PIN. Las clases antiguas sin PIN deben actualizarse antes del despliegue.

## ¿Está protegido también el panel de notas?

Sí, en la nueva integración comunicada: el servidor aplica la dependencia del PIN al router del panel. La función compartida `api()` envía la cabecera `X-Pin-Profe`; un PIN ausente o incorrecto produce 401, y el bloqueo temporal produce 429. El panel utiliza esa función y muestra el mensaje de error.

## ¿El PIN es suficiente para una escuela real?

Es la protección del prototipo y evita abrir una clase protegida sin su PIN. Antes de desplegarlo en una escuela, debemos revisar permisos, sesiones, recuperación de acceso y dispositivos compartidos. El PIN se conserva en el navegador del docente, por lo que también importa controlar quién utiliza ese aparato.

## ¿Cuánto cuesta?

La inferencia local no requiere pagar una llamada a una API de IA en la nube. Sí hay costes de ordenador, dispositivos, red local, electricidad, preparación y mantenimiento. No hemos calculado todavía un coste por escuela; lo mediremos en el piloto según el equipo disponible y el número de usuarios.

## ¿Cómo se sincroniza?

Las respuestas se guardan en una cola local y se envían al abrir la app, recuperar la red, cada 30 segundos y al acabar un test. El servidor recibe los pendientes y devuelve las novedades. Si no hay contenido nuevo, no vuelve a descargarlo; puede seguir habiendo una petición de comprobación. El ensayo debe verificar que los pendientes se conservan hasta confirmar su recepción.

## ¿Qué pasa si se corta la red a mitad de un envío?

Se reintentan las respuestas pendientes. Cada respuesta tiene un identificador único y el servidor ignora el identificador que ya había guardado. Así, un corte después de recibir los datos pero antes de confirmar al móvil no debe duplicarlos.

## ¿Y si dos móviles envían lo mismo?

Si envían el mismo registro con el mismo identificador, se guarda una sola vez. Dos respuestas creadas por separado tendrán identificadores diferentes y se conservan como respuestas distintas; el panel toma la última de cada pregunta para un mismo alumno. Al entrar con el mismo usuario y contraseña se recupera el mismo identificador de alumno. Crear otro usuario con el mismo nombre crea otra identidad: el nombre por sí solo no une cuentas.

## ¿Cómo decidís cuál es la última respuesta?

El panel compara la fecha de la respuesta por alumno, lección y pregunta; interpreta también fechas con zona horaria. En igualdad exacta de fecha usa el identificador para resolver el empate de forma determinista. Relojes mal ajustados pueden afectar al orden: es una limitación que debemos tratar en un despliegue real.

## ¿Por qué IA local y no en la nube?

Porque la creación de contenido debe poder continuar sin Internet y porque el material no necesita salir del aula para procesarse. Concentramos el cálculo en el ordenador del docente. A cambio, ese equipo necesita recursos para ejecutar el modelo y mantenerlo actualizado.

## ¿La IA corre en cada móvil?

No. El modelo qwen3-vl:4b-instruct, de unos 3,3 GB, se ejecuta en el ordenador del aula. Los móviles reciben el material preparado y realizan las actividades. La descarga inicial del modelo requiere preparación; su tamaño no demuestra por sí solo cuánta memoria necesita el ordenador.

## ¿Qué precisión y velocidad habéis medido?

El equipo informa de 185 palabras recuperadas de 185 en una foto realista y 184 de 185 en una muy mala, sin palabras inventadas en esas dos pruebas. Una generación anterior tardó unos 45 segundos; después se probó la generación en francés de la API multilingüe en 103 segundos. Una foto reducida ocupó unos 110 KB. Son ejemplos medidos, no garantías para otras imágenes o equipos; la transcripción y la lección siempre se revisan.

## ¿Cómo evitáis que la IA enseñe algo incorrecto?

El docente revisa primero el texto leído y después la lectura, el ejemplo y las preguntas antes de publicar. La revisión humana es parte del flujo. Las dos pruebas de OCR no demuestran que todas las lecciones generadas sean correctas; el piloto debe evaluar también su calidad pedagógica.

## ¿Qué significa «Se está quedando atrás»?

Es una señal de apoyo: un test completo tiene menos del 60 % de aciertos o han pasado más de tres días sin respuestas, tomando su fecha y, si no hay ninguna, la fecha de matrícula. Las fechas inválidas se descartan sin inventar actividad. Un test a medias se muestra como incompleto y no se marca todavía por nota baja. La falta de conexión también puede explicar la ausencia de datos; no es una evaluación automática de abandono.

## ¿Cómo lo escalaríais a una escuela?

Empezaríamos con un servidor local compartido y una red del centro, con clases separadas y generación de lecciones planificada para no saturar el ordenador. Mediríamos usuarios simultáneos, tiempos, almacenamiento y copias de seguridad antes de ampliar. No hemos validado todavía una capacidad máxima ni el funcionamiento bajo carga de una escuela completa.

## ¿Se puede escuchar siempre sin conexión?

Solo si el dispositivo tiene una voz local compatible instalada. Lo comprobamos antes del ensayo. La lectura y el test no dependen de esa voz.

## ¿Qué ocurre si se pierde el móvil o se borran sus datos?

Los resultados ya sincronizados permanecen en el ordenador del aula. Las respuestas que solo estaban en ese móvil pueden perderse. Por eso hay que sincronizar cuando sea posible y preparar copias de seguridad del servidor para un uso real.

## ¿Cómo demostraréis impacto educativo?

Con un piloto junto a docentes: medir continuidad durante los cortes, actividades completadas, tiempo de preparación, calidad de contenidos y evolución del aprendizaje. El prototipo demuestra un recorrido técnico; todavía no demuestra una mejora educativa cuantificada.

## ¿Pueden varios niños compartir el móvil?

Sí. Cada alumno tiene usuario y contraseña. «Salir» devuelve a «¿Quién eres?» para elegir otra cuenta. Para entrar sin conexión, esa cuenta debe haber entrado antes en ese móvil y tener el material descargado. Crear una cuenta nueva o entrar por primera vez desde otro aparato requiere conexión con el aula.

## ¿Qué pasa si un alumno olvida su contraseña?

El docente, dentro de su clase protegida por PIN, utiliza «Nueva contraseña». Se necesita conexión con el ordenador del aula para guardar el cambio. Un móvil desconectado conserva una comprobación local de la contraseña anterior; no prometemos revocación inmediata mientras permanezca offline.

## ¿Sincroniza con la aplicación cerrada?

La nueva versión incluye un service worker con sincronización en segundo plano y periódica. Se aprovecha donde el navegador lo admite y concede tiempo de ejecución; no funciona igual en todos los dispositivos ni garantiza un intervalo exacto con la app cerrada. La sincronización con la página abierta sigue siendo la vía de respaldo.

## ¿Puede la IA decirle algo inadecuado a un niño?

Está instruida para contestar solo con la lección y responder «Eso no está en esta lección. Pregúntaselo a tu profe.» cuando no encuentre la respuesta. Es una limitación por instrucciones, no una garantía absoluta del modelo. El docente puede revisar y cambiar las respuestas; su pantalla muestra las 30 últimas dudas de estudiantes matriculados. El modelo recibe la lección y la pregunta sin añadir nombres ni notas. En la instalación enteramente local ese procesamiento no sale del ordenador del aula.

## ¿Cuándo responde «Tengo una duda» si el móvil está offline?

La duda se guarda y muestra «Se enviará cuando haya conexión». El ordenador la recibe al sincronizar y ejecuta la IA local. El equipo midió respuestas de unos 5–10 s; si está apagada o tarda, la duda continúa pendiente y el profe puede responder desde «Cambiar la respuesta». Mientras espera, el móvil busca fragmentos relacionados en la lectura y el ejemplo descargados y muestra su origen. Esta búsqueda funciona sin red ni IA; no genera una explicación nueva. Si no encuentra fragmentos, mantiene el aviso de espera. La respuesta generada por IA sigue necesitando acceso al ordenador del aula. Tras una corrección aparece «Te lo ha contestado tu profe.».

## ¿En qué os diferenciáis de otros tutores sin conexión, como Juza AI (Kenia) o Nambi (Uganda)?

Compartimos la búsqueda de aprendizaje sin Internet. Nuestra propuesta parte de la página del libro del docente: lectura, ejemplo y preguntas revisados antes de publicar, navegador en un móvil modesto, varios estudiantes por aparato con contraseña, notas y dudas que el profesor puede corregir. No afirmamos que ninguna de estas funciones sea exclusiva ni que esos productos sean solo un chat: Juza también describe contenido curricular revisado, y Nambi trabaja con currículo y dispositivos compartidos. No hemos hecho una comparación funcional completa ni una prueba comparativa de rendimiento.

Referencias primarias para preparar esta respuesta: [Juza AI](https://www.juza.ai/) y [Nambi, de Akaalo](https://akaalo.com/nambi). No dar cifras de esos productos ni atribuirles funciones ausentes sin verificarlas.

## ¿Quién ha hecho las traducciones?

El francés y el inglés están revisados por el equipo. Las demás traducciones son un borrador automático que hay que revisar con hablantes nativos antes de usarlo en una escuela. La revisión técnica de portugués, árabe o suajili no equivale a una validación nativa. Si falta un texto, la app lo muestra en inglés; si tampoco hay traducción inglesa, conserva el español original.

## ¿Cambiar de idioma traduce también el libro y la voz?

El selector de portada cambia la interfaz. En «Nueva lección», el profe elige aparte el idioma del contenido en el paso 4. La API ya prepara el contenido en el idioma elegido, aunque el libro esté en otra lengua, y las dudas se contestan en el idioma de la lección. Se probó la generación en francés en 103 s; no es un tiempo garantizado. Las lecciones fr/en de la demo siguen siendo ejemplos escritos manualmente. «Escuchar» utiliza el idioma guardado de la lección; sin red requiere una voz local de ese idioma. Una lengua disponible en pantalla no garantiza una voz instalada ni calidad de traducción certificada.
