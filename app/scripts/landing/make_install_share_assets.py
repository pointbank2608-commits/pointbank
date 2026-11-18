"""Render install icons and the social card from the current book symbol.

Run with Pillow and a Korean font, e.g.
python app/scripts/landing/make_install_share_assets.py C:/Windows/Fonts/NotoSansKR-VF.ttf
"""

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


BRAND = Path(__file__).resolve().parents[2] / 'public' / 'brand'


def paste_symbol(canvas, symbol, width, center):
    height = round(symbol.height * width / symbol.width)
    mark = symbol.resize((width, height), Image.Resampling.LANCZOS)
    left = center[0] - mark.width // 2
    top = center[1] - mark.height // 2
    canvas.paste(mark, (left, top), mark)


def make_icon(symbol, size, name, mark_width):
    gradient = Image.linear_gradient('L').resize((size, size))
    canvas = ImageOps.colorize(gradient, '#f5faff', '#c5dfff')
    paste_symbol(canvas, symbol, round(size * mark_width), (size // 2, size // 2))
    canvas.save(BRAND / f'{name}.png', optimize=True)


def make_card(symbol, font_path):
    canvas = ImageOps.colorize(Image.linear_gradient('L').resize((1200, 630)), '#10294d', '#14223c')
    draw = ImageDraw.Draw(canvas)
    draw.ellipse((-376, -414, 326, 288), outline='#294a78', width=3)
    draw.ellipse((885, 357, 1575, 1047), outline='#294a78', width=3)
    paste_symbol(canvas, symbol, 206, (600, 205))
    heading = ImageFont.truetype(font_path, 104)
    caption = ImageFont.truetype(font_path, 40)
    if heading.get_variation_axes():
        heading.set_variation_by_axes([850])
        caption.set_variation_by_axes([480])
    draw.text((600, 373), '수업뚝딱', font=heading, anchor='mm', fill='#ffffff')
    draw.text((600, 480), '영어를 더 재미있게!!', font=caption, anchor='mm', fill='#cadef7')
    canvas.save(BRAND / 'share-card.jpg', quality=92, optimize=True, subsampling=0)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('font', help='Path to Noto Sans KR Variable')
    args = parser.parse_args()
    with Image.open(BRAND / 'symbol.webp') as image:
        symbol = image.convert('RGBA')
    for size in (192, 512):
        make_icon(symbol, size, f'install-{size}', 0.72)
        make_icon(symbol, size, f'install-maskable-{size}', 0.62)
    make_icon(symbol, 180, 'install-apple-180', 0.70)
    make_card(symbol, args.font)
