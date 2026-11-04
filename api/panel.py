"""Notas y matrículas de la clase, sin cambiar el esquema compartido."""
import json
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException

router = APIRouter()
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mochila.db')


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def instante(fecha):
    # Las fechas antiguas son locales; las del móvil pueden incluir Z u otro huso.
    try:
        return datetime.fromisoformat(fecha.replace('Z', '+00:00')).astimezone()
    except (ValueError, TypeError, AttributeError, OverflowError, OSError):
        return None


@router.get('/api/clases/{codigo}/panel')
def panel(codigo: str):
    codigo = ''.join(c for c in codigo.upper() if c.isascii() and c.isalnum())
    with closing(db()) as c:
        clase = c.execute('SELECT codigo, nombre FROM clases WHERE codigo = ?', (codigo,)).fetchone()
        if not clase:
            raise HTTPException(404, 'No hay ninguna clase con ese código.')
        alumnos = c.execute('''SELECT a.id, a.nombre, m.fecha FROM alumnos a
            JOIN matriculas m ON m.alumno = a.id WHERE m.clase = ? ORDER BY a.nombre COLLATE NOCASE''', (codigo,)).fetchall()
        lecciones = c.execute('''SELECT id, titulo, contenido FROM lecciones
            WHERE clase = ? AND publicada = 1 ORDER BY fecha, id''', (codigo,)).fetchall()
        respuestas = c.execute('''SELECT r.* FROM respuestas r
            JOIN lecciones l ON l.id = r.leccion_id
            JOIN matriculas m ON m.alumno = r.alumno AND m.clase = l.clase
            WHERE l.clase = ? AND l.publicada = 1''', (codigo,)).fetchall()
    preguntas = {l['id']: json.loads(l['contenido'])['preguntas'] for l in lecciones}
    ultimas = {}
    for r in respuestas:
        if not 0 <= r['pregunta'] < len(preguntas[r['leccion_id']]):
            continue
        momento = instante(r['fecha'])
        if momento is None:
            continue  # No calcular notas ni inactividad con una fecha inválida.
        clave = (r['alumno'], r['leccion_id'], r['pregunta'])
        anterior = ultimas.get(clave)
        if anterior is None or (momento, r['id']) > (instante(anterior['fecha']), anterior['id']):
            ultimas[clave] = r
    resultado = []
    limite = datetime.now().astimezone() - timedelta(days=3)
    for alumno in alumnos:
        notas = []
        ultima = None
        motivos = []
        for l in lecciones:
            ps = preguntas[l['id']]
            rs = [ultimas[(alumno['id'], l['id'], i)] for i in range(len(ps)) if (alumno['id'], l['id'], i) in ultimas]
            fecha = max((r['fecha'] for r in rs), key=instante, default=None)
            if fecha and (ultima is None or instante(fecha) > instante(ultima)):
                ultima = fecha
            aciertos = sum(r['respuesta'] == ps[r['pregunta']]['correcta'] for r in rs)
            notas.append(dict(leccion_id=l['id'], aciertos=aciertos, total=len(ps), respondidas=len(rs), ultima_respuesta=fecha))
            # No marcar como nota baja un test que todavía se está completando.
            if rs and len(rs) == len(ps) and aciertos / len(ps) < 3 / 5:
                motivos.append(f"Menos de 3 de cada 5 aciertos en «{l['titulo']}».")
        referencia = instante(ultima or alumno['fecha'])
        # Sin fecha de matrícula válida ni respuestas, no se puede deducir inactividad.
        if referencia is not None and referencia < limite:
            motivos.append('Más de 3 días sin respuestas recibidas.' if ultima else 'Más de 3 días sin recibir ninguna respuesta desde su inscripción.')
        resultado.append(dict(id=alumno['id'], nombre=alumno['nombre'], notas=notas, ultima_respuesta=ultima, motivos=motivos))
    return {**dict(clase), 'lecciones': [dict(id=l['id'], titulo=l['titulo']) for l in lecciones], 'alumnos': resultado}


@router.delete('/api/clases/{codigo}/alumnos/{alumno_id}')
def quitar_alumno(codigo: str, alumno_id: str):
    codigo = ''.join(c for c in codigo.upper() if c.isascii() and c.isalnum())
    with closing(db()) as c, c:
        if not c.execute('SELECT 1 FROM clases WHERE codigo = ?', (codigo,)).fetchone():
            raise HTTPException(404, 'No hay ninguna clase con ese código.')
        if not c.execute('SELECT 1 FROM matriculas WHERE clase = ? AND alumno = ?', (codigo, alumno_id)).fetchone():
            raise HTTPException(404, 'El alumno ya no está en esta clase.')
        c.execute('DELETE FROM respuestas WHERE alumno = ? AND leccion_id IN (SELECT id FROM lecciones WHERE clase = ?)',
                  (alumno_id, codigo))
        c.execute('DELETE FROM dudas WHERE alumno = ? AND leccion_id IN (SELECT id FROM lecciones WHERE clase = ?)',
                  (alumno_id, codigo))
        c.execute('DELETE FROM matriculas WHERE clase = ? AND alumno = ?', (codigo, alumno_id))
    return {'ok': True}
