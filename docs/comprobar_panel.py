"""Desde la raíz: api/.venv/bin/python docs/comprobar_panel.py. No cambia datos reales."""
import os
import json
import asyncio
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

async def borrar_por_api(codigo, alumno, pin=None):
    mensajes = []
    async def recibir():
        return {'type': 'http.request', 'body': b'', 'more_body': False}
    async def enviar(mensaje):
        mensajes.append(mensaje)
    ruta = f'/api/clases/{codigo}/alumnos/{alumno}'
    await main.app({'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1',
                    'method': 'DELETE', 'scheme': 'http', 'path': ruta, 'raw_path': ruta.encode(),
                    'query_string': b'', 'root_path': '', 'server': ('test', 80), 'client': ('test', 1),
                    'headers': [] if pin is None else [(b'x-pin-profe', pin.encode())]}, recibir, enviar)
    return next(m['status'] for m in mensajes if m['type'] == 'http.response.start')


async def sync_por_api(cuerpo):
    datos = json.dumps(cuerpo).encode()
    mensajes = []
    async def recibir():
        return {'type': 'http.request', 'body': datos, 'more_body': False}
    async def enviar(mensaje):
        mensajes.append(mensaje)
    await main.app({'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1',
                    'method': 'POST', 'scheme': 'http', 'path': '/api/sync', 'raw_path': b'/api/sync',
                    'query_string': b'', 'root_path': '', 'server': ('test', 80), 'client': ('test', 1),
                    'headers': [(b'content-type', b'application/json')]}, recibir, enviar)
    estado = next(m['status'] for m in mensajes if m['type'] == 'http.response.start')
    return estado, json.loads(b''.join(m.get('body', b'') for m in mensajes if m['type'] == 'http.response.body'))


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
        c.execute('INSERT INTO respuestas (id, alumno, leccion_id, pregunta, respuesta, fecha) VALUES (?, ?, ?, 0, 0, ?)',
                  ('vieja', ana, leccion, (datetime.now() - timedelta(days=10)).isoformat()))
        # ISO con huso: comparar instantes, no cadenas de texto.
        futura = datetime.now(timezone.utc) + timedelta(hours=1)
        c.execute('INSERT INTO respuestas (id, alumno, leccion_id, pregunta, respuesta, fecha) VALUES (?, ?, ?, 0, 0, ?)', ('nueva', ana, leccion, futura.isoformat()))
        c.execute('INSERT INTO respuestas (id, alumno, leccion_id, pregunta, respuesta, fecha) VALUES (?, ?, ?, 99, 0, ?)', ('invalida', ana, leccion, futura.isoformat()))
        c.execute("INSERT INTO clases (codigo, nombre, creada) VALUES ('OTRA12', 'Otra clase', '2026-01-01')")
        c.execute("INSERT INTO alumnos (id, nombre) VALUES ('reciente', 'Reciente')")
        c.execute('INSERT INTO matriculas (clase, alumno, fecha) VALUES (?, ?, ?)', ('AULA23', 'reciente', datetime.now().isoformat()))
        c.execute("INSERT INTO alumnos (id, nombre) VALUES ('antiguo', 'Antiguo')")
        c.execute('INSERT INTO matriculas (clase, alumno, fecha) VALUES (?, ?, ?)', ('AULA23', 'antiguo', (datetime.now() - timedelta(days=4)).isoformat()))
    datos = panel.panel('AULA23')
    a = next(a for a in datos['alumnos'] if a['id'] == ana)
    assert next(n for n in a['notas'] if n['leccion_id'] == leccion)['aciertos'] == 4
    assert not next(a for a in datos['alumnos'] if a['id'] == 'reciente')['motivos']
    assert next(a for a in datos['alumnos'] if a['id'] == 'antiguo')['motivos']
    assert panel.panel('OTRA12')['alumnos'] == []
    # Fechas inválidas: las respuestas válidas siguen contando y el panel no falla.
    for valor in ('no-es-fecha', None, 123, '9999-12-31T23:59:59-23:59'):
        assert panel.instante(valor) is None
    valida = datetime.now().isoformat()
    with sqlite3.connect(panel.DB_PATH) as c:
        for alumno in ('fecharota', 'matricularota'):
            c.execute('INSERT INTO alumnos (id, nombre) VALUES (?, ?)', (alumno, alumno))
        c.execute('INSERT INTO matriculas (clase, alumno, fecha) VALUES (?, ?, ?)', ('AULA23', 'fecharota', valida))
        c.execute('INSERT INTO matriculas (clase, alumno, fecha) VALUES (?, ?, ?)', ('AULA23', 'matricularota', 'no-es-fecha'))
        for id_, pregunta, fecha in (('ok', 0, valida), ('rota-0', 0, 'no-es-fecha'), ('rota-1', 1, 'no-es-fecha')):
            c.execute('INSERT INTO respuestas (id, alumno, leccion_id, pregunta, respuesta, fecha) VALUES (?, ?, ?, ?, 0, ?)',
                      (id_, 'fecharota', leccion, pregunta, fecha))
    alumnos = {a['id']: a for a in panel.panel('AULA23')['alumnos']}
    nota = next(n for n in alumnos['fecharota']['notas'] if n['leccion_id'] == leccion)
    assert nota['respondidas'] == 1 and nota['ultima_respuesta'] == valida
    assert alumnos['fecharota']['ultima_respuesta'] == valida and not alumnos['fecharota']['motivos']
    assert alumnos['matricularota']['ultima_respuesta'] is None and not alumnos['matricularota']['motivos']
    try:
        panel.panel('NOEXIS')
        raise AssertionError('Debe devolver 404')
    except HTTPException as e:
        assert e.status_code == 404
    # La ruta está registrada; no hace falta arrancar un servidor.
    assert '/api/clases/{codigo}/panel' in main.app.openapi()['paths']
    # La baja afecta solo a esta matrícula y a sus respuestas, incluso de lecciones sin publicar.
    original = main.DB_PATH
    main.DB_PATH = panel.DB_PATH
    try:
        with sqlite3.connect(panel.DB_PATH) as c:
            c.execute('INSERT INTO matriculas (clase, alumno, fecha) VALUES (?, ?, ?)', ('OTRA12', ana, datetime.now().isoformat()))
            c.execute("INSERT INTO lecciones (id, clase, titulo, contenido, fecha, publicada) SELECT 'otra-leccion', 'OTRA12', titulo, contenido, fecha, 1 FROM lecciones LIMIT 1")
            c.execute("INSERT INTO respuestas (id, alumno, leccion_id, pregunta, respuesta, fecha) VALUES ('otra-respuesta', ?, 'otra-leccion', 0, 0, ?)", (ana, datetime.now().isoformat()))
            c.execute("INSERT INTO lecciones (id, clase, titulo, contenido, fecha, publicada) SELECT 'borrador', 'AULA23', titulo, contenido, fecha, 0 FROM lecciones LIMIT 1")
            c.execute("INSERT INTO respuestas (id, alumno, leccion_id, pregunta, respuesta, fecha) VALUES ('respuesta-borrador', ?, 'borrador', 0, 0, ?)", (ana, datetime.now().isoformat()))
            for id_, alumno, leccion_id in [('duda-baja', ana, leccion), ('duda-borrador', ana, 'borrador'), ('duda-otra', ana, 'otra-leccion'), ('duda-control', demo.identificador('alumno-1'), leccion)]:
                c.execute('INSERT INTO dudas (id, alumno, leccion_id, pregunta, fecha, respuesta, corregida) VALUES (?, ?, ?, ?, ?, NULL, 0)',
                          (id_, alumno, leccion_id, '¿Qué significa evaporación?', datetime.now().isoformat()))
            antes = '\n'.join(c.iterdump())
        assert asyncio.run(borrar_por_api('AULA23', ana)) == 401
        assert asyncio.run(borrar_por_api('AULA23', ana, '0000')) == 401
        with sqlite3.connect(panel.DB_PATH) as c:
            assert '\n'.join(c.iterdump()) == antes
            # Si falla la segunda escritura, también se deshace la eliminación de respuestas.
            c.execute("CREATE TRIGGER fallo_baja BEFORE DELETE ON matriculas BEGIN SELECT RAISE(ABORT, 'fallo simulado'); END")
        try:
            panel.quitar_alumno('AULA23', ana)
            raise AssertionError('Debe fallar la matrícula')
        except sqlite3.IntegrityError:
            pass
        with sqlite3.connect(panel.DB_PATH) as c:
            c.execute('DROP TRIGGER fallo_baja')
            assert '\n'.join(c.iterdump()) == antes
        assert asyncio.run(borrar_por_api('aula23', ana, '1234')) == 200
        assert asyncio.run(borrar_por_api('AULA23', ana, '1234')) == 404
        assert asyncio.run(borrar_por_api('NOEXIS', ana, '1234')) == 404
        with sqlite3.connect(panel.DB_PATH) as c:
            assert not c.execute('SELECT 1 FROM matriculas WHERE clase = ? AND alumno = ?', ('AULA23', ana)).fetchone()
            assert not c.execute('SELECT 1 FROM respuestas r JOIN lecciones l ON l.id = r.leccion_id WHERE l.clase = ? AND r.alumno = ?', ('AULA23', ana)).fetchone()
            assert c.execute('SELECT 1 FROM matriculas WHERE clase = ? AND alumno = ?', ('OTRA12', ana)).fetchone()
            assert c.execute("SELECT 1 FROM respuestas WHERE id = 'otra-respuesta'").fetchone()
            assert not c.execute("SELECT 1 FROM dudas WHERE id IN ('duda-baja', 'duda-borrador')").fetchone()
            assert c.execute("SELECT COUNT(*) FROM dudas WHERE id IN ('duda-otra', 'duda-control')").fetchone()[0] == 2
            assert c.execute('SELECT COUNT(*) FROM respuestas WHERE alumno = ?', (demo.identificador('alumno-1'),)).fetchone()[0] == 10
        assert main.entrar_alumno(main.Entrar(usuario='aula23ana', contrasena='1234'))['id'] == ana
        assert not any(a['id'] == ana for a in panel.panel('AULA23')['alumnos'])
        # Tras la baja, POST /api/sync no reinserta y confirma recepción para vaciar la cola.
        momento = datetime.now().isoformat()
        def nueva(id_, alumno):
            return {'id': id_, 'alumno': alumno, 'leccion_id': leccion, 'pregunta': 0, 'respuesta': 0, 'fecha': momento}
        baja_id, control_id = '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b'
        estado, cuerpo = asyncio.run(sync_por_api({'alumno_id': ana, 'respuestas': [
            nueva(baja_id, ana), nueva(control_id, demo.identificador('alumno-1'))]}))
        assert estado == 200 and {baja_id, control_id} <= set(cuerpo['recibidas'])
        with sqlite3.connect(panel.DB_PATH) as c:
            assert not c.execute('SELECT 1 FROM respuestas WHERE id = ?', (baja_id,)).fetchone()
            assert c.execute('SELECT 1 FROM respuestas WHERE id = ?', (control_id,)).fetchone()  # control: el cuerpo es válido
            assert not c.execute('SELECT 1 FROM matriculas WHERE clase = ? AND alumno = ?', ('AULA23', ana)).fetchone()
    finally:
        main.DB_PATH = original
print('Panel correcto: fechas inválidas, notas, baja con PIN, aislamiento, cuenta conservada, rollback, 404 y sincronización tras la baja.')
