"""일상 대화 개별수업 그림(PNG, 구글 AI로 만든 것)을 WebP 로 줄여 app/public/solo-images/talk/ 에 둔다.
   사용: python app/scripts/solo/convert-talk-images.py
   만드는 쪽: ASPECT=4:3 node app/scripts/vocab/gemini-image.mjs <jobs.json> app/scripts/vocab/out/solo-talk
"""
import os
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
src = os.path.normpath(os.path.join(here, '..', 'vocab', 'out', 'solo-talk'))
dst = os.path.normpath(os.path.join(here, '..', '..', 'public', 'solo-images', 'talk'))
os.makedirs(dst, exist_ok=True)
n = 0
for f in sorted(os.listdir(src)):
    if not f.endswith('.png'):
        continue
    out = os.path.join(dst, f[:-4] + '.webp')
    im = Image.open(os.path.join(src, f)).convert('RGB')
    if im.width > 960:
        im = im.resize((960, round(im.height * 960 / im.width)), Image.LANCZOS)
    im.save(out, 'WEBP', quality=82, method=6)
    n += 1
print('converted', n)
