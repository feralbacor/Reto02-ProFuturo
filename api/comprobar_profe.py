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
main.crear_leccion_con_ia = lambda texto, idioma="es", nivel=1: llamadas.append((texto, nivel)) or {**leccion, "idioma": idioma, "nivel": nivel}
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

# Archivos: Word, PowerPoint (en orden de diapositiva), LibreOffice, texto y PDF; lo demás, un aviso claro.
import base64  # noqa: E402
import io  # noqa: E402
import zipfile  # noqa: E402


def zip_con(partes):
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w") as z:
        for nombre, xml in partes.items():
            z.writestr(nombre, xml)
    return b.getvalue()


def leer(crudo):
    return api.post(f"/api/clases/{suya}/leer-archivo", json={"archivo": "data:x;base64," + base64.b64encode(crudo).decode()}, headers=sesion)


frase = "El agua se evapora, forma nubes y cae como lluvia."
assert leer(zip_con({"word/document.xml": f"<w:p><w:r><w:t>El ciclo &amp; el agua</w:t></w:r></w:p><w:p><w:t>{frase}</w:t></w:p>"})).json()["texto"] == f"El ciclo & el agua\n{frase}"
diapos = zip_con({"ppt/slides/slide10.xml": f"<a:p><a:t>Diez {frase}</a:t></a:p>", "ppt/slides/slide2.xml": f"<a:p><a:t>Dos {frase}</a:t></a:p>"})
assert leer(diapos).json()["texto"].startswith("Dos")
assert frase in leer(zip_con({"content.xml": f"<text:p>{frase}</text:p>"})).json()["texto"]
assert leer(f"# Apuntes\n\n{frase}".encode()).json()["texto"] == f"# Apuntes\n\n{frase}"
assert leer(zip_con({"otra/cosa.xml": "<a/>"})).status_code == 415
assert leer(bytes(range(256)) * 10).status_code == 415
assert leer(b"corto").status_code == 422
# Un PDF de una página con una frase (hecho a mano: así la prueba no necesita más librerías).
flujo = f"BT /F1 12 Tf 72 720 Td ({frase}) Tj ET".encode()
objetos = [b"<</Type/Catalog/Pages 2 0 R>>", b"<</Type/Pages/Kids[3 0 R]/Count 1>>",
           b"<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
           b"<</Length %d>>stream\n" % len(flujo) + flujo + b"\nendstream", b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>"]
pdf, posiciones = b"%PDF-1.4\n", []
for i, o in enumerate(objetos, 1):
    posiciones.append(len(pdf))
    pdf += b"%d 0 obj\n" % i + o + b"\nendobj\n"
xref = len(pdf)
pdf += b"xref\n0 6\n0000000000 65535 f \n" + b"".join(b"%010d 00000 n \n" % p for p in posiciones)
pdf += b"trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n%d\n%%%%EOF\n" % xref
r = leer(pdf)
assert r.status_code in (200, 503), r.text  # 503: falta pypdf en este ordenador
if r.status_code == 200:
    assert r.json()["texto"] == frase, r.json()
print("Leer archivos: todo bien" + ("" if r.status_code == 200 else " (sin probar PDF: falta pypdf)"))
# Con main (idiomas): la lección va en el idioma elegido y conserva el título del profe; un idioma que no está, 400.
fr = api.post(f"/api/clases/{suya}/lecciones", json={**cuerpo, "id": None, "titulo": "L'eau", "idioma": "fr"}, headers=sesion).json()
assert fr["leccion"]["idioma"] == "fr" and fr["leccion"]["titulo"] == "L'eau"
assert api.post(f"/api/clases/{suya}/lecciones", json={**cuerpo, "id": None, "idioma": "xx"}, headers=sesion).status_code == 400
print("Idioma de la lección: todo bien")

# Nivel de dificultad: de 0 a 5 (por defecto 1, como antes); llega a la IA y se guarda en la lección.
alto = api.post(f"/api/clases/{suya}/lecciones", json={**cuerpo, "id": None, "nivel": 5}, headers=sesion).json()
assert alto["leccion"]["nivel"] == 5 and llamadas[-1][1] == 5
assert api.post(f"/api/clases/{suya}/lecciones", json={**cuerpo, "id": None}, headers=sesion).json()["leccion"]["nivel"] == 1
assert api.post(f"/api/clases/{suya}/lecciones", json={**cuerpo, "id": None, "nivel": 6}, headers=sesion).status_code == 400
assert main.esquema_con_nivel(5)["properties"]["preguntas"]["maxItems"] == 10 and main.ESQUEMA_LECCION["properties"]["preguntas"]["maxItems"] == 5
for n in main.NIVELES:  # el prompt se puede rellenar en todos los niveles
    assert f"NIVEL {n}" in main.PROMPT_LECCION.format(texto="t", idioma="español", nivel=n, como="", min_palabras=1, max_palabras=2, frases="1", n_preguntas=5, tipo="")
print("Nivel de dificultad: todo bien")
