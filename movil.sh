#!/bin/zsh
# Abre Mochila en el móvil con https (hace falta para el modo sin conexión).
# Antes: la API encendida en el puerto 8000. Para cerrarlo: Ctrl + C.
cd "$(dirname "$0")/web" || exit 1
npm run build || exit 1
npx vite preview --port 4173 --strictPort > /dev/null &
PREVIEW=$!
trap "kill $PREVIEW 2>/dev/null" EXIT INT TERM
echo "Creando el túnel (tarda unos segundos)…"
~/.local/bin/cloudflared tunnel --no-autoupdate --url http://localhost:4173 2>&1 |
  grep --line-buffered -oE 'https://[a-z0-9-]+\.trycloudflare\.com' |
  while read -r url; do echo "\n   ABRE EN EL MÓVIL:  $url\n"; done
