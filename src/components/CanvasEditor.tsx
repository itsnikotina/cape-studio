import React, { useRef, useEffect, useState, useCallback } from 'react';
import type {
  ColorRGBA,
  DocumentDimensions,
  SelectionState,
  ToolType,
} from '../types/editor';
import type { DocumentModel } from '../core/DocumentModel';
import { DrawingEngine } from '../core/DrawingEngine';
import { getScaledUVFaces, getUVFaceAt } from '../core/UVLayout';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface CanvasEditorProps {
  document: DocumentModel;
  currentTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  primaryColor: ColorRGBA;
  onColorPick: (color: ColorRGBA) => void;
  showGrid: boolean;
  showUVGuides: boolean;
  mirrorHorizontal: boolean;
  dimensions: DocumentDimensions;
  onStartStroke: () => void;
  onCommitChange: (description: string, colorUsed?: ColorRGBA) => void;
  selectionState: SelectionState;
  onUpdateSelection: (state: SelectionState) => void;
  version: number; // Increment to force repaint
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  document: doc,
  currentTool,
  onSelectTool,
  primaryColor,
  onColorPick,
  showGrid,
  showUVGuides,
  mirrorHorizontal,
  dimensions,
  onStartStroke,
  onCommitChange,
  selectionState,
  onUpdateSelection,
  version,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const checkerCanvasRef = useRef<HTMLCanvasElement>(null);
  const uvCanvasRef = useRef<HTMLCanvasElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Zoom factor (visual multiplier, can be fractional for HD fit-to-screen)
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Cursor coordinates
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Pointer drawing state
  const isDrawingRef = useRef(false);
  const activeButtonRef = useRef<number | null>(null); // 0 = left, 2 = right
  const strokeStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastPixelRef = useRef<{ x: number; y: number } | null>(null);
  const hasModifiedRef = useRef(false);

  // Move Tool Refs
  const isMovingSelectionRef = useRef(false);
  const isMovingLayerRef = useRef(false);
  const moveDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const layerDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const layerDragSnapshotRef = useRef<HTMLCanvasElement | null>(null);

  // Space key tracker for panning
  const spacePressedRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        spacePressedRef.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressedRef.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Fit to screen helper (supports HD resolutions like 1024x512 seamlessly)
  const fitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth <= 0 || clientHeight <= 0) return;

    const padding = 60;
    const availableW = Math.max(100, clientWidth - padding);
    const availableH = Math.max(100, clientHeight - padding);

    const scaleX = availableW / dimensions.width;
    const scaleY = availableH / dimensions.height;
    // Allow fractional zoom so 1024x512 fits on screen nicely
    const rawZoom = Math.min(scaleX, scaleY);
    // Snap to neat zoom value if >= 1, or use clean decimal if < 1
    const bestZoom = rawZoom >= 1 ? Math.min(32, Math.floor(rawZoom)) : Math.max(0.2, Number(rawZoom.toFixed(2)));

    setZoom(bestZoom);
    setPan({
      x: Math.round((clientWidth - dimensions.width * bestZoom) / 2),
      y: Math.round((clientHeight - dimensions.height * bestZoom) / 2),
    });
  }, [dimensions.width, dimensions.height]);

  // Initial fit when dimensions change
  useEffect(() => {
    fitToScreen();
  }, [fitToScreen]);

  // Sync viewport canvases size to container viewport
  const syncViewportCanvases = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    if (uvCanvasRef.current && (uvCanvasRef.current.width !== w || uvCanvasRef.current.height !== h)) {
      uvCanvasRef.current.width = w;
      uvCanvasRef.current.height = h;
    }
    if (overlayCanvasRef.current && (overlayCanvasRef.current.width !== w || overlayCanvasRef.current.height !== h)) {
      overlayCanvasRef.current.width = w;
      overlayCanvasRef.current.height = h;
    }
  }, []);

  // Convert client pointer coordinates to document pixel coordinates
  const getDocCoords = (clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = clientX - rect.left - pan.x;
    const relY = clientY - rect.top - pan.y;

    const docX = Math.floor(relX / zoom);
    const docY = Math.floor(relY / zoom);

    if (docX < 0 || docX >= dimensions.width || docY < 0 || docY >= dimensions.height) {
      return null;
    }
    return { x: docX, y: docY };
  };

  // 1. Render checkered transparency background behind UV and Cape
  const renderCheckerboard = useCallback(() => {
    const canvas = checkerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const tileSize = Math.max(4, Math.min(16, Math.round(16 / dimensions.scale)));
    for (let y = 0; y < canvas.height; y += tileSize) {
      for (let x = 0; x < canvas.width; x += tileSize) {
        ctx.fillStyle =
          (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0 ? '#1e293b' : '#0f172a';
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }
  }, [dimensions.scale]);

  // 2. Render UV Guides (BEHIND cape pixels; visible only through transparent pixels)
  const renderUVGuides = useCallback(() => {
    const canvas = uvCanvasRef.current;
    if (!canvas || !containerRef.current) return;
    syncViewportCanvases();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const containerW = canvas.width;
    const containerH = canvas.height;
    ctx.clearRect(0, 0, containerW, containerH);

    if (!showUVGuides) return;

    const faces = getScaledUVFaces(dimensions.scale);
    for (const face of faces) {
      const fx = pan.x + face.x * zoom;
      const fy = pan.y + face.y * zoom;
      const fw = face.width * zoom;
      const fh = face.height * zoom;

      // Skip if outside viewport
      if (fx + fw < 0 || fx > containerW || fy + fh < 0 || fy > containerH) continue;

      // Face background
      ctx.fillStyle = face.color + '2b';
      ctx.fillRect(fx, fy, fw, fh);

      // Face border
      ctx.strokeStyle = face.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(fx, fy, fw, fh);

      // Label if face is big enough
      if (fw > 30 && fh > 14) {
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = face.color;
        ctx.fillText(face.label.split(' ')[0], fx + 4, fy + 12);
      }
    }
  }, [showUVGuides, dimensions.scale, pan.x, pan.y, zoom, syncViewportCanvases]);

  // 3. Render main composite canvas (Cape pixels sit on top of UV guides)
  const renderDisplay = useCallback(() => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw composited layers (transparent where unpainted, letting UV guides show through)
    const compositeCanvas = doc.composite();
    ctx.drawImage(compositeCanvas, 0, 0);

    // If floating selection canvas exists, draw it
    if (selectionState.isFloating && selectionState.floatingCanvas) {
      ctx.drawImage(
        selectionState.floatingCanvas,
        Math.round(selectionState.floatingX),
        Math.round(selectionState.floatingY)
      );
    }
  }, [doc, selectionState]);

  // 4. Render viewport-fixed overlay (Grid, Selection Box, Tool Previews)
  const renderOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !containerRef.current) return;
    syncViewportCanvases();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const containerW = canvas.width;
    const containerH = canvas.height;
    ctx.clearRect(0, 0, containerW, containerH);

    const docW = dimensions.width;
    const docH = dimensions.height;

    // Viewport visible document coordinate bounds for high-performance culling
    const startDocX = Math.max(0, Math.floor(-pan.x / zoom));
    const endDocX = Math.min(docW, Math.ceil((containerW - pan.x) / zoom));
    const startDocY = Math.max(0, Math.floor(-pan.y / zoom));
    const endDocY = Math.min(docH, Math.ceil((containerH - pan.y) / zoom));

    // 1. Pixel Grid (render only visible lines when pixels are large enough on screen)
    if (showGrid && zoom >= 4) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();

      const topY = Math.max(0, pan.y);
      const bottomY = Math.min(containerH, pan.y + docH * zoom);
      const leftX = Math.max(0, pan.x);
      const rightX = Math.min(containerW, pan.x + docW * zoom);

      for (let x = startDocX; x <= endDocX; x++) {
        const px = Math.round(pan.x + x * zoom) + 0.5;
        ctx.moveTo(px, topY);
        ctx.lineTo(px, bottomY);
      }
      for (let y = startDocY; y <= endDocY; y++) {
        const py = Math.round(pan.y + y * zoom) + 0.5;
        ctx.moveTo(leftX, py);
        ctx.lineTo(rightX, py);
      }
      ctx.stroke();
    }

    // 2. Selection Rect outline (marching ants style)
    if (selectionState.rect) {
      const { x, y, width, height } = selectionState.rect;
      const rx = pan.x + (selectionState.isFloating ? selectionState.floatingX : x) * zoom;
      const ry = pan.y + (selectionState.isFloating ? selectionState.floatingY : y) * zoom;
      const rw = width * zoom;
      const rh = height * zoom;

      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }
  }, [showGrid, zoom, pan, dimensions, selectionState, syncViewportCanvases]);

  // Redraw when doc, zoom, pan or version changes
  useEffect(() => {
    renderCheckerboard();
    renderUVGuides();
    renderDisplay();
    renderOverlay();
  }, [renderCheckerboard, renderUVGuides, renderDisplay, renderOverlay, version, zoom, pan]);

  // Pointer Events
  const handlePointerDown = (e: React.PointerEvent) => {
    // Middle click or Space key triggers Pan
    if (e.button === 1 || spacePressedRef.current) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    // Allow left-click (0) or right-click (2)
    if (e.button !== 0 && e.button !== 2) return;

    const coords = getDocCoords(e.clientX, e.clientY);
    if (!coords) return;

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onStartStroke();
    isDrawingRef.current = true;
    activeButtonRef.current = e.button;
    strokeStartRef.current = coords;
    lastPixelRef.current = coords;
    hasModifiedRef.current = false;

    const activeLayer = doc.getActiveLayer();
    // Right click is ALWAYS eraser
    const isRightClick = e.button === 2;
    const effectiveTool = isRightClick ? 'eraser' : currentTool;

    if (effectiveTool === 'pencil' || effectiveTool === 'eraser') {
      const mode = effectiveTool === 'eraser' ? 'erase' : 'draw';
      DrawingEngine.setPixel(activeLayer.ctx, coords.x, coords.y, primaryColor, mode);
      if (mirrorHorizontal) {
        const mx = dimensions.width - 1 - coords.x;
        DrawingEngine.setPixel(activeLayer.ctx, mx, coords.y, primaryColor, mode);
      }
      hasModifiedRef.current = true;
      renderDisplay();
      doc.notifyUpdate(); // Live 3D update as you draw!
    } else if (effectiveTool === 'dropper') {
      const compCanvas = doc.composite();
      const compCtx = compCanvas.getContext('2d')!;
      const pixel = DrawingEngine.getPixel(compCtx, coords.x, coords.y);
      onColorPick(pixel);
      onSelectTool('pencil'); // Auto-switch back to pencil!
      isDrawingRef.current = false;
    } else if (effectiveTool === 'fill') {
      const changed = DrawingEngine.floodFill(
        activeLayer.ctx,
        coords.x,
        coords.y,
        primaryColor,
        dimensions.width,
        dimensions.height
      );
      if (changed) {
        renderDisplay();
        doc.notifyUpdate();
        onCommitChange('Preenchimento', primaryColor);
      }
      isDrawingRef.current = false;
    } else if (effectiveTool === 'move') {
      if (selectionState.rect || selectionState.isFloating) {
        // Selection movement
        isMovingSelectionRef.current = true;
        hasModifiedRef.current = false;

        if (!selectionState.isFloating && selectionState.rect) {
          // Lift selection from active layer into floating canvas
          const extracted = DrawingEngine.extractSelection(activeLayer.ctx, selectionState.rect, true);
          onUpdateSelection({
            rect: { ...selectionState.rect },
            floatingCanvas: extracted,
            floatingX: selectionState.rect.x,
            floatingY: selectionState.rect.y,
            isFloating: true,
          });
          moveDragOffsetRef.current = {
            x: coords.x - selectionState.rect.x,
            y: coords.y - selectionState.rect.y,
          };
        } else if (selectionState.isFloating) {
          moveDragOffsetRef.current = {
            x: coords.x - selectionState.floatingX,
            y: coords.y - selectionState.floatingY,
          };
        }
        renderDisplay();
        doc.notifyUpdate();
      } else {
        // Move current layer (no selection)
        isMovingLayerRef.current = true;
        hasModifiedRef.current = false;
        layerDragStartRef.current = coords;
        layerDragSnapshotRef.current = DrawingEngine.cloneCanvas(activeLayer.canvas);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // Handle pan
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
    }

    const coords = getDocCoords(e.clientX, e.clientY);
    setCursorPos(coords);

    if (!isDrawingRef.current || !coords) return;

    const activeLayer = doc.getActiveLayer();
    const isRightClick = activeButtonRef.current === 2;
    const effectiveTool = isRightClick ? 'eraser' : currentTool;

    if (effectiveTool === 'move') {
      if (isMovingSelectionRef.current && (selectionState.floatingCanvas || selectionState.rect)) {
        const newX = Math.round(coords.x - moveDragOffsetRef.current.x);
        const newY = Math.round(coords.y - moveDragOffsetRef.current.y);
        if (newX !== selectionState.floatingX || newY !== selectionState.floatingY) {
          hasModifiedRef.current = true;
          onUpdateSelection({
            ...selectionState,
            floatingX: newX,
            floatingY: newY,
            rect: selectionState.rect ? { ...selectionState.rect, x: newX, y: newY } : null,
          });
          renderDisplay();
          doc.notifyUpdate();
        }
      } else if (isMovingLayerRef.current && layerDragStartRef.current && layerDragSnapshotRef.current) {
        const dx = coords.x - layerDragStartRef.current.x;
        const dy = coords.y - layerDragStartRef.current.y;
        activeLayer.ctx.clearRect(0, 0, dimensions.width, dimensions.height);
        try {
          activeLayer.ctx.drawImage(layerDragSnapshotRef.current, dx, dy);
        } catch {
          // fallback
        }
        hasModifiedRef.current = dx !== 0 || dy !== 0;
        renderDisplay();
        doc.notifyUpdate();
      }
      return;
    }

    if (effectiveTool === 'pencil' || effectiveTool === 'eraser') {
      const last = lastPixelRef.current || coords;
      const mode = effectiveTool === 'eraser' ? 'erase' : 'draw';
      DrawingEngine.drawLine(
        activeLayer.ctx,
        last.x,
        last.y,
        coords.x,
        coords.y,
        primaryColor,
        mode,
        mirrorHorizontal,
        dimensions.width
      );
      lastPixelRef.current = coords;
      hasModifiedRef.current = true;
      renderDisplay();
      doc.notifyUpdate(); // Live 3D update as you drag!
    } else if (
      effectiveTool === 'line' ||
      effectiveTool === 'rectangle' ||
      effectiveTool === 'rectangle-fill' ||
      effectiveTool === 'ellipse' ||
      effectiveTool === 'ellipse-fill'
    ) {
      // Preview shape on overlay canvas
      renderOverlay();
      const oCanvas = overlayCanvasRef.current;
      if (!oCanvas || !strokeStartRef.current) return;
      const oCtx = oCanvas.getContext('2d');
      if (!oCtx) return;

      const p0 = strokeStartRef.current;
      const p1 = coords;

      oCtx.save();
      // Transform preview to viewport coordinates
      oCtx.translate(pan.x, pan.y);
      oCtx.scale(zoom, zoom);
      if (effectiveTool === 'line') {
        DrawingEngine.drawLine(
          oCtx,
          p0.x,
          p0.y,
          p1.x,
          p1.y,
          primaryColor,
          'draw',
          mirrorHorizontal,
          dimensions.width
        );
      } else if (effectiveTool === 'rectangle' || effectiveTool === 'rectangle-fill') {
        DrawingEngine.drawRectangle(
          oCtx,
          p0.x,
          p0.y,
          p1.x,
          p1.y,
          primaryColor,
          effectiveTool === 'rectangle-fill'
        );
      } else if (effectiveTool === 'ellipse' || effectiveTool === 'ellipse-fill') {
        DrawingEngine.drawEllipse(
          oCtx,
          p0.x,
          p0.y,
          p1.x,
          p1.y,
          primaryColor,
          effectiveTool === 'ellipse-fill'
        );
      }
      oCtx.restore();
    } else if (effectiveTool === 'select' && strokeStartRef.current) {
      // Preview selection box
      const minX = Math.min(strokeStartRef.current.x, coords.x);
      const maxX = Math.max(strokeStartRef.current.x, coords.x);
      const minY = Math.min(strokeStartRef.current.y, coords.y);
      const maxY = Math.max(strokeStartRef.current.y, coords.y);

      onUpdateSelection({
        ...selectionState,
        rect: {
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
        },
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const coords = getDocCoords(e.clientX, e.clientY) || lastPixelRef.current;
    const start = strokeStartRef.current;
    const activeLayer = doc.getActiveLayer();
    const isRightClick = activeButtonRef.current === 2;
    const effectiveTool = isRightClick ? 'eraser' : currentTool;

    if (effectiveTool === 'move') {
      if (isMovingSelectionRef.current) {
        if (hasModifiedRef.current && selectionState.floatingCanvas) {
          DrawingEngine.pasteSelection(
            activeLayer.ctx,
            selectionState.floatingCanvas,
            selectionState.floatingX,
            selectionState.floatingY
          );
          onCommitChange('Mover Seleção');
          onUpdateSelection({
            rect: {
              x: selectionState.floatingX,
              y: selectionState.floatingY,
              width: selectionState.floatingCanvas.width,
              height: selectionState.floatingCanvas.height,
            },
            floatingCanvas: null,
            floatingX: 0,
            floatingY: 0,
            isFloating: false,
          });
        }
        isMovingSelectionRef.current = false;
        hasModifiedRef.current = false;
      } else if (isMovingLayerRef.current) {
        if (hasModifiedRef.current) {
          onCommitChange('Mover Camada');
        }
        isMovingLayerRef.current = false;
        layerDragSnapshotRef.current = null;
        layerDragStartRef.current = null;
        hasModifiedRef.current = false;
      }

      activeButtonRef.current = null;
      strokeStartRef.current = null;
      lastPixelRef.current = null;
      renderDisplay();
      renderOverlay();
      doc.notifyUpdate();
      return;
    }

    if (start && coords && !isRightClick) {
      if (effectiveTool === 'line') {
        DrawingEngine.drawLine(
          activeLayer.ctx,
          start.x,
          start.y,
          coords.x,
          coords.y,
          primaryColor,
          'draw',
          mirrorHorizontal,
          dimensions.width
        );
        hasModifiedRef.current = true;
      } else if (effectiveTool === 'rectangle' || effectiveTool === 'rectangle-fill') {
        DrawingEngine.drawRectangle(
          activeLayer.ctx,
          start.x,
          start.y,
          coords.x,
          coords.y,
          primaryColor,
          effectiveTool === 'rectangle-fill'
        );
        hasModifiedRef.current = true;
      } else if (effectiveTool === 'ellipse' || effectiveTool === 'ellipse-fill') {
        DrawingEngine.drawEllipse(
          activeLayer.ctx,
          start.x,
          start.y,
          coords.x,
          coords.y,
          primaryColor,
          effectiveTool === 'ellipse-fill'
        );
        hasModifiedRef.current = true;
      }
    }

    activeButtonRef.current = null;
    strokeStartRef.current = null;
    lastPixelRef.current = null;

    renderDisplay();
    renderOverlay();
    doc.notifyUpdate();

    if (hasModifiedRef.current) {
      const colorUsed = !isRightClick && effectiveTool !== 'eraser' ? primaryColor : undefined;
      onCommitChange(
        isRightClick ? 'Borracha (Botão Direito)' : `Desenho (${effectiveTool})`,
        colorUsed
      );
      hasModifiedRef.current = false;
    }
  };

  // Wheel zoom centered on cursor (smooth in all resolutions, from 20% to 3200%)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.25 : 0.8;
    const newZoom = Math.min(32.0, Math.max(0.2, Number((zoom * factor).toFixed(2))));

    if (Math.abs(newZoom - zoom) > 0.001) {
      const newPanX = mouseX - ((mouseX - pan.x) / zoom) * newZoom;
      const newPanY = mouseY - ((mouseY - pan.y) / zoom) * newZoom;

      setZoom(newZoom);
      setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
    }
  };

  // Current UV face label under cursor
  const currentFace = cursorPos ? getUVFaceAt(cursorPos.x, cursorPos.y, dimensions.scale) : null;

  return (
    <div
      ref={containerRef}
      className="canvas-editor-area"
      onContextMenu={(e) => e.preventDefault()} // Disable native context menu for right-click eraser!
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        setCursorPos(null);
        if (isPanning) setIsPanning(false);
        if (isDrawingRef.current) {
          isDrawingRef.current = false;
          activeButtonRef.current = null;
          isMovingSelectionRef.current = false;
          isMovingLayerRef.current = false;
          layerDragSnapshotRef.current = null;
          layerDragStartRef.current = null;
          renderDisplay();
          renderOverlay();
          doc.notifyUpdate();
          if (hasModifiedRef.current) {
            onCommitChange('Desenho');
            hasModifiedRef.current = false;
          }
        }
      }}
      style={{
        cursor: isPanning
          ? 'grab'
          : currentTool === 'dropper'
          ? 'crosshair'
          : currentTool === 'move'
          ? 'move'
          : 'default',
      }}
    >
      {/* 1. Checkered Canvas (Behind UV and Cape) */}
      <canvas
        ref={checkerCanvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{
          width: dimensions.width * zoom,
          height: dimensions.height * zoom,
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          position: 'absolute',
          top: 0,
          left: 0,
          boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
          imageRendering: 'pixelated',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* 2. UV Guides Canvas (BEHIND cape pixels; visible only through transparent areas) */}
      <canvas
        ref={uvCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />

      {/* 3. Texture Display Canvas (Cape Pixels rendered ON TOP of UV guides) */}
      <canvas
        ref={displayCanvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{
          width: dimensions.width * zoom,
          height: dimensions.height * zoom,
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          position: 'absolute',
          top: 0,
          left: 0,
          imageRendering: 'pixelated',
          zIndex: 3,
          pointerEvents: 'none',
        }}
      />

      {/* 4. Viewport-Fixed Overlay Canvas (Grid, Selection Box, Tool Previews) */}
      <canvas
        ref={overlayCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 4,
          pointerEvents: 'none',
        }}
      />

      {/* Status Bar */}
      <div className="editor-status-bar">
        {cursorPos ? (
          <>
            <span>
              X: <span className="status-highlight">{cursorPos.x}</span>, Y:{' '}
              <span className="status-highlight">{cursorPos.y}</span>
            </span>
            {currentFace ? (
              <span style={{ color: currentFace.color, fontWeight: 600 }}>
                {currentFace.label}
              </span>
            ) : (
              <span style={{ color: 'var(--text-dim)' }}>Região livre (Transparente)</span>
            )}
          </>
        ) : (
          <span>Mova o cursor sobre o editor</span>
        )}
        <span>
          Dimensões:{' '}
          <span className="status-highlight">
            {dimensions.width}×{dimensions.height} ({dimensions.scale}x)
          </span>
        </span>
      </div>

      {/* Floating Zoom Controls */}
      <div className="canvas-floating-controls">
        <button
          className="btn btn-icon"
          onClick={() => {
            const newZoom = Math.min(32, Number((zoom * 1.25).toFixed(2)));
            setZoom(newZoom);
          }}
          title="Aumentar Zoom"
        >
          <ZoomIn size={14} />
        </button>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '0 6px',
            color: 'var(--text-muted)',
            fontFamily: 'monospace',
          }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <button
          className="btn btn-icon"
          onClick={() => {
            const newZoom = Math.max(0.2, Number((zoom * 0.8).toFixed(2)));
            setZoom(newZoom);
          }}
          title="Diminuir Zoom"
        >
          <ZoomOut size={14} />
        </button>
        <button className="btn btn-icon" onClick={fitToScreen} title="Ajustar à Tela">
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  );
};
