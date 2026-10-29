import { describe, it, expect } from 'vitest';
import { DocumentModel } from '../DocumentModel';
import { DrawingEngine } from '../DrawingEngine';
import type { ColorRGBA, SelectionRect, GradientConfig } from '../../types/editor';

describe('Gradient Tool and Selection Masking Tests', () => {
  const red: ColorRGBA = { r: 255, g: 0, b: 0, a: 255 };
  const blue: ColorRGBA = { r: 0, g: 0, b: 255, a: 255 };
  const white: ColorRGBA = { r: 255, g: 255, b: 255, a: 255 };

  describe('1. Gradient Tool Types and Interpolation', () => {
    it('applies linear gradient between two points', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      const config: GradientConfig = {
        type: 'linear',
        reverse: false,
        opacity: 1.0,
      };

      const applied = DrawingEngine.applyGradient(
        layer.ctx,
        0, 0,
        20, 0,
        red,
        blue,
        config,
        64, 32
      );

      expect(applied).toBe(true);

      const startPix = DrawingEngine.getPixel(layer.ctx, 0, 0);
      expect(startPix.r).toBe(255);
      expect(startPix.b).toBe(0);

      const endPix = DrawingEngine.getPixel(layer.ctx, 20, 0);
      expect(endPix.r).toBe(0);
      expect(endPix.b).toBe(255);

      const midPix = DrawingEngine.getPixel(layer.ctx, 10, 0);
      expect(midPix.r).toBeGreaterThan(100);
      expect(midPix.r).toBeLessThan(155);
      expect(midPix.b).toBeGreaterThan(100);
      expect(midPix.b).toBeLessThan(155);
    });

    it('applies radial gradient radiating outward from center', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      const config: GradientConfig = {
        type: 'radial',
        reverse: false,
        opacity: 1.0,
      };

      DrawingEngine.applyGradient(
        layer.ctx,
        10, 10,
        15, 10, // radius = 5
        red,
        blue,
        config,
        64, 32
      );

      // Center (10, 10) must be red (t = 0)
      const centerPix = DrawingEngine.getPixel(layer.ctx, 10, 10);
      expect(centerPix.r).toBe(255);
      expect(centerPix.b).toBe(0);

      // Outside radius (>= 5 units away) must be blue (t = 1)
      const edgePix = DrawingEngine.getPixel(layer.ctx, 15, 10);
      expect(edgePix.r).toBe(0);
      expect(edgePix.b).toBe(255);

      const outsidePix = DrawingEngine.getPixel(layer.ctx, 20, 10);
      expect(outsidePix.r).toBe(0);
      expect(outsidePix.b).toBe(255);
    });

    it('applies angular gradient sweeping 360 degrees around center', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      const config: GradientConfig = {
        type: 'angular',
        reverse: false,
        opacity: 1.0,
      };

      DrawingEngine.applyGradient(
        layer.ctx,
        10, 10,
        20, 10, // vector pointing right (angle 0)
        red,
        blue,
        config,
        64, 32
      );

      // Point directly to the right is angle 0 -> start color (red)
      const rightPix = DrawingEngine.getPixel(layer.ctx, 15, 10);
      expect(rightPix.r).toBe(255);
      expect(rightPix.b).toBe(0);

      // Point directly to the left is angle PI -> halfway (t = 0.5)
      const leftPix = DrawingEngine.getPixel(layer.ctx, 5, 10);
      expect(leftPix.r).toBeGreaterThan(100);
      expect(leftPix.r).toBeLessThan(155);
      expect(leftPix.b).toBeGreaterThan(100);
      expect(leftPix.b).toBeLessThan(155);
    });

    it('applies reflected gradient mirrored across start point', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      const config: GradientConfig = {
        type: 'reflected',
        reverse: false,
        opacity: 1.0,
      };

      DrawingEngine.applyGradient(
        layer.ctx,
        15, 15,
        20, 15, // vector len = 5 pointing right
        red,
        blue,
        config,
        64, 32
      );

      // Center (15, 15) must be red (t = 0)
      const centerPix = DrawingEngine.getPixel(layer.ctx, 15, 15);
      expect(centerPix.r).toBe(255);
      expect(centerPix.b).toBe(0);

      // +5 pixels to right (20, 15) must be blue (t = 1)
      const rightPix = DrawingEngine.getPixel(layer.ctx, 20, 15);
      expect(rightPix.r).toBe(0);
      expect(rightPix.b).toBe(255);

      // -5 pixels to left (10, 15) must ALSO be blue (t = 1, reflected!)
      const leftPix = DrawingEngine.getPixel(layer.ctx, 10, 15);
      expect(leftPix.r).toBe(0);
      expect(leftPix.b).toBe(255);
    });

    it('applies diamond gradient (rhombus shaped)', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      const config: GradientConfig = {
        type: 'diamond',
        reverse: false,
        opacity: 1.0,
      };

      DrawingEngine.applyGradient(
        layer.ctx,
        15, 15,
        20, 15, // radius = 5
        red,
        blue,
        config,
        64, 32
      );

      // Center is red
      expect(DrawingEngine.getPixel(layer.ctx, 15, 15).r).toBe(255);

      // Along axis at distance 5 is blue
      expect(DrawingEngine.getPixel(layer.ctx, 20, 15).b).toBe(255);
      expect(DrawingEngine.getPixel(layer.ctx, 15, 20).b).toBe(255);
      expect(DrawingEngine.getPixel(layer.ctx, 10, 15).b).toBe(255);
      expect(DrawingEngine.getPixel(layer.ctx, 15, 10).b).toBe(255);
    });

    it('reverses gradient colors when reverse is true', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      const config: GradientConfig = {
        type: 'linear',
        reverse: true, // Inverted!
        opacity: 1.0,
      };

      DrawingEngine.applyGradient(
        layer.ctx,
        0, 0,
        10, 0,
        red,
        blue,
        config,
        64, 32
      );

      // With reverse: true, start gets endColor (blue) and end gets startColor (red)
      const startPix = DrawingEngine.getPixel(layer.ctx, 0, 0);
      expect(startPix.r).toBe(0);
      expect(startPix.b).toBe(255);

      const endPix = DrawingEngine.getPixel(layer.ctx, 10, 0);
      expect(endPix.r).toBe(255);
      expect(endPix.b).toBe(0);
    });

    it('respects opacity settings', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      const config50: GradientConfig = {
        type: 'linear',
        reverse: false,
        opacity: 0.5,
      };

      DrawingEngine.applyGradient(
        layer.ctx,
        0, 0,
        10, 0,
        red,
        blue,
        config50,
        64, 32
      );

      const pix = DrawingEngine.getPixel(layer.ctx, 0, 0);
      expect(pix.r).toBe(255);
      expect(pix.a).toBeGreaterThanOrEqual(125);
      expect(pix.a).toBeLessThanOrEqual(130);

      // Opacity 0% should return false and modify nothing
      const doc2 = new DocumentModel(64, 32, 1);
      const layer2 = doc2.getActiveLayer();
      const config0: GradientConfig = {
        type: 'linear',
        reverse: false,
        opacity: 0,
      };
      const res = DrawingEngine.applyGradient(
        layer2.ctx,
        0, 0,
        10, 0,
        red,
        blue,
        config0,
        64, 32
      );
      expect(res).toBe(false);
      expect(DrawingEngine.getPixel(layer2.ctx, 0, 0).a).toBe(0);
    });
  });

  describe('2. Selection Masking for All Drawing Tools', () => {
    const selection: SelectionRect = {
      x: 10,
      y: 10,
      width: 10,
      height: 10,
    };

    it('strictly confines Gradient to the active selection rect', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      const config: GradientConfig = {
        type: 'linear',
        reverse: false,
        opacity: 1.0,
      };

      DrawingEngine.applyGradient(
        layer.ctx,
        0, 0,
        30, 30,
        red,
        blue,
        config,
        64, 32,
        selection
      );

      // Inside selection: modified
      expect(DrawingEngine.getPixel(layer.ctx, 10, 10).a).toBe(255);
      expect(DrawingEngine.getPixel(layer.ctx, 19, 19).a).toBe(255);

      // Outside selection: completely transparent / untouched
      expect(DrawingEngine.getPixel(layer.ctx, 9, 10).a).toBe(0);
      expect(DrawingEngine.getPixel(layer.ctx, 20, 10).a).toBe(0);
      expect(DrawingEngine.getPixel(layer.ctx, 10, 9).a).toBe(0);
      expect(DrawingEngine.getPixel(layer.ctx, 10, 20).a).toBe(0);
      expect(DrawingEngine.getPixel(layer.ctx, 0, 0).a).toBe(0);
      expect(DrawingEngine.getPixel(layer.ctx, 30, 30).a).toBe(0);
    });

    it('strictly confines Flood Fill to selection bounds even if target color spreads beyond', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      // Canvas starts empty (all transparent 0,0,0,0)
      // Fill with blue starting at (12, 12), with selection (10, 10, 10, 10)
      DrawingEngine.floodFill(layer.ctx, 12, 12, blue, 64, 32, selection);

      // Inside selection: filled
      expect(DrawingEngine.getPixel(layer.ctx, 10, 10).b).toBe(255);
      expect(DrawingEngine.getPixel(layer.ctx, 19, 19).b).toBe(255);

      // Outside selection: remains untouched (transparent)
      expect(DrawingEngine.getPixel(layer.ctx, 9, 10).a).toBe(0);
      expect(DrawingEngine.getPixel(layer.ctx, 20, 10).a).toBe(0);
      expect(DrawingEngine.getPixel(layer.ctx, 10, 9).a).toBe(0);
      expect(DrawingEngine.getPixel(layer.ctx, 10, 20).a).toBe(0);
    });

    it('strictly confines Pencil (setPixel) to selection bounds', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      // Outside selection: ignored
      DrawingEngine.setPixel(layer.ctx, 5, 5, red, 'draw', selection);
      expect(DrawingEngine.getPixel(layer.ctx, 5, 5).a).toBe(0);

      // Inside selection: plotted
      DrawingEngine.setPixel(layer.ctx, 10, 10, red, 'draw', selection);
      expect(DrawingEngine.getPixel(layer.ctx, 10, 10).r).toBe(255);
    });

    it('strictly confines Eraser (setPixel mode erase) to selection bounds', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      // Fill canvas background
      DrawingEngine.drawRectangle(layer.ctx, 0, 0, 63, 31, white, true);
      expect(DrawingEngine.getPixel(layer.ctx, 5, 5).a).toBe(255);
      expect(DrawingEngine.getPixel(layer.ctx, 12, 12).a).toBe(255);

      // Erase outside selection: should NOT erase
      DrawingEngine.setPixel(layer.ctx, 5, 5, red, 'erase', selection);
      expect(DrawingEngine.getPixel(layer.ctx, 5, 5).a).toBe(255);

      // Erase inside selection: should erase
      DrawingEngine.setPixel(layer.ctx, 12, 12, red, 'erase', selection);
      expect(DrawingEngine.getPixel(layer.ctx, 12, 12).a).toBe(0);
    });

    it('strictly confines Line (drawLine) to selection bounds', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      // Draw horizontal line through (0, 15) to (30, 15)
      DrawingEngine.drawLine(layer.ctx, 0, 15, 30, 15, red, 'draw', false, 64, selection);

      // Outside selection (x < 10): empty
      expect(DrawingEngine.getPixel(layer.ctx, 5, 15).a).toBe(0);
      expect(DrawingEngine.getPixel(layer.ctx, 9, 15).a).toBe(0);

      // Inside selection (10 <= x <= 19): drawn
      expect(DrawingEngine.getPixel(layer.ctx, 10, 15).r).toBe(255);
      expect(DrawingEngine.getPixel(layer.ctx, 15, 15).r).toBe(255);
      expect(DrawingEngine.getPixel(layer.ctx, 19, 15).r).toBe(255);

      // Outside selection (x > 19): empty
      expect(DrawingEngine.getPixel(layer.ctx, 20, 15).a).toBe(0);
    });

    it('strictly confines Rectangle (drawRectangle) to selection bounds', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      // Draw filled rectangle from (5, 5) to (25, 25)
      DrawingEngine.drawRectangle(layer.ctx, 5, 5, 25, 25, red, true, selection);

      // Outside selection: empty
      expect(DrawingEngine.getPixel(layer.ctx, 6, 6).a).toBe(0);
      expect(DrawingEngine.getPixel(layer.ctx, 22, 22).a).toBe(0);

      // Inside selection: filled
      expect(DrawingEngine.getPixel(layer.ctx, 10, 10).r).toBe(255);
      expect(DrawingEngine.getPixel(layer.ctx, 15, 15).r).toBe(255);
      expect(DrawingEngine.getPixel(layer.ctx, 19, 19).r).toBe(255);
    });

    it('strictly confines Ellipse (drawEllipse) to selection bounds', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      // Draw filled ellipse covering (5, 5) to (25, 25)
      DrawingEngine.drawEllipse(layer.ctx, 5, 5, 25, 25, red, true, selection);

      // Outside selection: empty
      expect(DrawingEngine.getPixel(layer.ctx, 5, 15).a).toBe(0);
      expect(DrawingEngine.getPixel(layer.ctx, 25, 15).a).toBe(0);

      // Inside selection center (15, 15): filled
      expect(DrawingEngine.getPixel(layer.ctx, 15, 15).r).toBe(255);
    });

    it('draws across full canvas when selection is null', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      // Draw line from 0 to 30 without selection
      DrawingEngine.drawLine(layer.ctx, 0, 10, 30, 10, red, 'draw', false, 64, null);

      expect(DrawingEngine.getPixel(layer.ctx, 0, 10).r).toBe(255);
      expect(DrawingEngine.getPixel(layer.ctx, 15, 10).r).toBe(255);
      expect(DrawingEngine.getPixel(layer.ctx, 30, 10).r).toBe(255);
    });
  });

  describe('3. HD Resolutions and Undo/Redo Compatibility', () => {
    it('supports 1024x512 HD resolution scaling with gradient and selection', () => {
      const doc = new DocumentModel(1024, 512, 16);
      const layer = doc.getActiveLayer();

      const hdSelection: SelectionRect = {
        x: 100,
        y: 100,
        width: 200,
        height: 200,
      };

      const config: GradientConfig = {
        type: 'linear',
        reverse: false,
        opacity: 1.0,
      };

      const ok = DrawingEngine.applyGradient(
        layer.ctx,
        0, 0,
        1024, 512,
        red,
        blue,
        config,
        1024, 512,
        hdSelection
      );

      expect(ok).toBe(true);

      // Inside selection
      expect(DrawingEngine.getPixel(layer.ctx, 150, 150).a).toBe(255);
      // Outside selection
      expect(DrawingEngine.getPixel(layer.ctx, 50, 50).a).toBe(0);
      expect(DrawingEngine.getPixel(layer.ctx, 400, 400).a).toBe(0);
    });

    it('records a single history entry for gradient and supports Undo/Redo', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      const initialSnapshot = doc.createSnapshot('Initial');

      const config: GradientConfig = {
        type: 'linear',
        reverse: false,
        opacity: 1.0,
      };

      DrawingEngine.applyGradient(
        layer.ctx,
        0, 0,
        64, 32,
        red,
        blue,
        config,
        64, 32
      );

      expect(DrawingEngine.getPixel(layer.ctx, 0, 0).a).toBe(255);

      // Restore snapshot (Undo)
      doc.restoreSnapshot(initialSnapshot);
      const restoredLayer = doc.getActiveLayer();
      expect(DrawingEngine.getPixel(restoredLayer.ctx, 0, 0).a).toBe(0);
    });
  });
});
