"""API de Mochila. La IA funciona en este mismo ordenador (Ollama), sin internet."""
import base64
import binascii
import json
import os
import random
import re
import secrets
import sqlite3
import urllib.error
import urllib.request
import uuid
from contextlib import closing
from datetime import datetime

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mochila.db")
# Por orden: un túnel a una GPU (si está abierto en el 11435) y, si no, el Ollama de este ordenador.
OLLAMAS = os.environ.get("OLLAMA_URL", "http://localhost:11435,http://localhost:11434").split(",")
MODELO = os.environ.get("MODELO_IA", "qwen3-vl:4b-instruct")
LETRAS_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # sin O/0 ni I/1, que se confunden

TABLAS = """
CREATE TABLE IF NOT EXISTS clases (
    codigo TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    creada TEXT NOT NULL
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


preparar_bd()


def ahora():
    return datetime.now().isoformat(timespec="seconds")


def normalizar_codigo(codigo: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", codigo.upper())


def buscar_clase(c, codigo):
    clase = c.execute("SELECT codigo, nombre FROM clases WHERE codigo = ?", (normalizar_codigo(codigo),)).fetchone()
    if not clase:
        raise HTTPException(404, f"No hay ninguna clase con el código {normalizar_codigo(codigo)}. Revisa que esté bien escrito.")
    return clase


# ---------- IA local (Ollama) ----------

PROMPT_LEER = """Transcribe exactamente todo el texto de esta foto de una página de libro, en el orden en que se lee.
- Copia las palabras tal cual, con sus tildes y signos. No corrijas, no resumas, no traduzcas.
- Incluye títulos, recuadros y pies de foto. No incluyas el número de página.
- Si una palabra no se lee, escribe [?]. No te inventes nada.
- Si en la foto no hay texto legible, responde solo: SIN TEXTO
Devuelve solo el texto, sin comentarios."""

PROMPT_LECCION = """Eres maestro de primaria. Con el TEXTO de abajo prepara una lección en español para alumnos de 8 a 12 años.
- "titulo": corto y claro.
- "lectura_facil": lo mismo que dice el texto, contado con frases cortas (15 palabras como mucho) y palabras sencillas. Entre 80 y 200 palabras. Usa solo información del texto, no añadas datos.
- "explicacion_ejemplo": explica la idea principal con un ejemplo de la vida diaria (la casa, la escuela, el campo). De 2 a 4 frases. El ejemplo tiene que ser cierto y tener sentido.
- "preguntas": 5 preguntas de opción múltiple, todas distintas entre sí, que se puedan contestar con el texto. Cada una con 4 opciones cortas y distintas, una sola correcta. "correcta" es la posición de la opción correcta (0, 1, 2 o 3). "porque" explica en una frase por qué es la correcta.

