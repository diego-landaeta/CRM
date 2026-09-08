# Escribe en ESTADO-Y-PENDIENTES.md el indice de TODAS las tareas abiertas,
# sacado de GitHub. Se puede volver a correr: reemplaza el bloque anterior.
import io, json, subprocess, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf8", errors="replace")

REPO = "diego-landaeta/CRM"
MARCA_INI = "<!-- INDICE-TAREAS -->"
MARCA_FIN = "<!-- FIN-INDICE-TAREAS -->"

r = subprocess.run(
    ["gh", "issue", "list", "--repo", REPO, "--state", "open", "--limit", "100",
     "--json", "number,title,labels,milestone,assignees"],
    capture_output=True, text=True, encoding="utf8")
tareas = json.loads(r.stdout)

DUENOS = {"angel": "Ángel", "fabian": "Fabián", "diego": "Diego", "claude": "Yo"}
ORDEN_FASES = ["Fase 1 · Desbloquear", "Fase 2 · Construir", "Fase 3 · Cerrar",
               "Fase 4 · Medir", "sin fase"]

por_fase = {}
for t in tareas:
    etiquetas = [l["name"] for l in t["labels"]]
    fase = (t.get("milestone") or {}).get("title") or "sin fase"
    duenno = next((DUENOS[e] for e in etiquetas if e in DUENOS), None)
    if not duenno:
        duenno = ", ".join(a["login"] for a in t.get("assignees", [])) or "—"
    banderas = []
    if "bloquea-a-otros" in etiquetas: banderas.append("**bloquea a otros**")
    if "necesita-sql" in etiquetas: banderas.append("lleva SQL")
    if "compartida" in etiquetas: banderas.append("compartida")
    por_fase.setdefault(fase, []).append((t["number"], t["title"], duenno, " · ".join(banderas)))

lineas = [MARCA_INI, "", "## Todas las tareas abiertas", "",
          f"Sacado de GitHub, no escrito a mano: **{len(tareas)} abiertas**. Para volver a",
          "generarlo, `scratchpad/indice_tareas.py`.", ""]

for fase in ORDEN_FASES:
    if fase not in por_fase:
        continue
    filas = sorted(por_fase[fase])
    lineas += [f"### {fase} · {len(filas)}", "",
               "| | Qué | Quién | |", "|---|---|---|---|"]
    for num, titulo, duenno, banderas in filas:
        titulo = titulo.replace("|", "·")
        lineas.append(f"| [#{num}](https://github.com/{REPO}/issues/{num}) | {titulo} | {duenno} | {banderas} |")
    lineas.append("")

lineas += ["> Las mismas tareas existen en el repositorio de ISEIE, bloqueadas con la",
           "> etiqueta `espera-multicrm`: se hacen aquí primero y se replican cuando Diego",
           "> las aprueba.", "", MARCA_FIN]
bloque = "\n".join(lineas)

for repo in ["c:/Users/Diego/Desktop/Proyectos-Carlos/CRM ISEIH",
             "c:/Users/Diego/Desktop/Proyectos-Carlos/CRM ISEIE"]:
    p = f"{repo}/docs/ESTADO-Y-PENDIENTES.md"
    s = open(p, encoding="utf8").read()
    fin = "\r\n" if "\r\n" in s else "\n"
    t = s.replace("\r\n", "\n")
    if MARCA_INI in t:
        i, j = t.index(MARCA_INI), t.index(MARCA_FIN) + len(MARCA_FIN)
        t = t[:i] + bloque + t[j:]
    else:
        t = t.rstrip() + "\n\n---\n\n" + bloque + "\n"
    open(p, "w", encoding="utf8", newline="").write(t.replace("\n", fin))
    print(f"{repo.split('/')[-1]}: indice escrito ({len(tareas)} tareas)")
