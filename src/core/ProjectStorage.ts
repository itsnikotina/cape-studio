import type { DocumentModel } from './DocumentModel';

export interface SerializedLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  width: number;
  height: number;
  pixelData: Uint8Array;
}

export interface SerializedProject {
  id?: string;
  name: string;
  dimensions: {
    width: number;
    height: number;
    scale: number;
    isCustom?: boolean;
  };
  activeLayerId: string;
  layers: SerializedLayer[];
  updatedAt: number;
  sequence: number;
  description?: string;
}

export interface IStorageBackend {
  save(key: string, project: SerializedProject): Promise<void>;
  load(key: string): Promise<SerializedProject | null>;
  clear(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
}

/**
 * Serializes DocumentModel and layers into a persistent snapshot.
 * Copies pixel bytes to detached Uint8Array for safe storage.
 */
export function serializeDocument(
  doc: DocumentModel,
  name = 'minha_capa',
  sequence = 0,
  description = 'Auto-save'
): SerializedProject {
  const { width, height, scale, isCustom } = doc.dimensions;
  const layers: SerializedLayer[] = doc.layers.map((l) => {
    const imgData = l.ctx.getImageData(0, 0, width, height);
    // Clone bytes to standalone Uint8Array (safe against pooled or sliced ArrayBuffers)
    const pixelData = new Uint8Array(imgData.data);
    return {
      id: l.id,
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      width,
      height,
      pixelData,
    };
  });

  return {
    name,
    dimensions: { width, height, scale, isCustom },
    activeLayerId: doc.activeLayerId,
    layers,
    updatedAt: Date.now(),
    sequence,
    description,
  };
}

/**
 * Restores a DocumentModel from serialized snapshot
 */
export function deserializeDocument(
  saved: SerializedProject,
  targetDoc?: DocumentModel
): DocumentModel {
  const { width, height, scale, isCustom } = saved.dimensions;

  if (targetDoc) {
    targetDoc.dimensions = { width, height, scale, isCustom: Boolean(isCustom) };
    targetDoc.layers = [];
  }

  // Create new document or reuse target
  const DocumentModelClass = targetDoc
    ? (targetDoc.constructor as new (w: number, h: number, s: number, c?: boolean) => DocumentModel)
    : null;

  const doc =
    targetDoc ||
    (DocumentModelClass
      ? new DocumentModelClass(width, height, scale, Boolean(isCustom))
      : targetDoc!);

  // Clear initial layer created by constructor
  doc.layers = [];

  for (const snapLayer of saved.layers) {
    const layer = doc.createLayer(snapLayer.name);
    layer.id = snapLayer.id;
    layer.visible = snapLayer.visible;
    layer.opacity = snapLayer.opacity;

    // Restore pixel bytes reliably regardless of TypedArray / Object / Buffer format
    let clamped: Uint8ClampedArray;
    if (snapLayer.pixelData instanceof Uint8ClampedArray) {
      clamped = snapLayer.pixelData;
    } else if (snapLayer.pixelData instanceof Uint8Array) {
      clamped = new Uint8ClampedArray(
        snapLayer.pixelData.buffer,
        snapLayer.pixelData.byteOffset,
        snapLayer.pixelData.byteLength
      );
    } else if (
      snapLayer.pixelData &&
      (Array.isArray(snapLayer.pixelData) || typeof snapLayer.pixelData === 'object')
    ) {
      clamped = new Uint8ClampedArray(Object.values(snapLayer.pixelData));
    } else {
      clamped = new Uint8ClampedArray(width * height * 4);
    }

    if (layer.ctx) {
      let imgData: ImageData;
      try {
        // Modern web browsers require genuine ImageData instance for ctx.putImageData
        if (typeof ImageData !== 'undefined') {
          imgData = new ImageData(clamped as unknown as Uint8ClampedArray<ArrayBuffer>, width, height);
        } else if (layer.ctx.createImageData) {
          imgData = layer.ctx.createImageData(width, height);
          imgData.data.set(clamped);
        } else {
          imgData = { data: clamped, width, height, colorSpace: 'srgb' } as unknown as ImageData;
        }
      } catch {
        if (layer.ctx.createImageData) {
          imgData = layer.ctx.createImageData(width, height);
          imgData.data.set(clamped);
        } else {
          imgData = { data: clamped, width, height, colorSpace: 'srgb' } as unknown as ImageData;
        }
      }
      layer.ctx.putImageData(imgData, 0, 0);
    }
    doc.layers.push(layer);
  }

  doc.activeLayerId = saved.activeLayerId;
  if (!doc.layers.some((l) => l.id === doc.activeLayerId) && doc.layers.length > 0) {
    doc.activeLayerId = doc.layers[0].id;
  }

  // Pre-composite immediately to sync composite canvas for 2D and 3D preview
  doc.composite();
  doc.notifyUpdate();
  return doc;
}

/**
 * In-Memory backend for test environments and fallback
 */
export class MemoryStorageBackend implements IStorageBackend {
  private store = new Map<string, SerializedProject>();
  public shouldFailSave = false;
  public shouldFailLoad = false;

