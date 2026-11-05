"""Comprueba exámenes, preguntas de desarrollo y palabras de los juegos, en una base de datos aparte:
cd api && .venv/bin/python comprobar_examen.py"""
import json
import os
import sys
import tempfile
from contextlib import closing

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ".")
import main  # noqa: E402

main.DB_PATH = os.path.join(tempfile.mkdtemp(), "prueba.db")  # nunca la base de datos real
main.preparar_bd()
main.ollama_disponible = lambda: None  # que el hilo de la IA no se meta en medio: la corrección se llama a mano

# --- Qué es una lección o un examen válido ---
P = {"pregunta": "¿Qué beben?", "opciones": ["Agua", "Leche", "Zumo", "Aceite"], "correcta": 0, "porque": "Lo dice."}
D = {"pregunta": "Explica cómo beben las plantas.", "respuesta_modelo": "Por las raíces."}
PAL = [{"palabra": p, "pista": f"Pista de {p}"} for p in ("raíz", "hoja", "tallo", "agua")]
L = lambda **mas: {"titulo": "Las plantas", "lectura_facil": "Las plantas beben.", "explicacion_ejemplo": "Riego.", "preguntas": [], **mas}
E = lambda **mas: {"tipo": "examen", "titulo": "Examen", "lectura_facil": "", "explicacion_ejemplo": "", "preguntas": [P], **mas}
v = main.leccion_valida
assert v(L()) and v(L(desarrollo=[D])) and v(L(juegos=["sopa", "crucigrama"], palabras=PAL))
assert v(E()) and v(E(preguntas=[], desarrollo=[D]))
assert not v(E(preguntas=[]))  # un examen sin ninguna pregunta
assert not v(L(tipo="otro"))
assert not v(L(juegos=["sopa"], palabras=PAL[:2]))  # pocas palabras para jugar
assert not v(L(juegos=["damas"], palabras=PAL))
assert not v(L(palabras=[{"palabra": "dos palabras", "pista": "x"}]))
assert not v(L(palabras=[{"palabra": "agua", "pista": " "}]))
assert not v(L(desarrollo=[{"pregunta": " "}]))
assert main.limpiar_palabras({"palabras": [*PAL, {"palabra": "Agua", "pista": "otra"}, {"palabra": "ab", "pista": "corta"}, "x"]})["palabras"] == PAL

# --- El esquema que se le pide a la IA ---
e = main.esquema_con_nivel(1, 5, 2, n_desarrollo=2, palabras=True, examen=True)
assert "lectura_facil" not in e["properties"] and "lectura_facil" not in e["required"]
assert e["properties"]["desarrollo"]["minItems"] == 2 and e["properties"]["palabras"]["maxItems"] == main.N_PALABRAS
assert "lectura_facil" in main.ESQUEMA_LECCION["required"] and "desarrollo" not in main.ESQUEMA_LECCION["properties"]  # el de siempre, sin tocar

# --- La IA prepara un examen (de mentira) ---
pedido = []


def ia_falsa(prompt, formato=None, **_):
    pedido.append((prompt, formato))
    if "Corrige la respuesta" in prompt:
        return json.dumps({"nota": 7, "comentario": "Bien, pero falta decir que suben por el tallo."})
    return json.dumps({"titulo": "Examen de plantas", "preguntas": [{"pregunta": "¿Qué beben?", "respuesta_correcta": "Agua", "porque": "Lo dice.", "incorrectas": ["Leche", "Zumo", "Aceite"]}],
                       "desarrollo": [D]})


main.preguntar_ia = ia_falsa
ex = main.crear_leccion_con_ia("Las plantas beben agua por las raíces. " * 3, "es", 1, 1, 2, n_desarrollo=1, examen=True)
assert ex["tipo"] == "examen" and ex["lectura_facil"] == "" and ex["desarrollo"] == [D] and v(ex)
assert "prepara un examen" in pedido[-1][0] and "desarrollo" in pedido[-1][1]["required"]

