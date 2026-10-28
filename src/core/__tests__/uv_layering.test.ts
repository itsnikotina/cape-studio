import { describe, it, expect, vi } from 'vitest';
import {
  renderUVBackground,
  renderUVForeground,
  getScaledUVFaces,
  CAPE_UV_FACES,
} from '../UVLayout';
import { DocumentModel } from '../DocumentModel';
import { DrawingEngine } from '../DrawingEngine';

describe('UV Guides Visual Layering (Preenchimento sólido, Contornos e Nomes)', () => {
  // Helper to create a spy mock 2D context to track operations
  function createSpyContext(width = 800, height = 600) {
    const fillRects: { x: number; y: number; w: number; h: number; fillStyle: string }[] = [];
    const strokeRects: { x: number; y: number; w: number; h: number; strokeStyle: string }[] = [];
    const fillTexts: { text: string; x: number; y: number; fillStyle: string }[] = [];
    const clearRects: { x: number; y: number; w: number; h: number }[] = [];

    let currentFillStyle = '#000000';
    let currentStrokeStyle = '#000000';

    const ctx = {
      get fillStyle() {
        return currentFillStyle;
      },
      set fillStyle(val: string) {
        currentFillStyle = val;
      },
      get strokeStyle() {
        return currentStrokeStyle;
      },
      set strokeStyle(val: string) {
        currentStrokeStyle = val;
      },
      lineWidth: 1,
      font: '',
      textBaseline: 'alphabetic',
      clearRect: vi.fn((x: number, y: number, w: number, h: number) => {
        clearRects.push({ x, y, w, h });
      }),
      fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
        fillRects.push({ x, y, w, h, fillStyle: currentFillStyle });
      }),
      strokeRect: vi.fn((x: number, y: number, w: number, h: number) => {
        strokeRects.push({ x, y, w, h, strokeStyle: currentStrokeStyle });
      }),
      fillText: vi.fn((text: string, x: number, y: number) => {
        fillTexts.push({ text, x, y, fillStyle: currentFillStyle });
      }),
      measureText: vi.fn((text: string) => ({
        width: text.length * 6,
      })),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      canvas: { width, height },
    } as unknown as CanvasRenderingContext2D;

    return { ctx, fillRects, strokeRects, fillTexts, clearRects };
  }

  // 1. Separation of Background Fill (Preenchimento sólido)
  describe('1. Preenchimento sólido (Layer behind pixels)', () => {
    it('renderUVBackground only draws solid/tint fill and never draws borders or text labels', () => {
      const { ctx, fillRects, strokeRects, fillTexts } = createSpyContext(800, 600);
      const viewport = {
        panX: 50,
        panY: 50,
        zoom: 10,
        viewportWidth: 800,
        viewportHeight: 600,
      };

      renderUVBackground(ctx, 1, viewport);

      // Must draw background fills for all faces in viewport
      expect(fillRects.length).toBe(CAPE_UV_FACES.length);

      // Must NEVER draw strokes or borders in background layer
      expect(strokeRects.length).toBe(0);

      // Must NEVER draw text labels in background layer
      expect(fillTexts.length).toBe(0);

      // Verify each face has its distinct color tint
      for (const face of CAPE_UV_FACES) {
        const found = fillRects.some((r) => r.fillStyle.startsWith(face.color));
        expect(found).toBe(true);
      }
    });

    it('clears the viewport before rendering background', () => {
      const { ctx, clearRects } = createSpyContext(800, 600);
      const viewport = {
        panX: 0,
        panY: 0,
        zoom: 8,
        viewportWidth: 800,
        viewportHeight: 600,
      };

      renderUVBackground(ctx, 1, viewport);
      expect(clearRects.length).toBeGreaterThanOrEqual(1);
      expect(clearRects[0]).toEqual({ x: 0, y: 0, w: 800, h: 600 });
    });
  });

  // 2. Separation of Borders and Labels (Contornos, bordas e nomes/rótulos)
  describe('2. Contornos e Rótulos (Layer on top of pixels)', () => {
    it('renderUVForeground renders stroke borders for all UV faces', () => {
      const { ctx, strokeRects } = createSpyContext(800, 600);
      const viewport = {
        panX: 50,
        panY: 50,
        zoom: 10,
        viewportWidth: 800,
        viewportHeight: 600,
      };

      renderUVForeground(ctx, 1, viewport);

      // All 6 faces must have their boundary borders stroked
      expect(strokeRects.length).toBe(CAPE_UV_FACES.length);

      // Verify each border matches the respective face color
      for (const face of CAPE_UV_FACES) {
        const found = strokeRects.some((s) => s.strokeStyle === face.color);
        expect(found).toBe(true);
      }
    });

    it('renderUVForeground renders legible text labels with high-contrast badges', () => {
      const { ctx, fillTexts, fillRects } = createSpyContext(800, 600);
      const viewport = {
        panX: 50,
        panY: 50,
        zoom: 12,
        viewportWidth: 800,
        viewportHeight: 600,
      };

      renderUVForeground(ctx, 1, viewport);

      // Text labels must be rendered for visible faces that fit
      expect(fillTexts.length).toBeGreaterThan(0);

      // Verify badge background is rendered with high-contrast dark color (rgba(15, 23, 42, ...))
      const darkBadges = fillRects.filter((r) => r.fillStyle.includes('15, 23, 42'));
      expect(darkBadges.length).toBe(fillTexts.length);

      // Check that front and back labels exist
      const texts = fillTexts.map((t) => t.text);
      expect(texts.some((t) => t.includes('Traseira') || t.includes('Back'))).toBe(true);
      expect(texts.some((t) => t.includes('Frente') || t.includes('Front'))).toBe(true);
    });

    it('does NOT fill the full face area in foreground layer (only badge backgrounds)', () => {
      const { ctx, fillRects } = createSpyContext(800, 600);
      const viewport = {
        panX: 50,
        panY: 50,
        zoom: 10,
        viewportWidth: 800,
        viewportHeight: 600,
      };

      renderUVForeground(ctx, 1, viewport);

      // Any fillRect in foreground layer must only be small label badges (never face-sized)
      for (const rect of fillRects) {
        expect(rect.fillStyle).toContain('15, 23, 42');
        expect(rect.h).toBeLessThanOrEqual(14);
      }
    });
  });

  // 3. Document and Texture Data Non-Destructive Integrity
  describe('3. Non-Destructive Cape Pixels & PNG Export Integrity', () => {
    it('painted pixels retain exact RGBA values without UV guide contamination', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      // Paint on back face (12, 1) and front face (1, 1)
      const pureRed = { r: 255, g: 0, b: 0, a: 255 };
      const pureGreen = { r: 0, g: 255, b: 0, a: 255 };

      DrawingEngine.setPixel(layer.ctx, 12, 1, pureRed, 'draw');
      DrawingEngine.setPixel(layer.ctx, 1, 1, pureGreen, 'draw');

      const comp = doc.composite();
      const compCtx = comp.getContext('2d')!;

      const redSample = DrawingEngine.getPixel(compCtx, 12, 1);
      expect(redSample).toEqual(pureRed);

      const greenSample = DrawingEngine.getPixel(compCtx, 1, 1);
      expect(greenSample).toEqual(pureGreen);

      // Unpainted transparent areas remain completely transparent
      const emptySample = DrawingEngine.getPixel(compCtx, 0, 0);
      expect(emptySample.a).toBe(0);
    });

    it('PNG export output does not contain any UV background, border, or label artifacts', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      // Draw custom pixel art
      const blue = { r: 10, g: 20, b: 30, a: 255 };
      DrawingEngine.setPixel(layer.ctx, 5, 5, blue, 'draw');

      const comp = doc.composite();
      expect(comp.width).toBe(64);
      expect(comp.height).toBe(32);

      // Verify no UV guide borders or fills leaked into composite
      const ctx = comp.getContext('2d')!;
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 64; x++) {
          if (x === 5 && y === 5) {
            expect(DrawingEngine.getPixel(ctx, x, y)).toEqual(blue);
          } else {
            expect(DrawingEngine.getPixel(ctx, x, y).a).toBe(0);
          }
        }
      }
    });
  });

  // 4. Proportional Scaling Across All Resolutions
  describe('4. Resolution Invariance (HD Support: 64x32 to 1024x512)', () => {
    it('UV faces and outlines scale strictly proportionally across HD scales', () => {
      const scales = [1, 2, 4, 8, 16];
      for (const scale of scales) {
        const faces = getScaledUVFaces(scale);
        expect(faces.length).toBe(6);

        const back = faces.find((f) => f.name === 'back')!;
        const front = faces.find((f) => f.name === 'front')!;
        const top = faces.find((f) => f.name === 'top')!;

        expect(back.width).toBe(10 * scale);
        expect(back.height).toBe(16 * scale);
        expect(front.width).toBe(10 * scale);
        expect(front.height).toBe(16 * scale);
        expect(top.width).toBe(10 * scale);
        expect(top.height).toBe(1 * scale);
      }
    });

    it('renderUVBackground and renderUVForeground adapt to HD scales without crashing', () => {
      const { ctx: bgCtx } = createSpyContext(1920, 1080);
      const { ctx: fgCtx } = createSpyContext(1920, 1080);

      const viewport = {
        panX: 100,
        panY: 100,
        zoom: 1.5,
        viewportWidth: 1920,
        viewportHeight: 1080,
      };

      // Scale 16x (1024x512)
      expect(() => renderUVBackground(bgCtx, 16, viewport)).not.toThrow();
      expect(() => renderUVForeground(fgCtx, 16, viewport)).not.toThrow();
    });
  });
});
