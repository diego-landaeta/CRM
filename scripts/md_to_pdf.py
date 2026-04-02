#!/usr/bin/env python3
"""Convert 07-tareas-jira.md to a professional PDF."""

import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Colors
PRIMARY = HexColor('#1e3a5f')
ACCENT = HexColor('#e74c3c')
LIGHT_BG = HexColor('#f0f4f8')
BORDER = HexColor('#d1d5db')
GREEN = HexColor('#16a34a')
BLUE = HexColor('#2563eb')
ORANGE = HexColor('#ea580c')
PURPLE = HexColor('#7c3aed')
GRAY = HexColor('#6b7280')
DARK = HexColor('#1f2937')
WHITE = white

def build_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        'DocTitle', parent=styles['Title'],
        fontSize=24, textColor=PRIMARY, spaceAfter=6,
        alignment=TA_CENTER, leading=30
    ))
    styles.add(ParagraphStyle(
        'DocSubtitle', parent=styles['Normal'],
        fontSize=11, textColor=GRAY, alignment=TA_CENTER,
        spaceAfter=20, leading=14
    ))
    styles.add(ParagraphStyle(
        'PhaseTitle', parent=styles['Heading1'],
        fontSize=18, textColor=WHITE, spaceBefore=20,
        spaceAfter=10, leading=24, backColor=PRIMARY,
        borderPadding=(8, 12, 8, 12)
    ))
    styles.add(ParagraphStyle(
        'EpicTitle', parent=styles['Heading2'],
        fontSize=14, textColor=PRIMARY, spaceBefore=16,
        spaceAfter=8, leading=18, borderWidth=0,
        leftIndent=0
    ))
    styles.add(ParagraphStyle(
        'StoryTitle', parent=styles['Heading3'],
        fontSize=11, textColor=DARK, spaceBefore=10,
        spaceAfter=4, leading=14, leftIndent=0
    ))
    styles.add(ParagraphStyle(
        'StoryMeta', parent=styles['Normal'],
        fontSize=9, textColor=GRAY, leading=13,
        leftIndent=10, spaceAfter=2
    ))
    styles.add(ParagraphStyle(
        'AC', parent=styles['Normal'],
        fontSize=9, textColor=DARK, leading=13,
        leftIndent=20, spaceAfter=1
    ))
    styles.add(ParagraphStyle(
        'TechNote', parent=styles['Normal'],
        fontSize=8, textColor=GRAY, leading=11,
        leftIndent=10, spaceAfter=6, fontName='Helvetica-Oblique'
    ))
    styles.add(ParagraphStyle(
        'TableCell', parent=styles['Normal'],
        fontSize=8, leading=11, textColor=DARK
    ))
    styles.add(ParagraphStyle(
        'TableHeader', parent=styles['Normal'],
        fontSize=8, leading=11, textColor=WHITE,
        fontName='Helvetica-Bold'
    ))
    styles.add(ParagraphStyle(
        'InfoText', parent=styles['Normal'],
        fontSize=10, textColor=DARK, leading=14,
        spaceAfter=4
    ))
    return styles


