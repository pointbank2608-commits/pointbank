"""Import reviewed image_gen outlines, preserving every existing asset."""
from pathlib import Path
import json
import argparse
from PIL import Image

root = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser()
parser.add_argument('--manifest', default='generated-lineart-cards.json')
args = parser.parse_args()
manifest = json.loads((Path(__file__).parent / args.manifest).read_text(encoding='utf-8-sig'))
data_path = root / 'app/src/data/phonics/words.json'
words = json.loads(data_path.read_text(encoding='utf-8'))
for item in manifest.get('colorCorrections', []):
    word = words[item['wordId']]
    target = root / item['destination']
    url = '/' + str(target.relative_to(root / 'app/public')).replace('\\', '/')
    assert word['word'] == item['word']
    assert word['imageUrl'] in [item['previousImageUrl'], url]
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        Image.open(item['sourcePath']).convert('RGB').resize((1024, 1024), Image.Resampling.LANCZOS).save(target, 'WEBP', quality=94, method=6)
    word['imageUrl'] = url
for item in manifest['records']:
    word = words[item['wordId']]
    assert word['word'] == item['word']
    assert word['imageUrl'] == item['colorReferenceUrl'], 'Color reference changed; review the new outline'
    target = root / item['destination']
    url = '/' + str(target.relative_to(root / 'app/public')).replace('\\', '/')
    if target.exists():
        assert word['lineartUrl'] == url, 'Never overwrite an existing unrelated asset'
        continue
    assert word['lineartUrl'] is None or item.get('replaceMismatchedReference'), 'Existing line art needs explicit review'
    target.parent.mkdir(parents=True, exist_ok=True)
    image = Image.open(item['sourcePath']).convert('RGB')
    assert image.width == image.height
    image.resize((1024, 1024), Image.Resampling.LANCZOS).save(target, 'WEBP', lossless=True, method=6)
    word['lineartUrl'] = url
    word['lineartSourceImageUrl'] = item['colorReferenceUrl']
data_path.write_text(json.dumps(words, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f"Imported/verified {len(manifest['records'])} reviewed line drawings.")
