# Cambios: logo en la portada y «© 2026 MaestrIA»

Rama **`v2-local`**, unida a `main` (5 de noviembre de 2026). Solo cambia el aspecto: no se ha tocado la API ni los datos.

## 1. Logo en la portada

- A la izquierda de «Mochila», en la cabecera de la portada, va el logo de la app: la mochila sobre fondo amarillo, el mismo icono que sale al instalarla.
- Es `web/public/favicon.svg`, de menos de 1 KB. Ya se guardaba en el aparato para usarlo sin conexión, así que también se ve sin red.
- Solo en la portada. En «Mis clases» del profe y en la pantalla principal del alumno, «Mochila» sigue sin logo.

## 2. «© 2026 MaestrIA» al final de todas las pantallas

- Sale al final de **todas** las pantallas: la portada y todas las del alumno y del profe. También en la página de entrada de la caja (`http://IP:8080`).
- Va **abajo del todo**:
  - Si la página es corta, se queda pegado al borde de abajo de la pantalla.
  - Si es larga, aparece después de todo el contenido.
- El símbolo © sirve en cualquier idioma, así que no hace falta traducirlo.

## Archivos

| Archivo | Qué cambia |
|---|---|
| `web/src/App.jsx` | El logo en la cabecera de la portada. El componente `Creadores`, que se pone en `App` detrás de la portada, de la vista del alumno y de la del profe; así sale en todas las pantallas sin tocar cada una |
| `web/src/estilo.css` | `.marca-logo` (40 px, esquinas redondeadas) y `.creadores`. `#root` ocupa al menos todo el alto de la pantalla, para que el pie quede abajo |
| `caja-inicio.html` | El mismo pie, abajo del todo |
| `CAMBIOS-LOGO-Y-PIE.md` | Este archivo |

## Cómo comprobarlo

1. Abre la app en el ordenador y en el móvil. En DevTools, el icono del móvil sirve para verla con tamaño de móvil.
2. En la portada debe salir el logo a la izquierda de «Mochila», y «© 2026 MaestrIA» pegado al borde de abajo.
3. Entra en «Soy estudiante» y en «Soy profe». El pie debe seguir saliendo al final.
4. En una pantalla larga, como una clase con muchas lecciones, el pie debe aparecer al bajar del todo, después del contenido.
