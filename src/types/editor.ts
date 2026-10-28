export interface ColorRGBA {
  r: number;
  g: number;
  b: number;
  a: number; // 0 - 255
}

export type ToolType =
  | 'pencil'
  | 'eraser'
  | 'dropper'
  | 'fill'
  | 'line'
  | 'rectangle'
  | 'rectangle-fill'
  | 'ellipse'
  | 'ellipse-fill'
  | 'select'
  | 'move';

export interface CapeLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number; // 0.0 to 1.0
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export interface DocumentDimensions {
  width: number;
  height: number;
  scale: number; // Multiplier relative to 64x32 (e.g. 1 = 64x32, 2 = 128x64, 4 = 256x128, 8 = 512x256, 16 = 1024x512)
  isCustom?: boolean;
}

export interface UVFace {
  name: string;
  label: string;
  color: string;
  // Normalized to 64x32 reference
  refX: number;
  refY: number;
  refWidth: number;
  refHeight: number;
}

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionState {
  rect: SelectionRect | null;
  floatingCanvas: HTMLCanvasElement | null;
  floatingX: number;
  floatingY: number;
  isFloating: boolean;
}

export interface HistoryEntry {
  description: string;
  layers: {
    id: string;
    name: string;
    visible: boolean;
    opacity: number;
    imageData: ImageData;
  }[];
  activeLayerId: string;
  width: number;
  height: number;
}
