#!/bin/zsh
# Modo caja: este ordenador es el servidor de la clase. Da la app y la IA a los móviles, tablets y ordenadores
# de la misma red (wifi o cable), sin internet. Antes: Ollama abierto. Para cerrarlo: Ctrl + C.
# Si el ordenador cambia de red, la caja rehace sola su certificado para la nueva dirección.
cd "$(dirname "$0")" || exit 1
RAIZ=$PWD
CERT=$RAIZ/caja-cert
mkdir -p $CERT/descarga

# Sin ninguna red: la caja solo sirve a este mismo ordenador (para probarla sin wifi).
direccion() { ipconfig getifaddr en0 || ipconfig getifaddr en1 || echo 127.0.0.1; }

# El modo sin conexión pide https. La caja tiene su propio certificado raíz: se instala UNA vez en cada
# aparato y sigue valiendo aunque cambie la IP (el de la IP se vuelve a hacer con cada red).
if [ ! -f $CERT/ca.key ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=Mochila caja" \
    -keyout $CERT/ca.key -out $CERT/ca.crt \
    -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null || exit 1
fi
certificado_de() {
  openssl req -newkey rsa:2048 -nodes -subj "/CN=$1" -keyout $CERT/caja.key -out $CERT/caja.csr 2>/dev/null || return 1
  printf "subjectAltName=IP:$1,DNS:localhost\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n" > $CERT/ext.txt
  openssl x509 -req -in $CERT/caja.csr -CA $CERT/ca.crt -CAkey $CERT/ca.key -CAcreateserial \
    -days 397 -extfile $CERT/ext.txt -out $CERT/caja.crt 2>/dev/null
}

(cd web && npm run build) || exit 1

# Puerta de entrada sin https (puerto 8080): si el aparato ya se fía de la caja pasa solo a la app; si no,
# pide permiso para bajar el certificado y dice cómo instalarlo en ese aparato (caja-inicio.html). Todo por la red local.
cp $CERT/ca.crt $CERT/descarga/mochila-caja.crt
cp $RAIZ/caja-inicio.html $CERT/descarga/index.html
python3 -m http.server 8080 --directory $CERT/descarga > /dev/null 2>&1 &
DESCARGA=$!
API=
trap 'kill $DESCARGA $API 2>/dev/null' EXIT INT TERM

while true; do
  IP=$(direccion)
  certificado_de $IP || exit 1
  echo "\n   CAJA ENCENDIDA. En móviles, tablets y ordenadores de esta red abre:  http://$IP:8080"
  echo "   (la primera vez pide el certificado; después pasa sola a https://$IP:8443)"
  [ $IP = 127.0.0.1 ] && echo "   Sin red: de momento solo funciona en este ordenador."
  echo
  (cd api && MOCHILA_WEB=$RAIZ/web/dist exec .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8443 \
    --ssl-keyfile $CERT/caja.key --ssl-certfile $CERT/caja.crt) &
  API=$!
  # Cada 5 s: si cambia la red, se para la API y se vuelve a empezar con un certificado para la nueva dirección.
  while kill -0 $API 2>/dev/null; do
    sleep 5
    [ "$(direccion)" != "$IP" ] && { echo "\n   La red ha cambiado: rehaciendo el certificado…"; kill $API; wait $API 2>/dev/null; continue 2; }
  done
  exit 1 # la API se ha parado sola: mira el error de arriba
done
