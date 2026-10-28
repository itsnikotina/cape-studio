import React, { useRef } from 'react';
import { hexToRgba, rgbaToHex } from '../core/DrawingEngine';
import type { ColorRGBA } from '../types/editor';

interface ColorPaletteProps {
  currentColor: ColorRGBA;
  onColorChange: (color: ColorRGBA) => void;
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

export const ColorPalette: React.FC<ColorPaletteProps> = ({
  currentColor,
  onColorChange,
  recentColors,
}) => {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const currentHex = rgbaToHex(currentColor);

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.trim();
    if (!val.startsWith('#')) val = `#${val}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      onColorChange(hexToRgba(val, currentColor.a));
    }
  };

  const handleNativeColorPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    onColorChange(hexToRgba(hex, currentColor.a));
  };

  const handleSelectSwatch = (hex: string) => {
    onColorChange(hexToRgba(hex, currentColor.a));
  };

  return (
    <div className="panel-section">
      <div className="panel-title">Cor Principal</div>

      <div className="color-picker-row">
        <div
          className="current-color-preview"
          style={{ backgroundColor: currentHex }}
          onClick={() => colorInputRef.current?.click()}
          title="Clique para abrir o seletor de cores"
        >
          <input
            ref={colorInputRef}
            type="color"
            value={currentHex}
            onChange={handleNativeColorPick}
          />
        </div>

        <div className="hex-input-group">
          <span className="hex-label">HEX & ALFA</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              className="hex-input"
              value={currentHex.toUpperCase()}
              onChange={handleHexInputChange}
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

      <div className="panel-title" style={{ marginTop: 10, fontSize: '0.7rem' }}>
        Paleta Capas Minecraft
      </div>
      <div className="palette-swatches">
        {MINECRAFT_CAPE_PRESETS.map((hex) => (
          <div
            key={hex}
            className="swatch"
            style={{ backgroundColor: hex }}
            onClick={() => handleSelectSwatch(hex)}
            title={hex.toUpperCase()}
          />
        ))}
      </div>

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
                onClick={() => handleSelectSwatch(hex)}
                title={hex.toUpperCase()}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
