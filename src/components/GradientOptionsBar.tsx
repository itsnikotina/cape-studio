import React from 'react';
import type { ColorRGBA, GradientType, GradientConfig } from '../types/editor';
import { rgbaToHex } from '../core/DrawingEngine';
import { ArrowLeftRight } from 'lucide-react';

export interface GradientOptionsBarProps {
  config: GradientConfig;
  onChangeConfig: (config: GradientConfig) => void;
  primaryColor: ColorRGBA;
  secondaryColor: ColorRGBA;
  onSwapColors: () => void;
}

export const GradientOptionsBar: React.FC<GradientOptionsBarProps> = ({
  config,
  onChangeConfig,
  primaryColor,
  secondaryColor,
  onSwapColors,
}) => {
  const startColor = config.reverse ? secondaryColor : primaryColor;
  const endColor = config.reverse ? primaryColor : secondaryColor;

  const startRgbaCss = `rgba(${startColor.r},${startColor.g},${startColor.b},${startColor.a / 255})`;
  const endRgbaCss = `rgba(${endColor.r},${endColor.g},${endColor.b},${endColor.a / 255})`;

  const types: { id: GradientType; label: string; icon: React.ReactNode }[] = [
    {
      id: 'linear',
      label: 'Degradê Linear',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <defs>
            <linearGradient id="optGradLinear" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fff" />
              <stop offset="100%" stopColor="#333" />
            </linearGradient>
          </defs>
          <rect x="1" y="2" width="14" height="12" rx="2" fill="url(#optGradLinear)" />
        </svg>
      ),
    },
    {
      id: 'radial',
      label: 'Degradê Radial',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <defs>
            <radialGradient id="optGradRadial" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff" />
              <stop offset="100%" stopColor="#333" />
            </radialGradient>
          </defs>
          <circle cx="8" cy="8" r="7" fill="url(#optGradRadial)" />
        </svg>
      ),
    },
    {
      id: 'angular',
      label: 'Degradê Angular (Cônico)',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1" fill="#222" />
          <path d="M8 8 L8 1 A7 7 0 0 1 15 8 Z" fill="#fff" opacity="0.9" />
          <path d="M8 8 L15 8 A7 7 0 0 1 8 15 Z" fill="#aaa" opacity="0.8" />
          <path d="M8 8 L8 15 A7 7 0 0 1 1 8 Z" fill="#666" opacity="0.7" />
          <path d="M8 8 L1 8 A7 7 0 0 1 8 1 Z" fill="#333" opacity="0.6" />
        </svg>
      ),
    },
    {
      id: 'reflected',
      label: 'Degradê Refletido',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <defs>
            <linearGradient id="optGradReflected" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#333" />
              <stop offset="50%" stopColor="#fff" />
              <stop offset="100%" stopColor="#333" />
            </linearGradient>
          </defs>
          <rect x="1" y="2" width="14" height="12" rx="2" fill="url(#optGradReflected)" />
        </svg>
      ),
    },
    {
      id: 'diamond',
      label: 'Degradê Diamante (Losango)',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="14" height="14" fill="#333" rx="2" />
          <polygon points="8,2 14,8 8,14 2,8" fill="#fff" />
        </svg>
      ),
    },
  ];

  return (
    <div className="gradient-options-bar" role="toolbar" aria-label="Opções da ferramenta de degradê">
      {/* Tool Label & Types */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-dim)', marginRight: 4 }}>
          TIPO:
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          {types.map((t) => (
            <button
              key={t.id}
              className={`btn btn-icon ${config.type === t.id ? 'active' : ''}`}
              style={{ width: 28, height: 26, padding: 0 }}
              onClick={() => onChangeConfig({ ...config, type: t.id })}
              title={t.label}
              aria-label={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: 1, height: 18, backgroundColor: 'var(--border-color)', margin: '0 2px' }} />

      {/* Visual Gradient Swatch Preview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 72,
            height: 18,
            borderRadius: 4,
            border: '1px solid var(--border-light)',
            background: `linear-gradient(to right, ${startRgbaCss}, ${endRgbaCss})`,
            boxShadow: 'inset 0 0 2px rgba(0,0,0,0.4)',
          }}
          title={`Degradê: ${rgbaToHex(startColor)} ➔ ${rgbaToHex(endColor)}`}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>1:</span>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                backgroundColor: startRgbaCss,
                border: '1px solid var(--border-light)',
              }}
              title={`Cor Inicial: ${rgbaToHex(startColor)}`}
            />
          </div>

          <span style={{ color: 'var(--text-dim)' }}>➔</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>2:</span>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                backgroundColor: endRgbaCss,
                border: '1px solid var(--border-light)',
              }}
              title={`Cor Final: ${rgbaToHex(endColor)}`}
            />
          </div>
        </div>

        {/* Swap Colors Button */}
        <button
          className="btn"
          style={{ padding: '2px 8px', fontSize: '0.72rem', height: 26 }}
          onClick={onSwapColors}
          title="Inverter cores inicial e final (X)"
          aria-label="Inverter cores inicial e final"
        >
          <ArrowLeftRight size={12} style={{ marginRight: 4 }} />
          Inverter
        </button>
      </div>

      <div style={{ width: 1, height: 18, backgroundColor: 'var(--border-color)', margin: '0 2px' }} />

      {/* Opacity Control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontWeight: 600 }}>
          OPACIDADE:
        </span>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(config.opacity * 100)}
          onChange={(e) =>
            onChangeConfig({
              ...config,
              opacity: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) / 100,
            })
          }
          style={{ width: 70, cursor: 'pointer' }}
          title={`Opacidade: ${Math.round(config.opacity * 100)}%`}
        />
        <span style={{ fontSize: '0.74rem', minWidth: 34, textAlign: 'right' }}>
          {Math.round(config.opacity * 100)}%
        </span>
      </div>
    </div>
  );
};
