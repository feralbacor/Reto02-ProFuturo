"""Comprueba las cuentas de profe en una base de datos aparte: cd api && .venv/bin/python comprobar_profe.py"""
import os
import sys
import tempfile

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ".")
import main  # noqa: E402

main.DB_PATH = os.path.join(tempfile.mkdtemp(), "prueba.db")
main.preparar_bd()
from fastapi.testclient import TestClient  # noqa: E402

api = TestClient(main.app)

r = api.post("/api/profes", json={"nombre": "Ana Profe", "usuario": "AnaProfe", "contrasena": "clave1"})
assert r.status_code == 200, r.text
sesion = {"X-Sesion-Profe": r.json()["sesion"]}
assert api.post("/api/profes", json={"nombre": "Otra", "usuario": "anaprofe", "contrasena": "clave1"}).status_code == 409
assert api.post("/api/profes/entrar", json={"usuario": "anaprofe", "contrasena": "mala"}).status_code == 401
assert api.post("/api/profes/entrar", json={"usuario": "anaprofe", "contrasena": "clave1"}).json()["sesion"] == sesion["X-Sesion-Profe"]

# Sin sesión no hay lista; con sesión, solo sus clases.
assert api.get("/api/profes/clases").status_code == 401
assert api.get("/api/profes/clases", headers={"X-Sesion-Profe": "anaprofe.falsa"}).status_code == 401
suya = api.post("/api/clases", json={"nombre": "5.º A"}, headers=sesion).json()["codigo"]
assert api.post("/api/clases", json={"nombre": "Sin PIN ni sesión"}).status_code == 400
vieja = api.post("/api/clases", json={"nombre": "Antigua", "pin": "1234"}).json()["codigo"]
assert [c["codigo"] for c in api.get("/api/profes/clases", headers=sesion).json()] == [suya]

# Su clase se abre con su sesión, y no sin ella ni con la de otro profe.
assert api.get(f"/api/clases/{suya}", headers=sesion).status_code == 200
assert api.get(f"/api/clases/{suya}").status_code == 401
otro = {"X-Sesion-Profe": api.post("/api/profes", json={"nombre": "Luis", "usuario": "luis", "contrasena": "clave2"}).json()["sesion"]}
assert api.get(f"/api/clases/{suya}", headers=otro).status_code == 401

# Una clase de antes pasa a su cuenta con el PIN; después ya no la puede coger otro.
assert api.post("/api/profes/clases", json={"codigo": vieja, "pin": "9999"}, headers=sesion).status_code == 401
assert api.post("/api/profes/clases", json={"codigo": vieja, "pin": "1234"}, headers=sesion).status_code == 200
assert {c["codigo"] for c in api.get("/api/profes/clases", headers=sesion).json()} == {suya, vieja}
assert api.get(f"/api/clases/{vieja}", headers=sesion).status_code == 200
assert api.post("/api/profes/clases", json={"codigo": vieja, "pin": "1234"}, headers=otro).status_code == 409
print("Cuentas de profe: todo bien")

# Sin conexión: la lección lleva el id del móvil; si llega dos veces, la IA no la repite ni se duplica.
leccion = {"titulo": "Las plantas", "materia": "Ciencias", "lectura_facil": "a", "explicacion_ejemplo": "b",
           "preguntas": [{"pregunta": "p", "opciones": ["1", "2", "3", "4"], "correcta": 0, "porque": "x"}] * 5}
llamadas = []
main.crear_leccion_con_ia = lambda texto: llamadas.append(texto) or dict(leccion)
lid = "12345678-1234-1234-1234-123456789abc"
cuerpo = {"texto": "Las plantas hacen la fotosíntesis con la luz del sol y el agua.", "materia": "Ciencias", "id": lid}
assert api.post(f"/api/clases/{suya}/lecciones", json=cuerpo, headers=sesion).json()["id"] == lid
assert api.post(f"/api/clases/{suya}/lecciones", json=cuerpo, headers=sesion).json()["id"] == lid
assert len(llamadas) == 1
assert api.post(f"/api/clases/{suya}/lecciones", json={**cuerpo, "id": "x"}, headers=sesion).status_code == 400
clase = api.get(f"/api/clases/{suya}", headers=sesion).json()
assert [l["contenido"]["titulo"] for l in clase["lecciones"]] == ["Las plantas"]
print("Lecciones del profe sin conexión: todo bien")

# El título: el que escribe el profe; si lo deja vacío, el de la IA.
con_titulo = api.post(f"/api/clases/{suya}/lecciones", json={**cuerpo, "id": None, "titulo": "  Mi   título "}, headers=sesion).json()
assert con_titulo["leccion"]["titulo"] == "Mi título"
sin_titulo = api.post(f"/api/clases/{suya}/lecciones", json={**cuerpo, "id": None, "titulo": "   "}, headers=sesion).json()
assert sin_titulo["leccion"]["titulo"] == "Las plantas"
assert {l["titulo"] for l in api.get(f"/api/clases/{suya}", headers=sesion).json()["lecciones"]} == {"Las plantas", "Mi título"}
print("Título de la lección: todo bien")
