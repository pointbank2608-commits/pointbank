"""Run from repository root after baseline.mjs, render-review.mjs and check-flow.mjs."""
from pathlib import Path
import json
import subprocess
from PIL import Image, ImageChops
from pypdf import PdfReader

root = Path(__file__).resolve().parents[3]
scratch = root / 'tmp/pdfs'
expected = {
    'output/pdf/cvc-baseline.pdf': 2, 'output/pdf/long-baseline.pdf': 2,
    'output/phonics-curriculum/print/stage4-sh.pdf': 2, 'output/phonics-curriculum/print/grammar-third-person.pdf': 4,
    'tmp/pdfs/stage4-all-review.pdf': 94, 'tmp/pdfs/stage5-all-review.pdf': 62,
}
checks = []
for name, count in expected.items():
    reader = PdfReader(root / name)
    assert len(reader.pages) == count, (name, len(reader.pages), count)
    for page in reader.pages:
        assert abs(float(page.mediabox.width) - 595.28) < 2
        assert abs(float(page.mediabox.height) - 841.89) < 2
        text = page.extract_text()
        assert len(text.strip()) > 40, (name, 'blank page')
        if 'stage' in name:
            assert 'UNIT' in text
            assert '선택 유닛 인쇄' not in text and '전체 선택' not in text
    checks.append({'file': name, 'pages': count, 'a4': True, 'noBlankPages': True})
for book in ['cvc', 'long']:
    for variant in ['baseline', 'after']:
        subprocess.run(['pdftoppm', '-scale-to', '1200', '-png', str(root / (f'output/pdf/{book}-baseline.pdf' if variant == 'baseline' else f'output/phonics-curriculum/print/{book}-after.pdf')), str(scratch / f'compare-{book}-{variant}')], check=True)
    for n in [1, 2]:
        original = Image.open(scratch / f'compare-{book}-baseline-{n}.png').convert('RGB')
        current = Image.open(scratch / f'compare-{book}-after-{n}.png').convert('RGB')
        assert original.size == current.size
        assert ImageChops.difference(original, current).getbbox() is None, (book, n, 'visual regression')
grammar = PdfReader(root / 'output/phonics-curriculum/print/grammar-third-person.pdf')
for page in grammar.pages[:2]:
    text = page.extract_text()
    assert 'He likes soccer.' not in text and 'The owner is TOBI.' not in text
for page in grammar.pages[2:]:
    assert '교사용' in page.extract_text()
result = {'passed': True, 'pdfs': checks, 'cvcLongPixelDifference': 0, 'studentAnswerLeak': False}
(root / 'output/phonics-curriculum/print/pdf-checks.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps(result, ensure_ascii=False))
