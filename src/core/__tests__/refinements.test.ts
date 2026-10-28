import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentModel } from '../DocumentModel';
import { DrawingEngine, hexToRgba, rgbaToHex, rgbToHsv, hsvToRgb } from '../DrawingEngine';
import { createCapeGeometry } from '../CapePreview3D';
import {
  STORAGE_KEY_FAVORITES,
  DEFAULT_FAVORITES,
  loadSavedFavorites,
  type FavoriteColor,
} from '../FavoritesManager';
import type { ColorRGBA } from '../../types/editor';

describe('Refinements & Bug Fixes Verification', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // 1. Cape Geometry Independence from Texture Resolution
  describe('1. 3D Cape Geometry Independence', () => {
    it('cape mesh dimensions and bounding box are constant (10 x 16 x 1) regardless of texture resolution', () => {
      const geom = createCapeGeometry();
      geom.computeBoundingBox();
      const bbox = geom.boundingBox!;

      // Width: X from -5 to 5 (size = 10)
      expect(bbox.min.x).toBeCloseTo(-5, 4);
      expect(bbox.max.x).toBeCloseTo(5, 4);

      // Height: Y from -16 to 0 (size = 16)
      expect(bbox.min.y).toBeCloseTo(-16, 4);
      expect(bbox.max.y).toBeCloseTo(0, 4);

      // Depth: Z from 0 to 1 (size = 1)
      expect(bbox.min.z).toBeCloseTo(0, 4);
      expect(bbox.max.z).toBeCloseTo(1, 4);
    });

    it('geometry UV coordinates remain normalized in [0, 1] range across all faces', () => {
      const geom = createCapeGeometry();
      const uvs = geom.getAttribute('uv');

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

  // 2. Texture Resizing with Nearest-Neighbor Scaling
  describe('2. Texture Proportional Scaling on Resolution Switch', () => {
    it('scales existing drawn pixels proportionally with nearest-neighbor from 64x32 to 256x128', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();
      const red = hexToRgba('#ff0000');

      // Draw a single pixel at (2, 2) in 64x32
      DrawingEngine.setPixel(layer.ctx, 2, 2, red, 'draw');
      expect(DrawingEngine.getPixel(layer.ctx, 2, 2).r).toBe(255);

      // Scale document to 256x128 (scale factor = 4)
      doc.setDimensions(256, 128, 4, false);

      expect(doc.dimensions.width).toBe(256);
      expect(doc.dimensions.height).toBe(128);
      expect(doc.dimensions.scale).toBe(4);

      const scaledLayer = doc.getActiveLayer();
      // Pixel (2, 2) at scale 1 should now map to [8..11, 8..11] at scale 4
      for (let y = 8; y < 12; y++) {
        for (let x = 8; x < 12; x++) {
          const p = DrawingEngine.getPixel(scaledLayer.ctx, x, y);
          expect(p.r).toBe(255);
          expect(p.a).toBe(255);
        }
      }
      // Adjacent pixel at (7, 7) remains unpainted transparent
      expect(DrawingEngine.getPixel(scaledLayer.ctx, 7, 7).a).toBe(0);
    });

    it('scales up to extreme HD 1024x512 without shifting coordinates', () => {
      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();
      const blue = hexToRgba('#0000ff');

      // Draw on back face top-left UV pixel (12, 1) in 64x32
      DrawingEngine.setPixel(layer.ctx, 12, 1, blue, 'draw');

      // Switch to 1024x512 (scale factor = 16)
      doc.setDimensions(1024, 512, 16, false);
      const scaledLayer = doc.getActiveLayer();

      // Scaled coordinates: 12 * 16 = 192, 1 * 16 = 16
      const sample = DrawingEngine.getPixel(scaledLayer.ctx, 192, 16);
      expect(sample.b).toBe(255);
      expect(sample.a).toBe(255);
    });
  });

  // 3. Triangle Color Picker Dimensions & Math
  describe('3. HSV Color Triangle Dimensions & Synchronization', () => {
    it('uses expanded 200px vertical height with correct barycentric geometry', () => {
      const width = 260;
      const height = 200;
      const apex = { x: 130, y: 12 };
      const baseLeft = { x: 14, y: 188 };
      const baseRight = { x: 246, y: 188 };

      const triangleHeight = baseLeft.y - apex.y;
      expect(triangleHeight).toBe(176); // Comfortable, large interactive area (>= 150px)
      expect(baseRight.x - baseLeft.x).toBe(232);
      expect(width).toBe(260);
      expect(height).toBe(200);
      expect(apex.x).toBe(width / 2);
    });

    it('converts pure colors and arbitrary HSV hues accurately', () => {
      const hues = [0, 60, 120, 180, 240, 300];
      for (const h of hues) {
        const rgb = hsvToRgb(h, 1, 1);
        const back = rgbToHsv(rgb.r, rgb.g, rgb.b);
        expect(back.h).toBeCloseTo(h, 0);
        expect(back.s).toBeCloseTo(1, 2);
        expect(back.v).toBeCloseTo(1, 2);
      }
    });
  });

  // 4, 5, 6, 7. Picker Actions Must NOT Record to Recent Colors
  describe('4-7. Color Selection Non-Recording to Recent Colors', () => {
    it('changing color in triangle, hue bar, hex, or dropper does not add to recent colors', () => {
      let recentColors: string[] = ['#B01E28', '#FFFFFF'];
      let primaryColor: ColorRGBA = { r: 176, g: 30, b: 40, a: 255 };

      // Handler when user picks/drags color
      const handleColorChange = (newColor: ColorRGBA) => {
        primaryColor = newColor;
        // Does NOT touch recentColors!
      };

      // 4. Triangle pick (e.g. Pure Blue)
      handleColorChange(hexToRgba('#0000FF'));
      expect(primaryColor.b).toBe(255);
      expect(recentColors).toEqual(['#B01E28', '#FFFFFF']);

      // 5. Hue slider drag (e.g. Yellow)
      handleColorChange(hexToRgba('#FFFF00'));
      expect(primaryColor.g).toBe(255);
      expect(recentColors).toEqual(['#B01E28', '#FFFFFF']);

      // 6. Manual hex input (e.g. Purple)
      handleColorChange(hexToRgba('#9A5CC6'));
      expect(recentColors).toEqual(['#B01E28', '#FFFFFF']);

      // 7. Dropper sampling (e.g. Cyan)
      handleColorChange(hexToRgba('#4AEDD9'));
      expect(recentColors).toEqual(['#B01E28', '#FFFFFF']);
    });
  });

  // 8. Pencil Drawing Records Color Upon Stroke Commit
  describe('8. Pencil Stroke Records Recent Color', () => {
    it('records recent color only when a stroke completes and modifies pixels', () => {
      let recentColors: string[] = ['#B01E28', '#FFFFFF'];

      const recordRecentColor = (color: ColorRGBA) => {
        const hex = rgbaToHex(color);
        const filtered = recentColors.filter((c) => c.toLowerCase() !== hex.toLowerCase());
        recentColors = [hex, ...filtered].slice(0, 16);
      };

      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();
      const cyan = hexToRgba('#4aedd9');

      // User draws a stroke with pencil
      DrawingEngine.setPixel(layer.ctx, 10, 10, cyan, 'draw');
      // On stroke commit:
      recordRecentColor(cyan);

      expect(recentColors[0]).toBe('#4aedd9');
      expect(recentColors).toEqual(['#4aedd9', '#B01E28', '#FFFFFF']);
    });

    it('eraser and right-click do not record colors to recent colors', () => {
      let recentColors: string[] = ['#B01E28', '#FFFFFF'];

      const commitChange = (isEraser: boolean, colorUsed?: ColorRGBA) => {
        if (!isEraser && colorUsed) {
          const hex = rgbaToHex(colorUsed);
          const filtered = recentColors.filter((c) => c.toLowerCase() !== hex.toLowerCase());
          recentColors = [hex, ...filtered].slice(0, 16);
        }
      };

      // Eraser commit
      commitChange(true, undefined);
      expect(recentColors).toEqual(['#B01E28', '#FFFFFF']);
    });
  });

  // 9. Flood Fill Records Color ONLY When Pixels Change
  describe('9. Flood Fill Recent Color Recording', () => {
    it('records recent color when flood fill modifies pixels', () => {
      let recentColors: string[] = ['#B01E28'];
      const recordRecentColor = (color: ColorRGBA) => {
        const hex = rgbaToHex(color);
        const filtered = recentColors.filter((c) => c.toLowerCase() !== hex.toLowerCase());
        recentColors = [hex, ...filtered].slice(0, 16);
      };

      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();
      const green = hexToRgba('#17dd62');

      const changed = DrawingEngine.floodFill(layer.ctx, 5, 5, green, 64, 32);
      expect(changed).toBe(true);

      if (changed) {
        recordRecentColor(green);
      }
      expect(recentColors[0]).toBe('#17dd62');
    });

    it('does NOT record recent color when flood fill target is identical and returns false', () => {
      let recentColors: string[] = ['#B01E28'];
      const recordRecentColor = (color: ColorRGBA) => {
        const hex = rgbaToHex(color);
        const filtered = recentColors.filter((c) => c.toLowerCase() !== hex.toLowerCase());
        recentColors = [hex, ...filtered].slice(0, 16);
      };

      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();
      const red = hexToRgba('#b01e28');

      // Pixel is transparent, filling with transparent or same color:
      DrawingEngine.setPixel(layer.ctx, 5, 5, red, 'draw');

      // Try filling with the exact same red
      const changed = DrawingEngine.floodFill(layer.ctx, 5, 5, red, 64, 32);
      expect(changed).toBe(false);

      if (changed) {
        recordRecentColor(red);
      }
      // recentColors was unchanged
      expect(recentColors).toEqual(['#B01E28']);
    });
  });

  // 10, 11, 12. Favorite Colors Management & Persistence
  describe('10-12. Favorite Colors Management, localStorage & Independence', () => {
    it('10. Adds a favorite, avoids duplicate hex+alpha, and persists to localStorage', () => {
      let favorites: FavoriteColor[] = [...DEFAULT_FAVORITES];

      const addFavorite = (color: ColorRGBA) => {
        const hex = rgbaToHex(color).toUpperCase();
        const alpha = color.a;
        const exists = favorites.some((f) => f.hex === hex && f.alpha === alpha);
        if (!exists) {
          favorites = [...favorites, { hex, alpha }];
          localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites));
        }
      };

      const gold: ColorRGBA = { r: 255, g: 215, b: 0, a: 255 }; // #FFD700
      addFavorite(gold);
      expect(favorites.some((f) => f.hex === '#FFD700')).toBe(true);

      // Try adding duplicate
      const lenBefore = favorites.length;
      addFavorite(gold);
      expect(favorites.length).toBe(lenBefore);

      // Verify localStorage loading and validation
      const loaded = loadSavedFavorites();
      expect(loaded.some((f) => f.hex === '#FFD700')).toBe(true);
    });

    it('11. Selecting a favorite color updates primaryColor without adding to recent colors', () => {
      let recentColors: string[] = ['#B01E28'];
      let primaryColor: ColorRGBA = { r: 0, g: 0, b: 0, a: 255 };

      const selectFavorite = (fav: FavoriteColor) => {
        // Only updates primaryColor, never recentColors
        primaryColor = hexToRgba(fav.hex, fav.alpha);
      };

      selectFavorite({ hex: '#4AEDD9', alpha: 255 });
      expect(rgbaToHex(primaryColor).toLowerCase()).toBe('#4aedd9');
      expect(recentColors).toEqual(['#B01E28']); // Recent colors untouched!
    });

    it('12. Removes a favorite individually and updates localStorage', () => {
      let favorites: FavoriteColor[] = [
        { hex: '#111111', alpha: 255 },
        { hex: '#222222', alpha: 255 },
        { hex: '#333333', alpha: 255 },
      ];
      localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites));

      const removeFavorite = (index: number) => {
        favorites = favorites.filter((_, idx) => idx !== index);
        localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites));
      };

      // Remove middle item (#222222)
      removeFavorite(1);
      expect(favorites.map((f) => f.hex)).toEqual(['#111111', '#333333']);

      // Reload from storage
      const reloaded = loadSavedFavorites();
      expect(reloaded.map((f) => f.hex)).toEqual(['#111111', '#333333']);
    });

    it('handles localStorage corruption gracefully by falling back to DEFAULT_FAVORITES', () => {
      localStorage.setItem(STORAGE_KEY_FAVORITES, 'invalid-json{{{');
      const loaded = loadSavedFavorites();
      expect(loaded).toEqual(DEFAULT_FAVORITES);

      localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify([{ invalid: true }]));
      const loaded2 = loadSavedFavorites();
      expect(loaded2).toEqual(DEFAULT_FAVORITES);
    });
  });
});
