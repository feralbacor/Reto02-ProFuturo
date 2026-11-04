# Mochila

Una clase digital para aprender cuando Internet es lento, caro o no existe. El profe convierte una página del libro en una lección revisada; el estudiante lee, responde y guarda sus dudas desde el móvil.

## Cómo funciona sin conexión

La aplicación y las lecciones se guardan en el móvil. Las respuestas y las dudas esperan allí hasta recuperar la conexión con el ordenador de la clase. Se envían automáticamente al abrir la app, volver la red y terminar una actividad; también en segundo plano con la app cerrada cuando el navegador lo permite. No se garantiza el mismo soporte ni un plazo con la app cerrada en todos los móviles.

La IA corre en el ordenador de la clase con **Ollama y qwen3-vl:4b-instruct**, sin necesitar Internet después de descargar el modelo. El móvil desconectado sigue con lo descargado; una duda espera a llegar al ordenador para recibir respuesta. Una wifi local puede conectar los dispositivos sin ofrecer Internet.

## Arranque

Requisitos: Python 3.11 o posterior, Node compatible con el proyecto y Ollama. La primera instalación y la descarga del modelo requieren conexión o paquetes trasladados previamente. Los servidores se arrancan manualmente.

Preparar la API desde la raíz:

```sh
cd api
python3 -m venv .venv
.venv/bin/python -m pip install "fastapi==0.162.0" "uvicorn==0.54.0"
.venv/bin/python demo.py
OLLAMA_URL=http://localhost:11434 .venv/bin/uvicorn main:app --reload --port 8000
```

Ollama debe estar abierto en ese ordenador. Descargar el modelo una vez:

```sh
ollama pull qwen3-vl:4b-instruct
```

En otra terminal, desde la raíz:

```sh
cd web
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Abrir http://localhost:4173. El proxy conecta `/api` con el puerto 8000. Para desarrollar se usa `npm run dev`, pero el ensayo de reapertura offline debe hacerse con la versión compilada y el service worker activo.

### Abrir en el móvil

En macOS, con la API encendida y cloudflared disponible en la ruta que utiliza el script, desde la raíz:

```sh
zsh movil.sh
```

El script compila, arranca preview y muestra un enlace HTTPS para el móvil. Abrirlo, añadir la app a la pantalla de inicio y esperar a que la app y las lecciones estén descargadas antes de activar modo avión.

**Ese enlace usa un túnel público y necesita Internet para llegar al ordenador.** Permite ensayar trabajo offline y reconexión; para un aula completamente desconectada se necesita una red local y HTTPS de confianza preparados para los dispositivos. Una dirección HTTP por IP local no basta para instalar el service worker.

## Probar la demo

Datos ficticios del hackatón: clase **AULA23**, PIN inicial del profe **1234**, estudiante **aula23ana**, contraseña inicial **1234**. La carga conserva credenciales ya cambiadas; si un usuario estaba ocupado, añade un sufijo y se puede consultar desde la clase del profe.

Hay seis estudiantes, dos lecciones y tres dudas de ejemplo: respuesta de IA preparada, respuesta corregida por el profe y una pendiente. El hilo de IA puede responder después a la pendiente. El profe entra por «Soy profe»; el estudiante por «Soy estudiante» → «Ya tengo usuario». En «Ver notas» están los resultados y, en la clase, «Dudas de tus alumnos».

## Privacidad y revisión docente

No pedimos email ni apellidos. La IA recibe el contenido de la lección y la pregunta, sin añadir nombres ni notas del estudiante. En el despliegue enteramente local, el procesamiento y los datos permanecen en el ordenador de la clase y los dispositivos del aula. El túnel público de la demo es una configuración distinta: la conexión atraviesa infraestructura externa.

El profe revisa la lección antes de publicarla y puede cambiar las respuestas a dudas. Las instrucciones al modelo reducen respuestas fuera de contexto, pero no garantizan ausencia de errores. Es un prototipo de hackatón, pendiente de evaluación en aulas reales.

## Comprobaciones y presentación

Desde la raíz:

```sh
api/.venv/bin/python api/demo.py --comprobar
api/.venv/bin/python docs/comprobar_panel.py
npm --prefix web run build
```

- [Pitch de tres minutos](docs/pitch.md).
- [Guion y planes B](docs/guion-demo.md).
- [Preguntas del jurado](docs/preguntas-jurado.md).
- [Ensayo de diez minutos en móvil](docs/ensayo.md).
- [Accesos y datos de demo](docs/demo.md).
