"""API de Mochila. La IA funciona en este mismo ordenador (Ollama), sin internet."""
import base64
import binascii
import hashlib
import hmac
import html
import io
import json
import os
import random
import re
import secrets
import sqlite3
import threading
import time
import urllib.error
import urllib.request
import uuid
import zipfile
from contextlib import closing
from datetime import datetime

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

app = FastAPI()

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mochila.db")
# Por orden: un túnel a una GPU (si está abierto en el 11435) y, si no, el Ollama de este ordenador.
OLLAMAS = os.environ.get("OLLAMA_URL", "http://localhost:11435,http://localhost:11434").split(",")
MODELO = os.environ.get("MODELO_IA", "qwen3-vl:4b-instruct")
# Siempre el mismo contexto (unos 5,7 GB de RAM): si cambia entre peticiones, Ollama recarga el modelo y una vez se quedó colgado.
# Cabe un nivel 5 de un tema largo (unos 6000 tokens de texto) con sitio de sobra para lo que escribe.
CONTEXTO = 16384
LETRAS_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # sin O/0 ni I/1, que se confunden

TABLAS = """
CREATE TABLE IF NOT EXISTS clases (
    codigo TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    creada TEXT NOT NULL,
    oculta INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS alumnos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS matriculas (
    clase TEXT NOT NULL REFERENCES clases(codigo),
    alumno TEXT NOT NULL REFERENCES alumnos(id),
    fecha TEXT NOT NULL,
    PRIMARY KEY (clase, alumno)
);
CREATE TABLE IF NOT EXISTS lecciones (
    id TEXT PRIMARY KEY,
    clase TEXT NOT NULL REFERENCES clases(codigo),
    titulo TEXT NOT NULL,
    contenido TEXT NOT NULL,
    fecha TEXT NOT NULL,
    publicada INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS respuestas (
    id TEXT PRIMARY KEY,
    alumno TEXT NOT NULL,
    leccion_id TEXT NOT NULL,
    pregunta INTEGER NOT NULL,
    respuesta INTEGER NOT NULL,
    fecha TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pines_profe (
    clase TEXT PRIMARY KEY REFERENCES clases(codigo),
    sal TEXT NOT NULL,
    hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dudas (
    id TEXT PRIMARY KEY,
    alumno TEXT NOT NULL,
    leccion_id TEXT NOT NULL,
    pregunta TEXT NOT NULL,
    fecha TEXT NOT NULL,
    respuesta TEXT,
    corregida INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cuentas_alumno (
    alumno TEXT PRIMARY KEY REFERENCES alumnos(id),
    usuario TEXT NOT NULL UNIQUE,
    sal TEXT NOT NULL,
    hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cuentas_profe (
    usuario TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    sal TEXT NOT NULL,
    hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS clases_profe (
    clase TEXT PRIMARY KEY REFERENCES clases(codigo),
    profe TEXT NOT NULL REFERENCES cuentas_profe(usuario)
);
"""


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def preparar_bd():
    # Una base de datos de antes de las clases no sirve: se aparta (no se borra) y se empieza otra.
    if os.path.exists(DB_PATH):
        with closing(sqlite3.connect(DB_PATH)) as c:
            columnas = [fila[1] for fila in c.execute("PRAGMA table_info(lecciones)")]
        if columnas and "clase" not in columnas:
            os.replace(DB_PATH, DB_PATH.replace(".db", f"-antigua-{datetime.now():%Y%m%d%H%M%S}.db"))
    with closing(db()) as c, c:
        c.executescript(TABLAS)
        # Bases de datos que ya existían: la columna se añade sin tocar lo demás.
        if "oculta" not in [fila[1] for fila in c.execute("PRAGMA table_info(clases)")]:
            c.execute("ALTER TABLE clases ADD COLUMN oculta INTEGER NOT NULL DEFAULT 0")


preparar_bd()


def ahora():
    return datetime.now().isoformat(timespec="seconds")


