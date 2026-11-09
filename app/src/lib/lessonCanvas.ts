import { newCanvasSlide, newTextElement, themeTextDefaults } from '../components/CanvasSlideEditor';

export function lessonTitleSlide(title: string, subtitle: string) {
  const slide = newCanvasSlide('green');
  slide.elements = [
    newTextElement({ x: 8, y: 26, w: 84, h: 30, ...themeTextDefaults('green', 'title'), text: title, fitText: true }),
    newTextElement({ x: 12, y: 60, w: 76, h: 20, ...themeTextDefaults('green'), bold: false, text: subtitle, fitText: true }),
  ];
  return slide;
}

/** 제목과 본문에 각자 줄바꿈할 공간을 두고 글꼴 크기는 렌더러에서 맞춘다. */
export function lessonBoard(title: string, lines: string[], fontSize = 5) {
  const slide = newCanvasSlide('green');
  slide.elements = [
    newTextElement({ x: 6, y: 5, w: 88, h: 26, ...themeTextDefaults('green', 'title'), text: title, fitText: true }),
    ...lines.map((text, i) => newTextElement({
      x: 8, y: 34 + i * 16, w: 84, h: 14,
      ...themeTextDefaults('green'), bold: false, text, fontSize, fitText: true,
    })),
  ];
  return slide;
}
