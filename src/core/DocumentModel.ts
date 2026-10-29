import type { CapeLayer, DocumentDimensions, HistoryEntry } from '../types/editor';

let layerCounter = 1;

function createMock2DContext(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): CanvasRenderingContext2D {
  const buffer = new Uint8ClampedArray(width * height * 4);
  let fillStyle = '#000000';
  let globalAlpha = 1.0;

  const mockCtx = {
    canvas,
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(val: string) {
      fillStyle = val;
    },
    get globalAlpha() {
      return globalAlpha;
    },
    set globalAlpha(val: number) {
      globalAlpha = val;
    },
    imageSmoothingEnabled: false,
    clearRect(x: number, y: number, w: number, h: number) {
      for (let cy = y; cy < y + h; cy++) {
        for (let cx = x; cx < x + w; cx++) {
          if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
            const idx = (cy * width + cx) * 4;
            buffer[idx] = 0;
            buffer[idx + 1] = 0;
            buffer[idx + 2] = 0;
            buffer[idx + 3] = 0;
          }
        }
      }
    },
    fillRect(x: number, y: number, w: number, h: number) {
      let r = 0,
        g = 0,
        b = 0,
        a = 255;
      if (fillStyle.startsWith('rgba')) {
        const parts = fillStyle
          .replace(/rgba?\(|\)/g, '')
          .split(',')
          .map((s) => parseFloat(s.trim()));
        r = Math.round(parts[0] || 0);
        g = Math.round(parts[1] || 0);
        b = Math.round(parts[2] || 0);
        a = Math.round((parts[3] !== undefined ? parts[3] : 1) * 255);
      } else if (fillStyle.startsWith('#')) {
        const hex = fillStyle.replace('#', '');
        const num = parseInt(hex, 16);
        r = (num >> 16) & 255;
        g = (num >> 8) & 255;
        b = num & 255;
      }
      for (let cy = y; cy < y + h; cy++) {
        for (let cx = x; cx < x + w; cx++) {
          if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
            const idx = (cy * width + cx) * 4;
            buffer[idx] = r;
            buffer[idx + 1] = g;
            buffer[idx + 2] = b;
            buffer[idx + 3] = a;
          }
        }
      }
    },
    createImageData(w: number, h: number) {
      return {
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
        colorSpace: 'srgb',
      } as unknown as ImageData;
    },
    getImageData(sx: number, sy: number, sw: number, sh: number) {
      const out = new Uint8ClampedArray(sw * sh * 4);
      for (let cy = 0; cy < sh; cy++) {
        for (let cx = 0; cx < sw; cx++) {
          const srcX = sx + cx;
          const srcY = sy + cy;
          if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
            const srcIdx = (srcY * width + srcX) * 4;
            const dstIdx = (cy * sw + cx) * 4;
            out[dstIdx] = buffer[srcIdx];
            out[dstIdx + 1] = buffer[srcIdx + 1];
            out[dstIdx + 2] = buffer[srcIdx + 2];
            out[dstIdx + 3] = buffer[srcIdx + 3];
          }
        }
      }
      return {
        data: out,
        width: sw,
        height: sh,
        colorSpace: 'srgb',
      } as ImageData;
    },
    putImageData(imgData: ImageData, dx: number, dy: number) {
      for (let cy = 0; cy < imgData.height; cy++) {
        for (let cx = 0; cx < imgData.width; cx++) {
          const targetX = dx + cx;
          const targetY = dy + cy;
          if (targetX >= 0 && targetX < width && targetY >= 0 && targetY < height) {
            const srcIdx = (cy * imgData.width + cx) * 4;
            const dstIdx = (targetY * width + targetX) * 4;
            buffer[dstIdx] = imgData.data[srcIdx];
            buffer[dstIdx + 1] = imgData.data[srcIdx + 1];
            buffer[dstIdx + 2] = imgData.data[srcIdx + 2];
            buffer[dstIdx + 3] = imgData.data[srcIdx + 3];
          }
        }
      }
    },
    drawImage(src: HTMLCanvasElement, ...args: number[]) {
      const srcCtx =
        src.getContext?.('2d') ||
        (src as unknown as { __mock2dContext?: CanvasRenderingContext2D }).__mock2dContext;
      if (!srcCtx) return;
      const srcW = src.width;
      const srcH = src.height;
      let dx = 0;
      let dy = 0;
      let dw = srcW;
      let dh = srcH;
      if (args.length === 2) {
        dx = args[0] || 0;
        dy = args[1] || 0;
        dw = srcW;
        dh = srcH;
      } else if (args.length >= 4) {
        dx = args[0] || 0;
        dy = args[1] || 0;
        dw = args[2] !== undefined ? args[2] : width;
        dh = args[3] !== undefined ? args[3] : height;
      }
      const srcImg = srcCtx.getImageData(0, 0, srcW, srcH);
      for (let y = 0; y < dh; y++) {
        const srcY = Math.floor((y / dh) * srcH);
        for (let x = 0; x < dw; x++) {
          const srcX = Math.floor((x / dw) * srcW);
          const srcIdx = (srcY * srcW + srcX) * 4;
          const dstX = dx + x;
          const dstY = dy + y;
          if (dstX >= 0 && dstX < width && dstY >= 0 && dstY < height) {
            const srcAlpha = srcImg.data[srcIdx + 3];
            if (srcAlpha > 0) {
              const dstIdx = (dstY * width + dstX) * 4;
              if (srcAlpha === 255) {
                buffer[dstIdx] = srcImg.data[srcIdx];
                buffer[dstIdx + 1] = srcImg.data[srcIdx + 1];
                buffer[dstIdx + 2] = srcImg.data[srcIdx + 2];
                buffer[dstIdx + 3] = 255;
              } else {
                const a = srcAlpha / 255;
                const da = buffer[dstIdx + 3] / 255;
                const outA = a + da * (1 - a);
                if (outA > 0) {
                  buffer[dstIdx] = Math.round(
                    (srcImg.data[srcIdx] * a + buffer[dstIdx] * da * (1 - a)) / outA
                  );
                  buffer[dstIdx + 1] = Math.round(
                    (srcImg.data[srcIdx + 1] * a + buffer[dstIdx + 1] * da * (1 - a)) / outA
                  );
                  buffer[dstIdx + 2] = Math.round(
                    (srcImg.data[srcIdx + 2] * a + buffer[dstIdx + 2] * da * (1 - a)) / outA
                  );
                  buffer[dstIdx + 3] = Math.round(outA * 255);
                }
              }
            }
          }
        }
      }
    },
  } as unknown as CanvasRenderingContext2D;

  (canvas as unknown as { __mock2dContext?: CanvasRenderingContext2D }).__mock2dContext = mockCtx;
  if (!canvas.getContext || !canvas.getContext('2d')) {
    canvas.getContext = ((type: string) => {
      if (type === '2d') return mockCtx;
      return null;
    }) as unknown as typeof canvas.getContext;
  }

  return mockCtx;
}

