"""Comprueba el tope de la IA y que una lección no se prepare dos veces a la vez, sin IA: cd api && .venv/bin/python comprobar_preparando.py"""
import json
import os
import sys
import tempfile
import threading
from contextlib import closing

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ".")
import main  # noqa: E402
from fastapi import HTTPException  # noqa: E402

main.DB_PATH = os.path.join(tempfile.mkdtemp(), "prueba.db")  # nunca la base de datos real
main.preparar_bd()
with closing(main.db()) as c, c:
    c.execute("INSERT INTO clases (codigo, nombre, creada) VALUES ('CLASEA', 'A', ?)", (main.ahora(),))

TEXTO = "Las raíces sujetan la planta al suelo y absorben agua y sales minerales del suelo."
BUENA = {"titulo": "Plantas", "lectura_facil": "Las raíces sujetan la planta.", "explicacion_ejemplo": "Regamos la tierra.", "preguntas": []}
topes = []
respuestas = []
empezada, seguir = threading.Event(), threading.Event()


def falsa(prompt, formato=None, max_tokens=None, espera=None):
    topes.append(max_tokens)
    empezada.set()
    seguir.wait(5)
    return respuestas.pop(0)


main.preguntar_ia = falsa
seguir.set()

# El tope crece con el nivel y las preguntas, y nunca se pasa de lo que cabe en el contexto.
for nivel, n, tope in [(0, 0, 500), (2, 5, 2500), (5, 30, 14000)]:
    respuestas[:] = [json.dumps(BUENA)]
    topes.clear()
    try:
        main.crear_leccion_con_ia(TEXTO, "es", nivel, n, 2)
    except HTTPException:
        pass  # con preguntas pedidas y ninguna en BUENA no vale; aquí solo importa el tope
    except IndexError:
        pass  # reintentó y ya no quedan respuestas
    assert topes[0] == tope, (nivel, n, topes)
respuestas[:] = [json.dumps(BUENA)]
topes.clear()
try:
    main.crear_leccion_con_ia("x" * 20000, "es", 5, 30, 2)
except (HTTPException, IndexError):
    pass
assert topes[0] < main.CONTEXTO - 10000, topes

# Un bucle deja el JSON cortado: se reintenta una vez y, si vuelve a pasar, se dice con un error.
respuestas[:] = ['{"titulo": "Plantas", "lectura_facil": "bla bla', '{"titulo": "Plantas", "lectura_facil": "bla bla']
topes.clear()
try:
    main.nueva_leccion("CLASEA", main.NuevaLeccion(texto=TEXTO, nivel=2, preguntas=0, id="00000000-0000-0000-0000-000000000001"))
    raise AssertionError("tenía que fallar")
except HTTPException as e:
    assert e.status_code == 502 and len(topes) == 2
assert main.ver_clase("CLASEA")["preparando"] == [] and not main.ver_clase("CLASEA")["lecciones"]  # no se queda «preparando» para siempre

# Mientras se prepara: la API lo dice, un segundo intento no va a la cola, y al acabar la lección ya está y no se repite.
ID = "00000000-0000-0000-0000-000000000002"
datos = main.NuevaLeccion(texto=TEXTO, nivel=2, preguntas=0, id=ID)
respuestas[:] = [json.dumps(BUENA)]
topes.clear()
empezada.clear()
seguir.clear()
hilo = threading.Thread(target=main.nueva_leccion, args=("CLASEA", datos))
hilo.start()
assert empezada.wait(5)
assert main.ver_clase("clasea")["preparando"] == [ID]
try:
    main.nueva_leccion("CLASEA", datos)
    raise AssertionError("tenía que decir que ya se está preparando")
except HTTPException as e:
    assert e.status_code == 409
seguir.set()
hilo.join()
clase = main.ver_clase("CLASEA")
assert clase["preparando"] == [] and [l["id"] for l in clase["lecciones"]] == [ID]
assert main.nueva_leccion("CLASEA", datos)["leccion"]["titulo"] == "Plantas" and len(topes) == 1  # la devuelve sin llamar otra vez a la IA
print("Tope de la IA y lecciones en marcha: todo bien")
