# Cambios: documentos largos, la IA los lee por partes

Rama **`profe-sin-conexion`**, unida a `main` (5 de noviembre de 2026). Solo trae lo nuevo de esta subida: lo de antes está en `CAMBIOS-NIVELES-Y-PREGUNTAS.md` y `CAMBIOS-PROFE.md`.

## El problema

Al subir un PDF largo, la lección solo usaba el principio. Con el libro de Anatomía Humana (246 páginas) solo llegaban hasta la página 11. El texto se cortaba en la API (`api/main.py`), no en la caja de texto:

| Dónde | Antes | Ahora |
|---|---|---|
| Leer el PDF | las primeras 40 páginas | todas |
| `POST /api/clases/{codigo}/leer-archivo` | 20 000 letras | el texto entero |
| Preparar la lección | 8 000 letras (niveles 0–2) o 20 000 (niveles 3–5); el resto se perdía | si no cabe, la IA lo lee por partes |

Un libro entero no cabe de una vez en la memoria de la IA. El de Anatomía son 550 000 letras, unos 150 000 tokens, y Qwen tiene 16 384. Por eso hay que leerlo por partes.

## Cómo funciona

1. Si el texto no cabe en lo que la IA lee de una vez (8 000 o 20 000 letras, como antes), `leer_por_partes()` lo parte con `partir()` en trozos de **24 000 letras** (`TROZO`), sin cortar párrafos.
2. La IA lee los trozos **uno detrás de otro**, cada uno con la memoria vacía, y saca los apuntes de cada uno (`PROMPT_APUNTES`): ideas, definiciones, nombres y datos, sin inventar nada.
3. Cada trozo da los apuntes justos para que todos juntos quepan. Si aun así no caben, se vuelven a leer por partes.
4. La lección se prepara con los apuntes, igual que antes con el texto (nivel, preguntas y dificultad no cambian).

Si el texto cabe, no cambia nada: va directo a la IA como antes.

En la pestaña de la API se ve cómo va: «Leyendo por partes: 3 de 24».

## Con lo que trae `main`

- La lectura por partes está **dentro de `PREPARANDO`** (de `main`): mientras la IA lee las partes, la lección cuenta como «se está preparando». Si se pulsa otra vez, la API contesta 409 en vez de empezar el libro otra vez. Antes, eso hacía que dos copias del libro se leyeran a la vez.
- Los apuntes de cada parte tienen su propio tope (`palabras × 3` tokens). La lección final usa el tope de `main` (`TOKENS_LECTURA` y `TOKENS_POR_PREGUNTA`).

## Archivos

| Archivo | Qué cambia |
|---|---|
| `api/main.py` | `TROZO`, `PROMPT_APUNTES`, `partir()`, `leer_por_partes()`; sin el corte de 40 páginas ni de 20 000 letras; `nueva_leccion()` usa `leer_por_partes()` |
| `api/comprobar_profe.py` | prueba «Documentos largos por partes» |
| `CAMBIOS-PROFE.md` | apartado 8, y el 4 sin los límites viejos |
| `REPARTO.md` | una línea en «Peticiones» |
| `CAMBIOS-DOCUMENTOS-LARGOS.md` | este archivo |

## Cuánto tarda

En el Mac (M3, 16 GB), cada parte de 24 000 letras tarda unos **50–90 s**. El libro de Anatomía son **24 partes**: unos **20–35 minutos** antes de que empiece la lección. Un tema de 10–20 páginas cabe de una vez y no tarda más que antes.

## Cómo comprobarlo

- Pruebas sin IA:
  - `cd api && .venv/bin/python comprobar_preparando.py` → «todo bien».
  - `.venv/bin/python comprobar_borrar.py` → «todo bien».
  - `comprobar_profe.py` también tiene la prueba nueva, pero necesita `httpx2` en el `.venv`.
- A mano, con la API y Ollama en marcha, en **http://localhost:4173**:
  1. Entra como profe, abre una clase y pulsa «Nueva lección».
  2. Sube el PDF de Anatomía.
  3. En el texto debe salir el libro entero: busca «6.3. PLEXO LUMBAR», que está en la página 242.
  4. Prepara la lección y mira la pestaña de la API: «Leyendo por partes: 1 de 24»…
  5. Al acabar, la lección habla de todo el libro, no solo de las primeras páginas.

## Ojo

- **Por el túnel de Cloudflare** la conexión se corta a los 100 s. La lección se sigue preparando en el ordenador, y la web de `main` espera a que acabe («espera tras el corte de Cloudflare»).
- Cuanto más largo el documento, más resumidos salen los apuntes de cada parte: de un libro de 246 páginas sale una lección general, no una de cada tema. Para un tema concreto, mejor subir solo sus páginas.
- La API se arranca con `--reload`: si se guarda un `.py` de `api/` mientras se prepara una lección, la API se reinicia y esa lección se pierde.
