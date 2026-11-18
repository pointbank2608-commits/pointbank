declare module 'pptx-browser' {
  export class PptxRenderer {
    slideCount: number;
    load(file: File): Promise<void>;
    getInfo(): { aspectRatio: number };
    renderSlide(index: number, canvas: HTMLCanvasElement, width: number): Promise<void>;
    destroy(): void;
  }
}
