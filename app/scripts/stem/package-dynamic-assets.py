"""Convert reviewed imagegen files to web assets, preserving alpha and source files."""
from pathlib import Path
from PIL import Image
import json,hashlib
ROOT=Path(__file__).resolve().parents[3]
GEN=Path('C:/Users/likes/.codex/generated_images/01a156f2-a097-7241-a23f-7d6c190f6d55')
OUT=ROOT/'app/public/stem/paper-bridges/dynamic'
OUT.mkdir(parents=True,exist_ok=True)
files={'hero':'exec-cac0b704-99ce-4dcd-babf-eda8d4b7d4eb.png','flat':'exec-60c1fb6f-c874-4657-b2ec-5921e2ddc9f6.png','folded':'exec-6aca0312-935f-4030-a558-b578791c1c2a.png','robot':'exec-af66c758-3bc9-4808-bbd0-abacd5cbf131.png','backdrop':'exec-67b5a311-7857-49c0-bac0-54fac1063c7c.png'}
audit=[]
for key,name in files.items():
 source=GEN/name
 im=Image.open(source)
 target=ROOT/'app/public/stem/theme/science-sky.webp' if key=='backdrop' else OUT/(key+'.webp')
 target.parent.mkdir(parents=True,exist_ok=True)
 im.save(target,quality=92,method=6)
 audit.append({'asset':str(target.relative_to(ROOT/'app/public')),'source':str(source),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'mode':im.mode,'size':im.size,'alpha':im.getextrema()[-1] if im.mode=='RGBA' else None})
(ROOT/'output/stem-paper-bridges/dynamic-artwork-audit.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')
print('Packaged',len(files),'dynamic assets')
