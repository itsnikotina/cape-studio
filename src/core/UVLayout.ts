import type { UVFace } from '../types/editor';

export const CAPE_UV_FACES: UVFace[] = [
  {
    name: 'top',
    label: 'Cima (Top)',
    color: '#3b82f6', // blue
    refX: 1,
    refY: 0,
    refWidth: 10,
    refHeight: 1,
  },
  {
    name: 'bottom',
    label: 'Baixo (Bottom)',
    color: '#8b5cf6', // purple
    refX: 11,
    refY: 0,
    refWidth: 10,
    refHeight: 1,
  },
  {
    name: 'right',
    label: 'Direita (Right)',
    color: '#ec4899', // pink
    refX: 0,
    refY: 1,
    refWidth: 1,
    refHeight: 16,
  },
  {
    name: 'front',
    label: 'Frente/Interna (Front)',
    color: '#10b981', // green
    refX: 1,
    refY: 1,
    refWidth: 10,
    refHeight: 16,
  },
  {
    name: 'left',
    label: 'Esquerda (Left)',
    color: '#f59e0b', // amber
    refX: 11,
    refY: 1,
    refWidth: 1,
    refHeight: 16,
  },
  {
    name: 'back',
    label: 'Traseira/Externa (Back)',
    color: '#ef4444', // red
    refX: 12,
    refY: 1,
    refWidth: 10,
    refHeight: 16,
  },
];

export interface ScaledUVFace extends UVFace {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getScaledUVFaces(scale: number): ScaledUVFace[] {
  return CAPE_UV_FACES.map((face) => ({
    ...face,
    x: Math.round(face.refX * scale),
    y: Math.round(face.refY * scale),
    width: Math.round(face.refWidth * scale),
    height: Math.round(face.refHeight * scale),
  }));
}

/**
 * Returns which UV face contains the given pixel coordinate (x, y), or null if none
 */
export function getUVFaceAt(x: number, y: number, scale: number): ScaledUVFace | null {
  const scaled = getScaledUVFaces(scale);
  for (const face of scaled) {
    if (x >= face.x && x < face.x + face.width && y >= face.y && y < face.y + face.height) {
      return face;
    }
  }
  return null;
}

export interface UVViewport {
  panX: number;
  panY: number;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * 1. Preenchimento sólido:
 * Renders UV region background fills BEHIND the cape texture pixels (z-index 2).
 * Visible only through transparent pixels; covered completely by painted pixels without altering their colors.
 */
export function renderUVBackground(
  ctx: CanvasRenderingContext2D,
  scale: number,
  viewport: UVViewport
): void {
  const { panX, panY, zoom, viewportWidth, viewportHeight } = viewport;
  ctx.clearRect(0, 0, viewportWidth, viewportHeight);

  const faces = getScaledUVFaces(scale);
  for (const face of faces) {
    const fx = panX + face.x * zoom;
    const fy = panY + face.y * zoom;
    const fw = face.width * zoom;
    const fh = face.height * zoom;

    // Viewport culling
    if (fx + fw < 0 || fx > viewportWidth || fy + fh < 0 || fy > viewportHeight) {
      continue;
    }

    // 1. Preenchimento sólido/translúcido (atrás dos pixels da capa)
    ctx.fillStyle = face.color + '26';
    ctx.fillRect(fx, fy, fw, fh);
  }
}

/**
 * 2. Contornos e bordas + 3. Nomes e rótulos:
 * Renders UV region borders and labels ON TOP of the cape texture pixels (z-index 4).
 * Ensures region boundaries and face names remain sharp, visible, and legible over painted pixels.
 */
export function renderUVForeground(
  ctx: CanvasRenderingContext2D,
  scale: number,
  viewport: UVViewport
): void {
  const { panX, panY, zoom, viewportWidth, viewportHeight } = viewport;
  ctx.clearRect(0, 0, viewportWidth, viewportHeight);

  const faces = getScaledUVFaces(scale);
  for (const face of faces) {
    const fx = panX + face.x * zoom;
    const fy = panY + face.y * zoom;
    const fw = face.width * zoom;
    const fh = face.height * zoom;

    // Viewport culling
    if (fx + fw < 0 || fx > viewportWidth || fy + fh < 0 || fy > viewportHeight) {
      continue;
    }

    // 2. Contornos e bordas (por cima dos pixels)
    if (ctx.save) ctx.save();
    ctx.strokeStyle = face.color;
    ctx.lineWidth = 1.5;
    if (ctx.strokeRect) {
      ctx.strokeRect(fx, fy, fw, fh);
    }

    // 3. Nomes e rótulos (por cima dos pixels)
    if (fw > 24 && fh > 10) {
      if (ctx.beginPath) ctx.beginPath();
      if (ctx.rect && ctx.clip) {
        ctx.rect(fx, fy, fw, fh);
        ctx.clip();
      }

      const shortName = face.label.split(' ')[0];
      const textToDisplay = fw >= 90 && fh >= 20 ? face.label : shortName;

      ctx.font = 'bold 10px monospace';
      const textMetrics = ctx.measureText ? ctx.measureText(textToDisplay) : { width: textToDisplay.length * 6 };
      const textWidth = textMetrics?.width || textToDisplay.length * 6;
      const badgeW = Math.min(fw - 4, textWidth + 6);
      const badgeH = Math.min(fh - 4, 14);

      if (badgeW > 10 && badgeH >= 10) {
        // High-contrast badge background so label is readable over any pixel colors
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        if (ctx.fillRect) {
          ctx.fillRect(fx + 2, fy + 2, badgeW, badgeH);
        }

        ctx.fillStyle = face.color;
        ctx.textBaseline = 'middle';
        if (ctx.fillText) {
          ctx.fillText(textToDisplay, fx + 5, fy + 2 + badgeH / 2, fw - 6);
        }
      }
    }
    if (ctx.restore) ctx.restore();
  }
}
