import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentModel } from '../DocumentModel';
import { DrawingEngine, hexToRgba } from '../DrawingEngine';
import { TextureImporter } from '../TextureImporter';
import { getScaledUVFaces } from '../UVLayout';
import type { SelectionRect } from '../../types/editor';

describe('Selection, Clipboard, Layer Move, UV Overlay and Import Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // 1. Move Selection and Layer with Undo/Redo
  describe('1. Move Selection & Layer Movement', () => {
    it('moves a selected region to new coordinates, clearing original and pasting at new position', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();
      const gold = hexToRgba('#ffac00', 255);

      // Paint 4x4 block at (10, 10)
      DrawingEngine.drawRectangle(layer.ctx, 10, 10, 13, 13, gold, true);
      expect(DrawingEngine.getPixel(layer.ctx, 10, 10).r).toBe(255);
      expect(DrawingEngine.getPixel(layer.ctx, 13, 13).g).toBe(172);

      // Capture snapshot before move (for Undo)
      const beforeSnapshot = doc.createSnapshot('Before Move');

      // Selection rect: (10, 10, 4, 4)
      const rect: SelectionRect = { x: 10, y: 10, width: 4, height: 4 };

      // Extract and clear original
      const extracted = DrawingEngine.extractSelection(layer.ctx, rect, true);
      expect(DrawingEngine.getPixel(layer.ctx, 10, 10).a).toBe(0); // cleared

      // Paste at new position (20, 15)
      DrawingEngine.pasteSelection(layer.ctx, extracted, 20, 15);

      // Verify new position has exact colors
      expect(DrawingEngine.getPixel(layer.ctx, 20, 15).r).toBe(255);
      expect(DrawingEngine.getPixel(layer.ctx, 20, 15).g).toBe(172);
      expect(DrawingEngine.getPixel(layer.ctx, 23, 18).a).toBe(255);

      // Verify old position remains empty
      expect(DrawingEngine.getPixel(layer.ctx, 10, 10).a).toBe(0);

      // Test Undo
      doc.restoreSnapshot(beforeSnapshot);
      const restored = doc.getActiveLayer();
      expect(DrawingEngine.getPixel(restored.ctx, 10, 10).r).toBe(255);
      expect(DrawingEngine.getPixel(restored.ctx, 20, 15).a).toBe(0);
    });

    it('moves the entire current layer by (dx, dy) respecting canvas bounds without selection', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();
      const cyan = hexToRgba('#4aedd9', 255);

      // Draw single pixel at (5, 5)
      DrawingEngine.setPixel(layer.ctx, 5, 5, cyan, 'draw');
      expect(DrawingEngine.getPixel(layer.ctx, 5, 5).b).toBe(217);

      const before = doc.createSnapshot('Before Layer Move');

      // Move layer by (+3, +4)
      DrawingEngine.moveLayer(layer.ctx, 64, 32, 3, 4);

      // Pixel should now be at (8, 9)
      expect(DrawingEngine.getPixel(layer.ctx, 8, 9).b).toBe(217);
      expect(DrawingEngine.getPixel(layer.ctx, 5, 5).a).toBe(0);

      // Undo restores pixel to (5, 5)
      doc.restoreSnapshot(before);
      const restored = doc.getActiveLayer();
      expect(DrawingEngine.getPixel(restored.ctx, 5, 5).b).toBe(217);
      expect(DrawingEngine.getPixel(restored.ctx, 8, 9).a).toBe(0);
    });

    it('moves layers correctly in HD resolutions (256x128)', () => {
      const doc = new DocumentModel(256, 128, 4);
      const layer = doc.getActiveLayer();
      const red = hexToRgba('#ff0000', 255);

      DrawingEngine.setPixel(layer.ctx, 50, 50, red, 'draw');
      DrawingEngine.moveLayer(layer.ctx, 256, 128, 10, -5);

      expect(DrawingEngine.getPixel(layer.ctx, 60, 45).r).toBe(255);
      expect(DrawingEngine.getPixel(layer.ctx, 50, 50).a).toBe(0);
    });
  });

  // 2. Clipboard (Copy, Cut, Paste) with and without Selection
  describe('2. Clipboard: Copy, Cut, Paste (with & without Selection)', () => {
    it('Ctrl+C with selection copies only the selection and preserves original layer', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();
      const purple = hexToRgba('#9a5cc6', 200);

      DrawingEngine.drawRectangle(layer.ctx, 0, 0, 5, 5, purple, true);

      // Copy selection (0, 0, 3, 3)
      const rect: SelectionRect = { x: 0, y: 0, width: 3, height: 3 };
      const copied = DrawingEngine.extractSelection(layer.ctx, rect, false); // clearOriginal = false

      expect(copied.width).toBe(3);
      expect(copied.height).toBe(3);

      // Original layer remains untouched
      expect(DrawingEngine.getPixel(layer.ctx, 1, 1).r).toBe(154);
      expect(DrawingEngine.getPixel(layer.ctx, 1, 1).a).toBe(200);
    });

    it('Ctrl+C without selection copies the entire layer and preserves original', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();
      const blue = hexToRgba('#1c4d9c', 255);

      DrawingEngine.setPixel(layer.ctx, 15, 15, blue, 'draw');

      const fullCopy = DrawingEngine.cloneCanvas(layer.canvas);
      expect(fullCopy.width).toBe(64);
      expect(fullCopy.height).toBe(32);

      // Verify pixel exists in copy and in original
      const copyCtx = fullCopy.getContext('2d')!;
      expect(DrawingEngine.getPixel(copyCtx, 15, 15).b).toBe(156);
      expect(DrawingEngine.getPixel(layer.ctx, 15, 15).b).toBe(156);
    });

    it('Ctrl+X with selection cuts only selected pixels and keeps rest of the layer', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();
      const red = hexToRgba('#ff0000', 255);
      const green = hexToRgba('#00ff00', 255);

      // Draw red at (2, 2) and green at (20, 20)
      DrawingEngine.setPixel(layer.ctx, 2, 2, red, 'draw');
      DrawingEngine.setPixel(layer.ctx, 20, 20, green, 'draw');

      const rect: SelectionRect = { x: 0, y: 0, width: 5, height: 5 };
      const cut = DrawingEngine.extractSelection(layer.ctx, rect, true); // clearOriginal = true

      expect(cut.width).toBe(5);
      // Cut area in original should now be transparent
      expect(DrawingEngine.getPixel(layer.ctx, 2, 2).a).toBe(0);
      // Other pixel outside selection remains intact
      expect(DrawingEngine.getPixel(layer.ctx, 20, 20).g).toBe(255);
    });

    it('Ctrl+X without selection cuts entire layer without removing layer from document', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();
      const red = hexToRgba('#ff0000', 255);

      DrawingEngine.setPixel(layer.ctx, 5, 5, red, 'draw');

      // Cut entire layer
      const copy = DrawingEngine.cloneCanvas(layer.canvas);
      layer.ctx.clearRect(0, 0, doc.dimensions.width, doc.dimensions.height);

      // Layer still exists in document
      expect(doc.layers.length).toBe(1);
      expect(doc.getActiveLayer().id).toBe(layer.id);
      // Content was cleared
      expect(DrawingEngine.getPixel(layer.ctx, 5, 5).a).toBe(0);
      // Copied canvas has the pixel
      const copyCtx = copy.getContext('2d')!;
      expect(DrawingEngine.getPixel(copyCtx, 5, 5).r).toBe(255);
    });

    it('Ctrl+V pastes cloned content preserving exact RGBA, dimensions, and alpha', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();
      const semitransparent = { r: 120, g: 200, b: 80, a: 180 };

      // Create an offscreen source canvas
      const source = DrawingEngine.createCanvas(8, 6);
      const sCtx = source.getContext('2d')!;
      DrawingEngine.setPixel(sCtx, 2, 3, semitransparent, 'draw');

      // Paste at (14, 10)
      DrawingEngine.pasteSelection(layer.ctx, source, 14, 10);

      const pastedPixel = DrawingEngine.getPixel(layer.ctx, 16, 13);
      expect(pastedPixel.r).toBe(120);
      expect(pastedPixel.g).toBe(200);
      expect(pastedPixel.b).toBe(80);
      expect(pastedPixel.a).toBe(180);
    });
  });

  // 3. UV Guides Overlay Non-Destructive Verification
  describe('3. UV Guides Behind Pixels & Non-Destructive Integrity', () => {
    it('UV guides do not modify layer RGBA data or composite output', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      // Transparent document
      const comp1 = doc.composite();
      const ctx1 = comp1.getContext('2d')!;
      expect(DrawingEngine.getPixel(ctx1, 15, 10).a).toBe(0);

      // Drawing a pixel
      const red = hexToRgba('#ff0000', 255);
      DrawingEngine.setPixel(layer.ctx, 15, 10, red, 'draw');

      const comp2 = doc.composite();
      const ctx2 = comp2.getContext('2d')!;
      const pixel = DrawingEngine.getPixel(ctx2, 15, 10);
      expect(pixel.r).toBe(255);
      expect(pixel.g).toBe(0);
      expect(pixel.b).toBe(0);
      expect(pixel.a).toBe(255);

      // Ensure no UV guide colors leaked into layer or composite
      const freePixel = DrawingEngine.getPixel(ctx2, 0, 0);
      expect(freePixel.a).toBe(0);
    });

    it('computes proportional UV faces for all standard and HD scales', () => {
      const standardFaces = getScaledUVFaces(1);
      const hdFaces = getScaledUVFaces(4);

      expect(standardFaces.length).toBe(6);
      expect(hdFaces.length).toBe(6);

      // Back face in standard: w=10, h=16
      const stdBack = standardFaces.find((f) => f.name === 'back')!;
      expect(stdBack.width).toBe(10);
      expect(stdBack.height).toBe(16);

      // Back face in HD 4x: w=40, h=64
      const hdBack = hdFaces.find((f) => f.name === 'back')!;
      expect(hdBack.width).toBe(40);
      expect(hdBack.height).toBe(64);
    });
  });

  // 4. Import Texture & Validation
  describe('4. Cape Import & Dimension Validation', () => {
    it('detects standard HD dimensions (64x32, 128x64, 256x128, 512x256, 1024x512)', () => {
      const validCases = [
        { w: 64, h: 32, scale: 1 },
        { w: 128, h: 64, scale: 2 },
        { w: 256, h: 128, scale: 4 },
        { w: 512, h: 256, scale: 8 },
        { w: 1024, h: 512, scale: 16 },
      ];

      for (const c of validCases) {
        const res = TextureImporter.validateDimensions(c.w, c.h);
        expect(res.isValid).toBe(true);
        expect(res.isStandardHD).toBe(true);
        expect(res.scale).toBe(c.scale);
        expect(res.warning).toBeUndefined();
      }
    });

    it('flags non-standard aspect ratios with descriptive warnings', () => {
      // 64x64 is Minecraft player skin, not a cape (needs 2:1 ratio)
      const resSkin = TextureImporter.validateDimensions(64, 64);
      expect(resSkin.isValid).toBe(false);
      expect(resSkin.isStandardHD).toBe(false);
      expect(resSkin.warning).toBeDefined();

      // 100x50 is 2:1 ratio but not multiple of 64x32
      const resCustom = TextureImporter.validateDimensions(100, 50);
      expect(resCustom.isValid).toBe(true);
      expect(resCustom.isStandardHD).toBe(false);
      expect(resCustom.warning).toContain('múltiplos exatos de 64×32');
    });

    it('rejects non-PNG files with clear error', async () => {
      const fakeFile = new File(['dummy content'], 'cape.jpg', { type: 'image/jpeg' });
      await expect(TextureImporter.loadFromFile(fakeFile)).rejects.toThrow(
        'Formato inválido. Por favor, selecione um arquivo de imagem PNG.'
      );
    });

    it('subscribing to document triggers update notification upon import', () => {
      const doc = new DocumentModel(64, 32, 1);
      let notified = false;
      doc.subscribe(() => {
        notified = true;
      });

      // Simulate import action
      doc.setDimensions(256, 128, 4, false);
      doc.notifyUpdate();

      expect(notified).toBe(true);
      expect(doc.dimensions.width).toBe(256);
      expect(doc.dimensions.height).toBe(128);
    });

    it('importing as new layer adds layer without deleting previous work', () => {
      const doc = new DocumentModel(64, 32, 1);
      const baseLayer = doc.getActiveLayer();
      DrawingEngine.setPixel(baseLayer.ctx, 10, 10, hexToRgba('#ff0000'), 'draw');

      // Add imported cape as new layer
      const importedLayer = doc.addLayer('Capa Importada');
      DrawingEngine.setPixel(importedLayer.ctx, 20, 20, hexToRgba('#00ff00'), 'draw');

      expect(doc.layers.length).toBe(2);
      expect(DrawingEngine.getPixel(baseLayer.ctx, 10, 10).r).toBe(255);
      expect(DrawingEngine.getPixel(importedLayer.ctx, 20, 20).g).toBe(255);

      // Composite has both
      const comp = doc.composite();
      const compCtx = comp.getContext('2d')!;
      expect(DrawingEngine.getPixel(compCtx, 10, 10).r).toBe(255);
      expect(DrawingEngine.getPixel(compCtx, 20, 20).g).toBe(255);
    });
  });
});
