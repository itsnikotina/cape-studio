import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { ColorRGBA } from '../types/editor';
import { hexToRgba, rgbaToHex, rgbToHsv, hsvToRgb } from '../core/DrawingEngine';
import {
  loadSavedFavorites,
  addFavoriteColor,
  removeFavoriteColor,
  type FavoriteColor,
} from '../core/FavoritesManager';
import { Star, Plus, X, ArrowLeftRight } from 'lucide-react';

interface ColorTrianglePickerProps {
  currentColor: ColorRGBA;
  secondaryColor?: ColorRGBA;
  activeColorSlot?: 'primary' | 'secondary';
  onSelectSlot?: (slot: 'primary' | 'secondary') => void;
  onColorChange: (color: ColorRGBA) => void;
  onSwapColors?: () => void;
  recentColors: string[];
}

const MINECRAFT_CAPE_PRESETS = [
  '#b01e28', // Mojang Red
  '#ffac00', // Minecon Gold
  '#4aedd9', // Diamond Cyan
  '#17dd62', // Emerald Green
  '#1c4d9c', // Lapis Blue
  '#9a5cc6', // Amethyst Purple
  '#ffffff', // Pure White
  '#000000', // Pure Black
  '#6a6a6a', // Cobblestone Gray
  '#232328', // Deepslate Dark
  '#ff2200', // Redstone
  '#fcee4b', // Gold Ingot
  '#1be3ba', // Glow Cyan
  '#1c8676', // Ender Teal
  '#032630', // Sculk Deep Blue
  '#5b595c', // Elytra Slate
];

