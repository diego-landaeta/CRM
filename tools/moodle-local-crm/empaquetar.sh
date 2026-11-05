#!/bin/sh
# Genera local_crm-<versión>.zip con la carpeta raíz «crm»: es lo que pide el
# instalador de Moodle (sin el prefijo «local_», o lo rechaza). Ver README.md.
#
# Tiene que ser un ZIP de verdad. En Git Bash, `tar` es GNU tar, que con -a no
# escribe ZIP: deja un .tar con nombre .zip y Moodle responde «The file provided is
# not a valid plugin ZIP package» (pasó en el ensayo del 05/11/2026). Por eso:
# zip si está; si no, el tar de Windows (bsdtar, que sí escribe ZIP).
set -e
cd "$(dirname "$0")"
version=$(sed -n "s/.*release *= *'\([^']*\)'.*/\1/p" crm/version.php)
salida="local_crm-${version}.zip"
rm -f "$salida"
if command -v zip >/dev/null 2>&1; then
  zip -qr "$salida" crm -x '*.DS_Store'
elif [ -x "${SYSTEMROOT:-/c/Windows}/System32/tar.exe" ] || [ -x /c/Windows/System32/tar.exe ]; then
  bsdtar="${SYSTEMROOT:-C:/Windows}/System32/tar.exe"
  [ -x "$bsdtar" ] || bsdtar=/c/Windows/System32/tar.exe
  "$bsdtar" -a -c -f "$salida" crm
else
  echo "Hace falta «zip» (o, en Windows, su tar.exe) para generar el ZIP." >&2
  exit 1
fi
# Comprobación: un ZIP empieza por «PK».
[ "$(head -c 2 "$salida")" = "PK" ] || { echo "«$salida» no es un ZIP" >&2; exit 1; }
echo "$salida"