# --- El alumno contesta por escrito (sin conexión) y le llega la nota ---
A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
with closing(main.db()) as c, c:
    c.execute("INSERT INTO clases (codigo, nombre, creada) VALUES ('CLASEA', 'A', ?)", (main.ahora(),))
    c.execute("INSERT INTO alumnos (id, nombre) VALUES (?, 'Ana')", (A,))
    c.execute("INSERT INTO matriculas (clase, alumno, fecha) VALUES ('CLASEA', ?, ?)", (A, main.ahora()))
    c.execute("INSERT INTO lecciones (id, clase, titulo, contenido, fecha, publicada) VALUES ('ex1', 'CLASEA', 'Examen', ?, ?, 1)",
              (json.dumps(ex), main.ahora()))
R = lambda id, pregunta=0, texto="Beben por las raíces.": {"id": id, "alumno": A, "leccion_id": "ex1", "pregunta": pregunta, "texto": texto, "fecha": "2026-11-05T10:00:00"}
ID1, ID2 = "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"
sync = lambda *ds: main.sincronizar(main.Sincronizar(alumno_id=A, desarrollos=list(ds)))
r = sync(R(ID1), R(ID1), R(ID2, pregunta=5), R("no-es-id"))  # repetida, de una pregunta que no hay y mal formada
assert r["desarrollos_recibidos"] == [ID1, ID1, ID2, "no-es-id"]  # todas recibidas: el móvil no las reenvía sin fin
assert [(d["id"], d["nota"]) for d in r["desarrollos"]] == [(ID1, None)]  # solo una guardada, sin nota todavía

nota, comentario = main.corregir_desarrollo(D, "Beben por las raíces.")  # lo que hace el hilo de la IA
assert nota == 7 and comentario.startswith("Bien")
assert "Ana" not in pedido[-1][0]  # a la IA nunca le llega el nombre del alumno
with closing(main.db()) as c, c:
    c.execute("UPDATE desarrollos SET nota_ia = ?, comentario_ia = ? WHERE id = ?", (nota, comentario, ID1))
d = sync()["desarrollos"][0]
assert d["nota"] == 7 and not d["corregida"] and not d["para_el_profe"]

main.preguntar_ia = lambda *_, **__: "esto no es JSON"
assert main.corregir_desarrollo(D, "algo") == (main.SIN_CORREGIR, "")  # no sabe corregirla: no se reintenta sin fin

# --- El profe la ve y pone su nota: vale más que la de la IA ---
vista = main.ver_clase("CLASEA")["desarrollos"][0]
assert vista["alumno"] == "Ana" and vista["pregunta"] == D["pregunta"] and vista["nota_ia"] == 7
try:
    main.corregir_desarrollo_profe("CLASEA", ID1, main.NotaProfe(nota=11))
    raise SystemExit("Debía rechazar un 11")
except main.HTTPException as e:
    assert e.status_code == 400
main.corregir_desarrollo_profe("CLASEA", ID1, main.NotaProfe(nota=9, comentario="Muy bien explicado."))
d = sync()["desarrollos"][0]
assert d["nota"] == 9 and d["corregida"] and d["comentario"] == "Muy bien explicado."
assert main.ver_clase("CLASEA")["lecciones"][0]["respondida"]

# --- Con respuestas, no se puede quitar una pregunta de desarrollo; al borrar el examen se van ---
try:
    main.guardar_leccion("CLASEA", "ex1", main.GuardarLeccion(leccion={**ex, "desarrollo": []}))
    raise SystemExit("Debía impedir quitar la pregunta")
except main.HTTPException as e:
    assert e.status_code == 409
main.borrar_leccion("CLASEA", "ex1")
assert not main.db().execute("SELECT 1 FROM desarrollos").fetchone()
print("Exámenes, desarrollo y juegos: se validan, se corrigen sin nombres, manda la nota del profe y no se duplican")
