import { describe, it, expect, beforeEach } from 'vitest';
import { getScaledUVFaces, getUVFaceAt } from '../UVLayout';
import { TextureImporter } from '../TextureImporter';
import { DocumentModel } from '../DocumentModel';
import { HistoryManager } from '../HistoryManager';
import { hexToRgba, rgbaToHex, colorsMatch } from '../DrawingEngine';
import { createCapeGeometry } from '../CapePreview3D';

describe('CapePreview3D Geometry', () => {
  it('creates cape geometry with valid attributes and 36 vertices (6 faces * 2 tris * 3)', () => {
    const geom = createCapeGeometry();
    const pos = geom.getAttribute('position');
    const uvs = geom.getAttribute('uv');
    const norms = geom.getAttribute('normal');

    expect(pos.count).toBe(36);
    expect(uvs.count).toBe(36);
    expect(norms.count).toBe(36);

    // Verify all UVs are between 0 and 1
    for (let i = 0; i < uvs.count; i++) {
      const u = uvs.getX(i);
      const v = uvs.getY(i);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('UVLayout', () => {
  it('should scale UV regions proportionally at 1x (64x32)', () => {
    const faces = getScaledUVFaces(1);
    const top = faces.find((f) => f.name === 'top')!;
    const back = faces.find((f) => f.name === 'back')!;

    expect(top.x).toBe(1);
    expect(top.y).toBe(0);
    expect(top.width).toBe(10);
    expect(top.height).toBe(1);

    expect(back.x).toBe(12);
    expect(back.y).toBe(1);
    expect(back.width).toBe(10);
    expect(back.height).toBe(16);
  });

  it('should scale UV regions proportionally at 4x (256x128)', () => {
    const faces = getScaledUVFaces(4);
    const top = faces.find((f) => f.name === 'top')!;
    const back = faces.find((f) => f.name === 'back')!;

    expect(top.x).toBe(4);
    expect(top.y).toBe(0);
    expect(top.width).toBe(40);
    expect(top.height).toBe(4);

    expect(back.x).toBe(48);
    expect(back.y).toBe(4);
    expect(back.width).toBe(40);
    expect(back.height).toBe(64);
  });

  it('should scale UV regions proportionally at 16x (1024x512)', () => {
    const faces = getScaledUVFaces(16);
    const right = faces.find((f) => f.name === 'right')!;
    expect(right.x).toBe(0);
    expect(right.y).toBe(16);
    expect(right.width).toBe(16);
    expect(right.height).toBe(256);
  });

  it('should detect the correct UV face at given coordinates', () => {
    // In 64x32, Back face is at x: 12..21, y: 1..16
    const face = getUVFaceAt(15, 5, 1);
    expect(face).not.toBeNull();
    expect(face?.name).toBe('back');

    // Outside all UV regions
    const outside = getUVFaceAt(30, 20, 1);
    expect(outside).toBeNull();
  });
});

describe('TextureImporter', () => {
  it('should validate standard 64x32 as valid HD scale 1', () => {
    const res = TextureImporter.validateDimensions(64, 32);
    expect(res.isValid).toBe(true);
    expect(res.isStandardHD).toBe(true);
    expect(res.scale).toBe(1);
    expect(res.warning).toBeUndefined();
  });

  it('should validate standard HD resolutions 128x64, 256x128, 512x256, 1024x512', () => {
    expect(TextureImporter.validateDimensions(128, 64).scale).toBe(2);
    expect(TextureImporter.validateDimensions(256, 128).scale).toBe(4);
    expect(TextureImporter.validateDimensions(512, 256).scale).toBe(8);
    expect(TextureImporter.validateDimensions(1024, 512).scale).toBe(16);
    expect(TextureImporter.validateDimensions(2048, 1024).scale).toBe(32);
  });

  it('should warn for 2:1 ratio images that are not multiples of 64x32', () => {
    const res = TextureImporter.validateDimensions(100, 50);
    expect(res.isValid).toBe(true);
    expect(res.isStandardHD).toBe(false);
    expect(res.warning).toBeDefined();
  });

  it('should invalidate non-2:1 dimension ratios with explicit warning', () => {
    const res = TextureImporter.validateDimensions(64, 64);
    expect(res.isValid).toBe(false);
    expect(res.isStandardHD).toBe(false);
    expect(res.warning).toBeDefined();
  });
});

describe('DrawingEngine Color Conversions', () => {
  it('converts hex to rgba and back', () => {
    const rgba = hexToRgba('#ff8800', 255);
    expect(rgba.r).toBe(255);
    expect(rgba.g).toBe(136);
    expect(rgba.b).toBe(0);
    expect(rgba.a).toBe(255);

    const hex = rgbaToHex(rgba);
    expect(hex.toLowerCase()).toBe('#ff8800');
  });

  it('handles 3-digit hex strings', () => {
    const rgba = hexToRgba('#f00');
    expect(rgba.r).toBe(255);
    expect(rgba.g).toBe(0);
    expect(rgba.b).toBe(0);
  });

  it('checks color equality including alpha', () => {
    expect(colorsMatch({ r: 10, g: 20, b: 30, a: 255 }, { r: 10, g: 20, b: 30, a: 255 })).toBe(true);
    expect(colorsMatch({ r: 10, g: 20, b: 30, a: 255 }, { r: 10, g: 20, b: 30, a: 128 })).toBe(false);
    // Both fully transparent should match
    expect(colorsMatch({ r: 10, g: 20, b: 30, a: 0 }, { r: 50, g: 60, b: 70, a: 0 })).toBe(true);
  });
});

describe('DocumentModel & Layers', () => {
  let doc: DocumentModel;

  beforeEach(() => {
    doc = new DocumentModel(64, 32, 1);
  });

  it('initializes with 1 base layer and correct dimensions', () => {
    expect(doc.layers.length).toBe(1);
    expect(doc.dimensions.width).toBe(64);
    expect(doc.dimensions.height).toBe(32);
    expect(doc.dimensions.scale).toBe(1);
  });

  it('can add, duplicate, rename and delete layers', () => {
    const layer2 = doc.addLayer('Details');
    expect(doc.layers.length).toBe(2);
    expect(doc.activeLayerId).toBe(layer2.id);

    doc.renameLayer(layer2.id, 'Cape Design');
    expect(doc.getActiveLayer().name).toBe('Cape Design');

    const copy = doc.duplicateLayer(layer2.id);
    expect(copy).not.toBeNull();
    expect(doc.layers.length).toBe(3);

    const deleted = doc.deleteLayer(copy!.id);
    expect(deleted).toBe(true);
    expect(doc.layers.length).toBe(2);
  });

  it('does not allow deleting the last remaining layer', () => {
    expect(doc.layers.length).toBe(1);
    const deleted = doc.deleteLayer(doc.layers[0].id);
    expect(deleted).toBe(false);
    expect(doc.layers.length).toBe(1);
  });

  it('can reorder layers', () => {
    doc.addLayer('L2');
    doc.addLayer('L3');

    // Current order
    const initialFirst = doc.layers[0].id;
    doc.reorderLayers(0, 2);
    expect(doc.layers[2].id).toBe(initialFirst);
  });
});

describe('HistoryManager', () => {
  let history: HistoryManager;

  beforeEach(() => {
    history = new HistoryManager(5);
  });

  it('records states and supports undo / redo', () => {
    const stateA = { description: 'State A', width: 64, height: 32, activeLayerId: '1', layers: [] };
    const stateB = { description: 'State B', width: 64, height: 32, activeLayerId: '1', layers: [] };
    const stateC = { description: 'State C', width: 64, height: 32, activeLayerId: '1', layers: [] };

    history.pushState(stateA);
    history.pushState(stateB);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);

    // Undo from C
    const undone = history.undo(stateC);
    expect(undone?.description).toBe('State B');
    expect(history.canRedo()).toBe(true);

    // Redo
    const redone = history.redo(stateB);
    expect(redone?.description).toBe('State C');
  });

  it('caps history stack to max limit', () => {
    for (let i = 0; i < 10; i++) {
      history.pushState({ description: `State ${i}`, width: 64, height: 32, activeLayerId: '1', layers: [] });
    }
    expect(history.getUndoCount()).toBe(5);
  });
});
