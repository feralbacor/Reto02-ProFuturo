"""Desde la raíz: api/.venv/bin/python docs/comprobar_panel.py. No cambia datos reales."""
import os
import sqlite3
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'api'))
import main
import demo
import panel
from fastapi import HTTPException

with tempfile.TemporaryDirectory() as carpeta:
    panel.DB_PATH = os.path.join(carpeta, 'prueba.db')
    with sqlite3.connect(panel.DB_PATH) as c:
        c.executescript(main.TABLAS)
        demo.crear_demo(c)
    datos = panel.panel('aula23')
    assert len(datos['alumnos']) == 6 and len(datos['lecciones']) == 2
    assert [a['nombre'] for a in datos['alumnos'] if a['motivos']] == ['Diego', 'Elena']
    ana = demo.identificador('alumno-0')
    leccion = demo.identificador('leccion-0')
    # Un intento anterior no debe reemplazar la última respuesta.
    with sqlite3.connect(panel.DB_PATH) as c:
        c.execute('INSERT INTO respuestas VALUES (?, ?, ?, 0, 0, ?)',
                  ('vieja', ana, leccion, (datetime.now() - timedelta(days=10)).isoformat()))
        # ISO con huso: comparar instantes, no cadenas de texto.
        futura = datetime.now(timezone.utc) + timedelta(hours=1)
        c.execute('INSERT INTO respuestas VALUES (?, ?, ?, 0, 0, ?)', ('nueva', ana, leccion, futura.isoformat()))
        c.execute('INSERT INTO respuestas VALUES (?, ?, ?, 99, 0, ?)', ('invalida', ana, leccion, futura.isoformat()))
        c.execute("INSERT INTO clases VALUES ('OTRA12', 'Otra clase', '2026-01-01')")
        c.execute("INSERT INTO alumnos VALUES ('reciente', 'Reciente')")
        c.execute('INSERT INTO matriculas VALUES (?, ?, ?)', ('AULA23', 'reciente', datetime.now().isoformat()))
        c.execute("INSERT INTO alumnos VALUES ('antiguo', 'Antiguo')")
        c.execute('INSERT INTO matriculas VALUES (?, ?, ?)', ('AULA23', 'antiguo', (datetime.now() - timedelta(days=4)).isoformat()))
    datos = panel.panel('AULA23')
    a = next(a for a in datos['alumnos'] if a['id'] == ana)
    assert next(n for n in a['notas'] if n['leccion_id'] == leccion)['aciertos'] == 4
    assert not next(a for a in datos['alumnos'] if a['id'] == 'reciente')['motivos']
    assert next(a for a in datos['alumnos'] if a['id'] == 'antiguo')['motivos']
    assert panel.panel('OTRA12')['alumnos'] == []
    try:
        panel.panel('NOEXIS')
        raise AssertionError('Debe devolver 404')
    except HTTPException as e:
        assert e.status_code == 404
    # La ruta está registrada; no hace falta arrancar un servidor.
    assert '/api/clases/{codigo}/panel' in main.app.openapi()['paths']
print('Panel correcto: notas, repeticiones, husos, aislamiento, inactividad, clase vacía y 404.')