def normalizar_codigo(codigo: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", codigo.upper())


def buscar_clase(c, codigo, para_alumno=False):
    clase = c.execute("SELECT codigo, nombre, oculta FROM clases WHERE codigo = ?", (normalizar_codigo(codigo),)).fetchone()
    # Para un alumno, una clase oculta es como si no existiera: su código no le deja entrar.
    if not clase or (para_alumno and clase["oculta"]):
        raise HTTPException(404, "No hay ninguna clase con ese código. Revisa que esté bien escrito.")
    return clase


# ---------- PIN del profe ----------
# Cada clase tiene el PIN de su profe (solo se guarda su hash). Las clases sin PIN (antiguas o de demo) quedan abiertas.

def hash_pin(pin: str, sal: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(sal), 100_000).hex()


def guardar_pin(c, codigo: str, pin: str):
    sal = secrets.token_hex(16)
    c.execute("INSERT OR REPLACE INTO pines_profe (clase, sal, hash) VALUES (?, ?, ?)", (codigo, sal, hash_pin(pin, sal)))


FALLOS = {}  # ponytail: en memoria (se pierde al reiniciar); basta para frenar a quien prueba PINes o contraseñas a mano


def comprobar_secreto(clave: str, secreto: str, fila, mensaje_malo: str):
    """Compara con el hash guardado. Tras 5 fallos seguidos con la misma clave, 1 minuto sin poder probar."""
    fallos, bloqueado_hasta = FALLOS.get(clave, (0, 0))
    if time.time() < bloqueado_hasta:
        raise HTTPException(429, "Demasiados intentos fallidos. Espera un minuto.")
    if fila and secrets.compare_digest(hash_pin(secreto, fila["sal"]), fila["hash"]):
        FALLOS.pop(clave, None)
        return
    fallos += 1
    FALLOS[clave] = (0, time.time() + 60) if fallos >= 5 else (fallos, 0)
    raise HTTPException(401, mensaje_malo)


# ---------- Cuenta del profe ----------
# La sesión es «usuario.firma», con la firma sacada del hash de su contraseña: no hace falta guardarla
# y deja de valer si cambia la contraseña. El móvil la guarda para abrir sus clases también sin conexión.

def firma_sesion(hash_guardado: str) -> str:
    return hmac.new(bytes.fromhex(hash_guardado), b"sesion-profe", hashlib.sha256).hexdigest()


def profe_de_sesion(sesion: str | None):
    usuario, _, firma = (sesion or "").partition(".")
    with closing(db()) as c:
        fila = c.execute("SELECT hash FROM cuentas_profe WHERE usuario = ?", (usuario,)).fetchone()
    return usuario if fila and secrets.compare_digest(firma, firma_sesion(fila["hash"])) else None


def solo_con_sesion(x_sesion_profe: str | None = Header(default=None)) -> str:
    usuario = profe_de_sesion(x_sesion_profe)
    if not usuario:
        raise HTTPException(401, "Entra con tu usuario de profe.")
    return usuario


def comprobar_pin(codigo: str, x_pin_profe: str | None = Header(default=None), x_sesion_profe: str | None = Header(default=None)):
    """Dependencia de las rutas del profe: necesitan {codigo} en la ruta y la sesión del profe dueño o el PIN de la clase."""
    codigo = normalizar_codigo(codigo)
    with closing(db()) as c:
        fila = c.execute("SELECT sal, hash FROM pines_profe WHERE clase = ?", (codigo,)).fetchone()
        dueno = c.execute("SELECT profe FROM clases_profe WHERE clase = ?", (codigo,)).fetchone()
    if dueno and profe_de_sesion(x_sesion_profe) == dueno["profe"]:
        return
    if not fila:
        if dueno:
            raise HTTPException(401, "Esta clase es de otro profe. Entra con tu usuario.")
        return
    if not x_pin_profe:
        raise HTTPException(401, "Esta clase tiene PIN: escríbelo para entrar.")
    comprobar_secreto(f"clase:{codigo}", x_pin_profe, fila, "PIN incorrecto.")


SOLO_PROFE = [Depends(comprobar_pin)]


# ---------- Cuentas de alumno ----------
# Usuario único y contraseña: en un mismo móvil pueden entrar varios hermanos o compañeros.
# Sin email: si un niño olvida la contraseña, su profe le pone otra. El id del alumno (UUID) solo se entrega
# al entrar con la contraseña, y es lo que el móvil usa después para sincronizar.

def normalizar_usuario(usuario: str) -> str:
    return re.sub(r"\s+", "", usuario).lower()


def comprobar_contrasena(contrasena: str):
    if not 4 <= len(contrasena) <= 64:
        raise HTTPException(400, "La contraseña tiene que tener al menos 4 letras o números.")


def guardar_contrasena(c, alumno_id: str, contrasena: str, usuario: str | None = None):
    sal = secrets.token_hex(16)
    if usuario:
        c.execute("INSERT INTO cuentas_alumno (alumno, usuario, sal, hash) VALUES (?, ?, ?, ?)",
                  (alumno_id, usuario, sal, hash_pin(contrasena, sal)))
    else:
        c.execute("UPDATE cuentas_alumno SET sal = ?, hash = ? WHERE alumno = ?", (sal, hash_pin(contrasena, sal), alumno_id))


def usuario_libre(c, base: str) -> str:
    base = base[:17]
    n = 2
    while c.execute("SELECT 1 FROM cuentas_alumno WHERE usuario = ?", (f"{base}{n}",)).fetchone():
        n += 1
    return f"{base}{n}"


# ---------- Materias ----------
# La materia va dentro del contenido de la lección (no cambia las tablas).

def materia_de(c, codigo: str, materia) -> str:
    """Limpia la materia y, si ya existe en la clase con otras mayúsculas, usa la que ya hay."""
    materia = re.sub(r"\s+", " ", str(materia or "")).strip()[:40] or "General"
    existentes = c.execute(
        "SELECT DISTINCT json_extract(contenido, '$.materia') FROM lecciones WHERE clase = ?", (codigo,)
    ).fetchall()
    for (m,) in existentes:
        if m and m.lower() == materia.lower():
            return m
    return materia[0].upper() + materia[1:]


# ---------- IA local (Ollama) ----------

# Los mismos códigos que web/src/idioma.js; el nombre va en la instrucción para la IA.
IDIOMAS = {
    "es": "español", "fr": "francés", "en": "inglés", "ar": "árabe", "pt": "portugués", "sw": "suajili",
    "am": "amárico", "om": "oromo", "ti": "tigriña", "so": "somalí", "ha": "hausa", "yo": "yoruba", "ig": "igbo",
    "ak": "twi (akan)", "wo": "wólof", "ln": "lingala", "rw": "kinyarwanda", "mg": "malgache", "ny": "chichewa",
    "sn": "shona", "zu": "zulú", "xh": "xhosa", "af": "afrikáans",
}

PROMPT_LEER = """Transcribe exactamente todo el texto de esta foto de una página de libro, en el orden en que se lee.
- Copia las palabras tal cual, con sus tildes y signos. No corrijas, no resumas, no traduzcas.
- Incluye títulos, recuadros y pies de foto. No incluyas el número de página.
- Si una palabra no se lee, escribe [?]. No te inventes nada.
- Si en la foto no hay texto legible, responde solo: SIN TEXTO
Devuelve solo el texto, sin comentarios."""

# Nivel de dificultad 0-5, relativo al TEXTO: un 4 de un tema de 2.º de la ESO es más fácil que un 2 de 3.º de carrera.
# Cuanto más alto, más larga y más técnica. (palabras de la lectura, frases del ejemplo, preguntas, cómo escribir)
NIVELES = {
    0: (60, 120, "2 o 3", 5, "Lo esencial: solo la idea principal, con frases muy cortas (12 palabras como mucho) y las palabras más sencillas. Sin términos técnicos."),
    1: (100, 220, "2 a 4", 5, "Básico: las ideas principales, con frases cortas (15 palabras como mucho) y palabras sencillas. Si sale un término técnico, explícalo con palabras fáciles."),
    2: (200, 380, "3 a 5", 5, "Normal: lo que se espera en ese curso, con los términos propios del tema, cada uno explicado la primera vez."),
    3: (350, 600, "4 a 6", 6, "Completo: todas las ideas del texto, con su vocabulario técnico, definiciones y cómo se relacionan."),
    4: (550, 850, "5 a 7", 8, "Avanzado: completo y técnico. Explica cómo funciona cada cosa, sus partes, sus tipos, causas y consecuencias, ventajas e inconvenientes, con el rigor del curso."),
    5: (800, 1200, "6 a 8", 10, "Experto: todo el contenido con el máximo detalle y precisión técnica del texto: mecanismos, pasos, casos, comparaciones y excepciones."),
}
# Dificultad de las preguntas 0-5, aparte del nivel de la lección (y también relativa al curso del texto).
DIFICULTAD_PREGUNTAS = {
    0: "muy fáciles: de recordar un dato que sale tal cual en el texto; las incorrectas se ven claramente falsas",
    1: "fáciles: de recordar y entender las ideas principales; las incorrectas son fáciles de descartar",
    2: "normales: de entender lo que dice el texto, no de copiar frases; las incorrectas son posibles",
    3: "algo difíciles: de relacionar ideas de distintas partes del texto; las incorrectas se parecen a la buena",
    4: "difíciles: de aplicar lo aprendido a un caso concreto o comparar conceptos; las incorrectas tienen errores sutiles",
    5: "muy difíciles: de razonar en varios pasos, casos nuevos y excepciones, nada de memoria; las incorrectas son casi correctas y solo se descartan entendiendo bien el tema",
}
MAX_PREGUNTAS = 30
# Tope de lo que puede escribir la IA, según el nivel y las preguntas. A veces entra en bucle repitiendo frases
# (1 de 3 con un texto corto): sin tope sigue unos 20 min y deja a la cola esperando. Si llega al tope, se reintenta.
TOKENS_LECTURA = {0: 500, 1: 800, 2: 1500, 3: 3000, 4: 5000, 5: 8000}
TOKENS_POR_PREGUNTA = 200
# Lecciones que la IA está preparando ahora, como (clase, id): así un segundo intento no se pone a la cola detrás del primero.
# shortcut: solo vale con un proceso de la API; con varios, pasarlo a la base de datos.
PREPARANDO = set()

PROMPT_LECCION = """Eres profesor. Con el TEXTO de abajo prepara una lección en {idioma}.
Escribe TODO en {idioma} (título, lectura, ejemplo, preguntas y respuestas), aunque el TEXTO esté en otro idioma.
Primero mira para qué curso es el TEXTO (primaria, ESO, bachillerato, FP o universidad): la lección es para alumnos de ese curso.
NIVEL {nivel} de 0 a 5 (0 = lo más corto y sencillo, 5 = lo más extenso y técnico, siempre dentro de ese curso). {como}
- "titulo": corto y claro.
- "lectura_facil": la lección en sí, contada al NIVEL {nivel}: enseña tú el contenido, no digas «el texto explica» ni lo resumas desde fuera. {largo} Un párrafo para cada idea, separados con una línea en blanco. Usa solo información del texto: puedes explicar y desarrollar lo que dice, pero no añadas datos que no estén.
- "explicacion_ejemplo": explica la idea principal con un ejemplo de la vida diaria, o un caso práctico real si el tema es técnico. De {frases} frases. El ejemplo tiene que ser cierto y tener sentido.
{preguntas}

TEXTO:
<<<
{texto}
>>>"""

ESQUEMA_LECCION = {
    "type": "object",
    "properties": {
        # Con largo máximo: en otros idiomas el modelo pequeño a veces repite una frase sin parar y el JSON llega cortado.
        "titulo": {"type": "string", "maxLength": 80},
        "lectura_facil": {"type": "string", "maxLength": 1600},
        "explicacion_ejemplo": {"type": "string", "maxLength": 700},
        "preguntas": {
            "type": "array",
            "minItems": 5,
            "maxItems": 5,
            "items": {
                "type": "object",
                # La respuesta buena va como texto (y su porqué antes que las incorrectas): los modelos pequeños
                # se equivocan al dar la posición de la buena, pero no al escribirla.
                "properties": {
                    "pregunta": {"type": "string", "maxLength": 200},
                    "respuesta_correcta": {"type": "string", "maxLength": 120},
                    "porque": {"type": "string", "maxLength": 300},
                    "incorrectas": {"type": "array", "minItems": 3, "maxItems": 3, "items": {"type": "string", "maxLength": 120}},
                },
                "required": ["pregunta", "respuesta_correcta", "porque", "incorrectas"],
            },
        },
    },
    "required": ["titulo", "lectura_facil", "explicacion_ejemplo", "preguntas"],
}


def ollama_disponible():
    """El primer Ollama que responde y tiene el modelo, o None."""
    for url in OLLAMAS:
        try:
            with urllib.request.urlopen(f"{url}/api/tags", timeout=3) as r:
                if MODELO in [m["name"] for m in json.load(r)["models"]]:
                    return url
        except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError):
            pass
    return None