export class DocumentModel {
  dimensions: DocumentDimensions;
  layers: CapeLayer[] = [];
  activeLayerId: string = '';
  private listeners: Set<() => void> = new Set();
  private _compositeCanvas: HTMLCanvasElement | null = null;

  constructor(width = 64, height = 32, scale = 1, isCustom = false) {
    this.dimensions = { width, height, scale, isCustom };
    const baseLayer = this.createLayer('Camada 1');
    this.layers.push(baseLayer);
    this.activeLayerId = baseLayer.id;
  }

  resetDocument(width = 64, height = 32, scale = 1, isCustom = false): void {
    this.dimensions = { width, height, scale, isCustom };
    this.layers = [];
    const baseLayer = this.createLayer('Camada 1');
    this.layers.push(baseLayer);
    this.activeLayerId = baseLayer.id;
    this.composite();
    this.notifyUpdate();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  notifyUpdate(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  createLayer(name?: string): CapeLayer {
    const id = `layer_${Date.now()}_${layerCounter++}`;
    const canvas = document.createElement('canvas');
    canvas.width = this.dimensions.width;
    canvas.height = this.dimensions.height;
    const realCtx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Provide safe context with fallback for test environments
    const ctx = realCtx || createMock2DContext(canvas, this.dimensions.width, this.dimensions.height);

    if (realCtx) {
      realCtx.imageSmoothingEnabled = false;
    }

    return {
      id,
      name: name || `Camada ${layerCounter}`,
      visible: true,
      opacity: 1.0,
      canvas,
      ctx,
    };
  }

  addLayer(name?: string): CapeLayer {
    const layer = this.createLayer(name);
    // Insert on top of active layer or top of list
    const activeIndex = this.layers.findIndex((l) => l.id === this.activeLayerId);
    if (activeIndex >= 0) {
      this.layers.splice(activeIndex + 1, 0, layer);
    } else {
      this.layers.push(layer);
    }
    this.activeLayerId = layer.id;
    return layer;
  }

  deleteLayer(id: string): boolean {
    if (this.layers.length <= 1) return false; // At least one layer must remain
    const index = this.layers.findIndex((l) => l.id === id);
    if (index === -1) return false;

    this.layers.splice(index, 1);
    if (this.activeLayerId === id) {
      const nextIndex = Math.max(0, index - 1);
      this.activeLayerId = this.layers[nextIndex].id;
    }
    return true;
  }

  duplicateLayer(id: string): CapeLayer | null {
    const source = this.layers.find((l) => l.id === id);
    if (!source) return null;

    const copy = this.createLayer(`${source.name} (cópia)`);
    copy.opacity = source.opacity;
    copy.visible = source.visible;
    copy.ctx.drawImage(source.canvas, 0, 0);

    const sourceIndex = this.layers.findIndex((l) => l.id === id);
    this.layers.splice(sourceIndex + 1, 0, copy);
    this.activeLayerId = copy.id;
    return copy;
  }

  renameLayer(id: string, name: string): void {
    const layer = this.layers.find((l) => l.id === id);
    if (layer) layer.name = name;
  }

  setLayerVisibility(id: string, visible: boolean): void {
    const layer = this.layers.find((l) => l.id === id);
    if (layer) layer.visible = visible;
  }

  setLayerOpacity(id: string, opacity: number): void {
    const layer = this.layers.find((l) => l.id === id);
    if (layer) layer.opacity = Math.max(0, Math.min(1, opacity));
  }

  reorderLayers(fromIndex: number, toIndex: number): void {
    if (
      fromIndex < 0 ||
      fromIndex >= this.layers.length ||
      toIndex < 0 ||
      toIndex >= this.layers.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const [moved] = this.layers.splice(fromIndex, 1);
    this.layers.splice(toIndex, 0, moved);
  }

  getActiveLayer(): CapeLayer {
    const layer = this.layers.find((l) => l.id === this.activeLayerId);
    return layer || this.layers[0];
  }

  setActiveLayer(id: string): void {
    if (this.layers.some((l) => l.id === id)) {
      this.activeLayerId = id;
    }
  }

  /**
   * Resize document dimensions. Scales existing layer content proportionally with nearest-neighbor
   * interpolation to preserve UV map coordinates and existing pixel art across HD resolutions.
   */
  setDimensions(width: number, height: number, scale: number, isCustom = false): void {
    const oldWidth = this.dimensions.width;
    const oldHeight = this.dimensions.height;
    this.dimensions = { width, height, scale, isCustom };

    for (const layer of this.layers) {
      const oldCanvas = layer.canvas;
      const oldCtx = layer.ctx;
      const newCanvas = document.createElement('canvas');
      newCanvas.width = width;
      newCanvas.height = height;
      const realCtx = newCanvas.getContext('2d', { willReadFrequently: true });
      const newCtx = realCtx || createMock2DContext(newCanvas, width, height);

      // In real browser, drawImage with imageSmoothingEnabled = false scales via GPU/native 2D canvas
      try {
        newCtx.imageSmoothingEnabled = false;
        newCtx.drawImage(oldCanvas, 0, 0, width, height);
      } catch {
        // Fallback for environments where drawImage throws or is unsupported
      }

      // Check if pixels were transferred (in headless/happy-dom test environments, drawImage is a no-op stub)
      let needsManualScaling = true;
      try {
        const dstSample = newCtx.getImageData(0, 0, width, height);
        for (let i = 3; i < dstSample.data.length; i += 4) {
          if (dstSample.data[i] > 0) {
            needsManualScaling = false;
            break;
          }
        }
      } catch {
        needsManualScaling = true;
      }

      if (needsManualScaling && oldCtx) {
        try {
          const srcData = oldCtx.getImageData(0, 0, oldWidth, oldHeight);
          let srcHasPixels = false;
          for (let i = 3; i < srcData.data.length; i += 4) {
            if (srcData.data[i] > 0) {
              srcHasPixels = true;
              break;
            }
          }

          if (srcHasPixels) {
            const dstData = newCtx.createImageData
              ? newCtx.createImageData(width, height)
              : newCtx.getImageData(0, 0, width, height);

            for (let dy = 0; dy < height; dy++) {
              const sy = Math.floor((dy / height) * oldHeight);
              for (let dx = 0; dx < width; dx++) {
                const sx = Math.floor((dx / width) * oldWidth);
                const sIdx = (sy * oldWidth + sx) * 4;
                const dIdx = (dy * width + dx) * 4;
                dstData.data[dIdx] = srcData.data[sIdx];
                dstData.data[dIdx + 1] = srcData.data[sIdx + 1];
                dstData.data[dIdx + 2] = srcData.data[sIdx + 2];
                dstData.data[dIdx + 3] = srcData.data[sIdx + 3];
              }
            }
            newCtx.putImageData(dstData, 0, 0);
          }
        } catch {
          // Graceful fallback
        }
      }

      layer.canvas = newCanvas;
      layer.ctx = newCtx;
    }
  }

  /**
   * Composites all visible layers with their opacity into a persistent clean canvas
   */
  composite(): HTMLCanvasElement {
    if (!this._compositeCanvas) {
      this._compositeCanvas = document.createElement('canvas');
    }
    if (
      this._compositeCanvas.width !== this.dimensions.width ||
      this._compositeCanvas.height !== this.dimensions.height
    ) {
      this._compositeCanvas.width = this.dimensions.width;
      this._compositeCanvas.height = this.dimensions.height;
    }

    const compCanvas = this._compositeCanvas;
    const realCtx = compCanvas.getContext('2d', { willReadFrequently: true });
    const compCtx =
      realCtx ||
      (compCanvas as unknown as { __mock2dContext?: CanvasRenderingContext2D }).__mock2dContext ||
      createMock2DContext(compCanvas, compCanvas.width, compCanvas.height);
    if (!compCtx) return compCanvas;

    compCtx.imageSmoothingEnabled = false;
    compCtx.clearRect(0, 0, compCanvas.width, compCanvas.height);

    // Draw from bottom (index 0) to top (last index)
    for (const layer of this.layers) {
      if (!layer.visible || layer.opacity <= 0) continue;
      compCtx.globalAlpha = layer.opacity;
      compCtx.drawImage(layer.canvas, 0, 0);
    }
    compCtx.globalAlpha = 1.0;

    return compCanvas;
  }

  getCompositeCanvas(): HTMLCanvasElement {
    return this.composite();
  }

  /**
   * Create snapshot for undo/redo
   */
  createSnapshot(description = 'Edit'): HistoryEntry {
    return {
      description,
      width: this.dimensions.width,
      height: this.dimensions.height,
      activeLayerId: this.activeLayerId,
      layers: this.layers.map((l) => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        opacity: l.opacity,
        imageData: l.ctx.getImageData(0, 0, this.dimensions.width, this.dimensions.height),
      })),
    };
  }

  /**
   * Restore document state from snapshot
   */
  restoreSnapshot(snapshot: HistoryEntry): void {
    this.dimensions.width = snapshot.width;
    this.dimensions.height = snapshot.height;
    this.dimensions.scale = snapshot.width / 64;

    this.layers = snapshot.layers.map((snapLayer) => {
      const canvas = document.createElement('canvas');
      canvas.width = snapshot.width;
      canvas.height = snapshot.height;
      const realCtx = canvas.getContext('2d', { willReadFrequently: true });
      const ctx = realCtx || createMock2DContext(canvas, snapshot.width, snapshot.height);

      if (realCtx) {
        realCtx.imageSmoothingEnabled = false;
        realCtx.putImageData(snapLayer.imageData, 0, 0);
      } else {
        ctx.putImageData(snapLayer.imageData, 0, 0);
      }

      return {
        id: snapLayer.id,
        name: snapLayer.name,
        visible: snapLayer.visible,
        opacity: snapLayer.opacity,
        canvas,
        ctx,
      };
    });

    this.activeLayerId = snapshot.activeLayerId;
    if (!this.layers.some((l) => l.id === this.activeLayerId) && this.layers.length > 0) {
      this.activeLayerId = this.layers[0].id;
    }
  }
}
