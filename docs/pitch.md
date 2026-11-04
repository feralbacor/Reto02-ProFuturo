# Mochila · Pitch de tres minutos

Dos personas: profe en el portátil y estudiante en el móvil. Partir de una lección descargada. Ensayar con cronómetro; demostrar la creación completa después del discurso.

## 0:00–0:25 · Problema

Una alumna tiene ganas de aprender, pero su conexión desaparece. Una lección que depende de Internet deja de servir justo cuando más la necesita.

Mochila permite llevar la clase en el dispositivo y continuar aprendiendo aunque no haya red.

## 0:25–0:55 · Solución

El profesor parte de una página del libro que ya utiliza. Fotografía la página, revisa el texto reconocido y elige la materia. Una IA local prepara una lectura sencilla, un ejemplo y cinco preguntas. El docente revisa el material antes de publicarlo.

El estudiante entra con usuario y contraseña. No pedimos email ni apellidos. Varios niños pueden compartir un móvil y cambiar de perfil al salir.

## 0:55–1:50 · Demo

Mirad el móvil: esta lección ya está descargada. Tiene tres pasos: Leer, Ejemplo y Preguntas. Cortamos la conexión y seguimos trabajando. La corrección es inmediata y las respuestas se guardan en el móvil.

La alumna también puede pulsar «Tengo una duda». La escribe y el móvil muestra fragmentos relacionados de la lección, sin red ni IA. Si no encuentra ninguno, mantiene «Se enviará cuando haya conexión».

Volvemos a conectar con el aula. Las respuestas y la pregunta se envían solas. Cuando llega la respuesta, aparece junto a la duda. El profesor puede verla en «Dudas de tus alumnos» y cambiarla. Entonces la alumna ve «Te lo ha contestado tu profe».

En «Ver notas», el docente consulta los resultados recibidos y quién puede necesitar apoyo.

## 1:50–2:20 · Por qué funciona sin Internet

El móvil guarda la aplicación, las lecciones, las respuestas y las dudas pendientes. El ordenador del aula ejecuta Ollama con qwen3-vl:4b-instruct, descargado previamente. Los móviles no necesitan ejecutar ese modelo.

Una wifi local permite compartir información sin Internet. Si tampoco hay conexión con el ordenador, el estudiante continúa con lo descargado. La búsqueda de fragmentos funciona en el móvil desconectado; la respuesta de IA espera al ordenador.

## 2:20–2:45 · Impacto

Mochila combina material revisado por el docente, práctica con feedback y dudas vinculadas a la lección. El profesor puede acompañar también a quien no ha podido enviar sus avances; la ausencia de respuestas puede deberse a la conexión.

En una instalación enteramente local, el contenido y el progreso permanecen en el aula. El modelo recibe la lección y la pregunta, sin nombres ni notas del alumnado.

## 2:45–3:00 · Siguientes pasos

El siguiente paso es un piloto con docentes: evaluar contenidos, continuidad durante los cortes, accesibilidad y funcionamiento en móviles modestos.

Queremos que perder la conexión deje de significar perder la clase.

---

Notas fuera del discurso:

- La generación de una lección tardó unos 45 s en las pruebas comunicadas por el equipo. La respuesta a una duda tardó 5–10 s; no es un plazo garantizado.
- El modelo ocupa unos 3,3 GB. El equipo midió 185/185 palabras en una foto realista y 184/185 en una muy mala, sin palabras inventadas en esas pruebas. No son métricas de exactitud general ni se han repetido aquí.
- Si la respuesta en directo tarda, mostrar una de las dudas preparadas y decir expresamente que es de ejemplo. No simular una recepción.
- «Escuchar» requiere voz local para funcionar offline. No es un cuarto paso de la nueva navegación.
- Una demostración con movil.sh utiliza un túnel externo y necesita Internet para llegar al servidor; no equivale al despliegue enteramente local descrito en el discurso.
