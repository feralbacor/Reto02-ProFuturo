"""Panel de notas del profe. Es de ChatGPT (ver REPARTO.md, tarea C1).
Ya está conectado en main.py: todo lo que se añada a `router` funciona sin tocar main.py.
Solo LEE la base de datos: no crea ni cambia tablas."""
import os
import sqlite3

from fastapi import APIRouter

router = APIRouter()

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mochila.db")


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@router.get("/api/clases/{codigo}/panel")
def panel(codigo: str):
    return {"codigo": codigo, "hecho": False}  # por hacer
