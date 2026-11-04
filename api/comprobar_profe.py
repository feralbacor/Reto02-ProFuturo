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
