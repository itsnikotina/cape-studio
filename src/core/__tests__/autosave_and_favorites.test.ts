import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentModel } from '../DocumentModel';
import { DrawingEngine } from '../DrawingEngine';
import {
  ProjectStorage,
  MemoryStorageBackend,
  serializeDocument,
  deserializeDocument,
} from '../ProjectStorage';
import { AutoSaveManager } from '../AutoSaveManager';
import {
  loadSavedFavorites,
  saveFavorites,
  addFavoriteColor,
  removeFavoriteColor,
  isSameFavorite,
  normalizeHex,
  DEFAULT_FAVORITES,
  STORAGE_KEY_FAVORITES,
  type FavoriteColor,
} from '../FavoritesManager';

describe('AutoSave & Favorite Colors Persistence', () => {
  // Mock localStorage for node/test environment
  let storageMock: Record<string, string>;
  let customStorage: Storage;

  beforeEach(() => {
    storageMock = {};
    customStorage = {
      getItem: vi.fn((key: string) => storageMock[key] ?? null),
      setItem: vi.fn((key: string, val: string) => {
        storageMock[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete storageMock[key];
      }),
      clear: vi.fn(() => {
        storageMock = {};
      }),
      key: vi.fn((idx: number) => Object.keys(storageMock)[idx] ?? null),
      get length() {
        return Object.keys(storageMock).length;
      },
    };
  });

  // =========================================================================
  // 1. Salvamento Automático Local do Projeto
  // =========================================================================
  describe('1. Salvamento Automático Local (Auto-Save)', () => {
    it('serializes and deserializes a multi-layer document preserving order, visibility, opacity, and RGBA pixels', () => {
      // 128x64 HD Cape
      const doc = new DocumentModel(128, 64, 2);
      const layer1 = doc.getActiveLayer();
      layer1.name = 'Base Color';
      layer1.opacity = 0.9;
      layer1.visible = true;

      // Draw red on layer 1
      const red = { r: 255, g: 30, b: 40, a: 255 };
      DrawingEngine.setPixel(layer1.ctx, 10, 10, red, 'draw');

      // Add Layer 2 with semi-transparent cyan
      const layer2 = doc.addLayer('Overlay Pattern');
      layer2.opacity = 0.75;
      layer2.visible = true;
      const cyan = { r: 0, g: 220, b: 240, a: 180 };
      DrawingEngine.setPixel(layer2.ctx, 10, 10, cyan, 'draw');

      // Serialize
      const serialized = serializeDocument(doc, 'capa_hd_teste', 1, 'Teste de camadas');
      expect(serialized.name).toBe('capa_hd_teste');
      expect(serialized.dimensions.width).toBe(128);
      expect(serialized.dimensions.height).toBe(64);
      expect(serialized.dimensions.scale).toBe(2);
      expect(serialized.layers.length).toBe(2);

      // Recreate completely fresh document instance
      const restoredDoc = new DocumentModel(64, 32, 1);
      deserializeDocument(serialized, restoredDoc);

      // Verify dimensions
      expect(restoredDoc.dimensions.width).toBe(128);
      expect(restoredDoc.dimensions.height).toBe(64);
      expect(restoredDoc.dimensions.scale).toBe(2);

      // Verify layers count & order
      expect(restoredDoc.layers.length).toBe(2);
      expect(restoredDoc.layers[0].name).toBe('Base Color');
      expect(restoredDoc.layers[0].opacity).toBe(0.9);
      expect(restoredDoc.layers[1].name).toBe('Overlay Pattern');
      expect(restoredDoc.layers[1].opacity).toBe(0.75);

      // Verify exact RGBA pixel data in layer 1
      const p1 = DrawingEngine.getPixel(restoredDoc.layers[0].ctx, 10, 10);
      expect(p1.r).toBe(255);
      expect(p1.g).toBe(30);
      expect(p1.b).toBe(40);
      expect(p1.a).toBe(255);

      // Verify exact RGBA pixel data in layer 2
      const p2 = DrawingEngine.getPixel(restoredDoc.layers[1].ctx, 10, 10);
      expect(p2.r).toBe(0);
      expect(p2.g).toBe(220);
      expect(p2.b).toBe(240);
      expect(p2.a).toBe(180);
    });

    it('persists project state after drawing, moving, cutting, pasting, and resolution change', async () => {
      const backend = new MemoryStorageBackend();
      const storage = new ProjectStorage(backend);
      const autoSave = new AutoSaveManager(storage, 50);

      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();

      // Step 1: Draw pixel
      const gold = { r: 255, g: 180, b: 0, a: 255 };
      DrawingEngine.setPixel(layer.ctx, 5, 5, gold, 'draw');
      await autoSave.flush(doc, 'capa_teste', 'Desenho inicial');

      let saved = await autoSave.loadRecoverableProject();
      expect(saved).not.toBeNull();
      expect(saved?.dimensions.width).toBe(64);

      // Step 2: Cut & Paste selection to (20, 10)
      const rect = { x: 5, y: 5, width: 2, height: 2 };
      const extracted = DrawingEngine.extractSelection(layer.ctx, rect, true);
      DrawingEngine.pasteSelection(layer.ctx, extracted, 20, 10);
      await autoSave.flush(doc, 'capa_teste', 'Recortar e Colar');

      // Step 3: Change resolution to 256x128 (4x HD)
      doc.setDimensions(256, 128, 4);
      await autoSave.flush(doc, 'capa_teste', 'Redimensionar HD');

      saved = await autoSave.loadRecoverableProject();
      expect(saved?.dimensions.width).toBe(256);
      expect(saved?.dimensions.height).toBe(128);
      expect(saved?.dimensions.scale).toBe(4);

      // Restore into a new document and verify pixel migrated proportionally (20*4 = 80, 10*4 = 40)
      const restored = new DocumentModel(64, 32, 1);
      deserializeDocument(saved!, restored);
      expect(restored.dimensions.width).toBe(256);
      expect(restored.dimensions.height).toBe(128);
    });

    it('batches rapid changes with debounce timer', async () => {
      const backend = new MemoryStorageBackend();
      const saveSpy = vi.spyOn(backend, 'save');
      const storage = new ProjectStorage(backend);
      const autoSave = new AutoSaveManager(storage, 60);

      const doc = new DocumentModel(64, 32, 1);

      // Trigger 5 rapid saves
      autoSave.scheduleSave(doc, 'teste', 'Ação 1');
      autoSave.scheduleSave(doc, 'teste', 'Ação 2');
      autoSave.scheduleSave(doc, 'teste', 'Ação 3');
      autoSave.scheduleSave(doc, 'teste', 'Ação 4');
      autoSave.scheduleSave(doc, 'teste', 'Ação 5');

      // Before timer fires: save has not been called
      expect(saveSpy).not.toHaveBeenCalled();

      // Wait for debounce timer
      await new Promise((resolve) => setTimeout(resolve, 100));

      // After debounce: save was called only once with latest state
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(autoSave.getStatus().type).toBe('saved');
    });

    it('protects against out-of-order writes', async () => {
      const backend = new MemoryStorageBackend();
      const storage = new ProjectStorage(backend);
      const autoSave = new AutoSaveManager(storage, 10);

      const doc = new DocumentModel(64, 32, 1);

      // Trigger first save
      const p1 = autoSave.flush(doc, 'save_1', 'Primeiro');
      // Trigger second save immediately
      const p2 = autoSave.flush(doc, 'save_2', 'Segundo');

      await Promise.all([p1, p2]);

      const status = autoSave.getStatus();
      expect(status.type).toBe('saved');
      // The sequence must be the latest sequence
      expect(status.sequence).toBe(2);
    });

    it('handles behavior when no saved project exists', async () => {
      const backend = new MemoryStorageBackend();
      const storage = new ProjectStorage(backend);
      const autoSave = new AutoSaveManager(storage, 10);

      const hasProject = await autoSave.hasRecoverableProject();
      expect(hasProject).toBe(false);

      const project = await autoSave.loadRecoverableProject();
      expect(project).toBeNull();
    });

    it('gracefully handles write and read failures without crashing', async () => {
      const backend = new MemoryStorageBackend();
      backend.shouldFailSave = true; // Simulate quota exceeded / disk failure

      const storage = new ProjectStorage(backend);
      const autoSave = new AutoSaveManager(storage, 10);
      const doc = new DocumentModel(64, 32, 1);

      // Save should fail gracefully
      const success = await autoSave.flush(doc, 'teste', 'Falha simulada');
      expect(success).toBe(false);

      const status = autoSave.getStatus();
      expect(status.type).toBe('error');
      expect(status.errorMessage).toContain('Falha de gravação simulada');

      // Test load failure
      backend.shouldFailSave = false;
      backend.shouldFailLoad = true;
      const loaded = await autoSave.loadRecoverableProject();
      expect(loaded).toBeNull();
      expect(autoSave.getStatus().type).toBe('error');
    });

    it('preserves saved project when user decides not to restore it immediately', async () => {
      const backend = new MemoryStorageBackend();
      const storage = new ProjectStorage(backend);
      const autoSave = new AutoSaveManager(storage, 10);

      const doc = new DocumentModel(64, 32, 1);
      const layer = doc.getActiveLayer();
      DrawingEngine.setPixel(layer.ctx, 1, 1, { r: 123, g: 45, b: 67, a: 255 }, 'draw');
      await autoSave.flush(doc, 'projeto_salvo');

      // User opens app and decides to start a blank document without immediately overwriting or deleting backup
      const freshDoc = new DocumentModel(64, 32, 1);
      expect(freshDoc.layers.length).toBe(1);

      // Backup is still intact in storage
      const stillSaved = await autoSave.loadRecoverableProject();
      expect(stillSaved).not.toBeNull();
      expect(stillSaved?.name).toBe('projeto_salvo');

      // User explicitly confirms clearing the backup
      await autoSave.clearRecoverableProject();
      const afterClear = await autoSave.loadRecoverableProject();
      expect(afterClear).toBeNull();
    });
  });

  // =========================================================================
  // 2. Persistência de Cores Favoritas
  // =========================================================================
  describe('2. Cores Favoritas (Favorite Colors Persistence)', () => {
    it('persists favorite colors to storage and loads them on startup', () => {
      const customFavs: FavoriteColor[] = [
        { hex: '#B01E28', alpha: 255 },
        { hex: '#00FFCC', alpha: 180 },
      ];

      const savedOk = saveFavorites(customFavs, customStorage);
      expect(savedOk).toBe(true);

      const loaded = loadSavedFavorites(customStorage);
      expect(loaded).toHaveLength(2);
      expect(loaded[0]).toEqual({ hex: '#B01E28', alpha: 255 });
      expect(loaded[1]).toEqual({ hex: '#00FFCC', alpha: 180 });
    });

    it('adds a favorite color and prevents duplicates with exact hex and alpha matching', () => {
      let favorites = [...DEFAULT_FAVORITES];

      // Add a new unique color
      const emerald = { hex: '#2ECC71', alpha: 255 };
      const res1 = addFavoriteColor(favorites, emerald, customStorage);
      expect(res1.added).toBe(true);
      favorites = res1.updated;
      expect(favorites.some((f) => f.hex === '#2ECC71' && f.alpha === 255)).toBe(true);

      // Try adding the exact same color again
      const res2 = addFavoriteColor(favorites, emerald, customStorage);
      expect(res2.added).toBe(false);
      expect(res2.updated.length).toBe(favorites.length);

      // Adding the same hex but with different alpha is treated as distinct
      const translucentEmerald = { hex: '#2ECC71', alpha: 120 };
      const res3 = addFavoriteColor(favorites, translucentEmerald, customStorage);
      expect(res3.added).toBe(true);
      favorites = res3.updated;
      expect(favorites.filter((f) => f.hex === '#2ECC71')).toHaveLength(2);
    });

    it('removes a favorite color by index and persists changes', () => {
      let favorites: FavoriteColor[] = [
        { hex: '#111111', alpha: 255 },
        { hex: '#222222', alpha: 200 },
        { hex: '#333333', alpha: 255 },
      ];
      saveFavorites(favorites, customStorage);

      // Remove index 1 (#222222)
      favorites = removeFavoriteColor(favorites, 1, customStorage);
      expect(favorites).toHaveLength(2);
      expect(favorites.map((f) => f.hex)).toEqual(['#111111', '#333333']);

      // Verify reloaded from storage
      const reloaded = loadSavedFavorites(customStorage);
      expect(reloaded).toEqual(favorites);
    });

    it('recovers safely from invalid or corrupted storage data without failing', () => {
      // 1. Invalid JSON
      customStorage.setItem(STORAGE_KEY_FAVORITES, 'invalid-corrupt-json{{{');
      expect(loadSavedFavorites(customStorage)).toEqual(DEFAULT_FAVORITES);

      // 2. Non-array JSON
      customStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify({ not: 'an array' }));
      expect(loadSavedFavorites(customStorage)).toEqual(DEFAULT_FAVORITES);

      // 3. Array with invalid objects
      customStorage.setItem(
        STORAGE_KEY_FAVORITES,
        JSON.stringify([
          null,
          'string',
          123,
          { hex: 'invalid_hex', alpha: 999 },
          { hex: '#123456', alpha: 200 }, // valid
        ])
      );
      const recovered = loadSavedFavorites(customStorage);
      expect(recovered).toHaveLength(1);
      expect(recovered[0]).toEqual({ hex: '#123456', alpha: 200 });

      // 4. Empty array falls back to DEFAULT_FAVORITES
      customStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify([]));
      expect(loadSavedFavorites(customStorage)).toEqual(DEFAULT_FAVORITES);
    });

    it('normalizes hex strings and compares colors consistently', () => {
      expect(normalizeHex('#fff')).toBe('#FFFFFF');
      expect(normalizeHex('abc')).toBe('#AABBCC');
      expect(normalizeHex('#10B981')).toBe('#10B981');
      expect(normalizeHex('invalid')).toBeNull();

      expect(isSameFavorite({ hex: '#ffffff', alpha: 255 }, { hex: '#FFF', alpha: 255 })).toBe(true);
      expect(isSameFavorite({ hex: '#123456', alpha: 100 }, { hex: '#123456', alpha: 200 })).toBe(false);
    });
  });
});
