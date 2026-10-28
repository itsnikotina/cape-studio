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
