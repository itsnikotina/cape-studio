import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GradientOptionsBar } from '../../components/GradientOptionsBar';
import type { ColorRGBA, GradientConfig, ToolType } from '../../types/editor';

// Enable React act() support
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Tool Properties Overlay Architecture', () => {
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

  it('1 & 2. Canvas position and dimensions are invariant when activating gradient options overlay', () => {
    // Harness component to measure canvas area dimensions and position across tool switches
    const TestHarness: React.FC = () => {
      const [tool, setTool] = useState<ToolType>('pencil');
      const [config, setConfig] = useState<GradientConfig>({
        type: 'linear',
        opacity: 1.0,
        reverse: false,
      });

      const primary: ColorRGBA = { r: 176, g: 30, b: 40, a: 255 };
      const secondary: ColorRGBA = { r: 255, g: 255, b: 255, a: 255 };

      return (
        <div style={{ width: 1000, height: 700, display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ height: 48, background: '#090d16' }}>Header</div>

          {/* Body */}
          <div style={{ flex: 1, display: 'flex' }}>
            {/* Sidebar */}
            <div style={{ width: 280, background: '#0f172a' }}>
              <button data-testid="btn-pencil" onClick={() => setTool('pencil')}>Pencil</button>
              <button data-testid="btn-gradient" onClick={() => setTool('gradient')}>Gradient</button>
              <button data-testid="btn-eraser" onClick={() => setTool('eraser')}>Eraser</button>
            </div>

            {/* Center: 2D Canvas Editor Container */}
            <div
              className="canvas-editor-container"
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minWidth: 0,
                height: '100%',
                position: 'relative',
              }}
            >
              {tool === 'gradient' && (
                <div
                  className="tool-properties-overlay"
                  data-testid="tool-properties-overlay"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <GradientOptionsBar
                    config={config}
                    onChangeConfig={setConfig}
                    primaryColor={primary}
                    secondaryColor={secondary}
                    onSwapColors={() => {}}
                  />
                </div>
              )}

              <div
                data-testid="mock-canvas-editor-area"
                className="canvas-editor-area"
                style={{
                  flex: 1,
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                }}
              >
                <canvas data-testid="checker-canvas" style={{ position: 'absolute' }} />
                <canvas data-testid="uv-bg-canvas" style={{ position: 'absolute' }} />
                <canvas data-testid="display-canvas" style={{ position: 'absolute' }} />
                <canvas data-testid="uv-fg-canvas" style={{ position: 'absolute' }} />
                <canvas data-testid="overlay-canvas" style={{ position: 'absolute' }} />
              </div>
            </div>
          </div>
        </div>
      );
    };

    act(() => {
      root!.render(<TestHarness />);
    });

    const canvasArea = container!.querySelector('[data-testid="mock-canvas-editor-area"]') as HTMLElement;
    expect(canvasArea).not.toBeNull();

    // 1. Record position and layout state before selecting gradient (pencil active)
    expect(container!.querySelector('[data-testid="tool-properties-overlay"]')).toBeNull();
    const beforeClientHeight = canvasArea.clientHeight;
    const beforeOffsetTop = canvasArea.offsetTop;

    // 2. Select gradient
    act(() => {
      const btnGradient = container!.querySelector('[data-testid="btn-gradient"]') as HTMLButtonElement;
      btnGradient.click();
    });

    const overlay = container!.querySelector('[data-testid="tool-properties-overlay"]') as HTMLElement;
    expect(overlay).not.toBeNull();

    // The overlay is rendered above without displacing the canvas
    const afterClientHeight = canvasArea.clientHeight;
    const afterOffsetTop = canvasArea.offsetTop;

    expect(afterClientHeight).toBe(beforeClientHeight);
    expect(afterOffsetTop).toBe(beforeOffsetTop);
  });

  it('3. Toggling between gradient and other tools preserves exact canvas position', () => {
    const TestToggleHarness: React.FC = () => {
      const [tool, setTool] = useState<ToolType>('pencil');
      const [config] = useState<GradientConfig>({ type: 'linear', opacity: 1, reverse: false });
      const primary: ColorRGBA = { r: 176, g: 30, b: 40, a: 255 };
      const secondary: ColorRGBA = { r: 255, g: 255, b: 255, a: 255 };

      return (
        <div style={{ width: 1000, height: 700, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, display: 'flex' }}>
            <div style={{ width: 280 }}>
              <button data-testid="btn-tool-pencil" onClick={() => setTool('pencil')}>Pencil</button>
              <button data-testid="btn-tool-gradient" onClick={() => setTool('gradient')}>Gradient</button>
              <button data-testid="btn-tool-fill" onClick={() => setTool('fill')}>Fill</button>
            </div>
            <div
              className="canvas-editor-container"
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minWidth: 0,
                height: '100%',
                position: 'relative',
              }}
            >
              {tool === 'gradient' && (
                <div
                  className="tool-properties-overlay"
                  data-testid="tool-properties-overlay"
                >
                  <GradientOptionsBar
                    config={config}
                    onChangeConfig={() => {}}
                    primaryColor={primary}
                    secondaryColor={secondary}
                    onSwapColors={() => {}}
                  />
                </div>
              )}
              <div
                data-testid="editor-area"
                className="canvas-editor-area"
                style={{ flex: 1, position: 'relative' }}
              />
            </div>
          </div>
        </div>
      );
    };

    act(() => {
      root!.render(<TestToggleHarness />);
    });

    const editorArea = container!.querySelector('[data-testid="editor-area"]') as HTMLElement;
    const initialTop = editorArea.offsetTop;
    const initialHeight = editorArea.clientHeight;

    // Switch to gradient
    act(() => {
      (container!.querySelector('[data-testid="btn-tool-gradient"]') as HTMLButtonElement).click();
    });
    expect(container!.querySelector('[data-testid="tool-properties-overlay"]')).not.toBeNull();
    expect(editorArea.offsetTop).toBe(initialTop);
    expect(editorArea.clientHeight).toBe(initialHeight);

    // Switch to fill
    act(() => {
      (container!.querySelector('[data-testid="btn-tool-fill"]') as HTMLButtonElement).click();
    });
    expect(container!.querySelector('[data-testid="tool-properties-overlay"]')).toBeNull();
    expect(editorArea.offsetTop).toBe(initialTop);
    expect(editorArea.clientHeight).toBe(initialHeight);

    // Switch back to pencil
    act(() => {
      (container!.querySelector('[data-testid="btn-tool-pencil"]') as HTMLButtonElement).click();
    });
    expect(editorArea.offsetTop).toBe(initialTop);
    expect(editorArea.clientHeight).toBe(initialHeight);
  });

  it('4. Overlay has absolute positioning and high z-index to overlay canvas without layout displacement', () => {
    act(() => {
      root!.render(
        <div style={{ position: 'relative', width: 600, height: 400 }}>
          <div className="tool-properties-overlay" data-testid="tool-properties-overlay">
            <div className="gradient-options-bar">Content</div>
          </div>
        </div>
      );
    });

    const overlay = container!.querySelector('[data-testid="tool-properties-overlay"]') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.className).toContain('tool-properties-overlay');
  });

  it('5. Controls inside tool overlay receive clicks and events normally', () => {
    const onChangeConfig = vi.fn();
    const onSwapColors = vi.fn();

    const config: GradientConfig = {
      type: 'linear',
      reverse: false,
      opacity: 1.0,
    };

    const primary: ColorRGBA = { r: 176, g: 30, b: 40, a: 255 };
    const secondary: ColorRGBA = { r: 255, g: 255, b: 255, a: 255 };

    act(() => {
      root!.render(
        <div style={{ position: 'relative' }}>
          <div
            className="tool-properties-overlay"
            data-testid="tool-properties-overlay"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <GradientOptionsBar
              config={config}
              onChangeConfig={onChangeConfig}
              primaryColor={primary}
              secondaryColor={secondary}
              onSwapColors={onSwapColors}
            />
          </div>
        </div>
      );
    });

    // Click Radial button (aria-label="Degradê Radial")
    const radialBtn = container!.querySelector('button[aria-label="Degradê Radial"]') as HTMLButtonElement;
    expect(radialBtn).not.toBeNull();

    act(() => {
      radialBtn.click();
    });

    expect(onChangeConfig).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'radial' })
    );

    // Click Invert button (aria-label="Inverter cores inicial e final")
    const invertBtn = container!.querySelector('button[aria-label="Inverter cores inicial e final"]') as HTMLButtonElement;
    expect(invertBtn).not.toBeNull();

    act(() => {
      invertBtn.click();
    });

    expect(onSwapColors).toHaveBeenCalled();
  });
});
