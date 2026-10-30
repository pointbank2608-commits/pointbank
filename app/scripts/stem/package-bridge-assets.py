"""Package reviewed generated artwork and extract vocabulary close-ups; no redraws."""
import hashlib,json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[3]
GEN=Path('C:/Users/likes/.codex/generated_images/01a156f2-a097-7241-a23f-7d6c190f6d55')
OUT=ROOT/'app/public/stem/paper-bridges'
OUT.mkdir(parents=True,exist_ok=True)
files={
 'hero':'exec-b4cf1dbc-32a6-4060-b2c9-3649167068e3.png',
 'flat':'exec-3bfea7ff-a633-4e63-b166-e7013d6c3a76.png',
 'folded':'exec-af4e3d25-8aff-40df-8bb9-6567af131b02.png',
 'fold':'exec-476feae2-81d6-4db0-a7d6-710ad17792b4.png',
 'materials':'exec-d2a513b9-fef0-46cb-88a4-b2baa7ca63bd.png',
 'predict':'exec-f1a781e0-5768-46f3-9100-1f4d82e09bd4.png',
 'observe':'exec-26e5a6e7-6d43-4617-8b73-6ebd387d0866.png',
}
audit=[]
for key,name in files.items():
 source=GEN/name
 im=Image.open(source).convert('RGB')
 im.save(OUT/(key+'.webp'),quality=91,method=6)
 audit.append({'asset':key+'.webp','source':str(source),'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'operation':'format conversion only'})
# Same-meaning common vocabulary pictures from the original lesson.
for key,n in [('coin',3)]:
 source=ROOT/f'app/public/stem/surface-tension/word-{n}.png'
 Image.open(source).convert('RGB').save(OUT/(key+'.webp'),quality=92,method=6)
 audit.append({'asset':key+'.webp','source':str(source.relative_to(ROOT)),'operation':'reuse same meaning, format conversion'})
# Paper-only close-up from the generated materials illustration, original pixels.
im=Image.open(GEN/files['materials'])
im.crop((30,490,980,930)).save(OUT/'paper.webp',quality=92,method=6)
audit.append({'asset':'paper.webp','source':files['materials'],'crop':[30,490,980,930]})
target=ROOT/'output/stem-paper-bridges'
target.mkdir(parents=True,exist_ok=True)
(target/'artwork-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
print('Packaged',len(audit),'assets')
