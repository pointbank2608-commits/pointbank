"""Inspect actual browser PDFs, then render every page for visual review."""
from pathlib import Path
import json
import subprocess
from pypdf import PdfReader
from PIL import Image, ImageOps, ImageDraw

root = Path(__file__).resolve().parents[3]
output = root / 'output' / 'phonics-stage1'
rendered = root / 'tmp' / 'phonics-stage1' / 'generated'
rendered.mkdir(parents=True, exist_ok=True)
reports, thumbs = [], []
for pdf in sorted(output.glob('*.pdf')):
    reader = PdfReader(pdf)
    expected = 8 if pdf.name == 'stage1-abc-workbook.pdf' else 1 if pdf.name == 'unit1-selected-page3.pdf' else 2 if pdf.name == 'unit1-teacher-guide.pdf' else 4
    assert len(reader.pages) == expected, (pdf.name, len(reader.pages), expected)
    for i, page in enumerate(reader.pages):
        assert abs(float(page.mediabox.width) - 595.28) < 1
        assert abs(float(page.mediabox.height) - 841.89) < 1
        text = page.extract_text()
        assert len(text) > 100, (pdf.name, i, 'empty page')
        if 'teacher' not in pdf.name:
            assert 'ClassBank' in text
            assert 'Read aloud:' not in text and 'selected' not in text
            assert 'Lesson' in text
    prefix = rendered / pdf.stem
    subprocess.run(['pdftoppm', '-scale-to', '900', '-png', str(pdf), str(prefix)], check=True, capture_output=True)
    images = sorted(rendered.glob(pdf.stem + '-*.png'))
    for img_path in images:
        im = Image.open(img_path).convert('RGB')
        small = ImageOps.contain(im, (255, 365))
        thumb = Image.new('RGB', (280, 405), '#edf1f5')
        thumb.paste(small, ((280-small.width)//2, 28))
        draw = ImageDraw.Draw(thumb)
        draw.text((8, 8), img_path.stem.replace('stage1-alphabet-', '').replace('-workbook', ''), fill='#173b5f')
        thumbs.append(thumb)
    reports.append({'file': pdf.name, 'pages': len(reader.pages), 'a4': True, 'emptyPages': 0})

for start in range(0, len(thumbs), 12):
    sheet = Image.new('RGB', (1120, 1215), 'white')
    for i, thumb in enumerate(thumbs[start:start+12]):
        sheet.paste(thumb, ((i%4)*280, (i//4)*405))
    sheet.save(output / f'print-contact-{start//12+1}.png')
(output / 'pdf-checks.json').write_text(json.dumps({'passed': True, 'files': reports, 'totalPages': len(thumbs)}, indent=2), encoding='utf8')
print(f'PASS: {len(reports)} A4 PDFs, {len(thumbs)} pages, no extra/empty pages; every page rendered.')