def preguntar_ia(prompt, imagen=None, formato=None, max_tokens=1500, espera=300):
    url = ollama_disponible()
    if not url:
        raise HTTPException(503, f"La IA está apagada o sin descargar. Abre Ollama (y si hace falta: ollama pull {MODELO}).")
    mensaje = {"role": "user", "content": prompt}
    if imagen:
        mensaje["images"] = [imagen]
    cuerpo = {
        "model": MODELO,
        "messages": [mensaje],
        "stream": False,
        "keep_alive": "30m",
        "options": {"temperature": 0.3 if formato else 0, "num_ctx": CONTEXTO, "num_predict": max_tokens, "repeat_penalty": 1.1},
    }
    if formato:
        cuerpo["format"] = formato
    peticion = urllib.request.Request(
        f"{url}/api/chat", json.dumps(cuerpo).encode(), {"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(peticion, timeout=espera) as r:
            return json.load(r)["message"]["content"]
    except urllib.error.HTTPError as e:
        raise HTTPException(502, f"La IA ha dado un error: {e.read().decode(errors='replace')[:200]}")
    except TimeoutError:
        raise HTTPException(504, "La IA está tardando demasiado. Prueba otra vez.")
    except urllib.error.URLError:
        raise HTTPException(503, "Se ha perdido la conexión con la IA. Prueba otra vez.")


def leccion_valida(l) -> bool:
    if not isinstance(l, dict):
        return False
    for clave in ("titulo", "lectura_facil", "explicacion_ejemplo"):
        if not isinstance(l.get(clave), str) or not l[clave].strip():
            return False
    preguntas = l.get("preguntas")
    if not isinstance(preguntas, list) or not 0 <= len(preguntas) <= MAX_PREGUNTAS:
        return False
    if len({str(p.get("pregunta", "")).strip().lower() for p in preguntas if isinstance(p, dict)}) != len(preguntas):
        return False  # preguntas repetidas
    for p in preguntas:
        if not isinstance(p, dict) or not isinstance(p.get("pregunta"), str) or not p["pregunta"].strip():
            return False
        opciones = p.get("opciones")
        if not isinstance(opciones, list) or len(opciones) != 4:
            return False
        if not all(isinstance(o, str) and o.strip() for o in opciones):
            return False
        if len({o.strip().lower() for o in opciones}) != 4:
            return False
        if p.get("correcta") not in (0, 1, 2, 3) or isinstance(p.get("correcta"), bool):
            return False
        if not isinstance(p.get("porque", ""), str):
            return False
    return True


def barajar_opciones(leccion):
    # Los modelos pequeños suelen poner la buena la primera: se cambian de sitio.
    for p in leccion["preguntas"]:
        buena = p["opciones"][p["correcta"]]
        random.shuffle(p["opciones"])
        p["correcta"] = p["opciones"].index(buena)
    return leccion


def juntar_opciones(leccion):
    """De lo que da la IA (la buena y 3 incorrectas) a lo que guarda la app: 4 opciones y la posición de la buena."""
    if isinstance(leccion, dict) and isinstance(leccion.get("preguntas"), list):
        leccion["preguntas"] = [
            {"pregunta": p.get("pregunta"), "opciones": [p.get("respuesta_correcta"), *p["incorrectas"]], "correcta": 0, "porque": p.get("porque", "")}
            if isinstance(p, dict) and isinstance(p.get("incorrectas"), list) else p
            for p in leccion["preguntas"]
        ]
    return leccion


def esquema_con_nivel(nivel, n, dificultad):
    """El esquema de siempre, con el número de preguntas que pide el profe y sin largo máximo en los textos."""
    e = json.loads(json.dumps(ESQUEMA_LECCION))
    # Sin límite de largo en la lectura ni en el ejemplo: lo marca el nivel (en el prompt), no un corte.
    del e["properties"]["lectura_facil"]["maxLength"], e["properties"]["explicacion_ejemplo"]["maxLength"]
    e["properties"]["preguntas"]["minItems"] = e["properties"]["preguntas"]["maxItems"] = n
    if max(nivel, dificultad) >= 3:  # las respuestas técnicas o difíciles son más largas (con 120 alguna salía cortada)
        p = e["properties"]["preguntas"]["items"]["properties"]
        p["respuesta_correcta"]["maxLength"] = p["incorrectas"]["items"]["maxLength"] = 200
    return e


def quitar_preguntas_malas(leccion):
    """Con muchas preguntas, el modelo pequeño repite alguna o una opción: se quitan esas y se queda el resto."""
    vistas, buenas = set(), []
    for p in leccion.get("preguntas") or []:
        if not isinstance(p, dict) or not isinstance(p.get("opciones"), list):
            continue
        clave = str(p.get("pregunta", "")).strip().lower()
        opciones = {str(o).strip().lower() for o in p["opciones"]}
        if clave and clave not in vistas and len(p["opciones"]) == 4 and len(opciones) == 4 and "" not in opciones:
            vistas.add(clave)
            buenas.append(p)
    leccion["preguntas"] = buenas
    return leccion


def crear_leccion_con_ia(texto, idioma="es", nivel=1, n_preguntas=None, dificultad=None):
    min_palabras, max_palabras, frases, n_por_nivel, como = NIVELES[nivel]
    n_preguntas = n_por_nivel if n_preguntas is None else n_preguntas
    dificultad = min(nivel, 5) if dificultad is None else dificultad
    largo = (f"Unas {min_palabras} a {max_palabras} palabras." if nivel < 3 else
             f"Como mínimo {min_palabras} palabras y sin máximo: extiéndete todo lo que dé de sí el texto.")
    preguntas = ('- "preguntas": una lista vacía [] (esta lección no lleva preguntas).' if n_preguntas == 0 else
                 f'- "preguntas": {n_preguntas} preguntas {DIFICULTAD_PREGUNTAS[dificultad]} (DIFICULTAD {dificultad} de 0 a 5, '
                 'para alumnos de ese curso). Todas distintas entre sí, sobre partes distintas del texto, y que se puedan contestar con el texto. Para cada una:\n'
                 '  - "respuesta_correcta": la respuesta buena, corta, sacada del texto.\n'
                 '  - "porque": una frase que explica por qué es la buena, con lo que dice el texto.\n'
                 '  - "incorrectas": 3 respuestas cortas que parezcan posibles pero que, según el texto, no son verdad. Distintas entre sí y de la buena.')
    prompt = PROMPT_LECCION.format(texto=texto, idioma=IDIOMAS[idioma], nivel=nivel, como=como, largo=largo, frases=frases, preguntas=preguntas)
    # Sin pasarse del contexto: lo que no cabe seguiría escribiéndose. Un token son 3 letras o más, así que len // 2 va sobrado.
    tope = min(TOKENS_LECTURA[nivel] + TOKENS_POR_PREGUNTA * n_preguntas, CONTEXTO - len(prompt) // 2)
    for _ in range(2):  # si sale mal, se intenta una vez más
        # Sin prisa: un nivel 5 de un tema largo tarda de 5 a 15 min en un Mac M3.
        respuesta = preguntar_ia(prompt, formato=esquema_con_nivel(nivel, n_preguntas, dificultad), max_tokens=tope, espera=1800)
        try:
            leccion = json.loads(respuesta[respuesta.find("{"): respuesta.rfind("}") + 1])
        except json.JSONDecodeError:
            continue
        leccion = quitar_preguntas_malas(juntar_opciones(leccion))
        # Si al quitar las repetidas quedan menos de la mitad de las pedidas, se intenta otra vez.
        if leccion_valida(leccion) and len(leccion["preguntas"]) * 2 >= n_preguntas:
            return {**barajar_opciones(leccion), "idioma": idioma, "nivel": nivel, "dificultad_preguntas": dificultad}
    raise HTTPException(502, "La IA no ha preparado bien la lección. Pulsa otra vez «Preparar la lección».")


# ---------- Dudas («Tengo una duda») ----------
# El estudiante pregunta sobre una lección, también sin conexión: la duda viaja con la sincronización, la IA
# de este ordenador la contesta en un hilo aparte (solo con lo que dice la lección) y la respuesta vuelve en la siguiente.
NO_ESTA = "Eso no está en esta lección. Pregúntaselo a tu profe."
AJENA = "Eso no tiene que ver con esta lección, así que no te lo puedo contestar. Pregúntame algo sobre la lección."
PROMPT_DUDA = """Eres el profe de un niño o una niña de 8 a 12 años. Te hace una pregunta sobre la LECCIÓN de abajo.
- Contesta en el mismo idioma en que está escrita la LECCIÓN, en 1 a 3 frases cortas, con palabras sencillas, hablándole de tú.
- Usa solo lo que dice la LECCIÓN. No inventes datos.
- Contesta ya y entero. No digas que lo explicarás «paso a paso» ni después, y no acabes con una pregunta: no te puede contestar.
- Si la pregunta no dice qué no entiende (como «no entiendo nada» o «no lo entiendo»), no expliques la lección: pídele en una frase que pregunte algo concreto y dale un ejemplo de pregunta sobre la LECCIÓN.
- Si la pregunta no tiene nada que ver con la LECCIÓN (como «¿lloverá mañana?», «¿quién ganó el partido?» o «¿cuántos años tienes?»), contesta solo: AJENA
- Si la pregunta es sobre el tema de la LECCIÓN pero la respuesta no está en ella, contesta solo: NO_ESTA

LECCIÓN:
<<<
{leccion}
>>>

PREGUNTA: {pregunta}"""


def contestar_duda(contenido: dict, pregunta: str) -> str:
    leccion = "\n\n".join(str(contenido.get(k, "")) for k in ("titulo", "lectura_facil", "explicacion_ejemplo"))
    texto = preguntar_ia(PROMPT_DUDA.format(leccion=leccion, pregunta=pregunta), max_tokens=200).strip()
    # Siempre la misma frase, en español: la app la traduce al idioma del niño.
    if "AJENA" in texto:
        return AJENA
    if not texto or "NO_ESTA" in texto or texto.lower().startswith("eso no está en esta lección"):
        return NO_ESTA
    # La IA a veces acaba con «¿Te gustaría saber…?», y el niño no puede contestar: se quita si antes ya ha explicado algo.
    # shortcut: solo mira el «¿» del español; si las lecciones en otros idiomas también lo hacen, cortar por la última frase.
    if "¿" in texto and not texto.startswith("¿") and texto.endswith("?"):
        texto = texto[:texto.rfind("¿")].strip()
    return texto[:600]


AVISO_DUDAS = threading.Event()


def contestar_dudas_pendientes():
    """Contesta las dudas sin respuesta, una a una. Se despierta al llegar dudas y cada minuto (por si la IA estaba apagada)."""
    while True:
        AVISO_DUDAS.wait(timeout=60)
        AVISO_DUDAS.clear()
        try:
            with closing(db()) as c:
                pendientes = c.execute("""
                    SELECT d.id, d.pregunta, l.contenido FROM dudas d JOIN lecciones l ON l.id = d.leccion_id
                    WHERE d.respuesta IS NULL ORDER BY d.fecha
                """).fetchall()
            for d in pendientes:
                if not ollama_disponible():
                    break
                respuesta = contestar_duda(json.loads(d["contenido"]), d["pregunta"])
                with closing(db()) as c, c:
                    c.execute("UPDATE dudas SET respuesta = ? WHERE id = ? AND respuesta IS NULL", (respuesta, d["id"]))
        except Exception as e:  # que un fallo no pare el hilo: se reintenta en el siguiente aviso
            print("dudas:", e)


threading.Thread(target=contestar_dudas_pendientes, daemon=True).start()


# ---------- Rutas ----------

@app.get("/api/salud")
def salud():
    url = ollama_disponible()
    ia = "apagada" if not url else ("gpu" if url != OLLAMAS[-1] else "lista")
    return {"estado": "ok", "ia": ia, "modelo": MODELO}


class NuevaClase(BaseModel):
    nombre: str
    pin: str = ""  # sin PIN solo si la crea un profe con su sesión: entonces la clase es suya


@app.post("/api/clases")
def crear_clase(datos: NuevaClase, x_sesion_profe: str | None = Header(default=None)):
    nombre = datos.nombre.strip()[:60]
    profe = profe_de_sesion(x_sesion_profe)
    if not nombre:
        raise HTTPException(400, "Escribe el nombre de la clase.")
    if not profe and not re.fullmatch(r"\d{4,8}", datos.pin):
        raise HTTPException(400, "El PIN tiene que tener entre 4 y 8 números.")
    with closing(db()) as c, c:
        while True:
            codigo = "".join(secrets.choice(LETRAS_CODIGO) for _ in range(6))
            if not c.execute("SELECT 1 FROM clases WHERE codigo = ?", (codigo,)).fetchone():
                break
        c.execute("INSERT INTO clases (codigo, nombre, creada) VALUES (?, ?, ?)", (codigo, nombre, ahora()))
        if profe:
            c.execute("INSERT INTO clases_profe (clase, profe) VALUES (?, ?)", (codigo, profe))
        else:
            guardar_pin(c, codigo, datos.pin)
    return {"codigo": codigo, "nombre": nombre}


def resumen_clases(c, profe: str | None = None):
    return [dict(f) for f in c.execute(f"""
        SELECT c.codigo, c.nombre, c.oculta,
               (SELECT COUNT(*) FROM matriculas m WHERE m.clase = c.codigo) AS alumnos,
               (SELECT COUNT(*) FROM lecciones l WHERE l.clase = c.codigo) AS lecciones
        FROM clases c {"WHERE c.codigo IN (SELECT clase FROM clases_profe WHERE profe = ?)" if profe else ""}
        ORDER BY c.creada DESC
    """, (profe,) if profe else ()).fetchall()]


@app.get("/api/clases")
def listar_clases():
    with closing(db()) as c:
        return resumen_clases(c)


class Entrar(BaseModel):
    usuario: str
    contrasena: str


class NuevoProfe(BaseModel):
    nombre: str
    usuario: str
    contrasena: str


@app.post("/api/profes")
def crear_profe(datos: NuevoProfe):
    nombre = " ".join(datos.nombre.split())[:60]
    usuario = normalizar_usuario(datos.usuario)
    if not nombre:
        raise HTTPException(400, "Escribe tu nombre.")
    if not re.fullmatch(r"[a-z0-9]{3,20}", usuario):
        raise HTTPException(400, "El usuario tiene que tener de 3 a 20 letras (sin tildes ni ñ) o números, sin espacios.")
    comprobar_contrasena(datos.contrasena)
    sal = secrets.token_hex(16)
    try:
        with closing(db()) as c, c:
            c.execute("INSERT INTO cuentas_profe (usuario, nombre, sal, hash) VALUES (?, ?, ?, ?)",
                      (usuario, nombre, sal, hash_pin(datos.contrasena, sal)))
    except sqlite3.IntegrityError:
        raise HTTPException(409, f"El usuario «{usuario}» ya existe. Elige otro.")
    return {"usuario": usuario, "nombre": nombre, "sesion": f"{usuario}.{firma_sesion(hash_pin(datos.contrasena, sal))}"}


@app.post("/api/profes/entrar")
def entrar_profe(datos: Entrar):
    usuario = normalizar_usuario(datos.usuario)
    with closing(db()) as c:
        fila = c.execute("SELECT usuario, nombre, sal, hash FROM cuentas_profe WHERE usuario = ?", (usuario,)).fetchone()
    comprobar_secreto(f"profe:{usuario}", datos.contrasena, fila, "Usuario o contraseña incorrectos.")
    return {"usuario": usuario, "nombre": fila["nombre"], "sesion": f"{usuario}.{firma_sesion(fila['hash'])}"}


@app.get("/api/profes/clases")
def clases_del_profe(profe: str = Depends(solo_con_sesion)):
    with closing(db()) as c:
        return resumen_clases(c, profe)


class TraerClase(BaseModel):
    codigo: str
    pin: str


@app.post("/api/profes/clases")
def traer_clase(datos: TraerClase, profe: str = Depends(solo_con_sesion)):
    """Una clase de antes (con PIN y sin dueño) pasa a la cuenta del profe que sabe su PIN."""
    codigo = normalizar_codigo(datos.codigo)
    with closing(db()) as c, c:
        clase = buscar_clase(c, codigo)
        fila = c.execute("SELECT sal, hash FROM pines_profe WHERE clase = ?", (codigo,)).fetchone()
        dueno = c.execute("SELECT profe FROM clases_profe WHERE clase = ?", (codigo,)).fetchone()
        if dueno and dueno["profe"] != profe:
            raise HTTPException(409, "Esa clase ya es de otro profe.")
        comprobar_secreto(f"clase:{codigo}", datos.pin, fila, "PIN incorrecto.")
        c.execute("INSERT OR IGNORE INTO clases_profe (clase, profe) VALUES (?, ?)", (codigo, profe))
    return dict(clase)


@app.get("/api/clases/{codigo}", dependencies=SOLO_PROFE)
def ver_clase(codigo: str):
    # Antes de leer las lecciones: si una acaba justo ahora, o sale aquí o sale en la lista.
    preparando = [i for k, i in list(PREPARANDO) if k == normalizar_codigo(codigo)]
    with closing(db()) as c:
        clase = buscar_clase(c, codigo)
        alumnos = c.execute("""
            SELECT a.id, a.nombre, cu.usuario, m.fecha FROM matriculas m JOIN alumnos a ON a.id = m.alumno
            LEFT JOIN cuentas_alumno cu ON cu.alumno = a.id
            WHERE m.clase = ? ORDER BY a.nombre COLLATE NOCASE
        """, (clase["codigo"],)).fetchall()
        lecciones = c.execute("""
            SELECT id, titulo, fecha, publicada, COALESCE(json_extract(contenido, '$.materia'), 'General') AS materia, contenido
            FROM lecciones WHERE clase = ? ORDER BY fecha DESC
        """, (clase["codigo"],)).fetchall()
        dudas = c.execute("""
            SELECT d.id, a.nombre AS alumno, l.titulo AS leccion, d.pregunta, d.respuesta, d.corregida, d.fecha
            FROM dudas d JOIN lecciones l ON l.id = d.leccion_id JOIN alumnos a ON a.id = d.alumno
            JOIN matriculas m ON m.alumno = d.alumno AND m.clase = l.clase
            WHERE l.clase = ? ORDER BY d.fecha DESC LIMIT 30
        """, (clase["codigo"],)).fetchall()
    # Enteras, para que el profe las vea también sin conexión.
    lecciones = [{**dict(l), "contenido": json.loads(l["contenido"])} for l in lecciones]
    return {
        **dict(clase),
        "alumnos": [dict(a) for a in alumnos],
        "dudas": [dict(d) for d in dudas],
        "lecciones": lecciones,
        "preparando": preparando,
        "materias": list(dict.fromkeys(l["materia"] for l in lecciones)),  # la más reciente primero
    }


class NuevoAlumno(BaseModel):
    nombre: str
    usuario: str
    contrasena: str
    clase: str | None = None  # opcional: sin código se crea sin clase y entra después con «Entrar en otra clase»
    alumno_id: str | None = None  # un alumno de antes (entró solo con su nombre), que conserva sus clases


@app.post("/api/alumnos")
def crear_alumno(datos: NuevoAlumno):
    nombre = " ".join(datos.nombre.split())[:40]
    usuario = normalizar_usuario(datos.usuario)
    if not nombre:
        raise HTTPException(400, "Escribe tu nombre.")
    if not re.fullmatch(r"[a-z0-9]{3,20}", usuario):
        raise HTTPException(400, "El usuario tiene que tener de 3 a 20 letras (sin tildes ni ñ) o números, sin espacios.")
    comprobar_contrasena(datos.contrasena)
    with closing(db()) as c, c:
        clase = buscar_clase(c, datos.clase, para_alumno=True) if datos.clase and not datos.alumno_id else None  # un código mal escrito sigue dando error
        if c.execute("SELECT 1 FROM cuentas_alumno WHERE usuario = ?", (usuario,)).fetchone():
            libre = usuario_libre(c, usuario)
            raise HTTPException(409, {"mensaje": f"El usuario «{usuario}» ya existe. Prueba con «{libre}».", "sugerencia": libre})
        if datos.alumno_id:
            if not c.execute("SELECT 1 FROM alumnos WHERE id = ?", (datos.alumno_id,)).fetchone():
                raise HTTPException(404, "No te encuentro en el ordenador de la clase. Crea un usuario nuevo con el código de tu clase.")
            if c.execute("SELECT 1 FROM cuentas_alumno WHERE alumno = ?", (datos.alumno_id,)).fetchone():
                raise HTTPException(409, "Ya tienes usuario: entra con «Ya tengo usuario».")
            alumno_id = datos.alumno_id
            c.execute("UPDATE alumnos SET nombre = ? WHERE id = ?", (nombre, alumno_id))
        else:
            alumno_id = str(uuid.uuid4())
            c.execute("INSERT INTO alumnos (id, nombre) VALUES (?, ?)", (alumno_id, nombre))
            if clase:
                c.execute("INSERT INTO matriculas (clase, alumno, fecha) VALUES (?, ?, ?)", (clase["codigo"], alumno_id, ahora()))
        guardar_contrasena(c, alumno_id, datos.contrasena, usuario)
    return {"id": alumno_id, "usuario": usuario, "nombre": nombre}


@app.post("/api/alumnos/entrar")
def entrar_alumno(datos: Entrar):
    usuario = normalizar_usuario(datos.usuario)
    with closing(db()) as c:
        fila = c.execute("""
            SELECT a.id, a.nombre, cu.usuario, cu.sal, cu.hash FROM cuentas_alumno cu JOIN alumnos a ON a.id = cu.alumno
            WHERE cu.usuario = ?
        """, (usuario,)).fetchone()
    comprobar_secreto(f"alumno:{usuario}", datos.contrasena, fila, "Usuario o contraseña incorrectos.")
    return {"id": fila["id"], "usuario": fila["usuario"], "nombre": fila["nombre"]}


class NuevaContrasena(BaseModel):
    contrasena: str


@app.put("/api/clases/{codigo}/alumnos/{alumno_id}/contrasena", dependencies=SOLO_PROFE)
def cambiar_contrasena(codigo: str, alumno_id: str, datos: NuevaContrasena):
    """El profe le pone una contraseña nueva a un alumno de su clase que ha olvidado la suya."""
    comprobar_contrasena(datos.contrasena)
    with closing(db()) as c, c:
        clase = buscar_clase(c, codigo)
        if not c.execute("""
            SELECT 1 FROM matriculas m JOIN cuentas_alumno cu ON cu.alumno = m.alumno WHERE m.clase = ? AND m.alumno = ?
        """, (clase["codigo"], alumno_id)).fetchone():
            raise HTTPException(404, "Ese alumno no está en esta clase o no tiene usuario.")
        guardar_contrasena(c, alumno_id, datos.contrasena)
    return {"ok": True}


class CorregirDuda(BaseModel):
    respuesta: str


@app.put("/api/clases/{codigo}/dudas/{duda_id}", dependencies=SOLO_PROFE)
def corregir_duda(codigo: str, duda_id: str, datos: CorregirDuda):
    """El profe cambia la respuesta de una duda; al estudiante le llega en la siguiente sincronización."""
    respuesta = datos.respuesta.strip()[:600]
    if not respuesta:
        raise HTTPException(400, "Escribe la respuesta.")
    with closing(db()) as c, c:
        clase = buscar_clase(c, codigo)
        if not c.execute("SELECT 1 FROM dudas d JOIN lecciones l ON l.id = d.leccion_id WHERE d.id = ? AND l.clase = ?",
                         (duda_id, clase["codigo"])).fetchone():
            raise HTTPException(404, "Esa duda no es de esta clase.")
        c.execute("UPDATE dudas SET respuesta = ?, corregida = 1 WHERE id = ?", (respuesta, duda_id))
    return {"ok": True}


class Unirse(BaseModel):
    alumno_id: str


@app.post("/api/clases/{codigo}/unirse")
def unirse(codigo: str, datos: Unirse):
    """Un alumno que ya tiene usuario entra en otra clase."""
    with closing(db()) as c, c:
        clase = buscar_clase(c, codigo, para_alumno=True)
        if not c.execute("SELECT 1 FROM cuentas_alumno WHERE alumno = ?", (datos.alumno_id,)).fetchone():
            # Solo pasa con la versión vieja de la app (la de entrar solo con el nombre), que siga abierta.
            raise HTTPException(404, "Hay una versión nueva de la app: ciérrala del todo y vuelve a abrirla.")
        c.execute(
            "INSERT OR IGNORE INTO matriculas (clase, alumno, fecha) VALUES (?, ?, ?)",
            (clase["codigo"], datos.alumno_id, ahora()),
        )
    return dict(clase)


def clases_del_alumno(c, alumno_id: str):
    # Todo lo que el alumno necesita sin conexión: sus clases y las lecciones publicadas enteras.
    clases = c.execute("""
        SELECT c.codigo, c.nombre FROM matriculas m JOIN clases c ON c.codigo = m.clase
        WHERE m.alumno = ? AND c.oculta = 0 ORDER BY m.fecha
    """, (alumno_id,)).fetchall()
    resultado = []
    for clase in clases:
        lecciones = c.execute("""
            SELECT id, titulo, fecha, contenido FROM lecciones
            WHERE clase = ? AND publicada = 1 ORDER BY fecha DESC
        """, (clase["codigo"],)).fetchall()
        resultado.append({
            **dict(clase),
            "lecciones": [{**dict(l), "contenido": json.loads(l["contenido"])} for l in lecciones],
        })
    return resultado


class Sincronizar(BaseModel):
    alumno_id: str
    # Cada una: {id, alumno, leccion_id, pregunta, respuesta, fecha}. Se revisan una a una
    # (no con el modelo), para que una mal formada no bloquee las demás para siempre.
    respuestas: list[dict] = []
    version: str | None = None  # la de las clases que ya tiene el móvil
    dudas: list[dict] = []  # cada una: {id, alumno, leccion_id, pregunta, fecha}


def es_uuid(v) -> bool:
    return isinstance(v, str) and bool(re.fullmatch(r"[0-9a-f-]{36}", v))


def es_fecha(v) -> bool:
    try:
        datetime.fromisoformat(v.replace("Z", "+00:00"))
        return True
    except (AttributeError, ValueError):
        return False


def leccion_del_alumno(c, alumno: str, leccion_id: str):
    """La lección, si está publicada en una clase del alumno."""
    return c.execute("""
        SELECT l.contenido FROM lecciones l JOIN matriculas m ON m.clase = l.clase AND m.alumno = ?
        WHERE l.id = ? AND l.publicada = 1
    """, (alumno, leccion_id)).fetchone()


def respuesta_valida(c, r: dict) -> bool:
    entero = lambda v: isinstance(v, int) and not isinstance(v, bool)
    if not (es_uuid(r.get("id")) and es_uuid(r.get("alumno")) and isinstance(r.get("leccion_id"), str)
            and entero(r.get("pregunta")) and entero(r.get("respuesta")) and es_fecha(r.get("fecha"))):
        return False
    fila = leccion_del_alumno(c, r["alumno"], r["leccion_id"])
    return bool(fila) and 0 <= r["pregunta"] < len(json.loads(fila["contenido"])["preguntas"]) and 0 <= r["respuesta"] <= 3


def duda_valida(c, d: dict) -> bool:
    return (es_uuid(d.get("id")) and es_uuid(d.get("alumno")) and isinstance(d.get("leccion_id"), str)
            and isinstance(d.get("pregunta"), str) and 2 <= len(d["pregunta"].strip()) <= 300 and es_fecha(d.get("fecha"))
            and bool(leccion_del_alumno(c, d["alumno"], d["leccion_id"])))


@app.post("/api/sync")
def sincronizar(datos: Sincronizar):
    """Recibe las respuestas que el móvil guardó sin conexión y le devuelve sus clases si han cambiado.
    Cada respuesta tiene su id: si llega dos veces, no se duplica."""
    if len(datos.respuestas) > 5000 or len(datos.dudas) > 200:
        raise HTTPException(413, "Demasiadas respuestas de una vez.")
    hay_dudas_nuevas = False
    with closing(db()) as c, c:
        for r in datos.respuestas:
            if respuesta_valida(c, r):
                c.execute(
                    "INSERT OR IGNORE INTO respuestas (id, alumno, leccion_id, pregunta, respuesta, fecha) VALUES (?, ?, ?, ?, ?, ?)",
                    (r["id"], r["alumno"], r["leccion_id"], r["pregunta"], r["respuesta"], r["fecha"]),
                )
        for d in datos.dudas:
            if duda_valida(c, d):
                hay_dudas_nuevas |= c.execute(
                    "INSERT OR IGNORE INTO dudas (id, alumno, leccion_id, pregunta, fecha) VALUES (?, ?, ?, ?, ?)",
                    (d["id"], d["alumno"], d["leccion_id"], d["pregunta"].strip(), d["fecha"]),
                ).rowcount > 0
        clases = clases_del_alumno(c, datos.alumno_id)
        dudas = c.execute("""
            SELECT d.id, d.leccion_id, d.pregunta, d.respuesta, d.corregida, d.fecha FROM dudas d
            JOIN lecciones l ON l.id = d.leccion_id JOIN matriculas m ON m.alumno = d.alumno AND m.clase = l.clase
            WHERE d.alumno = ? ORDER BY d.fecha
        """, (datos.alumno_id,)).fetchall()
    if hay_dudas_nuevas:
        AVISO_DUDAS.set()  # ya guardadas: que la IA se ponga a contestarlas
    version = hashlib.sha1(json.dumps(clases, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]
    return {
        # Las no válidas también se dan por recibidas: si no, el móvil las reenviaría siempre.
        "recibidas": [r["id"] for r in datos.respuestas if isinstance(r.get("id"), str)],
        "version": version,
        "clases": None if version == datos.version else clases,  # si no ha cambiado nada, no se gastan datos
        "dudas_recibidas": [d["id"] for d in datos.dudas if isinstance(d.get("id"), str)],
        "dudas": [dict(d) for d in dudas],  # todas las suyas, con su respuesta si ya la tienen
    }


class Foto(BaseModel):
    imagen: str  # JPEG en base64 (vale con o sin «data:image/jpeg;base64,»)


@app.post("/api/clases/{codigo}/leer-foto", dependencies=SOLO_PROFE)
def leer_foto(codigo: str, foto: Foto):
    datos = foto.imagen.split(",", 1)[-1]
    if len(datos) > 10_000_000:
        raise HTTPException(413, "La foto es demasiado grande.")
    try:
        base64.b64decode(datos, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(400, "No se ha podido abrir la foto. Prueba con otra.")
    texto = preguntar_ia(PROMPT_LEER, imagen=datos, max_tokens=2000).strip()
    texto = re.sub(r"^```[a-z]*\n?|\n?```$", "", texto).strip()
    if not texto or texto.upper().startswith("SIN TEXTO"):
        raise HTTPException(422, "No se lee texto en la foto. Hazla de frente, con buena luz y con la página entera.")
    return {"texto": texto}


class Archivo(BaseModel):
    archivo: str  # el archivo en base64 (vale con o sin «data:...;base64,»)


NO_SE_LEE = "Este archivo no se puede leer. Usa fotos, PDF, Word, PowerPoint, LibreOffice o texto."


def texto_de_xml(xml: str) -> str:
    xml = re.sub(r"<(?:w:br|w:tab|text:line-break|text:tab)\b[^>]*/>", " ", xml)
    xml = re.sub(r"</(?:w:p|a:p|text:p|text:h)>", "\n", xml)  # fin de párrafo en Word, PowerPoint y LibreOffice
    return html.unescape(re.sub(r"<[^>]+>", "", xml))


def texto_de_archivo(crudo: bytes) -> str:
    """Saca el texto de un PDF, Word (.docx), PowerPoint (.pptx), LibreOffice (.odt/.odp) o texto plano."""
    if crudo[:5] == b"%PDF-":
        try:
            from pypdf import PdfReader  # solo hace falta para los PDF
        except ImportError:
            raise HTTPException(503, "Para leer PDF falta pypdf en el ordenador de la clase (pip install pypdf).")
        try:
            return "\n\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(crudo)).pages[:40])
        except Exception:
            raise HTTPException(422, "No se puede abrir el PDF. Prueba con otro o haz fotos de sus páginas.")
    if crudo[:2] == b"PK":
        try:
            z = zipfile.ZipFile(io.BytesIO(crudo))
            nombres = z.namelist()
            partes = (["word/document.xml"] if "word/document.xml" in nombres
                      else sorted((n for n in nombres if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)), key=lambda n: int(re.sub(r"\D", "", n)))
                      or (["content.xml"] if "content.xml" in nombres else []))
            if not partes or sum(z.getinfo(n).file_size for n in partes) > 50_000_000:
                raise HTTPException(415, NO_SE_LEE)
            return "\n\n".join(texto_de_xml(z.read(n).decode("utf-8", "replace")) for n in partes)
        except (zipfile.BadZipFile, KeyError):
            raise HTTPException(415, NO_SE_LEE)
    try:
        texto = crudo.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(415, NO_SE_LEE)
    return texto_de_xml(texto) if texto.lstrip()[:1] == "<" else texto  # HTML: solo el texto


@app.post("/api/clases/{codigo}/leer-archivo", dependencies=SOLO_PROFE)
def leer_archivo(codigo: str, datos: Archivo):
    b64 = datos.archivo.split(",", 1)[-1]
    if len(b64) > 14_000_000:
        raise HTTPException(413, "El archivo es demasiado grande: como mucho 10 MB.")
    try:
        crudo = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(400, "No se ha podido abrir el archivo. Prueba con otro.")
    texto = re.sub(r"[ \t\xa0]+", " ", texto_de_archivo(crudo))
    texto = re.sub(r"\s*\n\s*\n\s*", "\n\n", texto).strip()
    if len(texto) < 20:
        raise HTTPException(422, "No encuentro texto en el archivo. Si es un PDF escaneado, haz fotos de sus páginas.")
    return {"texto": texto[:20000]}


class NuevaLeccion(BaseModel):
    texto: str
    materia: str = ""
    idioma: str = "es"
    nivel: int = 1  # dificultad de 0 a 5 (ver NIVELES); 1 es como eran antes las lecciones
    preguntas: int | None = None  # cuántas preguntas, de 0 a 30 de 5 en 5; si no llega, las del nivel
    dificultad_preguntas: int | None = None  # de 0 a 5 (ver DIFICULTAD_PREGUNTAS); si no llega, la del nivel
    titulo: str = ""  # si el profe lo escribe, se usa este; si no, el que pone la IA
    id: str | None = None  # la pone el móvil del profe: si la envía dos veces (sin conexión), no se duplica


@app.post("/api/clases/{codigo}/lecciones", dependencies=SOLO_PROFE)
def nueva_leccion(codigo: str, datos: NuevaLeccion):
    texto = datos.texto.strip()
    if len(texto) < 40:
        raise HTTPException(400, "Hace falta más texto para preparar una lección.")
    if datos.id is not None and not re.fullmatch(r"[0-9a-f-]{36}", datos.id):
        raise HTTPException(400, "Id de lección no válido.")
    with closing(db()) as c:
        clase = buscar_clase(c, codigo)
        hecha = datos.id and c.execute("SELECT contenido FROM lecciones WHERE id = ? AND clase = ?", (datos.id, clase["codigo"])).fetchone()
    if hecha:
        return {"id": datos.id, "leccion": json.loads(hecha["contenido"])}
    if datos.idioma not in IDIOMAS:
        raise HTTPException(400, "Ese idioma no está en la lista.")
    if datos.nivel not in NIVELES:
        raise HTTPException(400, "El nivel tiene que ser de 0 a 5.")
    # En los niveles altos se lee más del texto (un tema largo de universidad no cabe en 8000 letras).
    if datos.preguntas is not None and (datos.preguntas not in range(0, MAX_PREGUNTAS + 1, 5)):
        raise HTTPException(400, "El número de preguntas tiene que ser 0, 5, 10, 15, 20, 25 o 30.")
    if datos.dificultad_preguntas is not None and datos.dificultad_preguntas not in DIFICULTAD_PREGUNTAS:
        raise HTTPException(400, "La dificultad de las preguntas tiene que ser de 0 a 5.")
    leccion_id = datos.id or str(uuid.uuid4())
    en_marcha = (clase["codigo"], leccion_id)
    if en_marcha in PREPARANDO:
        raise HTTPException(409, "Esta lección ya se está preparando.")
    PREPARANDO.add(en_marcha)
    try:
        leccion = crear_leccion_con_ia(texto[:8000 if datos.nivel < 3 else 20000], datos.idioma, datos.nivel,
                                       datos.preguntas, datos.dificultad_preguntas)
        if " ".join(datos.titulo.split()):
            leccion["titulo"] = " ".join(datos.titulo.split())[:120]
        with closing(db()) as c, c:
            leccion["materia"] = materia_de(c, clase["codigo"], datos.materia)
            c.execute(
                "INSERT INTO lecciones (id, clase, titulo, contenido, fecha, publicada) VALUES (?, ?, ?, ?, ?, 0)",
                (leccion_id, clase["codigo"], leccion["titulo"], json.dumps(leccion, ensure_ascii=False), ahora()),
            )
    finally:  # después de guardarla: quien pregunta la ve en la lista o en PREPARANDO, nunca en ninguna
        PREPARANDO.discard(en_marcha)
    return {"id": leccion_id, "leccion": leccion}


def buscar_leccion(c, codigo: str, leccion_id: str):
    fila = c.execute(
        "SELECT id, clase, titulo, contenido, publicada FROM lecciones WHERE id = ? AND clase = ?",
        (leccion_id, normalizar_codigo(codigo)),
    ).fetchone()
    if not fila:
        raise HTTPException(404, "Lección no encontrada.")
    return fila


@app.get("/api/clases/{codigo}/lecciones/{leccion_id}", dependencies=SOLO_PROFE)
def ver_leccion(codigo: str, leccion_id: str):
    with closing(db()) as c:
        fila = buscar_leccion(c, codigo, leccion_id)
    contenido = json.loads(fila["contenido"])
    contenido.setdefault("materia", "General")
    return {**dict(fila), "contenido": contenido}


class GuardarLeccion(BaseModel):
    leccion: dict
    publicar: bool = False


@app.put("/api/clases/{codigo}/lecciones/{leccion_id}", dependencies=SOLO_PROFE)
def guardar_leccion(codigo: str, leccion_id: str, datos: GuardarLeccion):
    if not leccion_valida(datos.leccion):
        raise HTTPException(400, "Falta algún texto, o hay dos opciones iguales en una pregunta. Revísalo.")
    with closing(db()) as c, c:
        fila = buscar_leccion(c, codigo, leccion_id)
        leccion = {**datos.leccion, "materia": materia_de(c, fila["clase"], datos.leccion.get("materia"))}
        c.execute(
            "UPDATE lecciones SET titulo = ?, contenido = ?, publicada = MAX(publicada, ?) WHERE id = ?",
            (leccion["titulo"].strip(), json.dumps(leccion, ensure_ascii=False), int(datos.publicar), leccion_id),
        )
    return {"ok": True, "materia": leccion["materia"]}


class Publicada(BaseModel):
    publicada: bool


@app.put("/api/clases/{codigo}/lecciones/{leccion_id}/publicada", dependencies=SOLO_PROFE)
def publicar_u_ocultar(codigo: str, leccion_id: str, datos: Publicada):
    """Ocultar quita la lección de los móviles en su próxima sincronización; sus notas se quedan para cuando se vuelva a publicar."""
    with closing(db()) as c, c:
        buscar_leccion(c, codigo, leccion_id)
        c.execute("UPDATE lecciones SET publicada = ? WHERE id = ?", (int(datos.publicada), leccion_id))
    return {"publicada": datos.publicada}


def borrar_lecciones(c, donde: str, valor: str):
    # Primero lo que cuelga de cada lección: sus respuestas y sus dudas.
    for tabla in ("respuestas", "dudas"):
        c.execute(f"DELETE FROM {tabla} WHERE leccion_id IN (SELECT id FROM lecciones WHERE {donde} = ?)", (valor,))
    c.execute(f"DELETE FROM lecciones WHERE {donde} = ?", (valor,))


@app.delete("/api/clases/{codigo}/lecciones/{leccion_id}", dependencies=SOLO_PROFE)
def borrar_leccion(codigo: str, leccion_id: str):
    with closing(db()) as c, c:
        borrar_lecciones(c, "id", buscar_leccion(c, codigo, leccion_id)["id"])
    return {"ok": True}


class Oculta(BaseModel):
    oculta: bool


@app.put("/api/clases/{codigo}/oculta", dependencies=SOLO_PROFE)
def ocultar_o_mostrar_clase(codigo: str, datos: Oculta):
    """Oculta: sale de los móviles en su próxima sincronización y su código no deja entrar. Las respuestas que el móvil
    tuviera sin enviar se siguen guardando, y la clase vuelve entera al mostrarla."""
    with closing(db()) as c, c:
        c.execute("UPDATE clases SET oculta = ? WHERE codigo = ?", (int(datos.oculta), buscar_clase(c, codigo)["codigo"]))
    return {"oculta": datos.oculta}


@app.delete("/api/clases/{codigo}", dependencies=SOLO_PROFE)
def borrar_clase(codigo: str):
    """Se borran sus lecciones (con sus notas y dudas) y quién está en ella. Los alumnos siguen, por si están en otras clases."""
    with closing(db()) as c, c:
        codigo = buscar_clase(c, codigo)["codigo"]
        borrar_lecciones(c, "clase", codigo)
        for tabla in ("matriculas", "clases_profe", "pines_profe"):
            c.execute(f"DELETE FROM {tabla} WHERE clase = ?", (codigo,))
        c.execute("DELETE FROM clases WHERE codigo = ?", (codigo,))
    return {"ok": True}


# Panel de notas: es de ChatGPT (ver REPARTO.md). Sus rutas están en panel.py y piden el PIN del profe.
from panel import router as router_panel  # noqa: E402

app.include_router(router_panel, dependencies=SOLO_PROFE)
