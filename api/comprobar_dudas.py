"""Comprueba cómo se limpian las respuestas de la IA a las dudas, sin IA: cd api && .venv/bin/python comprobar_dudas.py"""
import os
import sys
import tempfile

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ".")
import main  # noqa: E402

main.DB_PATH = os.path.join(tempfile.mkdtemp(), "prueba.db")  # que el hilo de las dudas no toque la base de datos real

# Dudas: la pregunta del final se quita; la que pide concretar, no; lo ajeno y lo que no está salen con su frase fija.
leccion = {"titulo": "El agua", "lectura_facil": "El sol calienta el agua."}
real = main.preguntar_ia
for de_la_ia, sale in [("El sol calienta el agua. ¿Te gustaría saber más?", "El sol calienta el agua."),
                       ("¿Qué parte no entiendes? Por ejemplo, ¿qué es el vapor?", "¿Qué parte no entiendes? Por ejemplo, ¿qué es el vapor?"),
                       ("What part? Tell me?", "What part? Tell me?"),
                       ("AJENA", main.AJENA), ("NO_ESTA", main.NO_ESTA), ("", main.NO_ESTA)]:
    main.preguntar_ia = lambda *a, **k: de_la_ia
    assert main.contestar_duda(leccion, "x") == sale, de_la_ia
main.preguntar_ia = real
print("Respuestas a las dudas: todo bien")
