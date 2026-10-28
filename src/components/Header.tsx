import React, { useRef, useState } from 'react';
import {
  Undo2,
  Redo2,
  Upload,
  Download,
  Grid3X3,
  Layers,
  Sparkles,
  SplitSquareVertical,
  HelpCircle,
} from 'lucide-react';
import type { DocumentDimensions } from '../types/editor';

interface HeaderProps {
  documentName: string;
  onDocumentNameChange: (name: string) => void;
  dimensions: DocumentDimensions;
  onResolutionChange: (scale: number, customW?: number, customH?: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onImportFile: (file: File) => void;
  onExportPNG: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showUVGuides: boolean;
  onToggleUVGuides: () => void;
  mirrorHorizontal: boolean;
  onToggleMirror: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  documentName,
  onDocumentNameChange,
  dimensions,
  onResolutionChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onImportFile,
  onExportPNG,
  showGrid,
  onToggleGrid,
  showUVGuides,
  onToggleUVGuides,
  mirrorHorizontal,
  onToggleMirror,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customMultiplier, setCustomMultiplier] = useState(3);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleSelectResolution = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'custom') {
      setShowCustomModal(true);
    } else {
      const scale = parseInt(val, 10);
      onResolutionChange(scale);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportFile(file);
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleApplyCustomMultiplier = () => {
    if (customMultiplier >= 1 && customMultiplier <= 64) {
      onResolutionChange(customMultiplier);
      setShowCustomModal(false);
    }
  };

  return (
    <header className="app-header">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Left: Logo & Doc Name */}
      <div className="logo-section">
        <div className="app-logo">
          <Sparkles size={18} color="#38bdf8" />
          <span>CAPE STUDIO</span>
        </div>
        <span className="badge-hd">
          {dimensions.scale > 1 ? `${dimensions.scale}X HD` : '64×32'}
        </span>
        <input
          type="text"
          className="doc-name-input"
          value={documentName}
          onChange={(e) => onDocumentNameChange(e.target.value)}
          title="Renomear capa"
        />
      </div>

      {/* Center: Resolution selector & Visual Toggles */}
      <div className="header-center">
        <select
          className="select-input"
          value={dimensions.isCustom ? 'custom' : dimensions.scale}
          onChange={handleSelectResolution}
          title="Resolução da textura"
        >
          <option value="1">64×32 (1x Padrão)</option>
          <option value="2">128×64 (2x HD)</option>
          <option value="4">256×128 (4x HD)</option>
          <option value="8">512×256 (8x HD)</option>
          <option value="16">1024×512 (16x HD)</option>
          <option value="custom">Personalizado...</option>
        </select>

        <button
          className={`btn btn-icon ${showGrid ? 'active' : ''}`}
          onClick={onToggleGrid}
          title="Alternar Grade de Pixels (G)"
        >
          <Grid3X3 size={16} />
        </button>

        <button
          className={`btn btn-icon ${showUVGuides ? 'active' : ''}`}
          onClick={onToggleUVGuides}
          title="Alternar Guias UV de Minecraft (U)"
        >
          <Layers size={16} />
        </button>

        <button
          className={`btn btn-icon ${mirrorHorizontal ? 'active' : ''}`}
          onClick={onToggleMirror}
          title="Desenho Espelhado Horizontalmente"
        >
          <SplitSquareVertical size={16} />
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border-light)', margin: '0 4px' }} />

        <button
          className="btn btn-icon"
          onClick={onUndo}
          disabled={!canUndo}
          title="Desfazer (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>

        <button
          className="btn btn-icon"
          onClick={onRedo}
          disabled={!canRedo}
          title="Refazer (Ctrl+Y / Ctrl+Shift+Z)"
        >
          <Redo2 size={16} />
        </button>
      </div>

      {/* Right: Import / Export */}
      <div className="header-actions">
        <button
          className="btn"
          onClick={() => fileInputRef.current?.click()}
          title="Importar textura PNG existente"
        >
          <Upload size={14} />
          <span>Importar PNG</span>
        </button>

        <button
          className="btn btn-primary"
          onClick={onExportPNG}
          title={`Exportar textura em ${dimensions.width}×${dimensions.height}`}
        >
          <Download size={14} />
          <span>Exportar PNG</span>
        </button>

        <button
          className="btn btn-icon"
          onClick={() => setShowHelpModal(true)}
          title="Atalhos e Ajuda"
        >
          <HelpCircle size={16} />
        </button>
      </div>

      {/* Custom Multiplier Modal */}
      {showCustomModal && (
        <div className="modal-overlay" onClick={() => setShowCustomModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Resolução Personalizada HD</h3>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 12 }}>
                Escolha um multiplicador inteiro baseado na proporção padrão de 64×32 do Minecraft.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <label style={{ fontSize: '0.85rem', color: '#fff' }}>Multiplicador:</label>
                <input
                  type="number"
                  min="1"
                  max="32"
                  value={customMultiplier}
                  onChange={(e) => setCustomMultiplier(Math.max(1, parseInt(e.target.value) || 1))}
                  className="select-input"
                  style={{ width: 80 }}
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--accent-color)' }}>
                  = {customMultiplier * 64} × {customMultiplier * 32} pixels
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Todas as coordenadas UV serão dimensionadas proporcionalmente mantendo alinhamento exato.
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowCustomModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleApplyCustomMultiplier}>
                Aplicar Resolução
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help & Shortcuts Modal */}
      {showHelpModal && (
        <div className="modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: 500 }}>
            <div className="modal-header">
              <h3 className="modal-title">Atalhos de Teclado & Guia</h3>
            </div>
            <div className="modal-body" style={{ maxHeight: 380, overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 0', color: '#fff' }}>P</td>
                    <td style={{ color: 'var(--text-muted)' }}>Lápis (Pencil)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 0', color: '#fff' }}>E</td>
                    <td style={{ color: 'var(--text-muted)' }}>Borracha (Eraser)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 0', color: '#fff' }}>I</td>
                    <td style={{ color: 'var(--text-muted)' }}>Conta-gotas (Dropper)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 0', color: '#fff' }}>G</td>
                    <td style={{ color: 'var(--text-muted)' }}>Preenchimento (Flood Fill)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 0', color: '#fff' }}>L</td>
                    <td style={{ color: 'var(--text-muted)' }}>Linha</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 0', color: '#fff' }}>U / Shift+U</td>
                    <td style={{ color: 'var(--text-muted)' }}>Retângulo Contornado / Preenchido</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 0', color: '#fff' }}>C / Shift+C</td>
                    <td style={{ color: 'var(--text-muted)' }}>Elipse Contornada / Preenchida</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 0', color: '#fff' }}>M</td>
                    <td style={{ color: 'var(--text-muted)' }}>Seleção Retangular</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 0', color: '#fff' }}>V</td>
                    <td style={{ color: 'var(--text-muted)' }}>Mover Seleção</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 0', color: '#fff' }}>Ctrl+Z / Ctrl+Y</td>
                    <td style={{ color: 'var(--text-muted)' }}>Desfazer / Refazer</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 0', color: '#fff' }}>Espaço + Arraste</td>
                    <td style={{ color: 'var(--text-muted)' }}>Panorâmica (Pan) do Canvas</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 0', color: '#fff' }}>Scroll Wheel</td>
                    <td style={{ color: 'var(--text-muted)' }}>Zoom In / Zoom Out</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setShowHelpModal(false)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
