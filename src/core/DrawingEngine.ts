import type { ColorRGBA, SelectionRect, GradientConfig } from '../types/editor';

export function isPointInSelection(
  x: number,
  y: number,
  selection?: SelectionRect | null
): boolean {
  if (!selection) return true;
  return (
    x >= selection.x &&
    x < selection.x + selection.width &&
    y >= selection.y &&
    y < selection.y + selection.height
  );
}

export function hexToRgba(hex: string, alpha: number = 255): ColorRGBA {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) {
    return { r: 255, g: 255, b: 255, a: alpha };
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
    a: Math.min(255, Math.max(0, alpha)),
  };
}

export function rgbaToHex(color: ColorRGBA): string {
  const r = color.r.toString(16).padStart(2, '0');
  const g = color.g.toString(16).padStart(2, '0');
  const b = color.b.toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h, s, v };
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r1 = 0,
    g1 = 0,
    b1 = 0;

  if (h >= 0 && h < 60) {
    r1 = c;
    g1 = x;
    b1 = 0;
  } else if (h >= 60 && h < 120) {
    r1 = x;
    g1 = c;
    b1 = 0;
  } else if (h >= 120 && h < 180) {
    r1 = 0;
    g1 = c;
    b1 = x;
  } else if (h >= 180 && h < 240) {
    r1 = 0;
    g1 = x;
    b1 = c;
  } else if (h >= 240 && h < 300) {
    r1 = x;
    g1 = 0;
    b1 = c;
  } else {
    r1 = c;
    g1 = 0;
    b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

export function colorsMatch(c1: ColorRGBA, c2: ColorRGBA): boolean {
  if (c1.a === 0 && c2.a === 0) return true;
  return c1.r === c2.r && c1.g === c2.g && c1.b === c2.b && c1.a === c2.a;
}

export class DrawingEngine {
  /**
   * Put a single pixel directly onto canvas context without anti-aliasing
   */
  static setPixel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: ColorRGBA,
    mode: 'draw' | 'erase' = 'draw',
    selection?: SelectionRect | null
  ): void {
    if (selection && !isPointInSelection(x, y, selection)) return;
    if (mode === 'erase') {
      ctx.clearRect(x, y, 1, 1);
    } else {
      ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${color.a / 255})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  /**
   * Get pixel RGBA at coordinate
   */
  static getPixel(ctx: CanvasRenderingContext2D, x: number, y: number): ColorRGBA {
    const data = ctx.getImageData(x, y, 1, 1).data;
    return {
      r: data[0],
      g: data[1],
      b: data[2],
      a: data[3],
    };
  }

  /**
   * Bresenham line algorithm for pixel-perfect continuous lines
   */
  static drawLine(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: ColorRGBA,
    mode: 'draw' | 'erase' = 'draw',
    mirrorHorizontal = false,
    docWidth = 64,
    selection?: SelectionRect | null
  ): void {
    const plot = (px: number, py: number) => {
      this.setPixel(ctx, px, py, color, mode, selection);
      if (mirrorHorizontal) {
        const mx = docWidth - 1 - px;
        this.setPixel(ctx, mx, py, color, mode, selection);
      }
    };

    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let cx = x0;
    let cy = y0;

    while (true) {
      plot(cx, cy);
      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
  }

  /**
   * Flood fill (paint bucket) using efficient queue BFS
   * Returns true if any pixel was filled, false if no change occurred.
   * Respects selection mask if active.
   */
  static floodFill(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    fillColor: ColorRGBA,
    width: number,
    height: number,
    selection?: SelectionRect | null
  ): boolean {
    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return false;
    if (selection && !isPointInSelection(startX, startY, selection)) return false;

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const startIdx = (startY * width + startX) * 4;
    const targetR = data[startIdx];
    const targetG = data[startIdx + 1];
    const targetB = data[startIdx + 2];
    const targetA = data[startIdx + 3];

    // If target and fill are both fully transparent, no change
    if (targetA === 0 && fillColor.a === 0) return false;

    // If target already matches fill color exactly, abort with no change
    if (
      targetR === fillColor.r &&
      targetG === fillColor.g &&
      targetB === fillColor.b &&
      targetA === fillColor.a
    ) {
      return false;
    }

    // Convert colors to strictly unsigned 32-bit integers
    const toU32 = (r: number, g: number, b: number, a: number) =>
      ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;

    const targetU32 = toU32(targetR, targetG, targetB, targetA);
    const fillU32 = toU32(fillColor.r, fillColor.g, fillColor.b, fillColor.a);

    // Create 32-bit view of the pixel buffer
    const data32 = new Uint32Array(data.buffer);
    const startCoord = startY * width + startX;

    // Matching condition
    const isTargetTransparent = targetA === 0;
    const matchesTarget = (idx: number): boolean => {
      if (isTargetTransparent) {
        return (data32[idx] >>> 24) === 0;
      }
      return data32[idx] === targetU32;
    };

    if (!matchesTarget(startCoord)) return false;

    // Use pre-allocated typed arrays for maximum performance and zero GC at HD resolutions
    const totalPixels = width * height;
    const queue = new Int32Array(totalPixels);
    const visited = new Uint8Array(totalPixels);

    let head = 0;
    let tail = 0;

    queue[tail++] = startCoord;
    visited[startCoord] = 1;

    while (head < tail) {
      const current = queue[head++];
      const cx = current % width;
      const cy = (current / width) | 0;

      data32[current] = fillU32;

      // Check 4-connected neighbors, strictly bounded within selection if present
      if (cx > 0) {
        const nx = cx - 1;
        const ny = cy;
        const n = current - 1;
        if ((!selection || isPointInSelection(nx, ny, selection)) && !visited[n] && matchesTarget(n)) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (cx < width - 1) {
        const nx = cx + 1;
        const ny = cy;
        const n = current + 1;
        if ((!selection || isPointInSelection(nx, ny, selection)) && !visited[n] && matchesTarget(n)) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (cy > 0) {
        const nx = cx;
        const ny = cy - 1;
        const n = current - width;
        if ((!selection || isPointInSelection(nx, ny, selection)) && !visited[n] && matchesTarget(n)) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (cy < height - 1) {
        const nx = cx;
        const ny = cy + 1;
        const n = current + width;
        if ((!selection || isPointInSelection(nx, ny, selection)) && !visited[n] && matchesTarget(n)) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return true;
  }

  /**
   * Draw rectangle (stroke or filled), strictly clipped to selection if active
   */
  static drawRectangle(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: ColorRGBA,
    filled: boolean,
    selection?: SelectionRect | null
  ): void {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${color.a / 255})`;

    if (filled) {
      if (!selection) {
        ctx.fillRect(minX, minY, width, height);
      } else {
        const clipX0 = Math.max(minX, selection.x);
        const clipX1 = Math.min(maxX, selection.x + selection.width - 1);
        const clipY0 = Math.max(minY, selection.y);
        const clipY1 = Math.min(maxY, selection.y + selection.height - 1);
        if (clipX1 >= clipX0 && clipY1 >= clipY0) {
          ctx.fillRect(clipX0, clipY0, clipX1 - clipX0 + 1, clipY1 - clipY0 + 1);
        }
      }
    } else {
      // Outline only: check each pixel against selection
      const plot = (px: number, py: number) => {
        this.setPixel(ctx, px, py, color, 'draw', selection);
      };
      for (let x = minX; x <= maxX; x++) {
        plot(x, minY);
        plot(x, maxY);
      }
      for (let y = minY + 1; y < maxY; y++) {
        plot(minX, y);
        plot(maxX, y);
      }
    }
  }

  /**
   * Midpoint Ellipse Algorithm for pixel-perfect ellipse, strictly clipped to selection if active
   */
  static drawEllipse(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: ColorRGBA,
    filled: boolean,
    selection?: SelectionRect | null
  ): void {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);

    const rx = Math.floor((maxX - minX) / 2);
    const ry = Math.floor((maxY - minY) / 2);
    const xc = minX + rx;
    const yc = minY + ry;

    if (rx <= 0 && ry <= 0) {
      this.setPixel(ctx, xc, yc, color, 'draw', selection);
      return;
    }

    ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${color.a / 255})`;

    const plot4 = (px: number, py: number) => {
      if (filled) {
        const spanLeft = xc - px;
        const spanRight = xc + px;
        const fillRow = (rowY: number) => {
          if (!selection) {
            ctx.fillRect(spanLeft, rowY, spanRight - spanLeft + 1, 1);
          } else if (rowY >= selection.y && rowY < selection.y + selection.height) {
            const clipLeft = Math.max(spanLeft, selection.x);
            const clipRight = Math.min(spanRight, selection.x + selection.width - 1);
            if (clipRight >= clipLeft) {
              ctx.fillRect(clipLeft, rowY, clipRight - clipLeft + 1, 1);
            }
          }
        };
        fillRow(yc + py);
        if (py !== 0) {
          fillRow(yc - py);
        }
      } else {
        this.setPixel(ctx, xc + px, yc + py, color, 'draw', selection);
        this.setPixel(ctx, xc - px, yc + py, color, 'draw', selection);
        this.setPixel(ctx, xc + px, yc - py, color, 'draw', selection);
        this.setPixel(ctx, xc - px, yc - py, color, 'draw', selection);
      }
    };

    let x = 0;
    let y = ry;
    let d1 = ry * ry - rx * rx * ry + 0.25 * rx * rx;
    let dx = 2 * ry * ry * x;
    let dy = 2 * rx * rx * y;

    // Region 1
    while (dx < dy) {
      plot4(x, y);
      if (d1 < 0) {
        x++;
        dx = dx + 2 * ry * ry;
        d1 = d1 + dx + ry * ry;
      } else {
        x++;
        y--;
        dx = dx + 2 * ry * ry;
        dy = dy - 2 * rx * rx;
        d1 = d1 + dx - dy + ry * ry;
      }
    }

    // Region 2
    let d2 =
      ry * ry * ((x + 0.5) * (x + 0.5)) +
      rx * rx * ((y - 1) * (y - 1)) -
      rx * rx * ry * ry;

    while (y >= 0) {
      plot4(x, y);
      if (d2 > 0) {
        y--;
        dy = dy - 2 * rx * rx;
        d2 = d2 + rx * rx - dy;
      } else {
        y--;
        x++;
        dx = dx + 2 * ry * ry;
        dy = dy - 2 * rx * rx;
        d2 = d2 + dx - dy + rx * rx;
      }
    }
  }

  /**
   * Apply gradient (Linear, Radial, Angular, Reflected, Diamond) between two points
   * with alpha-aware interpolation, opacity modulation, and strict selection masking.
   */
  static applyGradient(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    startColor: ColorRGBA,
    endColor: ColorRGBA,
    options: GradientConfig,
    width: number,
    height: number,
    selection?: SelectionRect | null
  ): boolean {
    if (width <= 0 || height <= 0) return false;

    const color0 = options.reverse ? endColor : startColor;
    const color1 = options.reverse ? startColor : endColor;
    const opacityFactor = Math.max(0, Math.min(1, options.opacity ?? 1.0));
    if (opacityFactor <= 0) return false;

    // Target pixel bounds (clamped by document dimensions and selection)
    const minX = selection ? Math.max(0, Math.min(width, selection.x)) : 0;
    const maxX = selection
      ? Math.max(0, Math.min(width, selection.x + selection.width))
      : width;
    const minY = selection ? Math.max(0, Math.min(height, selection.y)) : 0;
    const maxY = selection
      ? Math.max(0, Math.min(height, selection.y + selection.height))
      : height;

    if (minX >= maxX || minY >= maxY) return false;

    const dx = x1 - x0;
    const dy = y1 - y0;
    const lenSq = dx * dx + dy * dy;
    const len = Math.sqrt(lenSq);

    const type = options.type;
    const baseAngle = type === 'angular' ? Math.atan2(dy, dx) : 0;

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let modified = false;

    for (let py = minY; py < maxY; py++) {
      for (let px = minX; px < maxX; px++) {
        let t = 0;

        if (len < 0.0001) {
          t = 0;
        } else {
          switch (type) {
            case 'linear': {
              const proj = (px - x0) * dx + (py - y0) * dy;
              t = Math.max(0, Math.min(1, proj / lenSq));
              break;
            }
            case 'radial': {
              const dist = Math.sqrt((px - x0) * (px - x0) + (py - y0) * (py - y0));
              t = Math.max(0, Math.min(1, dist / len));
              break;
            }
            case 'angular': {
              let angle = Math.atan2(py - y0, px - x0) - baseAngle;
              angle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
              t = angle / (Math.PI * 2);
              break;
            }
            case 'reflected': {
              const proj = (px - x0) * dx + (py - y0) * dy;
              t = Math.max(0, Math.min(1, Math.abs(proj) / lenSq));
              break;
            }
            case 'diamond': {
              const pX = px - x0;
              const pY = py - y0;
              const distParallel = Math.abs(pX * dx + pY * dy) / len;
              const distPerp = Math.abs(-pX * dy + pY * dx) / len;
              t = Math.max(0, Math.min(1, (distParallel + distPerp) / len));
              break;
            }
          }
        }

        // Interpolate colors with proper premultiplied alpha
        const a0 = color0.a;
        const a1 = color1.a;
        const outAlpha = (a0 + t * (a1 - a0)) * opacityFactor;

        let r = 0;
        let g = 0;
        let b = 0;

        if (a0 === 0 && a1 === 0) {
          r = 0;
          g = 0;
          b = 0;
        } else if (a0 === a1 && a0 === 255) {
          r = Math.round(color0.r + t * (color1.r - color0.r));
          g = Math.round(color0.g + t * (color1.g - color0.g));
          b = Math.round(color0.b + t * (color1.b - color0.b));
        } else {
          const w0 = (1 - t) * a0;
          const w1 = t * a1;
          const sumW = w0 + w1;
          if (sumW > 0) {
            r = Math.round((color0.r * w0 + color1.r * w1) / sumW);
            g = Math.round((color0.g * w0 + color1.g * w1) / sumW);
            b = Math.round((color0.b * w0 + color1.b * w1) / sumW);
          } else {
            r = color0.r;
            g = color0.g;
            b = color0.b;
          }
        }

        const srcA = Math.max(0, Math.min(255, Math.round(outAlpha)));
        if (srcA === 0) continue;

        // Composite onto existing destination pixel (Normal source-over)
        const idx = (py * width + px) * 4;
        const dstR = data[idx];
        const dstG = data[idx + 1];
        const dstB = data[idx + 2];
        const dstA = data[idx + 3];

        if (srcA === 255 || dstA === 0) {
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = srcA;
        } else {
          const sa = srcA / 255;
          const da = dstA / 255;
          const finalA = sa + da * (1 - sa);
          data[idx] = Math.round((r * sa + dstR * da * (1 - sa)) / finalA);
          data[idx + 1] = Math.round((g * sa + dstG * da * (1 - sa)) / finalA);
          data[idx + 2] = Math.round((b * sa + dstB * da * (1 - sa)) / finalA);
          data[idx + 3] = Math.round(finalA * 255);
        }
        modified = true;
      }
    }

    if (modified) {
      ctx.putImageData(imgData, 0, 0);
    }
    return modified;
  }

  /**
   * Helper to safely create an offscreen canvas with fallback for headless/test environments
   */
  static createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const realCtx = canvas.getContext('2d');
    if (!realCtx) {
      const buffer = new Uint8ClampedArray(canvas.width * canvas.height * 4);
      let fillStyle = '#000000';
      const mock = {
        canvas,
        get fillStyle() {
          return fillStyle;
        },
        set fillStyle(val: string) {
          fillStyle = val;
        },
        imageSmoothingEnabled: false,
        fillRect(x: number, y: number, w: number, h: number) {
          let r = 0;
          let g = 0;
          let b = 0;
          let a = 255;
          if (fillStyle.startsWith('rgba')) {
            const parts = fillStyle
              .replace(/rgba?\(|\)/g, '')
              .split(',')
              .map((s) => parseFloat(s.trim()));
            r = Math.round(parts[0] || 0);
            g = Math.round(parts[1] || 0);
            b = Math.round(parts[2] || 0);
            a = Math.round((parts[3] !== undefined ? parts[3] : 1) * 255);
          } else if (fillStyle.startsWith('#')) {
            const hex = fillStyle.replace('#', '');
            const num = parseInt(hex, 16);
            r = (num >> 16) & 255;
            g = (num >> 8) & 255;
            b = num & 255;
          }
          for (let cy = y; cy < y + h; cy++) {
            for (let cx = x; cx < x + w; cx++) {
              if (cx >= 0 && cx < canvas.width && cy >= 0 && cy < canvas.height) {
                const idx = (cy * canvas.width + cx) * 4;
                buffer[idx] = r;
                buffer[idx + 1] = g;
                buffer[idx + 2] = b;
                buffer[idx + 3] = a;
              }
            }
          }
        },
        clearRect(x: number, y: number, w: number, h: number) {
          for (let cy = y; cy < y + h; cy++) {
            for (let cx = x; cx < x + w; cx++) {
              if (cx >= 0 && cx < canvas.width && cy >= 0 && cy < canvas.height) {
                const idx = (cy * canvas.width + cx) * 4;
                buffer[idx] = 0;
                buffer[idx + 1] = 0;
                buffer[idx + 2] = 0;
                buffer[idx + 3] = 0;
              }
            }
          }
        },
        putImageData(data: ImageData, dx: number, dy: number) {
          for (let cy = 0; cy < data.height; cy++) {
            for (let cx = 0; cx < data.width; cx++) {
              const tx = dx + cx;
              const ty = dy + cy;
              if (tx >= 0 && tx < canvas.width && ty >= 0 && ty < canvas.height) {
                const sIdx = (cy * data.width + cx) * 4;
                const dIdx = (ty * canvas.width + tx) * 4;
                buffer[dIdx] = data.data[sIdx];
                buffer[dIdx + 1] = data.data[sIdx + 1];
                buffer[dIdx + 2] = data.data[sIdx + 2];
                buffer[dIdx + 3] = data.data[sIdx + 3];
              }
            }
          }
        },
        getImageData(sx: number, sy: number, sw: number, sh: number) {
          const out = new Uint8ClampedArray(sw * sh * 4);
          for (let cy = 0; cy < sh; cy++) {
            for (let cx = 0; cx < sw; cx++) {
              const tx = sx + cx;
              const ty = sy + cy;
              if (tx >= 0 && tx < canvas.width && ty >= 0 && ty < canvas.height) {
                const sIdx = (ty * canvas.width + tx) * 4;
                const dIdx = (cy * sw + cx) * 4;
                out[dIdx] = buffer[sIdx];
                out[dIdx + 1] = buffer[sIdx + 1];
                out[dIdx + 2] = buffer[sIdx + 2];
                out[dIdx + 3] = buffer[sIdx + 3];
              }
            }
          }
          return { data: out, width: sw, height: sh, colorSpace: 'srgb' } as ImageData;
        },
        drawImage(src: HTMLCanvasElement, dx: number, dy: number) {
          const sCtx =
            src.getContext?.('2d') ||
            (src as unknown as { __mock2dContext?: CanvasRenderingContext2D }).__mock2dContext;
          if (!sCtx) return;
          const sData = sCtx.getImageData(0, 0, src.width, src.height);
          mock.putImageData(sData, dx, dy);
        },
      } as unknown as CanvasRenderingContext2D;
      (canvas as unknown as { __mock2dContext?: CanvasRenderingContext2D }).__mock2dContext = mock;
      canvas.getContext = ((type: string) => (type === '2d' ? mock : null)) as unknown as typeof canvas.getContext;
    }
    return canvas;
  }

  /**
   * Clone canvas maintaining exact RGBA pixel data
   */
  static cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
    const copy = this.createCanvas(source.width, source.height);
    const sCtx =
      source.getContext?.('2d') ||
      (source as unknown as { __mock2dContext?: CanvasRenderingContext2D }).__mock2dContext;
    const cCtx =
      copy.getContext?.('2d') ||
      (copy as unknown as { __mock2dContext?: CanvasRenderingContext2D }).__mock2dContext;
    if (sCtx && cCtx) {
      cCtx.imageSmoothingEnabled = false;
      try {
        const sData = sCtx.getImageData(0, 0, source.width, source.height);
        cCtx.putImageData(sData, 0, 0);
      } catch {
        try {
          cCtx.drawImage(source, 0, 0);
        } catch {
          // fallback
        }
      }
    }
    return copy;
  }

  /**
   * Move layer content by (dx, dy) within document boundaries (width x height)
   */
  static moveLayer(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dx: number,
    dy: number
  ): void {
    if (dx === 0 && dy === 0) return;
    const srcData = ctx.getImageData(0, 0, width, height);
    const dstData = ctx.createImageData
      ? ctx.createImageData(width, height)
      : ctx.getImageData(0, 0, width, height);

    for (let y = 0; y < height; y++) {
      const srcY = y - dy;
      if (srcY < 0 || srcY >= height) continue;
      for (let x = 0; x < width; x++) {
        const srcX = x - dx;
        if (srcX < 0 || srcX >= width) continue;

        const srcIdx = (srcY * width + srcX) * 4;
        const dstIdx = (y * width + x) * 4;
        dstData.data[dstIdx] = srcData.data[srcIdx];
        dstData.data[dstIdx + 1] = srcData.data[srcIdx + 1];
        dstData.data[dstIdx + 2] = srcData.data[srcIdx + 2];
        dstData.data[dstIdx + 3] = srcData.data[srcIdx + 3];
      }
    }

    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(dstData, 0, 0);
  }

  /**
   * Cut or copy pixels in selection rectangle
   */
  static extractSelection(
    ctx: CanvasRenderingContext2D,
    rect: SelectionRect,
    clearOriginal = false
  ): HTMLCanvasElement {
    const canvas = this.createCanvas(rect.width, rect.height);
    const cCtx =
      canvas.getContext?.('2d') ||
      (canvas as unknown as { __mock2dContext?: CanvasRenderingContext2D }).__mock2dContext;

    const imgData = ctx.getImageData(rect.x, rect.y, rect.width, rect.height);

    if (cCtx) {
      cCtx.imageSmoothingEnabled = false;
      cCtx.putImageData(imgData, 0, 0);
    }

    if (clearOriginal) {
      ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
    }

    return canvas;
  }

  /**
   * Paste floating canvas onto target canvas at offset
   */
  static pasteSelection(
    ctx: CanvasRenderingContext2D,
    floatingCanvas: HTMLCanvasElement,
    x: number,
    y: number
  ): void {
    ctx.imageSmoothingEnabled = false;
    try {
      ctx.drawImage(floatingCanvas, Math.round(x), Math.round(y));
    } catch {
      // fallback
    }
    // Also transfer via imageData for headless mock environments
    const fCtx =
      floatingCanvas.getContext?.('2d') ||
      (floatingCanvas as unknown as { __mock2dContext?: CanvasRenderingContext2D }).__mock2dContext;
    if (fCtx) {
      try {
        const fData = fCtx.getImageData(0, 0, floatingCanvas.width, floatingCanvas.height);
        // Blend onto target
        const targetW = ctx.canvas?.width || 64;
        const targetH = ctx.canvas?.height || 32;
        const currentData = ctx.getImageData(0, 0, targetW, targetH);
        for (let cy = 0; cy < floatingCanvas.height; cy++) {
          const dy = Math.round(y) + cy;
          if (dy < 0 || dy >= targetH) continue;
          for (let cx = 0; cx < floatingCanvas.width; cx++) {
            const dx = Math.round(x) + cx;
            if (dx < 0 || dx >= targetW) continue;
            const sIdx = (cy * floatingCanvas.width + cx) * 4;
            const alpha = fData.data[sIdx + 3];
            if (alpha > 0) {
              const dIdx = (dy * targetW + dx) * 4;
              currentData.data[dIdx] = fData.data[sIdx];
              currentData.data[dIdx + 1] = fData.data[sIdx + 1];
              currentData.data[dIdx + 2] = fData.data[sIdx + 2];
              currentData.data[dIdx + 3] = alpha;
            }
          }
        }
        ctx.putImageData(currentData, 0, 0);
      } catch {
        // fallback
      }
    }
  }

  /**
   * Flip canvas horizontally
   */
  static flipHorizontally(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const flipped = this.createCanvas(canvas.width, canvas.height);
    const fCtx =
      flipped.getContext?.('2d') ||
      (flipped as unknown as { __mock2dContext?: CanvasRenderingContext2D }).__mock2dContext;
    if (fCtx) {
      fCtx.imageSmoothingEnabled = false;
      const srcCtx =
        canvas.getContext?.('2d') ||
        (canvas as unknown as { __mock2dContext?: CanvasRenderingContext2D }).__mock2dContext;
      if (srcCtx) {
        try {
          const sData = srcCtx.getImageData(0, 0, canvas.width, canvas.height);
          const dData = fCtx.createImageData
            ? fCtx.createImageData(canvas.width, canvas.height)
            : fCtx.getImageData(0, 0, canvas.width, canvas.height);
          for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
              const srcX = canvas.width - 1 - x;
              const sIdx = (y * canvas.width + srcX) * 4;
              const dIdx = (y * canvas.width + x) * 4;
              dData.data[dIdx] = sData.data[sIdx];
              dData.data[dIdx + 1] = sData.data[sIdx + 1];
              dData.data[dIdx + 2] = sData.data[sIdx + 2];
              dData.data[dIdx + 3] = sData.data[sIdx + 3];
            }
          }
          fCtx.putImageData(dData, 0, 0);
        } catch {
          try {
            fCtx.translate(canvas.width, 0);
            fCtx.scale(-1, 1);
            fCtx.drawImage(canvas, 0, 0);
          } catch {
            // fallback
          }
        }
      }
    }
    return flipped;
  }
}
