"""
Generador de PDF: Estado del Proyecto CRM MultiProyecto
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from datetime import datetime
import os

# --- Colores ---
PRIMARY = HexColor('#1e40af')       # azul oscuro
PRIMARY_LIGHT = HexColor('#dbeafe') # azul claro fondo
ACCENT = HexColor('#059669')        # verde
ACCENT_LIGHT = HexColor('#d1fae5')
WARNING = HexColor('#d97706')       # naranja
WARNING_LIGHT = HexColor('#fef3c7')
DANGER = HexColor('#dc2626')
GRAY_50 = HexColor('#f9fafb')
GRAY_100 = HexColor('#f3f4f6')
GRAY_200 = HexColor('#e5e7eb')
GRAY_500 = HexColor('#6b7280')
GRAY_700 = HexColor('#374151')
GRAY_900 = HexColor('#111827')

OUTPUT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'docs', 'estado-proyecto-crm.pdf')

def build_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        'DocTitle', parent=styles['Title'],
        fontSize=22, leading=26, textColor=PRIMARY,
        spaceAfter=4, alignment=TA_LEFT,
    ))
    styles.add(ParagraphStyle(
        'DocSubtitle', parent=styles['Normal'],
        fontSize=11, leading=14, textColor=GRAY_500,
        spaceAfter=16,
    ))
    styles.add(ParagraphStyle(
        'SectionTitle', parent=styles['Heading1'],
        fontSize=15, leading=20, textColor=PRIMARY,
        spaceBefore=18, spaceAfter=8,
        borderPadding=(0, 0, 4, 0),
    ))
    styles.add(ParagraphStyle(
        'SubSection', parent=styles['Heading2'],
        fontSize=12, leading=16, textColor=GRAY_900,
        spaceBefore=12, spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        'BodyText2', parent=styles['Normal'],
        fontSize=9.5, leading=14, textColor=GRAY_700,
        alignment=TA_JUSTIFY, spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        'BulletItem', parent=styles['Normal'],
        fontSize=9.5, leading=14, textColor=GRAY_700,
        leftIndent=14, bulletIndent=0, spaceAfter=3,
    ))
    styles.add(ParagraphStyle(
        'SmallGray', parent=styles['Normal'],
        fontSize=8, leading=10, textColor=GRAY_500,
    ))
    styles.add(ParagraphStyle(
        'CodeBlock', parent=styles['Normal'],
        fontSize=8.5, leading=12, textColor=GRAY_900,
        fontName='Courier', leftIndent=8,
        backColor=GRAY_50, borderPadding=6,
        spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        'TableCell', parent=styles['Normal'],
        fontSize=8.5, leading=12, textColor=GRAY_700,
    ))
    styles.add(ParagraphStyle(
        'TableHeader', parent=styles['Normal'],
        fontSize=8.5, leading=12, textColor=white,
        fontName='Helvetica-Bold',
    ))
    styles.add(ParagraphStyle(
        'FooterText', parent=styles['Normal'],
        fontSize=7.5, leading=10, textColor=GRAY_500,
        alignment=TA_CENTER,
    ))
    return styles


def header_footer(canvas_obj, doc):
    canvas_obj.saveState()
    w, h = A4

    # Header line
    canvas_obj.setStrokeColor(PRIMARY)
    canvas_obj.setLineWidth(1.5)
    canvas_obj.line(20*mm, h - 18*mm, w - 20*mm, h - 18*mm)
    canvas_obj.setFont('Helvetica-Bold', 8)
    canvas_obj.setFillColor(PRIMARY)
    canvas_obj.drawString(20*mm, h - 16*mm, 'CRM MultiProyecto')
    canvas_obj.setFont('Helvetica', 8)
    canvas_obj.setFillColor(GRAY_500)
    canvas_obj.drawRightString(w - 20*mm, h - 16*mm, 'Estado del Proyecto — Abril 2026')

    # Footer
    canvas_obj.setStrokeColor(GRAY_200)
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(20*mm, 14*mm, w - 20*mm, 14*mm)
    canvas_obj.setFont('Helvetica', 7.5)
    canvas_obj.setFillColor(GRAY_500)
    canvas_obj.drawString(20*mm, 10*mm, 'Documento generado automaticamente — Confidencial')
    canvas_obj.drawRightString(w - 20*mm, 10*mm, f'Pagina {doc.page}')

    canvas_obj.restoreState()


def make_status_badge(text, color, bg):
    return f'<font color="{color.hexval()}">{text}</font>'


def make_table(headers, rows, col_widths, styles_ref):
    header_row = [Paragraph(h, styles_ref['TableHeader']) for h in headers]
    data = [header_row]
    for row in rows:
        data.append([Paragraph(str(c), styles_ref['TableCell']) for c in row])

    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTSIZE', (0, 0), (-1, 0), 8.5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, GRAY_50]),
        ('GRID', (0, 0), (-1, -1), 0.5, GRAY_200),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return t


def build_pdf():
    s = build_styles()
    doc = SimpleDocTemplate(
        OUTPUT_PATH, pagesize=A4,
        topMargin=22*mm, bottomMargin=20*mm,
        leftMargin=20*mm, rightMargin=20*mm,
    )
    story = []
    usable = doc.width

    # ===================== PORTADA =====================
    story.append(Spacer(1, 30*mm))
    story.append(Paragraph('CRM MultiProyecto', s['DocTitle']))
    story.append(Paragraph('Estado del Proyecto y Proximos Pasos', ParagraphStyle(
        'BigSub', parent=s['DocSubtitle'], fontSize=14, textColor=GRAY_700, spaceAfter=8,
    )))
    story.append(HRFlowable(width='100%', thickness=1.5, color=PRIMARY, spaceAfter=12))
    story.append(Paragraph(f'Fecha: 1 de abril de 2026', s['DocSubtitle']))
    story.append(Paragraph('Equipo: Manuel Casas (Product Owner) · Diego (Fullstack) · Angel (Fullstack)', s['DocSubtitle']))
    story.append(Paragraph('Repo: github.com/esos2dev-oss/crm-multiproyecto · Jira: seo-iseie.atlassian.net', s['DocSubtitle']))
    story.append(Spacer(1, 10*mm))

    # Resumen ejecutivo
    story.append(Paragraph('Resumen Ejecutivo', s['SectionTitle']))
    story.append(Paragraph(
        'CRM interno multi-proyecto para la gestion integral de leads, conversiones, pagos, campanas publicitarias '
        '(Meta + Google Ads), trafico organico (GSC), metricas SaaS (Stripe) y reportes generados con IA (Claude). '
        'Gestiona 6 proyectos: 3 educativos (Psiko Aprende, ISEIH, Fono Aprende) y 3 plataformas IA '
        '(Psicologo IA, Nutricionista IA, Tarot IA).', s['BodyText2']
    ))
    story.append(Spacer(1, 4))

    # Stack resumido
    stack_data = [
        ['Frontend', 'React 18 + Vite + shadcn/ui (Radix + Tailwind CSS) — SPA en /crm'],
        ['Backend', 'Node.js + Express — API REST puerto 3001 — Arquitectura modular'],
        ['Base de datos', 'PostgreSQL 16 — SQL directo con pg Pool (sin ORM)'],
        ['Storage', 'Cloudflare R2 (compatible S3) — Dossiers PDF con pre-signed URLs'],
        ['Servidor', 'VPS Hostinger (KVM) — Nginx + PM2 + HTTPS (Let\'s Encrypt)'],
        ['Email', 'Brevo API v3 — Notificaciones leads, bienvenida, alertas de pago'],
        ['APIs Fase 2', 'Meta Marketing API v19+, Google Ads v16+, GSC, Stripe, Claude AI'],
    ]
    story.append(make_table(['Capa', 'Tecnologia'], stack_data, [usable*0.18, usable*0.82], s))
    story.append(PageBreak())

    # ===================== ARQUITECTURA MODULAR =====================
    story.append(Paragraph('1. Arquitectura Modular', s['SectionTitle']))
    story.append(Paragraph(
        'El proyecto esta organizado por <b>modulos de dominio</b>. Cada modulo (auth, users, leads, products, dossiers) '
        'contiene todo su codigo: routes, controller, service, model y validation. El codigo compartido '
        '(middleware, config, utils) esta en <b>shared/</b>. Esto permite que Diego y Angel trabajen en paralelo sin conflictos de merge.',
        s['BodyText2']
    ))
    story.append(Spacer(1, 4))

    story.append(Paragraph('Backend: backend/src/', s['SubSection']))
    story.append(Paragraph(
        'modules/products/ &nbsp;&nbsp; product.routes.js · product.controller.js · product.service.js · product.model.js · product.validation.js · index.js<br/>'
        'modules/dossiers/ &nbsp;&nbsp; dossier.routes.js · dossier.controller.js · dossier.service.js · dossier.model.js · dossier.validation.js · index.js<br/>'
        'modules/auth/ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; index.js (placeholder Diego)<br/>'
        'modules/users/ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; index.js (placeholder Diego)<br/>'
        'modules/leads/ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; index.js (placeholder Diego)<br/>'
        'shared/config/ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; db.js (pg pool) · r2.js (S3 client)<br/>'
        'shared/middleware/ &nbsp; auth.js · roleGuard · projectAccess · errorHandler · upload<br/>'
        'shared/services/ &nbsp;&nbsp;&nbsp; r2.service.js (upload/delete R2)<br/>'
        'shared/utils/ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; AppError.js · logger.js · presignedUrl.js<br/>'
        'app.js &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Express setup + registro automatico de modulos',
        s['CodeBlock']
    ))

    story.append(Paragraph('Frontend: frontend/src/', s['SubSection']))
    story.append(Paragraph(
        'modules/products/ &nbsp;&nbsp; api/ · hooks/ · components/ · pages/<br/>'
        'shared/api/ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; client.js (axios + interceptors JWT refresh)<br/>'
        'shared/components/ui/ &nbsp;9 primitivas shadcn/ui (Button, Dialog, Table, Badge...)<br/>'
        'shared/hooks/ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; useProject.js<br/>'
        'shared/lib/ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; utils.js (cn helper)<br/>'
        'shared/pages/ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; LoginPage, DashboardPage<br/>'
        'App.jsx &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Router con lazy loading por modulo',
        s['CodeBlock']
    ))

    story.append(Paragraph(
        'Cada modulo backend exporta <b>{ prefix, router }</b> en su index.js. '
        'app.js los recorre en un loop y los registra con <b>app.use(mod.prefix, mod.router)</b>. '
        'Para anadir un nuevo modulo basta crear la carpeta, implementar los 5 archivos, y anadirlo al array.',
        s['BodyText2']
    ))
    story.append(PageBreak())

    # ===================== TICKETS COMPLETADOS =====================
    story.append(Paragraph('2. Tickets Implementados (Fase 1 — Angel)', s['SectionTitle']))
    story.append(Paragraph(
        'Se completaron 8 tickets de la Subfase 1.1 (Setup) y Subfase 1.3 (Productos + Dossiers). '
        'Todos los criterios de aceptacion estan cubiertos.',
        s['BodyText2']
    ))

    tickets_done = [
        ['CRM-30\nF1-006', 'Config', '2', 'Init repo + estructura carpetas + .gitignore',
         '.gitignore (con uploads/), package.json backend/frontend, .env.example, app.js, vite.config.js, tailwind.config.js, ecosystem.config.js, db.js, logger.js, AppError.js, errorHandler.js, axios client con refresh, React Router con lazy loading'],
        ['CRM-28\nF1-004', 'Config', '2', 'Cloudflare R2: bucket + SDK',
         'S3Client configurado para R2, r2.service.js (upload/delete), presignedUrl.js (15min expiry via getSignedUrl)'],
        ['CRM-44\nF1-020', 'Backend', '1', 'Schema DB: products, dossiers',
         'Migracion SQL 002: tablas products y dossiers, FK a projects/users, UNIQUE parcial (project_id, nombre) WHERE active, indices en product_id'],
        ['CRM-45\nF1-021', 'Backend', '3', 'CRUD productos por proyecto',
         'Model (6 queries), Zod validation, Service (duplicados, acceso proyecto), Controller, Routes con verifyToken + roleGuard + projectAccess. Solo admin/SA crean/editan'],
        ['CRM-46\nF1-022', 'Backend', '5', 'Upload PDF a R2 uuid+timestamp',
         'Multer memoryStorage (20MB), doble validacion MIME (extension + magic bytes %PDF), key: dossiers/{projectId}/{uuid}-{ts}.pdf, registro en DB con size_bytes'],
        ['CRM-47\nF1-023', 'Backend', '3', 'Pre-signed URL (15min, auth)',
         'GET /dossiers/:id/url, verifica acceso al proyecto via producto, audit log con pino, URL expira en 900s'],
        ['CRM-48\nF1-024', 'Backend', '2', 'Historial versiones dossier',
         'createNewVersion() en transaccion PG: desactiva anteriores, calcula MAX(version)+1, inserta nueva. GET history ordenado por version DESC'],
        ['CRM-49\nF1-025', 'Frontend', '3', 'Panel gestion productos',
         'ProductsPage: tabla con nombre/descripcion/dossier/estado, Dialog crear/editar con validacion, AlertDialog confirmacion desactivar, Badge "Sin dossier", hook useProducts'],
        ['CRM-50\nF1-026', 'Frontend', '5', 'Upload dossier drag&drop + versiones',
         'DossierPanel: react-dropzone (solo PDF), preview archivo antes de subir, barra progreso con %, version activa con descarga, historial en Accordion con todas las versiones'],
    ]
    story.append(make_table(
        ['Ticket', 'Tipo', 'SP', 'Titulo', 'Que se implemento'],
        tickets_done,
        [usable*0.08, usable*0.07, usable*0.04, usable*0.20, usable*0.61],
        s
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph('<b>Total Story Points completados: 26 SP</b> de los ~208 SP totales del proyecto.', s['BodyText2']))
    story.append(PageBreak())

    # ===================== ENDPOINTS IMPLEMENTADOS =====================
    story.append(Paragraph('3. Endpoints API Implementados', s['SectionTitle']))

    endpoints = [
        ['GET', '/api/health', '—', 'Health check del servidor'],
        ['GET', '/api/products?projectId=X', 'Auth + Project', 'Listar productos activos del proyecto'],
        ['GET', '/api/products/:id?projectId=X', 'Auth + Project', 'Detalle de un producto'],
        ['POST', '/api/products', 'Admin/SA + Project', 'Crear producto (nombre, descripcion)'],
        ['PATCH', '/api/products/:id?projectId=X', 'Admin/SA + Project', 'Editar producto'],
        ['DELETE', '/api/products/:id?projectId=X', 'Admin/SA + Project', 'Desactivar producto (soft delete)'],
        ['POST', '/api/dossiers/upload?projectId=X', 'Admin/SA + Project', 'Upload PDF (multipart, max 20MB)'],
        ['GET', '/api/dossiers/:id/url?projectId=X', 'Auth + Project', 'Pre-signed URL (15min)'],
        ['GET', '/api/dossiers/product/:pid/history?projectId=X', 'Auth + Project', 'Historial versiones dossier'],
    ]
    story.append(make_table(
        ['Metodo', 'Ruta', 'Auth', 'Descripcion'],
        endpoints,
        [usable*0.08, usable*0.36, usable*0.16, usable*0.40],
        s
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        '<b>Formato de respuesta estandar:</b> <font face="Courier" size="8">{ success: true, data: {...} }</font> en exito, '
        '<font face="Courier" size="8">{ success: false, error: "msg", code: "CODE" }</font> en error.',
        s['BodyText2']
    ))

    # ===================== REGLAS DE NEGOCIO =====================
    story.append(Paragraph('4. Reglas de Negocio Criticas', s['SectionTitle']))
    rules = [
        ['Autenticacion', 'JWT access 15min (header Bearer) + refresh 30d (httpOnly cookie). Cadena: verifyToken > roleGuard > projectAccess. Passwords bcrypt cost 12.'],
        ['Roles', 'Superadmin: acceso total. Admin: operativo sin gestionar usuarios. Gestor: solo proyectos asignados y sus leads.'],
        ['Aislamiento', 'Cada endpoint verifica pertenencia al proyecto via user_projects. 403 si no coincide. Superadmin bypasea.'],
        ['Round-robin', 'Asignacion en transaccion PG (BEGIN/COMMIT) con SELECT FOR UPDATE. Gestores inactivos se saltan automaticamente.'],
        ['Dossiers', 'Nueva version marca anterior como inactive (nunca se borra). Pre-signed URLs expiran en 15 min. Solo PDF validado por magic bytes.'],
        ['Duplicados', 'Deteccion por email normalizado. Siempre crear nuevo registro + vincular con lead_duplicado_de. Proyectos aislados.'],
        ['API Keys', 'Encriptadas con AES-256-GCM antes de guardar. Clave maestra en ENCRYPTION_KEY. Nunca texto plano en DB.'],
        ['CORS', 'Configurado por dominio de proyecto. Nunca wildcard (*). Lista de origenes desde DB o .env.'],
    ]
    story.append(make_table(
        ['Regla', 'Detalle'],
        rules,
        [usable*0.14, usable*0.86],
        s
    ))
    story.append(PageBreak())

    # ===================== PROXIMOS PASOS =====================
    story.append(Paragraph('5. Proximos Pasos — Fase 1 (Pendiente)', s['SectionTitle']))
    story.append(Paragraph(
        'La Fase 1 tiene 7 subfases. Se completaron la 1.1 (parcial) y 1.3 (completa). '
        'A continuacion los tickets pendientes organizados por subfase, desarrollador y prioridad.',
        s['BodyText2']
    ))

    story.append(Paragraph('5.1 Subfase 1.1 — Setup Infraestructura (Diego)', s['SubSection']))
    setup_pending = [
        ['F1-001', 'Diego', '3', 'Instalar Node.js LTS, PostgreSQL 16, PM2 en VPS'],
        ['F1-002', 'Diego', '5', 'Nginx: /crm + /crm/api + HTTPS + SPA fallback'],
        ['F1-003', 'Diego', '2', 'PM2 ecosystem.config.js + arranque automatico'],
        ['F1-005', 'Diego', '3', 'Brevo: verificar dominio + crear 4 templates email'],
        ['F1-007', 'Ambos', '3', 'Migracion SQL inicial + seed data (superadmin + 6 proyectos)'],
        ['F1-008', 'Diego', '3', 'Script backup pg_dump diario a R2 + cron'],
    ]
    story.append(make_table(
        ['Ticket', 'Asignado', 'SP', 'Descripcion'],
        setup_pending,
        [usable*0.10, usable*0.10, usable*0.06, usable*0.74],
        s
    ))
    story.append(Spacer(1, 4))

    story.append(Paragraph('5.2 Subfase 1.2 — Auth + Roles + Panel Usuarios (Diego)', s['SubSection']))
    auth_pending = [
        ['F1-009', 'Diego', '2', 'Schema DB: users, projects, user_projects'],
        ['F1-010', 'Diego', '5', 'Endpoints auth: POST login, logout, refresh'],
        ['F1-011', 'Diego', '3', 'JWT access (15min) + refresh token (30d) httpOnly cookie'],
        ['F1-012', 'Diego', '5', 'Middleware roleGuard + projectAccess (completo, no stub)'],
        ['F1-013', 'Diego', '5', 'CRUD usuarios + email bienvenida Brevo'],
        ['F1-014', 'Diego', '2', 'Endpoint set-password con token unico (24h)'],
        ['F1-015', 'Diego', '2', 'Tabla user_activity_log + registro automatico'],
        ['F1-016', 'Diego', '3', 'Frontend: pantalla login (RHF + Zod)'],
        ['F1-017', 'Diego', '5', 'Frontend: AuthContext + ProjectSelector navbar'],
        ['F1-018', 'Diego', '5', 'Frontend: panel admin usuarios (tabla + CRUD)'],
        ['F1-019', 'Diego', '2', 'Frontend: pantalla set-password desde email'],
    ]
    story.append(make_table(
        ['Ticket', 'Asignado', 'SP', 'Descripcion'],
        auth_pending,
        [usable*0.10, usable*0.10, usable*0.06, usable*0.74],
        s
    ))
    story.append(Spacer(1, 4))

    story.append(Paragraph('5.3 Subfase 1.4 — Webhook + UTMs + Round-robin (Diego)', s['SubSection']))
    webhook_pending = [
        ['F1-027', 'Diego', '2', 'Schema DB: leads, lead_utms, project_queue_state'],
        ['F1-028', 'Diego', '5', 'POST /webhooks/leads/:slug con API key (&lt;500ms)'],
        ['F1-029', 'Diego', '3', 'Parseo UTMs + deteccion canal (meta/google/chatgpt/organico)'],
        ['F1-030', 'Diego', '3', 'Deteccion duplicados por email + vinculacion'],
        ['F1-031', 'Diego', '8', 'Round-robin transaccional PG (SELECT FOR UPDATE)'],
        ['F1-032', 'Diego', '3', 'Notificacion Brevo asincrona al gestor asignado'],
        ['F1-033', 'Diego', '1', 'CORS configurado por dominio de proyecto'],
        ['F1-034', 'Diego', '1', 'Indices PG optimizados para leads'],
        ['F1-035', 'Diego', '5', 'Frontend: lista leads con filtros y paginacion server-side'],
        ['F1-036', 'Diego', '5', 'Frontend: vista pipeline por status (columnas)'],
        ['F1-037', 'Diego', '2', 'Frontend: badge duplicados + alerta inactividad'],
    ]
    story.append(make_table(
        ['Ticket', 'Asignado', 'SP', 'Descripcion'],
        webhook_pending,
        [usable*0.10, usable*0.10, usable*0.06, usable*0.74],
        s
    ))
    story.append(PageBreak())

    story.append(Paragraph('5.4 Subfase 1.5 — Ficha Lead + Historial + Seguimiento (Angel)', s['SubSection']))
    ficha_pending = [
        ['F1-038', 'Angel', '1', 'Schema DB: lead_status_history, lead_interactions, lead_reminders'],
        ['F1-039', 'Angel', '3', 'PATCH /leads/:id/status con registro en historial'],
        ['F1-040', 'Angel', '2', 'POST /leads/:id/interactions (llamada/email/whatsapp/nota)'],
        ['F1-041', 'Angel', '5', 'POST /leads/:id/reminders + cron diario 8AM Brevo'],
        ['F1-042', 'Angel', '2', 'Reasignacion manual de lead (solo Admin/SA)'],
        ['F1-043', 'Angel', '5', 'Frontend: ficha lead completa (datos + UTMs + canal)'],
        ['F1-044', 'Angel', '3', 'Frontend: selector status con confirmacion'],
        ['F1-045', 'Angel', '5', 'Frontend: timeline interacciones (scroll vertical)'],
        ['F1-046', 'Angel', '3', 'Frontend: boton dossier (preview/copiar enlace)'],
        ['F1-047', 'Angel', '2', 'Frontend: formulario recordatorio (datepicker)'],
        ['F1-048', 'Angel', '2', 'Frontend: vista historial duplicado'],
    ]
    story.append(make_table(
        ['Ticket', 'Asignado', 'SP', 'Descripcion'],
        ficha_pending,
        [usable*0.10, usable*0.10, usable*0.06, usable*0.74],
        s
    ))
    story.append(Spacer(1, 4))

    story.append(Paragraph('5.5 Subfase 1.6 — Conversiones y Pagos (Angel)', s['SubSection']))
    conv_pending = [
        ['F1-049', 'Angel', '1', 'Schema DB: conversions, conversion_payments'],
        ['F1-050', 'Angel', '3', 'Registrar conversion (auto cambia status a Convertido)'],
        ['F1-051', 'Angel', '3', 'Agregar abono parcial + recalculo pendiente'],
        ['F1-052', 'Angel', '3', 'Cron pagos vencidos + notificacion email Brevo'],
        ['F1-053', 'Angel', '5', 'Frontend: formulario conversion (al marcar Convertido)'],
        ['F1-054', 'Angel', '3', 'Frontend: dashboard pagos pendientes con alertas'],
        ['F1-055', 'Angel', '3', 'Frontend: vista ingresos por proyecto'],
    ]
    story.append(make_table(
        ['Ticket', 'Asignado', 'SP', 'Descripcion'],
        conv_pending,
        [usable*0.10, usable*0.10, usable*0.06, usable*0.74],
        s
    ))
    story.append(Spacer(1, 4))

    story.append(Paragraph('5.6 Subfase 1.7 — Dashboard + QA Integral (Ambos)', s['SubSection']))
    dash_pending = [
        ['F1-056', 'Diego', '5', 'Backend: queries dashboard leads (status/canal/temporal)'],
        ['F1-057', 'Diego', '3', 'Backend: queries dashboard ingresos'],
        ['F1-058', 'Diego', '2', 'Indices adicionales + EXPLAIN ANALYZE top 5 queries'],
        ['F1-059', 'Diego', '5', 'Frontend: dashboard leads con graficas Recharts'],
        ['F1-060', 'Diego', '3', 'Frontend: dashboard ingresos filtrable por mes'],
        ['F1-061', 'Ambos', '5', 'QA: flujo E2E webhook > lead > dossier > conversion > pagos'],
        ['F1-062', 'Ambos', '3', 'QA: multi-usuario 3 proyectos + 4 gestores'],
        ['F1-063', 'Diego', '3', 'QA: test carga 50 webhooks simultaneos'],
        ['F1-064', 'Angel', '3', 'QA: revision seguridad endpoints'],
        ['F1-065', 'Angel', '2', 'QA: verificacion responsive tablet/movil'],
    ]
    story.append(make_table(
        ['Ticket', 'Asignado', 'SP', 'Descripcion'],
        dash_pending,
        [usable*0.10, usable*0.10, usable*0.06, usable*0.74],
        s
    ))
    story.append(PageBreak())

    # ===================== RESUMEN POR FASES =====================
    story.append(Paragraph('6. Roadmap Completo — 3 Fases', s['SectionTitle']))

    phases = [
        ['Fase 1\nCore CRM', '7 epics\n65 stories', '~130 SP', 'Semanas 1-3',
         'Auth, roles, productos, dossiers, webhook leads, round-robin, UTMs, ficha lead, interacciones, recordatorios, conversiones, pagos, dashboard, QA integral'],
        ['Fase 2\nIntegraciones', '6 epics\n~22 stories', '~55 SP', 'Semanas 4-6',
         'API credentials (AES-256), Meta Marketing API (campanas + audiencias), Google Ads API, Google Search Console, Stripe (suscripciones + MRR), reportes mensuales con Claude AI + Puppeteer PDF'],
        ['Fase 3\nAvanzado', '2 epics\n~10 stories', '~23 SP', 'Semanas 7-9',
         'Custom audiences (sync Meta/Google), Lead Ads webhook directo, chat con Claude AI (SSE streaming), exportacion PDF de reportes, optimizaciones finales'],
    ]
    story.append(make_table(
        ['Fase', 'Alcance', 'SP', 'Duracion', 'Contenido'],
        phases,
        [usable*0.10, usable*0.10, usable*0.08, usable*0.12, usable*0.60],
        s
    ))
    story.append(Spacer(1, 8))

    # Progress bar visual
    story.append(Paragraph('<b>Progreso global estimado: ~12.5% (26 / 208 SP)</b>', s['BodyText2']))
    progress_data = [
        [Paragraph('<font color="#ffffff"><b>Completado (26 SP)</b></font>', s['TableCell']),
         '', '', '', '', '', ''],
    ]
    progress_t = Table(progress_data, colWidths=[usable*0.125] + [usable*0.125]*6 + [usable*0.0])
    progress_t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), ACCENT),
        ('BACKGROUND', (1, 0), (6, 0), GRAY_200),
        ('LINEBELOW', (0, 0), (-1, 0), 0, white),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('BOX', (0, 0), (-1, -1), 0.5, GRAY_200),
    ]))
    story.append(progress_t)
    story.append(Spacer(1, 12))

    # ===================== CARGA POR DESARROLLADOR =====================
    story.append(Paragraph('7. Carga por Desarrollador — Fase 1 Restante', s['SectionTitle']))

    dev_load = [
        ['Diego', '~95 SP', 'Setup VPS/Nginx/PM2, Auth completo (JWT + refresh + roles), CRUD usuarios, '
         'webhook leads, round-robin transaccional, UTMs, CORS dinamico, dashboard leads + ingresos con Recharts, '
         'QA carga 50 webhooks'],
        ['Angel', '~50 SP', 'Ficha lead (status history, interacciones, recordatorios, reasignacion), '
         'frontend ficha lead completa (timeline, dossier, datepicker), conversiones y pagos (CRUD + cron alertas), '
         'frontend pagos pendientes + ingresos, QA seguridad + responsive'],
        ['Ambos', '~11 SP', 'Migracion SQL inicial + seed data, QA E2E completo, QA multi-usuario'],
    ]
    story.append(make_table(
        ['Dev', 'SP Pendientes', 'Responsabilidades'],
        dev_load,
        [usable*0.08, usable*0.12, usable*0.80],
        s
    ))
    story.append(Spacer(1, 8))

    # ===================== ACCIONES INMEDIATAS =====================
    story.append(Paragraph('8. Acciones Inmediatas (Sprint Actual)', s['SectionTitle']))
    story.append(Paragraph(
        'Orden de ejecucion recomendado para desbloquear el trabajo paralelo lo antes posible:',
        s['BodyText2']
    ))

    actions = [
        ['1', 'Diego', 'F1-001 a F1-003', 'Setup VPS: Node.js + PG + Nginx + PM2. Bloquea todo lo demas en produccion.'],
        ['2', 'Diego', 'F1-007', 'Ejecutar migracion SQL + seed data. Angel necesita las tablas base para trabajar.'],
        ['3', 'Diego', 'F1-009 a F1-012', 'Auth completo + middleware de roles. Desbloquea todos los endpoints protegidos.'],
        ['4', 'Diego', 'F1-016 + F1-017', 'Login frontend + AuthContext + ProjectSelector. Desbloquea todo el frontend.'],
        ['5', 'Angel', 'F1-038 a F1-042', 'Ficha lead backend (status, interacciones, reminders). En paralelo con Diego #3-4.'],
        ['6', 'Angel', 'F1-043 a F1-048', 'Ficha lead frontend. Depende de que Diego tenga auth frontend listo.'],
        ['7', 'Angel', 'F1-049 a F1-055', 'Conversiones y pagos (backend + frontend).'],
        ['8', 'Diego', 'F1-027 a F1-037', 'Webhook + leads + round-robin + frontend lista leads.'],
        ['9', 'Ambos', 'F1-056 a F1-065', 'Dashboard + QA integral.'],
    ]
    story.append(make_table(
        ['#', 'Dev', 'Tickets', 'Que hacer y por que'],
        actions,
        [usable*0.04, usable*0.08, usable*0.14, usable*0.74],
        s
    ))
    story.append(PageBreak())

    # ===================== DOCUMENTACION DISPONIBLE =====================
    story.append(Paragraph('9. Documentacion Tecnica Disponible', s['SectionTitle']))
    story.append(Paragraph(
        'El repositorio incluye 7 documentos de referencia completos en <b>docs/</b> que cubren '
        'toda la especificacion del sistema. Estos son la fuente de verdad para la implementacion.',
        s['BodyText2']
    ))

    docs = [
        ['01-esquema-base-datos.md', '1514 lineas', 'Schema PG completo: 50+ tablas, enums, FKs, indices, convenciones naming'],
        ['02-estructura-proyecto.md', '876 lineas', 'Arquitectura, patrones, convenios de codigo, estructura de carpetas'],
        ['03-api-endpoints.md', '3409 lineas', 'Especificacion REST completa: todos los endpoints, params, responses, auth'],
        ['04-variables-entorno.md', '409 lineas', '50+ variables con descripcion, valores ejemplo, comandos de generacion'],
        ['05-arquitectura-frontend.md', '1485 lineas', 'Rutas, componentes, state management, shadcn/ui, Recharts'],
        ['06-despliegue-devops.md', '1044 lineas', 'VPS, Nginx, PM2, backups R2, SSL, health checks, monitoring'],
        ['07-tareas-jira.md', '1524 lineas', '15 epics, ~97 stories con SP y criterios de aceptacion detallados'],
    ]
    story.append(make_table(
        ['Documento', 'Tamano', 'Contenido'],
        docs,
        [usable*0.28, usable*0.10, usable*0.62],
        s
    ))
    story.append(Spacer(1, 8))

    # ===================== NOTAS FINALES =====================
    story.append(Paragraph('10. Variables de Entorno Requeridas', s['SectionTitle']))
    story.append(Paragraph(
        'El archivo <b>backend/.env.example</b> contiene el template completo. Variables criticas para arrancar:',
        s['BodyText2']
    ))

    env_vars = [
        ['DATABASE_URL', 'postgresql://crm_user:pass@localhost:5432/crm_db'],
        ['JWT_SECRET / JWT_REFRESH_SECRET', 'Generar con: openssl rand -hex 32'],
        ['ENCRYPTION_KEY', 'Generar con: openssl rand -hex 32 (64 chars hex)'],
        ['CLOUDFLARE_R2_*', 'Account ID + Access Key + Secret Key + Bucket name'],
        ['BREVO_API_KEY', 'API key v3 de Brevo para envio de emails'],
        ['PORT', '3001 (backend Express)'],
        ['CORS_ORIGINS', 'http://localhost:5173 (dev), https://dominio.com (prod)'],
    ]
    story.append(make_table(
        ['Variable', 'Valor / Como generar'],
        env_vars,
        [usable*0.35, usable*0.65],
        s
    ))
    story.append(Spacer(1, 12))

    story.append(HRFlowable(width='100%', thickness=1, color=GRAY_200, spaceAfter=8))
    story.append(Paragraph(
        '<i>Documento generado el 1 de abril de 2026. '
        'Para informacion actualizada consultar los documentos en docs/ y el backlog en Jira (seo-iseie.atlassian.net).</i>',
        s['SmallGray']
    ))

    # Build
    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    return OUTPUT_PATH


if __name__ == '__main__':
    path = build_pdf()
    print(f'PDF generado: {path}')