  async save(key: string, project: SerializedProject): Promise<void> {
    if (this.shouldFailSave) {
      throw new Error('Falha de gravação simulada no armazenamento');
    }
    // Deep clone project and typed arrays
    const clonedLayers = project.layers.map((l) => ({
      ...l,
      pixelData: new Uint8Array(l.pixelData),
    }));
    this.store.set(key, { ...project, layers: clonedLayers });
  }

  async load(key: string): Promise<SerializedProject | null> {
    if (this.shouldFailLoad) {
      throw new Error('Falha de leitura simulada no armazenamento');
    }
    const item = this.store.get(key);
    if (!item) return null;
    const clonedLayers = item.layers.map((l) => ({
      ...l,
      pixelData: new Uint8Array(l.pixelData),
    }));
    return { ...item, layers: clonedLayers };
  }

  async clear(key: string): Promise<void> {
    this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }
}

/**
 * Native IndexedDB backend for persistent in-browser storage
 */
export class IndexedDBBackend implements IStorageBackend {
  private dbName: string;
  private storeName: string;
  private version: number;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(dbName = 'cape_studio_db', storeName = 'project_backup', version = 1) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.version = version;
  }

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB não está disponível neste ambiente'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error || new Error('Falha ao abrir banco de dados IndexedDB'));
      };
    });

    return this.dbPromise;
  }

  async save(key: string, project: SerializedProject): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.put(project, key);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error || new Error('Falha ao salvar dados no IndexedDB'));
        tx.onerror = () => reject(tx.error || new Error('Erro na transação IndexedDB'));
      } catch (err) {
        reject(err);
      }
    });
  }

  async load(key: string): Promise<SerializedProject | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(key);

        req.onsuccess = () => {
          resolve(req.result || null);
        };
        req.onerror = () => reject(req.error || new Error('Falha ao ler dados do IndexedDB'));
      } catch (err) {
        reject(err);
      }
    });
  }

  async clear(key: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.delete(key);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error || new Error('Falha ao limpar registro no IndexedDB'));
      } catch (err) {
        reject(err);
      }
    });
  }

  async has(key: string): Promise<boolean> {
    const item = await this.load(key);
    return item !== null;
  }
}

export const AUTOSAVE_STORAGE_KEY = 'cape_studio_autosave';

/**
 * Storage manager that automatically selects IndexedDB when available,
 * falling back gracefully to Memory storage.
 */
export class ProjectStorage {
  private backend: IStorageBackend;

  constructor(customBackend?: IStorageBackend) {
    if (customBackend) {
      this.backend = customBackend;
    } else if (typeof indexedDB !== 'undefined') {
      this.backend = new IndexedDBBackend();
    } else {
      this.backend = new MemoryStorageBackend();
    }
  }

  setBackend(backend: IStorageBackend): void {
    this.backend = backend;
  }

  getBackend(): IStorageBackend {
    return this.backend;
  }

  async saveProject(project: SerializedProject, key = AUTOSAVE_STORAGE_KEY): Promise<void> {
    await this.backend.save(key, project);
  }

  async loadProject(key = AUTOSAVE_STORAGE_KEY): Promise<SerializedProject | null> {
    return await this.backend.load(key);
  }

  async clearProject(key = AUTOSAVE_STORAGE_KEY): Promise<void> {
    await this.backend.clear(key);
  }

  async hasProject(key = AUTOSAVE_STORAGE_KEY): Promise<boolean> {
    return await this.backend.has(key);
  }
}