def parse_md(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    return content


def badge(text, color):
    return f'<font color="{color}"><b>{text}</b></font>'


def build_pdf(md_path, pdf_path):
    styles = build_styles()

    doc = SimpleDocTemplate(
        pdf_path, pagesize=A4,
        leftMargin=1.5*cm, rightMargin=1.5*cm,
        topMargin=2*cm, bottomMargin=2*cm
    )

    story = []
    content = parse_md(md_path)
    lines = content.split('\n')

    # --- COVER ---
    story.append(Spacer(1, 3*cm))
    story.append(Paragraph('CRM MultiProyecto', styles['DocTitle']))
    story.append(Paragraph('Tareas Jira - Plan de Desarrollo', styles['DocSubtitle']))
    story.append(Spacer(1, 1*cm))

    # Info box
    info_data = [
        [Paragraph('<b>Proyecto</b>', styles['TableCell']), Paragraph('CRM MultiProyecto', styles['TableCell'])],
        [Paragraph('<b>Equipo</b>', styles['TableCell']), Paragraph('Diego + Angel (fullstack)', styles['TableCell'])],
        [Paragraph('<b>Total</b>', styles['TableCell']), Paragraph('15 Epics, ~97 Stories', styles['TableCell'])],
        [Paragraph('<b>Duracion</b>', styles['TableCell']), Paragraph('6 - 9.5 semanas', styles['TableCell'])],
        [Paragraph('<b>Metodologia</b>', styles['TableCell']), Paragraph('Scrum con sprints semanales', styles['TableCell'])],
    ]
    info_table = Table(info_data, colWidths=[4*cm, 10*cm])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), LIGHT_BG),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(info_table)

    story.append(Spacer(1, 1*cm))

    # Legend
    legend_data = [
        [Paragraph('<b>Campo</b>', styles['TableHeader']), Paragraph('<b>Descripcion</b>', styles['TableHeader'])],
        [Paragraph('Tipo', styles['TableCell']), Paragraph('Backend / Frontend / Fullstack / Config / QA', styles['TableCell'])],
        [Paragraph('Story points', styles['TableCell']), Paragraph('Fibonacci: 1, 2, 3, 5, 8', styles['TableCell'])],
        [Paragraph('AC', styles['TableCell']), Paragraph('Criterios de aceptacion (todos deben cumplirse)', styles['TableCell'])],
    ]
    legend_table = Table(legend_data, colWidths=[3*cm, 11*cm])
    legend_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
    ]))
    story.append(legend_table)
    story.append(PageBreak())

    # --- PARSE STORIES ---
    i = 0
    current_phase = None

    while i < len(lines):
        line = lines[i].strip()

        # Phase headers
        if line.startswith('# FASE') or (line.startswith('# ') and 'FASE' in line.upper() and 'Core' in line or 'Integraciones' in line or 'Avanzadas' in line if line.startswith('# ') else False):
            pass

        if re.match(r'^# FASE \d', line) or (line.startswith('# ') and ('Core CRM' in line or 'Integraciones' in line or 'Avanzadas' in line)):
            phase_text = line.replace('# ', '').strip()
            # Phase banner
            phase_data = [[Paragraph(f'<b>{phase_text}</b>', styles['TableHeader'])]]
            phase_table = Table(phase_data, colWidths=[17*cm])
            phase_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), PRIMARY),
                ('TEXTCOLOR', (0, 0), (-1, -1), WHITE),
                ('PADDING', (0, 0), (-1, -1), 10),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ]))
            story.append(Spacer(1, 8))
            story.append(phase_table)
            story.append(Spacer(1, 8))
            i += 1
            continue

        # Epic headers
        if line.startswith('## EPIC:'):
            epic_text = line.replace('## ', '').strip()
            story.append(Spacer(1, 6))
            story.append(HRFlowable(width='100%', thickness=1, color=PRIMARY))
            story.append(Paragraph(epic_text, styles['EpicTitle']))

            # Read epic metadata (next few lines)
            j = i + 1
            meta_lines = []
            while j < len(lines) and not lines[j].strip().startswith('###') and not lines[j].strip().startswith('## ') and not lines[j].strip().startswith('# '):
                ml = lines[j].strip()
                if ml.startswith('**') and ':**' in ml:
                    ml = ml.replace('**', '')
                    meta_lines.append(ml)
                j += 1

            if meta_lines:
                meta_text = ' | '.join(meta_lines)
                story.append(Paragraph(meta_text, styles['StoryMeta']))

            i = j
            continue

        # Story headers
        if line.startswith('### [F'):
            story_id_match = re.match(r'### \[(F\d+-\d+)\]\s*(.*)', line)
            if story_id_match:
                story_id = story_id_match.group(1)
                story_name = story_id_match.group(2)

                # Collect story details
                assigned = ''
                tipo = ''
                points = ''
                acs = []
                tech_note = ''

                j = i + 1
                while j < len(lines):
                    sl = lines[j].strip()
                    if sl.startswith('### [F') or sl.startswith('## EPIC') or sl.startswith('# FASE') or sl.startswith('# '):
                        break
                    if sl.startswith('- **Asignado a:**'):
                        assigned = sl.replace('- **Asignado a:**', '').strip()
                    elif sl.startswith('- **Tipo:**'):
                        tipo = sl.replace('- **Tipo:**', '').strip()
                    elif sl.startswith('- **Story points:**'):
                        points = sl.replace('- **Story points:**', '').strip()
                    elif sl.startswith('- [ ]') or sl.startswith('  - [ ]'):
                        ac_text = sl.replace('- [ ]', '').strip()
                        acs.append(ac_text)
                    elif sl.startswith('- **Notas tecnicas:**'):
                        tech_note = sl.replace('- **Notas tecnicas:**', '').strip()
                    j += 1

                # Build story block
                elements = []

                # Story title with ID badge
                color_map = {'Diego': '#2563eb', 'Angel': '#7c3aed', 'Ambos': '#16a34a'}
                assign_color = color_map.get(assigned, '#6b7280')

                title_text = f'<b>[{story_id}]</b> {story_name}'
                elements.append(Paragraph(title_text, styles['StoryTitle']))

                # Meta row as mini table
                meta_parts = []
                if assigned:
                    meta_parts.append(f'<font color="{assign_color}"><b>{assigned}</b></font>')
                if tipo:
                    meta_parts.append(f'Tipo: {tipo}')
                if points:
                    meta_parts.append(f'SP: <b>{points}</b>')

                if meta_parts:
                    elements.append(Paragraph(' &nbsp;|&nbsp; '.join(meta_parts), styles['StoryMeta']))

                # ACs
                if acs:
                    elements.append(Paragraph('<b>Criterios de aceptacion:</b>', styles['StoryMeta']))
                    for ac in acs:
                        elements.append(Paragraph(f'&#9744; {ac}', styles['AC']))

                # Tech notes
                if tech_note:
                    elements.append(Paragraph(f'Nota: {tech_note}', styles['TechNote']))

                elements.append(Spacer(1, 4))

                story.append(KeepTogether(elements))
                i = j
                continue

        # Summary tables at end
        if line.startswith('## Resumen') or line.startswith('## Calendario') or line.startswith('## Story Points'):
            story.append(Spacer(1, 10))
            story.append(HRFlowable(width='100%', thickness=1, color=PRIMARY))
            title_text = line.replace('## ', '').strip()
            story.append(Paragraph(f'<b>{title_text}</b>', styles['EpicTitle']))

            # Look for table
            j = i + 1
            table_rows = []
            while j < len(lines):
                tl = lines[j].strip()
                if tl.startswith('|') and '---' not in tl:
                    cells = [c.strip() for c in tl.split('|')[1:-1]]
                    table_rows.append(cells)
                elif tl.startswith('## ') or tl.startswith('# '):
                    break
                j += 1

            if table_rows:
                # Build table
                header = table_rows[0]
                data_rows = table_rows[1:]

                col_count = len(header)
                col_width = 17*cm / col_count

                pdf_data = []
                pdf_data.append([Paragraph(f'<b>{h}</b>', styles['TableHeader']) for h in header])
                for row in data_rows:
                    while len(row) < col_count:
                        row.append('')
                    pdf_data.append([Paragraph(str(c).replace('**', ''), styles['TableCell']) for c in row])

                t = Table(pdf_data, colWidths=[col_width]*col_count)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
                    ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
                    ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('PADDING', (0, 0), (-1, -1), 5),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                ]))
                story.append(t)
                story.append(Spacer(1, 8))

            i = j
            continue

        i += 1

    # Footer function
    def add_footer(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 7)
        canvas.setFillColor(GRAY)
        canvas.drawString(1.5*cm, 1*cm, 'CRM MultiProyecto — Tareas Jira — Confidencial')
        canvas.drawRightString(A4[0] - 1.5*cm, 1*cm, f'Pagina {doc.page}')
        canvas.restoreState()

    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    print(f'PDF generado: {pdf_path}')


if __name__ == '__main__':
    md_path = r'c:\Users\molin\Downloads\Proyectos T\CRM\docs\07-tareas-jira.md'
    pdf_path = r'c:\Users\molin\Downloads\Proyectos T\CRM\docs\07-tareas-jira.pdf'
    build_pdf(md_path, pdf_path)
