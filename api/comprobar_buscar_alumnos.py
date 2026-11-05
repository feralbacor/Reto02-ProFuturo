"""Comprueba buscar alumnos y meterlos al crear una clase, sin IA: cd api && .venv/bin/python comprobar_buscar_alumnos.py"""
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
    for u, n in [("ana1", "Ana López"), ("bruno", "Bruno"), ("carla", "Carla"), ("anaotra", "Ana de otro profe")]:
        c.execute("INSERT INTO alumnos (id, nombre) VALUES (?, ?)", (u + "-id", n))
        main.guardar_contrasena(c, u + "-id", "1234", u)
    c.execute("INSERT INTO alumnos (id, nombre) VALUES ('sincuenta', 'Ana sin cuenta')")
    for p in ("profe1", "profe2"):
        c.execute("INSERT INTO cuentas_profe (usuario, nombre, sal, hash) VALUES (?, ?, 'aa', 'bb')", (p, p))
    for cod, p, alumnos in [("AAAAAA", "profe1", ["ana1-id", "bruno-id"]), ("BBBBBB", "profe2", ["anaotra-id", "carla-id"])]:
        c.execute("INSERT INTO clases (codigo, nombre, creada) VALUES (?, ?, ?)", (cod, cod, main.ahora()))
        c.execute("INSERT INTO clases_profe (clase, profe) VALUES (?, ?)", (cod, p))
        for a in alumnos:
            c.execute("INSERT INTO matriculas (clase, alumno, fecha) VALUES (?, ?, ?)", (cod, a, main.ahora()))

b = lambda q: [a["usuario"] for a in main.buscar_alumnos(q, "profe1")]  # noqa: E731
assert b("ana") == ["ana1"], b("ana")  # los alumnos de otro profe no salen por nombre
assert b("") == [] and b("%") == [] and b("_") == []  # ni con comodines
assert b("carla") == ["carla"] and b(" CARLA ") == ["carla"]  # otro alumno: solo con su usuario exacto
assert b("Carl") == []

# Al crear la clase con su sesión, el profe mete a los elegidos; ids falsos, repetidos o sin cuenta se ignoran.
main.profe_de_sesion = lambda s: "profe1" if s == "ok" else None
clase = main.crear_clase(main.NuevaClase(nombre="Nueva", alumnos=["ana1-id", "carla-id", "sincuenta", "no-existe", "ana1-id"]), "ok")
with closing(main.db()) as c:
    dentro = sorted(r[0] for r in c.execute("SELECT alumno FROM matriculas WHERE clase = ?", (clase["codigo"],)))
assert dentro == ["ana1-id", "carla-id"], dentro

# Una clase con PIN (sin sesión) no mete a nadie.
clase = main.crear_clase(main.NuevaClase(nombre="Con PIN", pin="1234", alumnos=["ana1-id"]), None)
with closing(main.db()) as c:
    assert not c.execute("SELECT 1 FROM matriculas WHERE clase = ?", (clase["codigo"],)).fetchone()
print("Buscar y meter alumnos: todo bien")
