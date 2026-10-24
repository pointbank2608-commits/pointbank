"""Compare before/after student PDFs and render print previews for visual QA."""
from pathlib import Path
import hashlib
import json
import subprocess
from PIL import Image, ImageDraw, ImageOps
from pypdf import PdfReader

root = Path(__file__).resolve().parents[3]
output = root / 'output' / 'phonics-workbook-navigation'
rendered = root / 'tmp' / 'phonics-workbook-navigation'
rendered.mkdir(parents=True, exist_ok=True)
reports, thumbs = [], []
for before in sorted(output.glob('before-*.pdf')):
    case = before.stem.removeprefix('before-')
    after = output / f'after-{case}.pdf'
    expected = 8 if case == 'stage1' else 2
    assert len(PdfReader(before).pages) == expected
    assert len(PdfReader(after).pages) == expected
    for pdf in [before, after]:
        for page in PdfReader(pdf).pages:
            assert abs(float(page.mediabox.width)-595.28) < 1
            assert abs(float(page.mediabox.height)-841.89) < 1
        subprocess.run(['pdftoppm','-scale-to','1000','-png',str(pdf),str(rendered/pdf.stem)],check=True,capture_output=True)
    for i in range(1,expected+1):
        original = Image.open(rendered/f'before-{case}-{i}.png').convert('RGB')
        current = Image.open(rendered/f'after-{case}-{i}.png').convert('RGB')
        assert original.size == current.size
        assert hashlib.sha256(original.tobytes()).digest() == hashlib.sha256(current.tobytes()).digest(), (case,i,'print pixels changed')
        tile = Image.new('RGB',(280,425),'#eef2f7')
        ImageDraw.Draw(tile).text((8,8),f'{case} p.{i}',fill='#173b5f')
        image = ImageOps.contain(current,(260,385))
        tile.paste(image,((280-image.width)//2,30))
        thumbs.append(tile)
    reports.append({'case':case,'pages':expected,'sameContent':True,'identicalPixels':True})
for start in range(0,len(thumbs),9):
    sheet = Image.new('RGB',(840,1275),'white')
    for i,tile in enumerate(thumbs[start:start+9]):
        sheet.paste(tile,((i%3)*280,(i//3)*425))
    sheet.save(output/f'print-contact-{start//9+1}.png')
(output/'pdf-checks.json').write_text(json.dumps({'passed':True,'pairs':reports,'totalFiles':len(reports)*2,'comparedPages':len(thumbs)},indent=2),encoding='utf8')
print(f'PASS: {len(reports)} workbook pairs, {len(thumbs)} pages match pixel for pixel; A4 page counts unchanged.')
