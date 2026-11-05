"""Comprueba las lecciones escritas a mano, en una base de datos aparte: cd api && .venv/bin/python comprobar_a_mano.py"""
import json
import os
import sys
import tempfile
from contextlib import closing

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ".")
import main  # noqa: E402

main.DB_PATH = os.path.join(tempfile.mkdtemp(), "prueba.db")  # nunca la base de datos real


def sin_ia(*_, **__):
    raise SystemExit("Una lección a mano no debe llamar a la IA")


main.preguntar_ia = sin_ia
main.preparar_bd()
with closing(main.db()) as c, c:
    for k in ("CLASEA", "CLASEB"):
        c.execute("INSERT INTO clases (codigo, nombre, creada) VALUES (?, ?, ?)", (k, k, main.ahora()))
    c.execute("INSERT INTO alumnos VALUES ('a1', 'Ana')")
    c.execute("INSERT INTO matriculas VALUES ('CLASEA', 'a1', ?)", (main.ahora(),))

ID = "11111111-1111-4111-8111-111111111111"
L = lambda titulo="Las plantas", **mas: {"titulo": titulo, "materia": "ciencias", "idioma": "es", "lectura_facil": "Las plantas beben.", "explicacion_ejemplo": "Riego.", "preguntas": [], **mas}
enviar = lambda leccion, publicar=False, codigo="CLASEA", id=ID: main.leccion_a_mano(codigo, main.LeccionAMano(id=id, leccion=leccion, publicar=publicar))
filas = lambda: main.db().execute("SELECT id, clase, titulo, publicada, contenido FROM lecciones").fetchall()
ve_ana = lambda: [l["id"] for clase in main.clases_del_alumno(main.db(), "a1") for l in clase["lecciones"]]


def rechaza(estado, *args, **kwargs):
    try:
        enviar(*args, **kwargs)
    except main.HTTPException as e:
        assert e.status_code == estado, e.status_code
        return
    raise SystemExit("Debía rechazarla")


rechaza(400, L(explicacion_ejemplo=" "))  # sin ejemplo
rechaza(400, L(), id="no-es-un-id")
assert not filas()

assert enviar(L())["materia"] == "Ciencias"
assert len(filas()) == 1 and filas()[0]["publicada"] == 0 and ve_ana() == []  # borrador: Ana no la ve

enviar(L())  # llega dos veces: no se duplica
assert len(filas()) == 1
enviar(L(titulo="Las plantas verdes"), publicar=True)  # el último cambio manda
assert len(filas()) == 1 and filas()[0]["titulo"] == "Las plantas verdes" and filas()[0]["publicada"] == 1
assert json.loads(filas()[0]["contenido"])["materia"] == "Ciencias" and ve_ana() == [ID]

rechaza(404, L(titulo="De otra clase"), codigo="CLASEB")  # el mismo id en otra clase no la toca
assert filas()[0]["titulo"] == "Las plantas verdes" and filas()[0]["clase"] == "CLASEA"
print("Lecciones a mano: se guardan sin IA, no se duplican y llegan al alumno al publicarlas")
