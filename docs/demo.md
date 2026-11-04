# Demo rápida · AULA23 y móvil compartido

El recorrido completo está en [guion-demo.md](guion-demo.md). También están el [pitch](pitch.md) y las [preguntas del jurado](preguntas-jurado.md).

## Preparación

Desde la raíz del proyecto:

```sh
api/.venv/bin/python api/demo.py --comprobar
api/.venv/bin/python api/demo.py
api/.venv/bin/python docs/comprobar_panel.py
```

La clase AULA23 tiene PIN inicial **1234**. Las seis cuentas de ejemplo tienen contraseña inicial **1234**:

| Alumno | Usuario base |
| --- | --- |
| Ana | aula23ana |
| Bruno | aula23bruno |
| Carla | aula23carla |
| Diego | aula23diego |
| Elena | aula23elena |
| Farid | aula23farid |

Son credenciales de datos ficticios para el hackatón. El script solo crea las que faltan: si el profe ya cambió un PIN o una contraseña, conserva ese cambio. Si un usuario base está ocupado por otra cuenta, asigna un sufijo numérico; consulta el usuario definitivo en la clase del profe. Las lecciones antiguas sin materia aparecen en «General».

## Pasos

1. **Profe, portátil:** «Soy profe» → abrir «5.º A · Ciencias» → introducir el PIN si se pide. Comprobar «Ver notas».
2. **Alumno, móvil, conectado al aula:** «Soy estudiante» → «¿Quién eres?» → «Crear mi usuario». Introducir nombre, usuario único (3–20 letras minúsculas o números), contraseña de al menos cuatro caracteres y código **AULA23**. Pulsar «Crear y entrar». Esto crea un séptimo alumno; para usar uno de los seis existentes, elegir «Ya tengo usuario» y entrar con sus credenciales.
3. Esperar a que estén descargadas sus lecciones. Abrir una, consultar «Leer» y «Ejemplo», y pasar a «3. Preguntas».
4. Pulsar **«Salir»**. En «¿Quién eres?», elegir «Ya tengo usuario» y entrar como otro alumno, por ejemplo `aula23diego`. Esperar a que sus lecciones estén descargadas también. Comprobar que se muestra la identidad correcta.
5. Pulsar «Salir» y desconectar wifi y datos. En «¿Quién eres?», elegir el perfil del primer alumno que ya entró en este móvil. Escribir su contraseña y pulsar «Entrar». Abrir su lección descargada y responder. Repetir el cambio con el segundo alumno: cada uno debe ver su propio perfil. No intentar crear usuarios nuevos offline.
6. Recuperar la conexión con el aula. Esperar «Todo enviado a tu profe». En el portátil, «Ver notas» → «Actualizar notas»: comprobar que cada respuesta corresponde a su alumno.
7. **Opcional, con conexión y después de demostrar el acceso offline:** el profe pulsa «Nueva contraseña» junto al alumno que la olvidó. Confirmar la nueva contraseña en otro acceso conectado. No prometer revocación instantánea de credenciales guardadas en un dispositivo desconectado.

La sincronización en segundo plano depende del soporte y la planificación del navegador. Para una demostración predecible, mantener la app abierta durante el envío y mostrar la confirmación real.

## Dudas de ejemplo

La carga añade tres dudas con identificadores fijos: Ana tiene una respuesta de ejemplo de IA sobre evaporación, Bruno una corregida por el profe sobre las nubes y Carla una pendiente sobre raíces. Son datos ficticios preparados, no tres consultas ejecutadas en directo. Repetir el script no cambia sus respuestas. El hilo de IA puede contestar después la pendiente si Ollama está disponible.

Para demostrar una pregunta nueva: abrir «1. Leer» → «Tengo una duda» → «Enviar mi duda» sin red. Ver «Se enviará cuando haya conexión.». Reconectar, esperar la respuesta y revisar «Dudas de tus alumnos» en el portátil. El docente puede «Cambiar la respuesta»; la siguiente sincronización muestra «Te lo ha contestado tu profe.».