export const ColorTrianglePicker: React.FC<ColorTrianglePickerProps> = ({
  currentColor,
  secondaryColor,
  activeColorSlot = 'primary',
  onSelectSlot,
  onColorChange,
  onSwapColors,
  recentColors,
}) => {
  const triangleCanvasRef = useRef<HTMLCanvasElement>(null);
  const hueCanvasRef = useRef<HTMLCanvasElement>(null);

  // Favorites state
  const [favorites, setFavorites] = useState<FavoriteColor[]>(() => loadSavedFavorites());

  // Derive HSV from current RGB
  const derivedHsv = useMemo(
    () => rgbToHsv(currentColor.r, currentColor.g, currentColor.b),
    [currentColor.r, currentColor.g, currentColor.b]
  );

  // User-selected hue override (when saturated, defaults to derivedHsv.h)
  const [userHue, setUserHue] = useState<number | null>(null);
  const activeHue = userHue !== null ? userHue : derivedHsv.h;

  const [hexInputOverride, setHexInputOverride] = useState<string | null>(null);
  const hexInput = hexInputOverride ?? rgbaToHex(currentColor).toUpperCase();

  // Triangle vertex coordinates (width: 260, height: 200 - expanded vertical space!)
  const A = { x: 130, y: 12 }; // Apex: Pure Hue
  const B = { x: 14, y: 188 }; // Bottom-left: White
  const C = { x: 246, y: 188 }; // Bottom-right: Black

  // Convert current (S, V) to triangle (X, Y)
  const getHandlePosition = useCallback((): { x: number; y: number } => {
    const s = derivedHsv.s;
    const v = derivedHsv.v;
    const wA = s * v;
    const wB = v * (1 - s);
    const wC = 1 - v;

    return {
      x: wA * A.x + wB * B.x + wC * C.x,
      y: wA * A.y + wB * B.y + wC * C.y,
    };
  }, [derivedHsv.s, derivedHsv.v, A.x, A.y, B.x, B.y, C.x, C.y]);

  // Render Triangle Canvas
  useEffect(() => {
    const canvas = triangleCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    const denom = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
    const pureHue = hsvToRgb(activeHue, 1, 1);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const wA = ((B.y - C.y) * (x - C.x) + (C.x - B.x) * (y - C.y)) / denom;
        const wB = ((C.y - A.y) * (x - C.x) + (A.x - C.x) * (y - C.y)) / denom;
        const wC = 1 - wA - wB;

        if (wA >= 0 && wB >= 0 && wC >= 0) {
          const idx = (y * w + x) * 4;
          const r = Math.round(wA * pureHue.r + wB * 255);
          const g = Math.round(wA * pureHue.g + wB * 255);
          const b = Math.round(wA * pureHue.b + wB * 255);

          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Subtle Triangle Outline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.lineTo(C.x, C.y);
    ctx.closePath();
    ctx.stroke();

    // Draggable Handle
    const handle = getHandlePosition();
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, 6, 0, Math.PI * 2);
    ctx.strokeStyle = derivedHsv.v > 0.5 && derivedHsv.s < 0.5 ? '#000000' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(handle.x, handle.y, 4, 0, Math.PI * 2);
    ctx.strokeStyle = derivedHsv.v > 0.5 && derivedHsv.s < 0.5 ? '#ffffff' : '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [activeHue, derivedHsv.s, derivedHsv.v, getHandlePosition, A.x, A.y, B.x, B.y, C.x, C.y]);

  // Render Hue Bar
  useEffect(() => {
    const canvas = hueCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#ff0000');
    grad.addColorStop(1 / 6, '#ffff00');
    grad.addColorStop(2 / 6, '#00ff00');
    grad.addColorStop(3 / 6, '#00ffff');
    grad.addColorStop(4 / 6, '#0000ff');
    grad.addColorStop(5 / 6, '#ff00ff');
    grad.addColorStop(1, '#ff0000');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const thumbX = (activeHue / 360) * w;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(thumbX - 2, 0, 4, h);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(thumbX - 3, 0, 6, h);
  }, [activeHue]);

  // Dragging in triangle
  const isDraggingTriangleRef = useRef(false);

  const updateFromTrianglePointer = (clientX: number, clientY: number) => {
    const canvas = triangleCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const denom = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
    let wA = ((B.y - C.y) * (x - C.x) + (C.x - B.x) * (y - C.y)) / denom;
    let wB = ((C.y - A.y) * (x - C.x) + (A.x - C.x) * (y - C.y)) / denom;
    let wC = 1 - wA - wB;

    wA = Math.max(0, Math.min(1, wA));
    wB = Math.max(0, Math.min(1, wB));
    wC = Math.max(0, Math.min(1, wC));
    const sum = wA + wB + wC;
    wA /= sum;
    wB /= sum;
    wC /= sum;

    const newV = Math.max(0, Math.min(1, wA + wB));
    const newS = newV === 0 ? 0 : Math.max(0, Math.min(1, wA / newV));

    const rgb = hsvToRgb(activeHue, newS, newV);
    const newColor: ColorRGBA = { ...rgb, a: currentColor.a };
    onColorChange(newColor);
    setHexInputOverride(null);
  };

  const handleTrianglePointerDown = (e: React.PointerEvent) => {
    isDraggingTriangleRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromTrianglePointer(e.clientX, e.clientY);
  };

  const handleTrianglePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingTriangleRef.current) return;
    updateFromTrianglePointer(e.clientX, e.clientY);
  };

  const handleTrianglePointerUp = () => {
    isDraggingTriangleRef.current = false;
  };

  // Dragging in Hue bar
  const isDraggingHueRef = useRef(false);

  const updateFromHuePointer = (clientX: number) => {
    const canvas = hueCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const newHue = Math.round((x / rect.width) * 360) % 360;

    setUserHue(newHue);
    const rgb = hsvToRgb(newHue, derivedHsv.s, derivedHsv.v);
    const newColor: ColorRGBA = { ...rgb, a: currentColor.a };
    onColorChange(newColor);
    setHexInputOverride(null);
  };

  const handleHuePointerDown = (e: React.PointerEvent) => {
    isDraggingHueRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromHuePointer(e.clientX);
  };

  const handleHuePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingHueRef.current) return;
    updateFromHuePointer(e.clientX);
  };

  const handleHuePointerUp = () => {
    isDraggingHueRef.current = false;
  };

  // Manual Hex Input
  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valStr = e.target.value.trim();
    if (!valStr.startsWith('#')) valStr = `#${valStr}`;
    setHexInputOverride(valStr.toUpperCase());
    if (/^#[0-9A-Fa-f]{6}$/.test(valStr)) {
      const parsed = hexToRgba(valStr, currentColor.a);
      onColorChange(parsed);
      const hsv = rgbToHsv(parsed.r, parsed.g, parsed.b);
      setUserHue(hsv.h);
    }
  };

  // Favorite actions
  const handleAddFavorite = () => {
    const hex = rgbaToHex(currentColor).toUpperCase();
    const alpha = currentColor.a;
    const { updated } = addFavoriteColor(favorites, { hex, alpha });
    setFavorites(updated);
  };

  const handleRemoveFavorite = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = removeFavoriteColor(favorites, index);
    setFavorites(updated);
  };

  const currentHex = rgbaToHex(currentColor);

  return (
    <div className="panel-section">
      <div className="panel-title">Seletor Triangular HSV</div>

      {/* Expanded Height Triangle Canvas (260x200) */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
        <canvas
          ref={triangleCanvasRef}
          width={260}
          height={200}
          style={{ borderRadius: 6, cursor: 'crosshair', display: 'block' }}
          onPointerDown={handleTrianglePointerDown}
          onPointerMove={handleTrianglePointerMove}
          onPointerUp={handleTrianglePointerUp}
        />
      </div>

      {/* Hue Bar Slider */}
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
        <canvas
          ref={hueCanvasRef}
          width={260}
          height={14}
          style={{
            borderRadius: 4,
            cursor: 'ew-resize',
            display: 'block',
            border: '1px solid var(--border-light)',
          }}
          onPointerDown={handleHuePointerDown}
          onPointerMove={handleHuePointerMove}
          onPointerUp={handleHuePointerUp}
        />
      </div>

      {/* Color Swatch & Hex / Alpha Inputs */}
      <div className="color-picker-row">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {secondaryColor && onSelectSlot ? (
            <div style={{ position: 'relative', width: 44, height: 38 }}>
              {/* Secondary Color Swatch (behind) */}
              <div
                className={`secondary-color-preview ${activeColorSlot === 'secondary' ? 'active-slot' : ''}`}
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  backgroundColor: rgbaToHex(secondaryColor),
                  cursor: 'pointer',
                  border:
                    activeColorSlot === 'secondary'
                      ? '2px solid var(--accent-color)'
                      : '1px solid var(--border-light)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                  zIndex: activeColorSlot === 'secondary' ? 2 : 1,
                }}
                onClick={() => onSelectSlot('secondary')}
                title={`Cor Secundária: ${rgbaToHex(secondaryColor).toUpperCase()} (Alfa: ${secondaryColor.a}) - Clique para editar`}
              />
              {/* Primary Color Swatch (front) */}
              <div
                className={`primary-color-preview ${activeColorSlot === 'primary' ? 'active-slot' : ''}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: 26,
                  height: 26,
                  borderRadius: 4,
                  backgroundColor: currentHex,
                  cursor: 'pointer',
                  border:
                    activeColorSlot === 'primary'
                      ? '2px solid var(--accent-color)'
                      : '1px solid var(--border-light)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                  zIndex: activeColorSlot === 'primary' ? 2 : 1,
                }}
                onClick={() => onSelectSlot('primary')}
                title={`Cor Principal: ${currentHex.toUpperCase()} (Alfa: ${currentColor.a}) - Clique para editar`}
              />
              {/* Swap Button */}
              {onSwapColors && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSwapColors();
                  }}
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-muted)',
                    borderRadius: 4,
                    padding: 2,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 3,
                  }}
                  title="Inverter cores primária e secundária (X)"
                >
                  <ArrowLeftRight size={10} />
                </button>
              )}
            </div>
          ) : (
            <div
              className="current-color-preview"
              style={{ backgroundColor: currentHex }}
              title={`Cor Atual: ${currentHex.toUpperCase()} (Alfa: ${currentColor.a})`}
            />
          )}
        </div>

        <div className="hex-input-group">
          <span className="hex-label">HEX & ALFA</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              className="hex-input"
              value={hexInput}
              onChange={handleHexChange}
              onBlur={() => setHexInputOverride(null)}
              maxLength={7}
            />
            <input
              type="number"
              min="0"
              max="255"
              value={currentColor.a}
              onChange={(e) =>
                onColorChange({
                  ...currentColor,
                  a: Math.min(255, Math.max(0, parseInt(e.target.value) || 0)),
                })
              }
              className="hex-input"
              style={{ width: 54 }}
              title="Opacidade do traço (0-255)"
            />
          </div>
        </div>
      </div>

      {/* Favorites Section */}
      <div
        className="panel-title"
        style={{
          marginTop: 10,
          fontSize: '0.7rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Star size={12} color="var(--warning)" fill="var(--warning)" />
          <span>Favoritas ({favorites.length})</span>
        </div>
        <button
          className="btn"
          style={{ padding: '2px 6px', fontSize: '0.65rem' }}
          onClick={handleAddFavorite}
          title="Salvar cor atual nas favoritas"
        >
          <Plus size={11} />
          <span>Salvar</span>
        </button>
      </div>

      <div className="palette-swatches" style={{ marginBottom: 12 }}>
        {favorites.map((fav, idx) => (
          <div
            key={`${fav.hex}-${fav.alpha}-${idx}`}
            className="swatch"
            style={{
              backgroundColor: fav.hex,
              position: 'relative',
              opacity: fav.alpha / 255,
            }}
            onClick={() => {
              const parsed = hexToRgba(fav.hex, fav.alpha);
              onColorChange(parsed);
              const hsv = rgbToHsv(parsed.r, parsed.g, parsed.b);
              setUserHue(hsv.h);
              setHexInputOverride(null);
            }}
            title={`${fav.hex.toUpperCase()} (Alfa: ${fav.alpha}) - Clique para selecionar`}
          >
            <button
              onClick={(e) => handleRemoveFavorite(idx, e)}
              style={{
                position: 'absolute',
                top: -3,
                right: -3,
                width: 13,
                height: 13,
                borderRadius: '50%',
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                fontSize: '9px',
                lineHeight: 1,
              }}
              title="Remover dos favoritos"
            >
              <X size={8} />
            </button>
          </div>
        ))}
      </div>

      {/* Minecraft Cape Presets */}
      <div className="panel-title" style={{ fontSize: '0.7rem' }}>
        Paleta Capas Minecraft
      </div>
      <div className="palette-swatches">
        {MINECRAFT_CAPE_PRESETS.map((hex) => (
          <div
            key={hex}
            className="swatch"
            style={{ backgroundColor: hex }}
            onClick={() => {
              const parsed = hexToRgba(hex, currentColor.a);
              onColorChange(parsed);
              const hsv = rgbToHsv(parsed.r, parsed.g, parsed.b);
              setUserHue(hsv.h);
              setHexInputOverride(null);
            }}
            title={hex.toUpperCase()}
          />
        ))}
      </div>

      {/* Recent Colors */}
      {recentColors.length > 0 && (
        <>
          <div className="panel-title" style={{ marginTop: 12, fontSize: '0.7rem' }}>
            Cores Recentes
          </div>
          <div className="palette-swatches">
            {recentColors.map((hex, idx) => (
              <div
                key={`${hex}-${idx}`}
                className="swatch"
                style={{ backgroundColor: hex }}
                onClick={() => {
                  const parsed = hexToRgba(hex, currentColor.a);
                  onColorChange(parsed);
                  const hsv = rgbToHsv(parsed.r, parsed.g, parsed.b);
                  setUserHue(hsv.h);
                  setHexInputOverride(null);
                }}
                title={hex.toUpperCase()}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
