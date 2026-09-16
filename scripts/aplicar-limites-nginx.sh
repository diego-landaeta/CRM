#!/usr/bin/env bash
#
# Aplica los limites de Nginx del CRM en el VPS. Tarea #77.
#
# EL PROBLEMA QUE RESUELVE
#   Una gestora no puede mandar un dossier de 1,4 MB: sale «Error 413». No es
#   del CRM —multer acepta 16 MB— sino de Nginx, cuyo `client_max_body_size` por
#   defecto es 1 MB. La peticion se rechaza antes de llegar a Node, asi que en
#   los registros de la aplicacion no aparece nada.
#
# QUIEN LO EJECUTA
#   Quien tenga acceso al VPS (187.124.128.126), como root o con sudo.
#   Desde la raiz del repo ya desplegado, o copiando este script y nginx/crm.conf.
#
# QUE HACE
#   1. Comprueba que el fichero de limites existe y que Nginx esta instalado.
#   2. Guarda una copia de seguridad fechada de lo que haya.
#   3. Instala el snippet y lo incluye en el server{} del CRM si no estaba.
#   4. `nginx -t` ANTES de recargar. Si falla, deshace y no recarga.
#
# NO reinicia Nginx: recarga. Un reinicio corta las conexiones en curso; una
# recarga levanta procesos nuevos y deja terminar a los viejos.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ORIGEN="$RAIZ/nginx/crm.conf"
DESTINO="/etc/nginx/snippets/crm-limites.conf"
SELLO="$(date +%Y%m%d-%H%M%S)"

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }

[ -f "$ORIGEN" ] || { rojo "No encuentro $ORIGEN"; exit 1; }
command -v nginx >/dev/null || { rojo "Nginx no esta instalado aqui"; exit 1; }
[ "$(id -u)" -eq 0 ] || { rojo "Hay que ejecutarlo como root (sudo)"; exit 1; }

# El sitio del CRM. Si el nombre no coincide, se pasa como primer argumento.
SITIO="${1:-/etc/nginx/sites-available/360crm.tech}"
[ -f "$SITIO" ] || { rojo "No encuentro el sitio $SITIO — pasalo como argumento"; exit 1; }

echo "Sitio:   $SITIO"
echo "Snippet: $DESTINO"
echo

# ── 1. Copia de seguridad ────────────────────────────────────────────────────
cp -a "$SITIO" "$SITIO.bak-$SELLO"
[ -f "$DESTINO" ] && cp -a "$DESTINO" "$DESTINO.bak-$SELLO"
verde "Copia guardada: $SITIO.bak-$SELLO"

deshacer() {
  rojo "Deshaciendo..."
  cp -a "$SITIO.bak-$SELLO" "$SITIO"
  [ -f "$DESTINO.bak-$SELLO" ] && cp -a "$DESTINO.bak-$SELLO" "$DESTINO" || rm -f "$DESTINO"
  rojo "Restaurado. Nginx NO se ha recargado, sigue con la configuracion de antes."
}

# ── 2. Instalar el snippet ───────────────────────────────────────────────────
mkdir -p /etc/nginx/snippets
install -m 644 "$ORIGEN" "$DESTINO"

# ── 3. Incluirlo en el server{}, si no estaba ────────────────────────────────
if grep -q 'crm-limites.conf' "$SITIO"; then
  echo "El include ya estaba en el sitio, no se toca."
else
  # Tras la PRIMERA linea `server {`. Con `0,/.../` para no repetirlo en cada
  # bloque: un sitio con redireccion de HTTP a HTTPS tiene dos.
  sed -i '0,/^\s*server\s*{/s//&\n    include snippets\/crm-limites.conf;/' "$SITIO"
  grep -q 'crm-limites.conf' "$SITIO" || { rojo "No pude anadir el include"; deshacer; exit 1; }
  verde "Include anadido."
fi

# ── 4. Validar ANTES de recargar ─────────────────────────────────────────────
echo
echo "Validando configuracion..."
if ! nginx -t; then
  rojo "La configuracion NO es valida."
  deshacer
  exit 1
fi
verde "Configuracion valida."

systemctl reload nginx
verde "Nginx recargado."

# ── 5. Comprobar que el limite es el que se queria ───────────────────────────
echo
echo "Limite efectivo:"
nginx -T 2>/dev/null | grep -n 'client_max_body_size' || rojo "No aparece client_max_body_size — revisalo a mano"

cat <<'FIN'

Para comprobarlo de verdad, desde el CRM: mandar un dossier de mas de 1 MB por
WhatsApp. Antes daba 413 sin llegar a Node; ahora tiene que salir.

Si algo va mal:
  cp -a /etc/nginx/sites-available/360crm.tech.bak-<sello> /etc/nginx/sites-available/360crm.tech
  nginx -t && systemctl reload nginx
FIN
