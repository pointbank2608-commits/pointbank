/**
 * 업로드한 이미지를 정사각형 PNG로 축소한다.
 * 브랜드 마크가 작은 원형으로 표시되므로 원본 크기를 그대로 올릴 필요가 없고,
 * 큰 사진을 그대로 올리면 용량/로딩 속도만 나빠진다.
 */
export function resizeImageToPng(file: File, maxSize = 256): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('이미지를 처리할 수 없습니다.'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('이미지 변환에 실패했습니다.'))),
        'image/png',
        0.92,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 읽을 수 없습니다. 다른 파일을 선택해 주세요.'));
    };
    img.src = url;
  });
}
