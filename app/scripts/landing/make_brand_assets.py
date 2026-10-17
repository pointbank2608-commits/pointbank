"""브랜드 로고 자산 만들기(2026-10-17) — 사용자가 준 로고 PNG 3종(docs/logos)을 앱에서 쓸 크기로 정리한다. 저장소 루트에서 실행.
입력: docs/logos/ClassBank_Symbol.png · ClassBank_Full_Logo.png · ClassBank_Wordmark.png (없으면 압축 파일 ClassBank_Logos_PNG.zip 을 풀 것)
출력: app/public/brand/{symbol,logo,wordmark}.webp, 파비콘·앱 아이콘 PNG(선생님용·학생용)"""
import os

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = 'docs/logos/'
PUB = 'app/public/'
os.makedirs(PUB + 'brand', exist_ok=True)


def clean(path):
    """투명 배경 로고를 자르고, AI 가장자리의 작은 얼룩 조각과 옅은 테두리를 정리한다"""
    im = Image.open(path).convert('RGBA')
    a = np.array(im)
    alpha = a[..., 3].astype(float)
    solid = alpha > 40
    lab, n = ndimage.label(solid)
    if n:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > sizes.max() * 0.01])
        keep = ndimage.binary_dilation(keep, iterations=3)
        alpha = alpha * keep
    alpha = np.where(alpha < 28, 0, alpha)
    a[..., 3] = alpha.astype('uint8')
    out = Image.fromarray(a, 'RGBA')
    return out.crop(out.getbbox())


def save_webp(im, name, width):
    im = im.copy()
    im.thumbnail((width, width * 4), Image.LANCZOS)
    im.save(PUB + f'brand/{name}.webp', quality=92)
    print(name, im.size)


sym = clean(SRC + 'ClassBank_Symbol.png')
logo = clean(SRC + 'ClassBank_Full_Logo.png')
word = clean(SRC + 'ClassBank_Wordmark.png')
save_webp(sym, 'symbol', 420)
save_webp(logo, 'logo', 1000)
save_webp(word, 'wordmark', 800)


def square(im, size, bg, pad):
    """정사각 캔버스 가운데에 심볼을 놓는다(pad = 가장자리 여백 비율)"""
    canvas = Image.new('RGBA', (size, size), bg)
    inner = int(size * (1 - 2 * pad))
    s = im.copy()
    s.thumbnail((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(s, ((size - s.width) // 2, (size - s.height) // 2))
    return canvas


# 파비콘(투명 바탕) · 선생님용 앱 아이콘(흰 바탕, 마스크 안전 여백) · 학생용(남색 바탕)
square(sym, 48, (0, 0, 0, 0), 0.04).save(PUB + 'favicon-48.png')
square(sym, 32, (0, 0, 0, 0), 0.04).save(PUB + 'favicon-32.png')
for size, name in [(192, 'icon-192'), (512, 'icon-512'), (180, 'apple-touch-icon')]:
    square(sym, size, (255, 255, 255, 255), 0.2).convert('RGB').save(PUB + name + '.png')
for size, name in [(192, 'icon-student-192'), (512, 'icon-student-512'), (180, 'apple-touch-icon-student')]:
    square(sym, size, (22, 33, 62, 255), 0.2).convert('RGB').save(PUB + name + '.png')
print('done')
