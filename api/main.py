from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import os

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
            fecha TEXT NOT NULL
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
    conn.commit()
    conn.close()
