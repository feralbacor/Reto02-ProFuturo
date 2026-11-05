"""Comprueba los paquetes cifrados del profe, sin IA: cd api && .venv/bin/python comprobar_paquetes.py"""
import os
import sys
import tempfile

from fastapi import HTTPException

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ".")
import main  # noqa: E402

main.DB_PATH = os.path.join(tempfile.mkdtemp(), "prueba.db")  # nunca la base de datos real
main.preparar_bd()


def falla(f, codigo):
    try:
        f()
    except HTTPException as e:
        assert e.status_code == codigo, (e.status_code, e.detail)
        return
    raise AssertionError("tenía que fallar")


for usuario, nombre in [("eva", "Eva"), ("leo", "Leo")]:
    main.crear_profe(main.NuevoProfe(nombre=nombre, usuario=usuario, contrasena="1234"))

# Fuera del modo caja no se reparten paquetes.
main.WEB_CAJA = None
falla(main.solo_en_caja, 404)
main.WEB_CAJA = "dist"
main.solo_en_caja()

paquete = main.Paquete(sal="sal1", iv="AAAAAAAAAAAAAAAA", cifrado="c2VjcmV0bw==")
falla(lambda: main.guardar_paquete(main.Paquete(sal="s", iv="no base64!", cifrado="x"), "leo"), 400)
falla(lambda: main.guardar_paquete(main.Paquete(sal="s", iv="AAAA", cifrado=""), "leo"), 400)
main.guardar_paquete(paquete, "leo")
main.guardar_paquete(paquete, "leo")  # el segundo sustituye al primero
main.guardar_paquete(paquete, "eva")
assert sorted((p["usuario"], p["nombre"]) for p in main.paquetes_profe()) == [("eva", "Eva"), ("leo", "Leo")]
assert sorted(f["usuario"] for f in main.fechas_paquetes()) == ["eva", "leo"]
assert [p["usuario"] for p in main.paquetes_profe("leo,nadie")] == ["leo"]

print("Paquetes del profe: todo bien")
