"""색칠용 선화의 흰 여백을 잘라낸다(그림이 페이지에서 더 크게 보이도록).

    python app/scripts/vocab/trim-lineart.py

- 대상: app/public/word-bank-lineart/*.webp 와 decor/*.webp
- 선이 있는 부분(회색 240 미만)의 바깥 사각형만 남기고 사방에 작은 여백(긴 변의 4%)을 둔다.
  결과는 정사각형이 아니어도 된다(화면은 object-contain 으로 그린다).
- 이미 잘라낸 파일은 건너뛴다. 커서가 선화를 새로 만들 때마다 다시 돌리면 된다.
- 선화는 순수 흑백이라 무손실 WebP 로 저장해도 파일이 작다. 원본 덮어쓰기라서 원본이 필요하면 커서에게 다시 요청한다.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / "public" / "word-bank-lineart"
THRESHOLD = 240
PAD_RATIO = 0.04


def trim(path: Path) -> str:
    im = Image.open(path).convert("RGB")
    gray = im.convert("L").point(lambda v: 255 if v < THRESHOLD else 0)
    box = gray.getbbox()
    if box is None:
        return "빈 그림(건너뜀)"
    left, top, right, bottom = box
    w, h = im.size
    pad = round(max(right - left, bottom - top) * PAD_RATIO)
    # 이미 잘라낸 파일(사방 여백이 pad 근처)이면 건너뛴다.
    if max(left, top, w - right, h - bottom) <= pad + 2:
        return "이미 잘림"
    crop = (max(0, left - pad), max(0, top - pad), min(w, right + pad), min(h, bottom + pad))
    out = im.crop(crop)
    out.save(path, "WEBP", lossless=True, quality=100, method=4)
    return f"{w}x{h} → {out.size[0]}x{out.size[1]}"


def main() -> None:
    files = sorted(ROOT.glob("*.webp")) + sorted((ROOT / "decor").glob("*.webp"))
    done = 0
    for f in files:
        result = trim(f)
        if "→" in result:
            done += 1
    print(f"선화 {len(files)}개 중 {done}개를 잘랐습니다.")


if __name__ == "__main__":
    main()
