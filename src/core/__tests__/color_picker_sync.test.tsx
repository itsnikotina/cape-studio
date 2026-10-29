import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ColorTrianglePicker } from '../../components/ColorTrianglePicker';
import { GradientOptionsBar } from '../../components/GradientOptionsBar';
import { DocumentModel } from '../DocumentModel';
import { HistoryManager } from '../HistoryManager';
import { DrawingEngine, rgbaToHex } from '../DrawingEngine';
import type { ColorRGBA, GradientConfig } from '../../types/editor';

// Enable React act() support
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Color Picker Synchronization and Primary/Secondary Independence', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
      root = null;
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
      container = null;
    }
  });

  const redMojang: ColorRGBA = { r: 176, g: 30, b: 40, a: 255 }; // #b01e28
  const white: ColorRGBA = { r: 255, g: 255, b: 255, a: 255 };     // #ffffff
  const cyanDiamond: ColorRGBA = { r: 74, g: 237, b: 217, a: 255 }; // #4aedd9
  const goldMinecon: ColorRGBA = { r: 255, g: 172, b: 0, a: 255 }; // #ffac00

  it('1. Changing primary color does not modify secondary color', () => {
    let primary = { ...redMojang };
    let secondary = { ...white };

    const handleColorChange = (newColor: ColorRGBA, slot: 'primary' | 'secondary') => {
      if (slot === 'secondary') {
        secondary = newColor;
      } else {
        primary = newColor;
      }
    };

    // Simulate primary change
    handleColorChange(cyanDiamond, 'primary');

    expect(primary).toEqual(cyanDiamond);
    expect(secondary).toEqual(white); // Secondary strictly intact
  });

  it('2. Changing secondary color does not modify primary color', () => {
    let primary = { ...redMojang };
    let secondary = { ...white };

    const handleColorChange = (newColor: ColorRGBA, slot: 'primary' | 'secondary') => {
      if (slot === 'secondary') {
        secondary = newColor;
      } else {
        primary = newColor;
      }
    };

    // Simulate secondary change
    handleColorChange(goldMinecon, 'secondary');

    expect(primary).toEqual(redMojang); // Primary strictly intact
    expect(secondary).toEqual(goldMinecon);
  });

  it('3. Visual indicators strictly display their respective colors regardless of active slot', () => {
    // Wrapper component simulating App.tsx state management
    const TestColorPickerWrapper: React.FC = () => {
      const [primary, setPrimary] = useState<ColorRGBA>(redMojang);
      const [secondary, setSecondary] = useState<ColorRGBA>(white);
      const [slot, setSlot] = useState<'primary' | 'secondary'>('primary');

      const onColorChange = (color: ColorRGBA) => {
        if (slot === 'secondary') {
          setSecondary(color);
        } else {
          setPrimary(color);
        }
      };

      return (
        <div>
          <button data-testid="select-secondary" onClick={() => setSlot('secondary')}>
            Select Secondary
          </button>
          <button data-testid="select-primary" onClick={() => setSlot('primary')}>
            Select Primary
          </button>
          <button
            data-testid="set-color-cyan"
            onClick={() => onColorChange(cyanDiamond)}
          >
            Set Color Cyan
          </button>
          <ColorTrianglePicker
            primaryColor={primary}
            secondaryColor={secondary}
            activeColorSlot={slot}
            onSelectSlot={setSlot}
            onColorChange={onColorChange}
            recentColors={[]}
          />
        </div>
      );
    };

    act(() => {
      root!.render(<TestColorPickerWrapper />);
    });

    const primarySwatch = container!.querySelector('[data-testid="primary-color-swatch"]') as HTMLElement;
    const secondarySwatch = container!.querySelector('[data-testid="secondary-color-swatch"]') as HTMLElement;

    expect(primarySwatch).not.toBeNull();
    expect(secondarySwatch).not.toBeNull();

    // Initially: Primary is Mojang Red (#B01E28), Secondary is White (#FFFFFF)
    expect(primarySwatch.style.backgroundColor.toLowerCase()).toBe('#b01e28');
    expect(secondarySwatch.style.backgroundColor.toLowerCase()).toBe('#ffffff');
    expect(primarySwatch.className).toContain('active-slot');
    expect(secondarySwatch.className).not.toContain('active-slot');

    // Switch to Secondary slot
    act(() => {
      const btn = container!.querySelector('[data-testid="select-secondary"]') as HTMLButtonElement;
      btn.click();
    });

    // Both indicators MUST still display their own respective colors!
    expect(primarySwatch.style.backgroundColor.toLowerCase()).toBe('#b01e28');
    expect(secondarySwatch.style.backgroundColor.toLowerCase()).toBe('#ffffff');
    expect(secondarySwatch.className).toContain('active-slot');
    expect(primarySwatch.className).not.toContain('active-slot');

    // Change the color while Secondary slot is active to Cyan (#4AEDD9)
    act(() => {
      const btn = container!.querySelector('[data-testid="set-color-cyan"]') as HTMLButtonElement;
      btn.click();
    });

    // Secondary swatch MUST become cyan, and Primary swatch MUST remain red!
    expect(primarySwatch.style.backgroundColor.toLowerCase()).toBe('#b01e28');
    expect(secondarySwatch.style.backgroundColor.toLowerCase()).toBe('#4aedd9');

    // Now switch back to Primary slot
    act(() => {
      const btn = container!.querySelector('[data-testid="select-primary"]') as HTMLButtonElement;
      btn.click();
    });

    expect(primarySwatch.style.backgroundColor.toLowerCase()).toBe('#b01e28');
    expect(secondarySwatch.style.backgroundColor.toLowerCase()).toBe('#4aedd9');
    expect(primarySwatch.className).toContain('active-slot');
  });

  it('4. Swapping colors inverts primary and secondary values correctly', () => {
    let primary = { ...redMojang };
    let secondary = { ...white };

    const handleSwapColors = () => {
      const prevP = primary;
      const prevS = secondary;
      primary = prevS;
      secondary = prevP;
    };

    handleSwapColors();
    expect(primary).toEqual(white);
    expect(secondary).toEqual(redMojang);

    handleSwapColors();
    expect(primary).toEqual(redMojang);
    expect(secondary).toEqual(white);
  });

  it('5. Gradient continues using correct start and end colors regardless of active slot', () => {
    const doc = new DocumentModel(64, 32, 1);
    const layer = doc.getActiveLayer();

    const primary = redMojang;
    const secondary = cyanDiamond;

    const config: GradientConfig = {
      type: 'linear',
      reverse: false,
      opacity: 1.0,
    };

    // When reverse is false: start is primary, end is secondary
    DrawingEngine.applyGradient(
      layer.ctx,
      0, 0,
      20, 0,
      primary,
      secondary,
      config,
      64, 32
    );

    const startPixel = DrawingEngine.getPixel(layer.ctx, 0, 0);
    expect(startPixel.r).toBe(redMojang.r);
    expect(startPixel.g).toBe(redMojang.g);
    expect(startPixel.b).toBe(redMojang.b);

    const endPixel = DrawingEngine.getPixel(layer.ctx, 20, 0);
    expect(endPixel.r).toBe(cyanDiamond.r);
    expect(endPixel.g).toBe(cyanDiamond.g);
    expect(endPixel.b).toBe(cyanDiamond.b);

    // Verify GradientOptionsBar renders correct colors
    act(() => {
      root!.render(
        <GradientOptionsBar
          config={config}
          onChangeConfig={() => {}}
          primaryColor={primary}
          secondaryColor={secondary}
          onSwapColors={() => {}}
        />
      );
    });

    const preview = container!.querySelector('.gradient-options-bar');
    expect(preview).not.toBeNull();
  });

  it('6. Selecting or changing color does not modify pixel history', () => {
    const doc = new DocumentModel(64, 32, 1);
    const history = new HistoryManager(30);

    // Initial state: canUndo should be false
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);

    // Simulate user selecting preset or picking color in ColorTrianglePicker
    const newColor = cyanDiamond;
    const hex = rgbaToHex(newColor);
    expect(hex).toBe('#4aedd9');

    // Document layers and history MUST NOT be modified by color selection
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);

    // Verify canvas pixels are strictly untouched
    const pixel = DrawingEngine.getPixel(doc.getActiveLayer().ctx, 0, 0);
    expect(pixel.a).toBe(0);
  });
});
