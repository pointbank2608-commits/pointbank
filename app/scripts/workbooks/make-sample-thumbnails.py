"""Create card thumbnails from the verified worksheet print renders, not mock images.

Run check-activity-ui.mjs --pdf and check-activity-pdf.py --render first.
The full, editable preview still uses WorksheetActivitySheets and exampleWorksheet.
"""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[3]
report = json.loads((root / 'output/worksheet-studio/pdf-checks.json').read_text(encoding='utf-8'))
if not report['passed'] or report['worksheets'] != 81:
    raise SystemExit('A successful full worksheet PDF check is required.')
target = root / 'app/public/worksheets/samples'
target.mkdir(parents=True, exist_ok=True)
manifest = {}
for activity in report['results']:
    key = activity['id']
    source = root / f'output/worksheet-studio/rendered/{key}-student-1.png'
    image = Image.open(source).convert('RGB')
    image.thumbnail((420, 590), Image.Resampling.LANCZOS)
    image.save(target / f'{key}.webp', 'WEBP', quality=86, method=6)
    manifest[key] = {'src': f'/worksheets/samples/{key}.webp',
                     'pages': next(view['pages'] for view in activity['views'] if view['audience'] == 'student')}
module = root / 'app/src/lib/worksheetSampleThumbnails.ts'
module.write_text('/** Generated from verified student printouts; regenerate with make-sample-thumbnails.py. */\n'
                  + 'export const WORKSHEET_SAMPLE_THUMBNAILS: Record<string,{src:string;pages:number}> = '
                  + json.dumps(manifest, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
print(f'Generated {len(manifest)} real worksheet thumbnails.')
