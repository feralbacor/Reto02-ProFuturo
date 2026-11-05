# Mochila

Una clase digital para aprender cuando internet es lento, caro o no existe. El profe convierte una página del libro en una lección, un examen o un juego con ayuda de una IA. El alumno lee, escucha y responde desde el móvil, también **sin conexión**.

Mochila funciona en **modo caja**. Un ordenador de la clase, la **caja**, contiene la app, los datos y la IA. Los móviles, tablets y ordenadores se conectan a él por una wifi que **no necesita internet**. Se puede montar en cualquier aula con un ordenador y un router.

```
   Caja: ordenador de la clase (app + datos + IA + certificado)
                    │
              Router wifi (sin internet)
          ┌─────────┼─────────┬──────────┐
        Móvil     Tablet   Portátil   Ordenador
```

Índice:
1. [Qué hace falta](#1-qué-hace-falta)
2. [Instalar la caja (una sola vez, con internet)](#2-instalar-la-caja-una-sola-vez-con-internet)
3. [Preparar la red wifi](#3-preparar-la-red-wifi)
4. [Encender la caja (cada día)](#4-encender-la-caja-cada-día)
5. [Conectar cada aparato (la primera vez)](#5-conectar-cada-aparato-la-primera-vez)
6. [Usar Mochila](#6-usar-mochila)
7. [Si algo no funciona](#7-si-algo-no-funciona)
8. [Datos, copias y seguridad](#8-datos-copias-y-seguridad)
9. [Otras formas de arrancarlo](#9-otras-formas-de-arrancarlo)
10. [Demo, idiomas y documentación](#10-demo-idiomas-y-documentación)

---

## 1. Qué hace falta

| Qué | Requisitos |
|---|---|
| **Caja**: el ordenador que hace de servidor | Un **Mac** con macOS. Se recomiendan **16 GB de RAM**, porque la IA usa unos 6 GB mientras trabaja, y **8 GB libres en el disco**. Tiene que estar enchufado mientras se usa. |
| **Router wifi** | Cualquiera, **no hace falta que tenga internet**: puede ser uno viejo, sin cable de internet. También vale la zona wifi de un móvil con los datos móviles apagados. |
| **Aparatos de la clase** | Móviles, tablets u ordenadores con un navegador actual: Chrome, Edge, Safari o Firefox. |
| **Internet** | **Solo para instalar**: para descargar el proyecto, las librerías y el modelo de IA (unos 3,3 GB). Después, todo funciona sin internet. |

> `caja.sh` está hecho y probado para macOS. En Linux o Windows haría falta adaptarlo.

---

## 2. Instalar la caja (una sola vez, con internet)

Todos los comandos se escriben en la app **Terminal** del Mac: está en Aplicaciones → Utilidades.

### 2.1. Instalar las herramientas

1. **Git y las herramientas de desarrollo de Apple.** Escribe este comando y acepta la instalación que se abre:
   ```bash
   xcode-select --install
   ```
   Si dice que ya están instaladas, sigue al paso siguiente.
2. **Node.js 22 o posterior.** Descarga la versión «LTS» de https://nodejs.org e instálala.
3. **Python 3.11 o posterior.** Descárgalo de https://www.python.org/downloads/ e instálalo.
4. **Ollama**, que hace funcionar la IA en el propio Mac. Descárgalo de https://ollama.com, instálalo y ábrelo una vez. Aparecerá una llama en la barra de arriba.

Para comprobar que están instaladas, cada una de estas líneas debe mostrar una versión:

```bash
git --version
node --version
python3 --version
ollama --version
```

`node` tiene que ser 22 o mayor, y `python3`, 3.11 o mayor.

### 2.2. Descargar Mochila

```bash
cd ~/Documents
git clone https://github.com/feralbacor/Reto02-ProFuturo.git
cd Reto02-ProFuturo
```

A partir de aquí, todos los comandos se escriben **dentro de la carpeta `Reto02-ProFuturo`**.

### 2.3. Instalar la web

```bash
cd web
npm ci
cd ..
```

### 2.4. Instalar la API

La API es la parte que guarda los datos y habla con la IA.

```bash
cd api
python3 -m venv .venv
.venv/bin/python -m pip install "fastapi==0.162.0" "uvicorn==0.54.0" "pypdf>=5"
cd ..
```

### 2.5. Descargar el modelo de IA

Son unos 3,3 GB, así que puede tardar un rato. Con Ollama abierto:

```bash
ollama pull qwen3-vl:4b-instruct
```

Comprueba que está descargado: el siguiente comando debe mostrar `qwen3-vl:4b-instruct` en la lista.

```bash
ollama list
```

### 2.6. (Opcional) Cargar datos de ejemplo

Si quieres una clase de prueba con alumnos, lecciones y notas:

```bash
api/.venv/bin/python api/demo.py
```

Crea la clase **AULA23**. Los datos para entrar están en el [apartado 10](#10-demo-idiomas-y-documentación).

La instalación está terminada: **a partir de aquí ya no hace falta internet**.

---

## 3. Preparar la red wifi

1. **Enciende el router**, o activa la zona wifi de un móvil con los **datos móviles apagados**.
2. **Conecta la caja (el Mac) a esa wifi.**
3. Para que el Mac **no vuelva solo a otra wifi que tenga internet**, ve a Ajustes del Sistema → Wi-Fi, pulsa «Detalles…» en cada una de esas redes y desactiva **«Conectarse automáticamente»**.

macOS dirá que esa wifi está «Sin conexión a internet». Es normal y no afecta.

> **Importante:** no sirven las redes que **aíslan a los aparatos entre sí**. Así son muchas wifis de invitados, de empresas o de universidades: cada aparato puede salir a internet, pero no puede hablar con los demás. Con un router propio o con la zona wifi de un móvil no pasa.

---

## 4. Encender la caja (cada día)

1. **Abre Ollama.** Tiene que verse la llama en la barra de arriba.
2. En Terminal, dentro de la carpeta del proyecto, escribe:
   ```bash
   caffeinate -i ./caja.sh
   ```
   `caffeinate -i` evita que el Mac se duerma mientras la caja está encendida. Si prefieres no usarlo, `./caja.sh` también funciona, pero entonces el Mac no debe dormirse.
3. La primera vez tarda un poco más: crea el certificado de la caja y prepara la web. **Si macOS pregunta si permites conexiones entrantes a «Python», pulsa «Permitir».**
4. Cuando termine, verás algo así:
   ```
   CAJA ENCENDIDA. En móviles, tablets y ordenadores de esta red abre:  http://DIRECCIÓN-DE-LA-CAJA:8080
   ```
   **Ese es el enlace para los aparatos de la clase.** La dirección depende de cada wifi; la de tu caja es la que salga en tu terminal. Puedes escribirla en la pizarra.
5. **Deja la Terminal abierta.** Si la cierras, se apaga la caja.

Conviene saber:
- **Si el Mac cambia de wifi**, la caja lo detecta en unos segundos y vuelve a arrancar con la nueva dirección. En la terminal aparecerá el enlace nuevo. Los aparatos **no** tienen que volver a instalar nada: solo usar el enlace nuevo.
- **Sin ninguna wifi**, la caja funciona solo en el propio Mac. Ábrela en él con `http://localhost:8080`.
- **Para apagarla**, pulsa **Ctrl + C** en la Terminal.

---

## 5. Conectar cada aparato (la primera vez)

En cada móvil, tablet u ordenador, incluido el del profe si no es la propia caja:

1. **Conéctalo a la misma wifi que la caja.**
2. Abre el navegador y escribe **el enlace que salió en la terminal de la caja**: el que empieza por `http://` y acaba en `:8080`. En iPhone y iPad, usa **Safari**.
3. Saldrá **«Este aparato necesita el certificado de la caja»**. Pulsa **«Sí, descargar el certificado»**. Si el navegador avisa de que la descarga no es segura, es normal, porque viene de la caja y no de internet: elige «Descargar» o «Conservar».
4. **Instálalo** siguiendo los pasos que salen en la página, que son los de ese aparato. En resumen:

   | Aparato | Dónde se instala |
   |---|---|
   | **Android** | Ajustes → Seguridad → Cifrado y credenciales → Instalar un certificado → **Certificado de CA**. Elige `mochila-caja.crt`. |
   | **iPhone / iPad** | Pulsa «Permitir» al descargar → Ajustes → **Perfil descargado** → Instalar. Después, Ajustes → General → Información → **Ajustes de confianza de certificados** → activa «Mochila caja». |
   | **Windows** | Abre `mochila-caja.crt` → Instalar certificado → **Equipo local** → «Colocar todos los certificados en el siguiente almacén» → **Entidades de certificación raíz de confianza**. Cierra el navegador y vuelve a abrirlo. |
   | **Mac** | Abre `mochila-caja.crt` y añádelo al llavero «Inicio de sesión». En **Acceso a Llaveros**, doble clic en «Mochila caja» → Confiar → **«Confiar siempre»**. Cierra el navegador del todo (Cmd + Q) y vuelve a abrirlo. |
   | **Chromebook / Linux** | En Chrome: Configuración → Privacidad y seguridad → Seguridad → **Gestionar certificados** → Autoridades → Importar → marca «Confiar en este certificado para identificar sitios web». |
   | **Firefox** (cualquier sistema) | Ajustes → Privacidad y seguridad → **Ver certificados** → Autoridades → Importar → marca «identificar sitios web». |

5. Vuelve al navegador y pulsa **«Ya lo he instalado: abrir Mochila»**. Se abrirá la app.
6. **Instala la app** en el aparato, para tenerla como un icono más y usarla sin conexión:
   - **Android (Chrome):** menú ⋮ → **«Instalar app»** o «Añadir a pantalla de inicio».
   - **iPhone / iPad (Safari):** botón Compartir → **«Añadir a pantalla de inicio»**.
   - **Ordenador (Chrome o Edge):** icono **«Instalar»** a la derecha de la barra de direcciones.

**Las siguientes veces** no hay que hacer nada de esto: basta con abrir la app instalada, o el mismo enlace, que ya lleva directo a la app.

> El certificado se instala **una sola vez por aparato** y vale para cualquier wifi. Solo habría que repetirlo si se borra la carpeta `caja-cert` de la caja (ver el [apartado 8](#8-datos-copias-y-seguridad)).

---

## 6. Usar Mochila

**El profe.** Mejor desde un portátil u ordenador.
1. «Soy profe» → **«Crear mi cuenta de profe»**: nombre, usuario y contraseña.
2. **Crear una clase.** Sale un **código de 6 letras**: es el que usarán los alumnos para entrar.
3. **Nueva lección.** Haz una foto a una página del libro, sube un archivo (PDF, Word, PowerPoint…) o pega un texto. Elige:
   - **Lección**, con pruebas (cuestionario, sopa de letras, crucigrama, pregunta de desarrollo) o sin ellas.
   - **Examen**.

   La IA de la caja la prepara en uno o dos minutos. También se puede escribir a mano, sin IA.
4. **Revísala y publícala.**
5. En **«Ver notas»** salen los resultados, las estadísticas y quién se está quedando atrás. Las respuestas de desarrollo las corrige la IA, pero **manda la nota que ponga el profe**.

**El alumno.**
1. «Soy estudiante» → **«Crear mi usuario»**, con el código de la clase.
2. Las lecciones publicadas **se descargan en el aparato**.
3. Desde ese momento puede leer, escuchar, hacer los tests y los juegos y preguntar dudas **aunque no haya conexión**. Arriba se ve cuántas respuestas faltan por enviar.
4. Cuando vuelve a ver la caja, todo se envía solo y el profe ve las notas.
5. Varios alumnos pueden compartir un aparato: cada uno entra con su usuario.

**Sin conexión con la caja:**
- **El alumno** sigue usando todo lo que ya tiene descargado.
- **El profe** entra en **modo «solo ver»**: ve sus clases, lecciones, notas y estadísticas como estaban la última vez, pero no puede crear ni subir nada. Puede entrar incluso en un aparato que no haya usado nunca, siempre que ese aparato se haya conectado antes a la caja. Para eso, la caja reparte a todos los aparatos los datos de cada profe **cifrados con su contraseña**.
- En la portada se ve si hay conexión con la caja y si se han descargado los datos de los profes.

---

## 7. Si algo no funciona

| Qué pasa | Qué hacer |
|---|---|
| El enlace **no carga** en un aparato | 1. Comprueba que el aparato está en **la misma wifi** que la caja. 2. Comprueba que el Mac **no se ha cambiado solo** a otra wifi. 3. Mira si la wifi aísla a los aparatos entre sí: prueba con un router propio o con la zona wifi de un móvil. 4. En el Mac, revisa Ajustes del Sistema → Red → **Cortafuegos**: debe permitir conexiones a Python. |
| Dice **«Este aparato todavía no se fía de la caja»** aunque el certificado ya está descargado | Descargarlo no basta: hay que **instalarlo y marcarlo como de confianza** (apartado 5, paso 4). Después, cierra el navegador del todo y vuelve a abrirlo. En iPhone/iPad, no olvides «Ajustes de confianza de certificados». |
| Funcionaba y ha dejado de funcionar | Es posible que el Mac haya cambiado de wifi y la dirección sea otra. Mira en la terminal de la caja el **último enlace** que ha salido. |
| **«La IA está apagada»** o no prepara lecciones | Abre **Ollama** y comprueba que `ollama list` muestra `qwen3-vl:4b-instruct`. Si no aparece, descárgalo con `ollama pull qwen3-vl:4b-instruct`, para lo que hace falta internet. |
| `caja.sh` dice que un **puerto está ocupado** (8080 u 8443) | Ya hay una caja encendida en otra Terminal: ciérrala con Ctrl + C, o cierra el programa que esté usando ese puerto. |
| `./caja.sh` dice **«permiso denegado»** | Ejecuta `chmod +x caja.sh` y vuelve a probar. |
| La IA va **muy lenta** | Es normal en ordenadores con poca memoria. Cierra otros programas. Una lección tarda normalmente entre 1 y 2 minutos. |
| Un alumno **no puede entrar sin conexión** | La primera vez que entra en un aparato necesita la caja. Después ya puede entrar sin ella. |

---

## 8. Datos, copias y seguridad

- **Todos los datos** (clases, alumnos, lecciones, notas) están en **`api/mochila.db`**, en la caja. Para hacer una copia de seguridad, **apaga la caja** (Ctrl + C) y copia ese archivo a otro sitio.
- **El certificado de la caja** está en la carpeta **`caja-cert/`**. **No compartas `caja-cert/ca.key`**: con ella, cualquiera podría hacerse pasar por la caja ante los aparatos que la tienen instalada. Si borras la carpeta, se crea un certificado nuevo y **todos los aparatos tendrán que volver a instalarlo**. Cuando ya no uséis Mochila, podéis quitar «Mochila caja» de los certificados de cada aparato.
- **Privacidad:** no se piden email ni apellidos. **A la IA solo le llega el contenido de la lección**, nunca nombres ni notas de los alumnos. Todo se queda en la caja y en los aparatos de la clase: nada sale a internet.
- **Es un prototipo de hackatón.** Las contraseñas de los profes pueden ser cortas, pero cuanto más largas, más difícil es adivinarlas a partir de los datos cifrados que guardan los aparatos.

---

## 9. Otras formas de arrancarlo

**Para desarrollar**, con la API y la web por separado y recarga automática. En una terminal:

```bash
cd api && .venv/bin/uvicorn main:app --reload --port 8000
```

Y en otra terminal:

```bash
cd web && npm run dev
```

Después abre http://localhost:5173.

**Para enseñarlo en un móvil a través de internet**, sin caja: `zsh movil.sh` crea un túnel público con `cloudflared`. Necesita internet y la API encendida.

**En línea:** lo que está en la rama `main` de GitHub se publica solo en el servidor del equipo; ver `AGENTS.md`. En línea no hay modo caja.

---

## 10. Demo, idiomas y documentación

**Datos de ejemplo** (`api/demo.py`, apartado 2.6):
- Clase: **AULA23**, con PIN del profe **1234**.
- Alumno: **aula23ana**, con contraseña **1234**.
- Incluye seis alumnos, cuatro lecciones (en español, francés e inglés) y dudas de ejemplo.

**Idiomas:** la portada permite elegir entre 23 idiomas, y el árabe se escribe de derecha a izquierda. El francés y el inglés están revisados; los demás son traducciones automáticas pendientes de revisar. El profe elige el idioma de cada lección.

**Comprobaciones**, desde la raíz del proyecto:

```bash
api/.venv/bin/python api/comprobar_paquetes.py
api/.venv/bin/python api/comprobar_examen.py
node web/comprobar-juegos.js
npm --prefix web run build
```

**Más documentación:**
- [CAMBIOS-V2.md](CAMBIOS-V2.md) y [CAMBIOS-V2-CAJA.md](CAMBIOS-V2-CAJA.md): cómo funciona por dentro el modo caja.
- [Pitch de tres minutos](docs/pitch.md), [guion de la demo](docs/guion-demo.md), [preguntas del jurado](docs/preguntas-jurado.md), [ensayo en móvil](docs/ensayo.md) y [accesos de demo](docs/demo.md).

---

© 2026 **MaestrIA**
