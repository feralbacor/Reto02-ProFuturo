"""Datos de AULA23. Ejecutar: .venv/bin/python demo.py [--comprobar]."""
import json
import sqlite3
import sys
import uuid
from contextlib import closing
from datetime import datetime, timedelta

import main

CODIGO = 'AULA23'


def identificador(nombre):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f'mochila/demo/{CODIGO}/{nombre}'))


def leccion(titulo, lectura, ejemplo, preguntas):
    return dict(titulo=titulo, lectura_facil=lectura, explicacion_ejemplo=ejemplo,
                preguntas=[dict(pregunta=p, opciones=o, correcta=c, porque=e) for p, o, c, e in preguntas])


LECCIONES = [
    leccion('El ciclo del agua',
            'El agua cambia de lugar y de estado. El sol calienta el agua de mares, ríos y lagos. Parte se convierte en vapor: es la evaporación. El vapor sube y se enfría. Forma gotas pequeñas que se juntan en las nubes: es la condensación. Cuando las gotas crecen, caen como lluvia: es la precipitación. Parte del agua entra en el suelo. Otra parte llega a los ríos y al mar. Allí el ciclo comienza otra vez. El agua puede ser sólida, líquida o gaseosa. El hielo es agua sólida. El vapor es agua gaseosa. Cuidar el agua ayuda a todos los seres vivos.',
            'Después de llover queda un charco en el patio. Con el calor del sol, parte del agua se evapora.', [
                ('¿Qué calienta el agua?', ['La luna', 'El sol', 'Las piedras', 'La nieve'], 1, 'El sol aporta calor al agua.'),
                ('¿Cómo se llama el paso a vapor?', ['Congelación', 'Lluvia', 'Evaporación', 'Infiltración'], 2, 'Al evaporarse, el agua pasa a vapor.'),
                ('¿Qué forma las nubes?', ['Gotas pequeñas', 'Arena', 'Humo de fuego', 'Piedras'], 0, 'El vapor se enfría y forma gotas pequeñas.'),
                ('¿Cómo se llama la caída de lluvia?', ['Evaporación', 'Condensación', 'Calentamiento', 'Precipitación'], 3, 'La lluvia es una forma de precipitación.'),
                ('¿En qué estado está el hielo?', ['Gaseoso', 'Sólido', 'Líquido', 'En ninguno'], 1, 'El hielo es agua sólida.'),
            ]),
    leccion('Las plantas y sus partes',
            'Las plantas son seres vivos. Necesitan agua, luz y aire para crecer. Las raíces sujetan la planta al suelo. También absorben agua y sales minerales. El tallo sostiene las hojas y transporta sustancias por la planta. Las hojas aprovechan la luz para fabricar alimento. Este proceso se llama fotosíntesis. Muchas plantas tienen flores. Las flores participan en la reproducción. Algunas flores dan lugar a frutos. Dentro de muchos frutos encontramos semillas. Una semilla puede dar origen a otra planta si encuentra condiciones adecuadas. No todas las plantas tienen flores. Cuidar una planta exige conocer lo que necesita y observar cómo crece.',
            'En una maceta de judías podemos observar el tallo y las hojas. Regamos la tierra para que las raíces puedan absorber agua.', [
                ('¿Qué absorbe agua del suelo?', ['La flor', 'El fruto', 'Las raíces', 'La semilla seca'], 2, 'Las raíces absorben agua y sales minerales.'),
                ('¿Qué sostiene las hojas?', ['El tallo', 'La nube', 'El fruto', 'La maceta'], 0, 'El tallo sostiene las hojas.'),
                ('¿Qué aprovechan las hojas para fabricar alimento?', ['Piedras', 'Plástico', 'Oscuridad', 'Luz'], 3, 'Las hojas aprovechan la luz en la fotosíntesis.'),
                ('¿Qué hay dentro de muchos frutos?', ['Raíces', 'Semillas', 'Tallos', 'Tierra'], 1, 'Muchos frutos contienen semillas.'),
                ('¿Todas las plantas tienen flores?', ['Sí, siempre', 'Solo en invierno', 'No', 'Solo de noche'], 2, 'No todas las plantas tienen flores.'),
            ]),
]


def crear_demo(c, fecha=None):
    fecha = fecha or datetime.now()
    antigua = (fecha - timedelta(days=7)).isoformat(timespec='seconds')
    c.execute('INSERT OR IGNORE INTO clases VALUES (?, ?, ?)', (CODIGO, '5.º A · Ciencias', antigua))
    for i, contenido in enumerate(LECCIONES):
        c.execute('INSERT OR IGNORE INTO lecciones VALUES (?, ?, ?, ?, ?, 1)',
                  (identificador(f'leccion-{i}'), CODIGO, contenido['titulo'], json.dumps(contenido, ensure_ascii=False), antigua))
    # Solo Diego tiene nota baja; Elena lleva cinco días sin responder.
    for i, nombre in enumerate(['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Farid']):
        alumno = identificador(f'alumno-{i}')
        c.execute('INSERT OR IGNORE INTO alumnos VALUES (?, ?)', (alumno, nombre))
        c.execute('INSERT OR IGNORE INTO matriculas VALUES (?, ?, ?)', (CODIGO, alumno, antigua))
        for j, contenido in enumerate(LECCIONES):
            aciertos = [5, 4, 3, 2, 4, 5][i]
            momento = (fecha - timedelta(days=5 if i == 4 else j, hours=i)).isoformat(timespec='seconds')
            for k, pregunta in enumerate(contenido['preguntas']):
                opcion = pregunta['correcta'] if k < aciertos else (pregunta['correcta'] + 1) % 4
                c.execute('INSERT OR IGNORE INTO respuestas VALUES (?, ?, ?, ?, ?, ?)',
                          (identificador(f'respuesta-{i}-{j}-{k}'), alumno, identificador(f'leccion-{j}'), k, opcion, momento))


def comprobar():
    with closing(sqlite3.connect(':memory:')) as c, c:
        c.executescript(main.TABLAS)
        c.execute("INSERT INTO clases VALUES ('OTRA12', 'No tocar', '2026-01-01')")
        crear_demo(c)
        antes = '\n'.join(c.iterdump())
        crear_demo(c, datetime.now() + timedelta(days=1))
        assert '\n'.join(c.iterdump()) == antes, 'La segunda ejecución cambia datos'
        assert c.execute('SELECT COUNT(*) FROM alumnos').fetchone()[0] == 6
        assert c.execute('SELECT COUNT(*) FROM lecciones').fetchone()[0] == 2
        assert c.execute('SELECT COUNT(*) FROM respuestas').fetchone()[0] == 60
        assert all(main.leccion_valida(l) for l in LECCIONES)
    print('Correcto: 6 alumnos, 2 lecciones, 60 respuestas; repetible y sin cambiar otra clase.')


if __name__ == '__main__':
    if '--comprobar' in sys.argv:
        comprobar()
    else:
        with closing(main.db()) as c, c:
            crear_demo(c)
        print('Demo preparada: AULA23 · 5.º A · Ciencias. Repetir el comando no duplica ni reinicia datos.')
