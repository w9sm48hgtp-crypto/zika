/**
 * 图片压缩工具 — 用 Canvas 缩放 + JPEG 压缩减少 base64 体积
 *
 * Android WebView 对大体积 base64 字符串的处理能力有限，
 * 导出前压缩可避免分享/复制时的闪退问题。
 */

/**
 * 压缩单张 base64 图片
 * @param dataUrl 原始 base64 图片 (data:image/...)
 * @param maxWidth 最大宽度（像素），超过则等比缩小
 * @param quality JPEG 质量 0-1，默认 0.6
 * @returns 压缩后的 base64 (data:image/jpeg;base64,...)
 */
export function compressImage(
  dataUrl: string,
  maxWidth: number,
  quality: number = 0.6,
): Promise<string> {
  return new Promise((resolve) => {
    // SVG 不压缩，直接返回
    if (dataUrl.startsWith('data:image/svg')) {
      resolve(dataUrl);
      return;
    }

    // 空数据或非图片格式，直接返回
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();

    img.onload = () => {
      try {
        const origW = img.naturalWidth;
        const origH = img.naturalHeight;

        // 原图很小，但还是要过一遍 JPEG 压缩（PNG→JPEG 可能大幅减小）
        let w = origW;
        let h = origH;
        if (w > maxWidth) {
          const ratio = maxWidth / w;
          w = maxWidth;
          h = Math.round(h * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl); // 降级返回原图
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', quality);

        // 如果压缩后反而更大，返回原图
        if (compressed.length >= dataUrl.length) {
          resolve(dataUrl);
        } else {
          resolve(compressed);
        }
      } catch {
        resolve(dataUrl); // 出错降级返回原图
      }
    };

    img.onerror = () => {
      resolve(dataUrl); // 加载失败降级返回原图
    };

    img.src = dataUrl;
  });
}

/**
 * 估算 base64 数据的实际字节大小（去掉 data:... 头之后的 base64 编码开销）
 */
export function estimateBase64Size(dataUrl: string): number {
  const base64Part = dataUrl.split(',')[1] || '';
  return Math.round(base64Part.length * 0.75);
}
