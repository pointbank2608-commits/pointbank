"""Generate the two teacher manuals from their Markdown sources; no app or database access."""
from pathlib import Path
import re
from html import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs' / 'manuals'
OUT = ROOT / 'output' / 'pdf'
OUT.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Korean', 'C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('KoreanBold', 'C:/Windows/Fonts/malgunbd.ttf'))
pdfmetrics.registerFontFamily('Korean', normal='Korean', bold='KoreanBold')
NAVY = colors.HexColor('#162B49')
BLUE = colors.HexColor('#0867DB')
MUTED = colors.HexColor('#53667B')
PALE = colors.HexColor('#EDF5FF')
WIDTH, HEIGHT = A4
MARGIN = 44
TEXT_WIDTH = WIDTH - 2*MARGIN
BASE = dict(fontName='Korean', fontSize=10.6, leading=16.4, textColor=NAVY, wordWrap='CJK', spaceAfter=7)
styles = {
    'p': ParagraphStyle('body', **BASE),
    'title': ParagraphStyle('title', fontName='KoreanBold', fontSize=29, leading=36, textColor=NAVY, spaceAfter=9, wordWrap='CJK'),
    'subtitle': ParagraphStyle('subtitle', fontName='Korean', fontSize=11, leading=17, textColor=MUTED, spaceAfter=20, wordWrap='CJK'),
    'h2': ParagraphStyle('h2', fontName='KoreanBold', fontSize=17, leading=23, textColor=BLUE, spaceBefore=2, spaceAfter=13, keepWithNext=True, wordWrap='CJK'),
    'h3': ParagraphStyle('h3', fontName='KoreanBold', fontSize=12, leading=18, textColor=NAVY, spaceBefore=7, spaceAfter=7, keepWithNext=True, wordWrap='CJK'),
    'step': ParagraphStyle('step', **{**BASE, 'leftIndent':19, 'firstLineIndent':-19, 'spaceAfter':9}),
    'bullet': ParagraphStyle('bullet', **{**BASE, 'leftIndent':13, 'firstLineIndent':-13, 'spaceAfter':5}),
    'callout': ParagraphStyle('callout', **{**BASE, 'spaceAfter':0, 'fontSize':10.3, 'leading':16}),
    'cell': ParagraphStyle('cell', **{**BASE, 'fontSize':9.8, 'leading':14.8, 'spaceAfter':0}),
    'th': ParagraphStyle('th', fontName='KoreanBold', fontSize=10, leading=15, textColor=colors.white, wordWrap='CJK'),
    'note': ParagraphStyle('note', fontName='Korean', fontSize=8.5, leading=13, textColor=MUTED, wordWrap='CJK', spaceBefore=5),
}

def markup(text):
    text = escape(text)
    return re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)

def para(text, style='p'):
    return Paragraph(markup(text), styles[style])

def parse_page(text):
    story = []
    lines = text.strip().splitlines()
    i = 0
    first_title = False
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                row = [c.strip() for c in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r'[-: ]+', c) for c in row):
                    rows.append(row)
                i += 1
            widths = [TEXT_WIDTH*0.34, TEXT_WIDTH*0.66] if len(rows[0]) == 2 else [TEXT_WIDTH/len(rows[0])]*len(rows[0])
            table = Table([[para(c, 'th' if r == 0 else 'cell') for c in row] for r, row in enumerate(rows)], colWidths=widths, repeatRows=1)
            table.setStyle(TableStyle([
                ('BACKGROUND',(0,0),(-1,0),NAVY),
                ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor('#F4F7FB'),colors.white]),
                ('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),
                ('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),8),
                ('BOTTOMPADDING',(0,0),(-1,-1),8),
                ('LINEBELOW',(0,-1),(-1,-1),0.5,colors.HexColor('#D9E4EF')),
            ]))
            story.extend([table, Spacer(1,10)])
            continue
        if line.startswith('# '):
            story.append(para(line[2:], 'title'))
            first_title = True
        elif line.startswith('## '):
            story.append(para(line[3:], 'h2'))
        elif line.startswith('### '):
            story.append(para(line[4:], 'h3'))
        elif line.startswith('> '):
            box = Table([[para(line[2:], 'callout')]], colWidths=[TEXT_WIDTH])
            box.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),PALE),('BOX',(0,0),(-1,-1),0.5,colors.HexColor('#B6D6FC')),('LEFTPADDING',(0,0),(-1,-1),11),('RIGHTPADDING',(0,0),(-1,-1),11),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9)]))
            story.extend([Spacer(1,4),box,Spacer(1,10)])
        elif re.match(r'^\d+\. ',line):
            story.append(para(line,'step'))
        elif line.startswith('- '):
            story.append(para(line[2:] if line.startswith('- [ ]') else '· '+line[2:], 'bullet'))
        elif line.startswith('이 문서는 '):
            story.append(para(line,'note'))
        elif first_title:
            story.append(para(line,'subtitle'))
            first_title = False
        else:
            story.append(para(line))
        i += 1
    return story

def build(name, label):
    source = SOURCE / (name+'.md')
    pages = source.read_text(encoding='utf-8').split('<!-- PAGE -->')
    story = []
    for idx, page in enumerate(pages):
        if idx:
            story.append(PageBreak())
        story.extend(parse_page(page))
    target = OUT / (name+'.pdf')
    def chrome(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(BLUE)
        canvas.setFont('KoreanBold',10)
        canvas.drawString(MARGIN, HEIGHT-29, 'CLASSBANK')
        canvas.setFont('Korean',8)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(WIDTH-MARGIN, HEIGHT-29, '선생님 사용 안내 | 2026.10')
        canvas.setStrokeColor(colors.HexColor('#D9E4EF'))
        canvas.line(MARGIN,34,WIDTH-MARGIN,34)
        canvas.setFont('Korean',8)
        canvas.drawString(MARGIN,20,label)
        canvas.drawRightString(WIDTH-MARGIN,20,f'{doc.page} / {len(pages)}')
        canvas.restoreState()
    doc = SimpleDocTemplate(str(target), pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=53, bottomMargin=49, title=label, author='ClassBank', pageCompression=1)
    doc.build(story,onFirstPage=chrome,onLaterPages=chrome)
    reader = PdfReader(str(target))
    assert len(reader.pages)==len(pages),(name,len(reader.pages),len(pages))
    text='\n'.join(p.extract_text() or '' for p in reader.pages)
    assert label in text and '\ufffd' not in text
    print(f'{target}: {len(reader.pages)} pages, {target.stat().st_size:,} bytes')

if __name__=='__main__':
    build('수업-만들기-매뉴얼','수업 만들기')
    build('숙제-내주기-매뉴얼','숙제 내주기')
