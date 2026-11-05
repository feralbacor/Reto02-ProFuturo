"""Comprueba las estadísticas de la clase, en una base de datos aparte: cd api && .venv/bin/python comprobar_estadisticas.py"""
import json
import os
import sys
import tempfile
from contextlib import closing
from datetime import datetime, timedelta

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ".")
import main  # noqa: E402

main.DB_PATH = os.path.join(tempfile.mkdtemp(), "prueba.db")  # nunca la base de datos real
main.preparar_bd()

P = lambda n: {"pregunta": f"Pregunta {n}", "opciones": [f"Bien {n}", f"Mal {n}a", f"Mal {n}b", f"Mal {n}c"], "correcta": 0, "porque": "Porque sí."}
L = lambda titulo, *ps: json.dumps({"titulo": titulo, "lectura_facil": "Texto.", "explicacion_ejemplo": "Ejemplo.", "preguntas": [P(p) for p in ps]})
ahora = datetime.now().astimezone()
hoy, antes, hace_mucho = ahora.isoformat(), (ahora - timedelta(days=2)).isoformat(), (ahora - timedelta(days=30)).isoformat()

with closing(main.db()) as c, c:
    for k in ("CLASEA", "CLASEB"):
        c.execute("INSERT INTO clases (codigo, nombre, creada) VALUES (?, ?, ?)", (k, k, hoy))
    for a in ("ana", "luis", "fuera"):
        c.execute("INSERT INTO alumnos VALUES (?, ?)", (a, a))
    c.execute("INSERT INTO matriculas VALUES ('CLASEA', 'ana', ?)", (hoy,))
    c.execute("INSERT INTO matriculas VALUES ('CLASEA', 'luis', ?)", (hoy,))
    c.execute("INSERT INTO matriculas VALUES ('CLASEB', 'fuera', ?)", (hoy,))
    for id_, clase, titulo, publicada, ps in (("l1", "CLASEA", "Uno", 1, (1, 2)), ("borrador", "CLASEA", "Borrador", 0, (3,)), ("otra", "CLASEB", "Otra", 1, (4,))):
        c.execute("INSERT INTO lecciones (id, clase, titulo, contenido, fecha, publicada) VALUES (?, ?, ?, ?, ?, ?)", (id_, clase, titulo, L(titulo, *ps), hoy, publicada))
    filas = [
        ("r1", "ana", "l1", 0, 2, hace_mucho),  # falló y luego acertó: cuenta la última
        ("r2", "ana", "l1", 0, 0, hoy),
        ("r3", "ana", "l1", 1, 1, antes),  # fallada
        ("r4", "luis", "l1", 1, 3, hoy),  # fallada: la pregunta 2 la falla todo el mundo
        ("r5", "luis", "l1", 9, 0, hoy),  # pregunta que ya no existe: no cuenta
        ("r6", "ana", "borrador", 0, 0, hoy),  # lección sin publicar: no cuenta
        ("r7", "fuera", "l1", 0, 0, hoy),  # alumno de otra clase: no cuenta
        ("r8", "ana", "l1", 1, 1, "no es una fecha"),  # fecha mala: no cuenta
        ("r9", "fuera", "otra", 0, 1, hoy),  # otra clase: no sale aquí
    ]
    c.executemany("INSERT INTO respuestas (id, alumno, leccion_id, pregunta, respuesta, fecha) VALUES (?, ?, ?, ?, ?, ?)", filas)
    c.execute("INSERT INTO dudas (id, alumno, leccion_id, pregunta, fecha) VALUES ('d1', 'ana', 'l1', '¿Por qué?', ?)", (hoy,))
    c.execute("INSERT INTO dudas (id, alumno, leccion_id, pregunta, fecha) VALUES ('d2', 'fuera', 'otra', '¿Y esto?', ?)", (hoy,))

e = main.estadisticas_clase("clasea")
assert [(p["pregunta"], p["aciertos"], p["respuestas"]) for p in e["preguntas"]] == [("Pregunta 2", 0, 2), ("Pregunta 1", 1, 1)], e["preguntas"]  # la que más cuesta, primero
assert e["respuestas"]["ana"] == {"l1": {0: 0, 1: 1}}, e["respuestas"]  # las acertadas también, y de la 1 la última
assert e["respuestas"]["luis"] == {"l1": {1: 3}} and "fuera" not in e["respuestas"]
assert list(e["lecciones"]) == ["l1"] and [p["pregunta"] for p in e["lecciones"]["l1"]] == ["Pregunta 1", "Pregunta 2"], e["lecciones"]
assert e["dudas"] == {"ana": 1}
assert len(e["actividad"]) == 7 and e["actividad"][-1]["dia"] == str(ahora.date())
assert e["actividad"][-1]["respuestas"] == 2 and e["actividad"][-3]["respuestas"] == 1 and sum(d["respuestas"] for d in e["actividad"]) == 3, e["actividad"]  # lo de hace 30 días no sale

vacia = main.estadisticas_clase("CLASEB")
assert vacia["dudas"] == {} or vacia["dudas"] == {"fuera": 1}
try:
    main.estadisticas_clase("NOEXIS")
    raise SystemExit("Debía dar 404")
except main.HTTPException as error:
    assert error.status_code == 404
print("Estadísticas: cuentan la última respuesta, solo de la clase y de lo publicado")
