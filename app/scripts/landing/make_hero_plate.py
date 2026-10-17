"""랜딩 첫 화면 배경판 만들기(2026-10-17) — 디자인 시안 01_hero.png 에서 글자(제목·버튼·태그·머리줄·하단 장점)를 지우고
노트북·소품·마스코트·활동지 그림만 남긴다. 글자는 HTML 로 다시 얹는다. 저장소 루트에서 실행.
입력: docs/landing-pack/ClassBank_Landing_Design_Pack/01_hero.png (없으면 압축 파일에서 풀 것)"""
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = 'docs/landing-pack/ClassBank_Landing_Design_Pack/01_hero.png'
OUT = 'app/public/landing2/hero-plate.webp'
TOP, BOTTOM = 95, 892  # 머리줄과 하단 장점 줄은 잘라 낸다

im = np.array(Image.open(SRC).convert('RGB')).astype(float)
h, w, _ = im.shape
mask = np.zeros((h, w), bool)
mask[170:800, 30:600] = True       # 태그·제목 1줄·부제·버튼 왼쪽
mask[395:505, 30:730] = True       # "10분이면 준비 끝" 줄
mask[680:800, 30:775] = True       # 버튼 줄(보조 링크)
mask = ndimage.binary_dilation(mask, iterations=7)

# 지운 자리는 가장 가까운 남은 픽셀의 색을 가져와 부드럽게 번지게 채운다
idx = ndimage.distance_transform_edt(mask, return_distances=False, return_indices=True)
nearest = im[idx[0], idx[1]]
fill = np.stack([ndimage.gaussian_filter(nearest[..., c], 30) for c in range(3)], axis=-1)
soft = ndimage.gaussian_filter(mask.astype(float), 6)[..., None]
out = im * (1 - soft) + fill * soft
Image.fromarray(np.clip(out, 0, 255).astype('uint8')).crop((0, TOP, w, BOTTOM)).save(OUT, quality=90)
print('saved', OUT, (w, BOTTOM - TOP))
