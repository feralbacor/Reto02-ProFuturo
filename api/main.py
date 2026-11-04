from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import os
import json
import boto3
from botocore.config import Config
from datetime import datetime
import uuid

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(__file__), "mochila.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.get("/api/salud")
def salud():
    return {"estado": "ok", "mensaje": "API de Mochila funcionando"}

@app.on_event("startup")
def startup():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS lecciones (
            id TEXT PRIMARY KEY,
            titulo TEXT NOT NULL,
            contenido TEXT NOT NULL,
            fecha TEXT NOT NULL,
            publicada INTEGER DEFAULT 0
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS respuestas (
            id TEXT PRIMARY KEY,
            alumno TEXT NOT NULL,
            leccion_id TEXT NOT NULL,
            pregunta INTEGER NOT NULL,
            respuesta INTEGER NOT NULL,
            fecha TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS clases (
            codigo TEXT PRIMARY KEY,
            nombre TEXT NOT NULL,
            alumnos TEXT NOT NULL
        )
    """)
    cursor.execute("""
        INSERT OR IGNORE INTO clases (codigo, nombre, alumnos) VALUES (?, ?, ?)
    """, ('CLASE-5A', 'Quinto grado A', '["Ana", "Carlos", "María", "Juan", "Laura", "Pedro", "Sofia", "Miguel"]'))
    conn.commit()
    conn.close()


class TranscripcionRequest(BaseModel):
    imagen: str


class LeccionRequest(BaseModel):
    texto: str


class LeccionUpdate(BaseModel):
    titulo: str
    contenido: str


def transcribir_imagen(imagen_base64: str) -> str:
    import base64
    imagen_bytes = base64.b64decode(imagen_base64.split(',')[1] if ',' in imagen_base64 else imagen_base64)
    
    config = Config(read_timeout=300)
    client = boto3.client('bedrock-runtime', region_name='us-east-1', config=config)
    
    response = client.converse(
        modelId='global.moonshotai.kimi-k3',
        messages=[
            {
                'role': 'user',
                'content': [
                    {
                        'image': {
                            'format': 'jpeg',
                            'source': {
                                'bytes': imagen_bytes
                            }
                        }
                    },
                    {
                        'text': 'Transcribe todo el texto que aparece en esta página de libro. Incluye títulos, párrafos, pies de foto y cualquier texto visible. Devuelve solo el texto, sin explicaciones.'
                    }
                ]
            }
        ]
    )
    
    return response['output']['message']['content'][0]['text']


def generar_leccion(texto: str) -> dict:
    config = Config(read_timeout=300)
    client = boto3.client('bedrock-runtime', region_name='us-east-1', config=config)
    
    prompt = f"""Eres un maestro experto en crear material educativo para estudiantes. A partir del siguiente texto de un libro de texto, crea una lección completa.

Texto del libro:
{texto}

Genera una lección en formato JSON con esta estructura exacta:
{{
    "titulo": "título corto y claro",
    "lectura_facil": "texto simplificado, frases cortas, palabras sencillas",
    "explicacion_ejemplo": "explicación con un ejemplo de la vida diaria",
    "preguntas": [
        {{
            "pregunta": "pregunta clara",
            "opciones": ["opción A", "opción B", "opción C", "opción D"],
            "correcta": 0,
            "porque": "explicación breve de por qué es correcta"
        }}
    ]
}}

Reglas:
- La lectura fácil debe usar oraciones cortas (máximo 15 palabras)
- El ejemplo debe ser algo que un niño vea en su casa o escuela
- Crea exactamente 5 preguntas de opción múltiple
- La opción correcta va del índice 0 al 3
- Responde SOLO con el JSON, sin texto adicional ni bloques de código"""

    response = client.converse(
        modelId='zai.glm-5',
        messages=[
            {
                'role': 'user',
                'content': [{'text': prompt}]
            }
        ]
    )
    
    resultado = response['output']['message']['content'][0]['text']
    
    if resultado.startswith('```json'):
        resultado = resultado.split('```json')[1].split('```')[0]
    elif resultado.startswith('```'):
        resultado = resultado.split('```')[1].split('```')[0]
    
    try:
        return json.loads(resultado.strip())
    except json.JSONDecodeError:
        raise ValueError("La IA no generó un JSON válido")


@app.post("/api/transcribir")
def transcribir(request: TranscripcionRequest):
    try:
        texto = transcribir_imagen(request.imagen)
        return {"texto": texto}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al transcribir imagen: {str(e)}")


@app.post("/api/generar-leccion")
def generar(request: LeccionRequest):
    try:
        leccion = generar_leccion(request.texto)
        leccion_id = str(uuid.uuid4())
        
        leccion_json = json.dumps(leccion, ensure_ascii=False)
        
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO lecciones (id, titulo, contenido, fecha, publicada) VALUES (?, ?, ?, ?, 0)",
            (leccion_id, leccion['titulo'], leccion_json, datetime.now().isoformat())
        )
        conn.commit()
        conn.close()
        
        return {"id": leccion_id, "leccion": leccion}
    except ValueError as e:
        raise HTTPException(status_code=500, detail="Error al procesar la respuesta de la IA. Por favor, intenta de nuevo.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar lección: {str(e)}")


@app.get("/api/leccion/{leccion_id}")
def obtener_leccion(leccion_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, titulo, contenido, publicada FROM lecciones WHERE id = ?", (leccion_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Lección no encontrada")
    
    return {
        "id": row["id"],
        "titulo": row["titulo"],
        "contenido": json.loads(row["contenido"]),
        "publicada": row["publicada"]
    }


@app.put("/api/leccion/{leccion_id}")
def actualizar_leccion(leccion_id: str, update: LeccionUpdate):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE lecciones SET titulo = ?, contenido = ? WHERE id = ?",
        (update.titulo, json.dumps(update.contenido, ensure_ascii=False), leccion_id)
    )
    conn.commit()
    conn.close()
    
    return {"mensaje": "Lección actualizada"}


@app.post("/api/leccion/{leccion_id}/publicar")
def publicar_leccion(leccion_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE lecciones SET publicada = 1 WHERE id = ?", (leccion_id,))
    conn.commit()
    conn.close()
    
    return {"mensaje": "Lección publicada"}


@app.get("/api/clases")
def listar_clases():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT codigo, nombre FROM clases")
    rows = cursor.fetchall()
    conn.close()
    
    return [{"codigo": row["codigo"], "nombre": row["nombre"]} for row in rows]


@app.get("/api/clases/{codigo}")
def obtener_clase(codigo: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT codigo, nombre, alumnos FROM clases WHERE codigo = ?", (codigo,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Clase no encontrada")
    
    return {
        "codigo": row["codigo"],
        "nombre": row["nombre"],
        "alumnos": json.loads(row["alumnos"])
    }


@app.get("/api/clases/{codigo}/lecciones")
def lecciones_clase(codigo: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT codigo FROM clases WHERE codigo = ?", (codigo,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Clase no encontrada")
    
    cursor.execute("""
        SELECT id, titulo, fecha FROM lecciones 
        WHERE publicada = 1 
        ORDER BY fecha DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    
    return [
        {"id": row["id"], "titulo": row["titulo"], "fecha": row["fecha"]}
        for row in rows
    ]
