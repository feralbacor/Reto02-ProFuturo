# Mochila · Pitch de 3 minutos

Guion oral para dos personas: una presenta y maneja el portátil del docente; otra maneja el móvil del alumno. Ensayar con cronómetro. La demo completa está en [guion-demo.md](guion-demo.md).

## 0:00–0:25 · Problema

Imaginad que una alumna tiene un móvil, ganas de aprender y una conexión que desaparece. Una lección que depende de Internet deja de servir justo cuando más la necesita.

Mochila responde a ese problema: permite preparar una clase, llevarla en el dispositivo y seguir aprendiendo aunque no haya red.

## 0:25–0:55 · Solución

El docente crea una clase con nombre y PIN. El alumnado crea usuario y contraseña con el código de clase, sin email ni apellidos. Puede compartir móvil y cambiar de perfil al salir.

Para preparar una lección, el profesor elige la materia y fotografía una página de su libro. Mochila lee la foto; el docente revisa el texto y genera una lectura sencilla, un ejemplo y un test. Revisa el resultado y lo publica. La IA ayuda a preparar material; el profesor conserva la decisión educativa.

## 0:55–1:45 · Demo

Mirad el móvil: las lecciones aparecen por materia. Abrimos una que ya hemos descargado. Tenemos Leer, Ejemplo, Escuchar y Test.

Ahora desconectamos el móvil. Podemos seguir leyendo y responder. La corrección es inmediata y las respuestas quedan guardadas. Arriba vemos cuántas faltan por enviar.

Recuperamos la conexión con el aula. Mochila envía los pendientes y muestra «Todo enviado». En el portátil, el docente abre «Ver notas» y actualiza el panel: ahí están los resultados del alumno. Un reintento del mismo envío no duplica las respuestas.

## 1:45–2:20 · Por qué funciona sin Internet

Hay dos piezas locales. El móvil guarda el material y las respuestas. El ordenador del aula ejecuta la IA, qwen3-vl:4b, con un modelo de unos 3,3 gigabytes descargado previamente. Los móviles no necesitan ejecutar ese modelo.

Una wifi local permite compartir el contenido sin salir a Internet. Si el alumno se aleja, sigue trabajando con lo descargado y sincroniza al volver. Si no hay novedades, no vuelve a descargar contenido.

En nuestras pruebas de lectura, recuperamos 185 de 185 palabras de una foto realista y 184 de una foto muy mala, sin inventar palabras. Son resultados de esas pruebas, no una garantía para cualquier imagen.

## 2:20–2:45 · Impacto

El aprendizaje puede continuar durante los cortes. El docente dispone de material revisado, ejercicios con explicación y un panel para detectar quién puede necesitar apoyo. La falta de respuestas también puede significar falta de conexión.

En el despliegue local, el contenido y el progreso permanecen en el aula. La IA solo recibe contenido educativo, nunca datos del alumnado.

## 2:45–3:00 · Siguientes pasos

El siguiente paso es probar Mochila en una escuela: medir tiempos, consumo y funcionamiento en móviles modestos, y evaluar los contenidos con docentes.

Queremos que perder la conexión deje de significar perder la clase.

---

Notas de ensayo, fuera del discurso:

- El flujo de usuarios y sincronización está integrado desde main (6163d10). Las medidas de OCR, el tamaño del modelo y los tiempos proceden del equipo; falta repetir el ensayo completo en este ordenador y el móvil.
- Para encajar los tres minutos, partir de una lección publicada. La creación completa con IA se demuestra después: la generación tarda unos 45 segundos en el equipo probado, además de la lectura y la revisión.
- «Escuchar» sin Internet requiere una voz local instalada. Ensayar en el móvil concreto.
- La afirmación de permanencia en el aula corresponde al despliegue local: sin túneles externos ni GPU remota durante la demostración.
