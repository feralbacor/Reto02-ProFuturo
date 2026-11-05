"""Comprueba ocultar, volver a publicar y eliminar lecciones y clases, en una base de datos aparte: cd api && .venv/bin/python comprobar_borrar.py"""
import os
import sys
import tempfile
from contextlib import closing

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ".")
import main  # noqa: E402

main.DB_PATH = os.path.join(tempfile.mkdtemp(), "prueba.db")  # nunca la base de datos real
main.preparar_bd()
with closing(main.db()) as c, c:
    for k in ("CLASEA", "CLASEB"):
        c.execute("INSERT INTO clases (codigo, nombre, creada) VALUES (?, ?, ?)", (k, k, main.ahora()))
        c.execute("INSERT OR IGNORE INTO alumnos VALUES ('a1', 'Ana')")
        c.execute("INSERT INTO matriculas VALUES (?, 'a1', ?)", (k, main.ahora()))
    for i, k in (("l1", "CLASEA"), ("l2", "CLASEA"), ("l3", "CLASEB")):
        c.execute("INSERT INTO lecciones (id, clase, titulo, contenido, fecha, publicada) VALUES (?, ?, 'T', '{\"preguntas\": []}', ?, 1)", (i, k, main.ahora()))
        c.execute("INSERT INTO respuestas VALUES (?, 'a1', ?, 0, 0, ?)", ("r" + i, i, main.ahora()))
        c.execute("INSERT INTO dudas (id, alumno, leccion_id, pregunta, fecha) VALUES (?, 'a1', ?, 'p', ?)", ("d" + i, i, main.ahora()))
    c.execute("INSERT INTO pines_profe VALUES ('CLASEA', 's', 'h')")

cuantas = lambda sql: main.db().execute(sql).fetchone()[0]
ve_ana = lambda: sorted(l["id"] for clase in main.clases_del_alumno(main.db(), "a1") for l in clase["lecciones"])

main.publicar_u_ocultar("CLASEA", "l1", main.Publicada(publicada=False))
assert ve_ana() == ["l2", "l3"] and cuantas("SELECT COUNT(*) FROM respuestas") == 3  # oculta: Ana no la ve, pero su nota sigue
main.publicar_u_ocultar("clasea", "l1", main.Publicada(publicada=True))
assert ve_ana() == ["l1", "l2", "l3"]
main.borrar_leccion("CLASEA", "l2")
assert ve_ana() == ["l1", "l3"] and not cuantas("SELECT COUNT(*) FROM respuestas WHERE leccion_id = 'l2'") and not cuantas("SELECT COUNT(*) FROM dudas WHERE leccion_id = 'l2'")
try:
    main.borrar_leccion("CLASEB", "l1")  # una lección de otra clase: no se toca
    raise SystemExit("Ha borrado una lección de otra clase")
except main.HTTPException as e:
    assert e.status_code == 404
main.borrar_clase("CLASEA")
assert ve_ana() == ["l3"] and cuantas("SELECT COUNT(*) FROM clases") == 1 and not cuantas("SELECT COUNT(*) FROM pines_profe")
assert cuantas("SELECT COUNT(*) FROM alumnos") == 1 and cuantas("SELECT COUNT(*) FROM respuestas") == 1  # Ana y su nota de la otra clase siguen

# Clase oculta: Ana no la ve y su código no deja entrar, pero el profe la sigue viendo y las respuestas pendientes se guardan.
main.ocultar_o_mostrar_clase("CLASEB", main.Oculta(oculta=True))
assert ve_ana() == [] and main.ver_clase("CLASEB")["oculta"] == 1
assert main.resumen_clases(main.db())[0]["oculta"] == 1
assert main.leccion_del_alumno(main.db(), "a1", "l3")
for entrar in (lambda: main.unirse("CLASEB", main.Unirse(alumno_id="a1")),
               lambda: main.crear_alumno(main.NuevoAlumno(nombre="Bea", usuario="beaprueba", contrasena="clave1234", clase="CLASEB"))):
    try:
        entrar()
        raise SystemExit("Se ha podido entrar en una clase oculta")
    except main.HTTPException as e:
        assert e.status_code == 404
assert not cuantas("SELECT COUNT(*) FROM alumnos WHERE nombre = 'Bea'")  # el error no deja medio alumno creado
main.ocultar_o_mostrar_clase("CLASEB", main.Oculta(oculta=False))
assert ve_ana() == ["l3"]
# Quitar preguntas: se puede mientras nadie ha contestado; después no, porque las respuestas guardan la posición.
P = lambda n: {"pregunta": n, "opciones": [n + "1", n + "2", n + "3", n + "4"], "correcta": 0, "porque": "Porque sí."}
L = lambda *ps: {"titulo": "T", "lectura_facil": "Texto.", "explicacion_ejemplo": "Ejemplo.", "preguntas": list(ps)}
import json  # noqa: E402
with closing(main.db()) as c, c:
    c.execute("INSERT INTO lecciones (id, clase, titulo, contenido, fecha, publicada) VALUES ('l4', 'CLASEB', 'T', ?, ?, 1)", (json.dumps(L(P("a"), P("b"), P("c"))), main.ahora()))
respondida = lambda: next(l["respondida"] for l in main.ver_clase("CLASEB")["lecciones"] if l["id"] == "l4")
preguntas = lambda: [p["pregunta"] for p in json.loads(main.db().execute("SELECT contenido FROM lecciones WHERE id = 'l4'").fetchone()[0])["preguntas"]]
assert not respondida()
with closing(main.db()) as c, c:
    c.execute("INSERT INTO lecciones (id, clase, titulo, contenido, fecha, publicada) VALUES ('l5', 'CLASEB', 'T', ?, ?, 0)", (json.dumps(L(P("a"))), main.ahora()))
main.guardar_leccion("CLASEB", "l5", main.GuardarLeccion(leccion=L()))  # se puede quedar sin ninguna pregunta
assert json.loads(main.db().execute("SELECT contenido FROM lecciones WHERE id = 'l5'").fetchone()[0])["preguntas"] == []
main.guardar_leccion("CLASEB", "l4", main.GuardarLeccion(leccion=L(P("a"), P("c"))))
assert preguntas() == ["a", "c"]
with closing(main.db()) as c, c:
    c.execute("INSERT INTO respuestas VALUES ('r4', 'a1', 'l4', 1, 0, ?)", (main.ahora(),))
assert respondida()
try:
    main.guardar_leccion("CLASEB", "l4", main.GuardarLeccion(leccion=L(P("a"))))
    raise SystemExit("Ha quitado una pregunta con respuestas")
except main.HTTPException as e:
    assert e.status_code == 409 and preguntas() == ["a", "c"]
main.guardar_leccion("CLASEB", "l4", main.GuardarLeccion(leccion=L(P("a"), P("c cambiada"))))  # cambiar el texto sigue valiendo
main.guardar_leccion("CLASEB", "l4", main.GuardarLeccion(leccion=L(P("a"), P("c cambiada"), P("d"))))  # y añadir al final también
assert preguntas() == ["a", "c cambiada", "d"]
print("Ocultar, publicar y eliminar lecciones y clases, y quitar preguntas: todo bien")