TEXTO:
<<<
{texto}
>>>"""

ESQUEMA_LECCION = {
    "type": "object",
    "properties": {
        "titulo": {"type": "string"},
        "lectura_facil": {"type": "string"},
        "explicacion_ejemplo": {"type": "string"},
        "preguntas": {
            "type": "array",
            "minItems": 5,
            "maxItems": 5,
            "items": {
                "type": "object",
                "properties": {
                    "pregunta": {"type": "string"},
                    "opciones": {"type": "array", "minItems": 4, "maxItems": 4, "items": {"type": "string"}},
                    "correcta": {"type": "integer", "enum": [0, 1, 2, 3]},
                    "porque": {"type": "string"},
                },
                "required": ["pregunta", "opciones", "correcta", "porque"],
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


def preguntar_ia(prompt, imagen=None, formato=None, max_tokens=1500):
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
        "options": {"temperature": 0.3 if formato else 0, "num_ctx": 8192, "num_predict": max_tokens},
    }
    if formato:
        cuerpo["format"] = formato
    peticion = urllib.request.Request(
        f"{url}/api/chat", json.dumps(cuerpo).encode(), {"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(peticion, timeout=300) as r:
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
    if not isinstance(preguntas, list) or not 1 <= len(preguntas) <= 10:
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


def crear_leccion_con_ia(texto):
    for _ in range(2):  # si sale mal, se intenta una vez más
        respuesta = preguntar_ia(PROMPT_LECCION.format(texto=texto), formato=ESQUEMA_LECCION, max_tokens=2500)
        try:
            leccion = json.loads(respuesta[respuesta.find("{"): respuesta.rfind("}") + 1])
        except json.JSONDecodeError:
            continue
        if leccion_valida(leccion):
            return barajar_opciones(leccion)
    raise HTTPException(502, "La IA no ha preparado bien la lección. Pulsa otra vez «Crear lección».")


# ---------- Rutas ----------

@app.get("/api/salud")
def salud():
    url = ollama_disponible()
    ia = "apagada" if not url else ("gpu" if url != OLLAMAS[-1] else "lista")
    return {"estado": "ok", "ia": ia, "modelo": MODELO}


class NuevaClase(BaseModel):
    nombre: str


@app.post("/api/clases")
def crear_clase(datos: NuevaClase):
    nombre = datos.nombre.strip()[:60]
    if not nombre:
        raise HTTPException(400, "Escribe el nombre de la clase.")
    with closing(db()) as c, c:
        while True:
            codigo = "".join(secrets.choice(LETRAS_CODIGO) for _ in range(6))
            if not c.execute("SELECT 1 FROM clases WHERE codigo = ?", (codigo,)).fetchone():
                break
        c.execute("INSERT INTO clases (codigo, nombre, creada) VALUES (?, ?, ?)", (codigo, nombre, ahora()))
    return {"codigo": codigo, "nombre": nombre}


@app.get("/api/clases")
def listar_clases():
    with closing(db()) as c:
        filas = c.execute("""
            SELECT c.codigo, c.nombre,
                   (SELECT COUNT(*) FROM matriculas m WHERE m.clase = c.codigo) AS alumnos,
                   (SELECT COUNT(*) FROM lecciones l WHERE l.clase = c.codigo) AS lecciones
            FROM clases c ORDER BY c.creada DESC
        """).fetchall()
    return [dict(f) for f in filas]


@app.get("/api/clases/{codigo}")
def ver_clase(codigo: str):
    with closing(db()) as c:
        clase = buscar_clase(c, codigo)
        alumnos = c.execute("""
            SELECT a.id, a.nombre, m.fecha FROM matriculas m JOIN alumnos a ON a.id = m.alumno
            WHERE m.clase = ? ORDER BY a.nombre COLLATE NOCASE
        """, (clase["codigo"],)).fetchall()
        lecciones = c.execute(
            "SELECT id, titulo, fecha, publicada FROM lecciones WHERE clase = ? ORDER BY fecha DESC",
            (clase["codigo"],),
        ).fetchall()
    return {**dict(clase), "alumnos": [dict(a) for a in alumnos], "lecciones": [dict(l) for l in lecciones]}


class Unirse(BaseModel):
    alumno_id: str
    nombre: str


@app.post("/api/clases/{codigo}/unirse")
def unirse(codigo: str, datos: Unirse):
    nombre = datos.nombre.strip()[:40]
    if not nombre:
        raise HTTPException(400, "Escribe tu nombre.")
    if not re.fullmatch(r"[0-9a-f-]{36}", datos.alumno_id):
        raise HTTPException(400, "Identificador de alumno no válido.")
    with closing(db()) as c, c:
        clase = buscar_clase(c, codigo)
        c.execute(
            "INSERT INTO alumnos (id, nombre) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre",
            (datos.alumno_id, nombre),
        )
        c.execute(
            "INSERT OR IGNORE INTO matriculas (clase, alumno, fecha) VALUES (?, ?, ?)",
            (clase["codigo"], datos.alumno_id, ahora()),
        )
    return dict(clase)


@app.get("/api/alumnos/{alumno_id}/clases")
def clases_del_alumno(alumno_id: str):
    # Todo lo que el alumno necesita sin conexión: sus clases y las lecciones publicadas enteras.
    with closing(db()) as c:
        clases = c.execute("""
            SELECT c.codigo, c.nombre FROM matriculas m JOIN clases c ON c.codigo = m.clase
            WHERE m.alumno = ? ORDER BY m.fecha
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


class Foto(BaseModel):
    imagen: str  # JPEG en base64 (vale con o sin «data:image/jpeg;base64,»)


@app.post("/api/leer-foto")
def leer_foto(foto: Foto):
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


class NuevaLeccion(BaseModel):
    texto: str


@app.post("/api/clases/{codigo}/lecciones")
def nueva_leccion(codigo: str, datos: NuevaLeccion):
    texto = datos.texto.strip()
    if len(texto) < 40:
        raise HTTPException(400, "Hace falta más texto para preparar una lección.")
    with closing(db()) as c:
        clase = buscar_clase(c, codigo)
    leccion = crear_leccion_con_ia(texto[:8000])
    leccion_id = str(uuid.uuid4())
    with closing(db()) as c, c:
        c.execute(
            "INSERT INTO lecciones (id, clase, titulo, contenido, fecha, publicada) VALUES (?, ?, ?, ?, ?, 0)",
            (leccion_id, clase["codigo"], leccion["titulo"], json.dumps(leccion, ensure_ascii=False), ahora()),
        )
    return {"id": leccion_id, "leccion": leccion}


@app.get("/api/leccion/{leccion_id}")
def ver_leccion(leccion_id: str):
    with closing(db()) as c:
        fila = c.execute(
            "SELECT id, clase, titulo, contenido, publicada FROM lecciones WHERE id = ?", (leccion_id,)
        ).fetchone()
    if not fila:
        raise HTTPException(404, "Lección no encontrada.")
    return {**dict(fila), "contenido": json.loads(fila["contenido"])}


class GuardarLeccion(BaseModel):
    leccion: dict
    publicar: bool = False


@app.put("/api/leccion/{leccion_id}")
def guardar_leccion(leccion_id: str, datos: GuardarLeccion):
    if not leccion_valida(datos.leccion):
        raise HTTPException(400, "Falta algún texto, o hay dos opciones iguales en una pregunta. Revísalo.")
    with closing(db()) as c, c:
        cambiadas = c.execute(
            "UPDATE lecciones SET titulo = ?, contenido = ?, publicada = MAX(publicada, ?) WHERE id = ?",
            (datos.leccion["titulo"].strip(), json.dumps(datos.leccion, ensure_ascii=False), int(datos.publicar), leccion_id),
        ).rowcount
    if not cambiadas:
        raise HTTPException(404, "Lección no encontrada.")
    return {"ok": True}


# Panel de notas: es de ChatGPT (ver REPARTO.md). Sus rutas están en panel.py.
from panel import router as router_panel  # noqa: E402

app.include_router(router_panel)
