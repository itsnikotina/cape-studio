import React from 'react';
import {
  Pencil,
  Eraser,
  Pipette,
  PaintBucket,
  Minus,
  Square,
  Circle,
  BoxSelect,
  Move,
  Copy,
  Scissors,
  ClipboardPaste,
  FlipHorizontal,
  XSquare,
} from 'lucide-react';
import type { ToolType } from '../types/editor';

interface ToolBarProps {
  currentTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  hasActiveSelection: boolean;
  onCopySelection: () => void;
  onCutSelection: () => void;
  onPasteSelection: () => void;
  onFlipSelection: () => void;
  onCancelSelection: () => void;
}

export const ToolBar: React.FC<ToolBarProps> = ({
  currentTool,
  onSelectTool,
  hasActiveSelection,
  onCopySelection,
  onCutSelection,
  onPasteSelection,
  onFlipSelection,
  onCancelSelection,
}) => {
  const tools: { id: ToolType; name: string; key: string; icon: React.ReactNode }[] = [
    { id: 'pencil', name: 'Lápis (P)', key: 'P', icon: <Pencil size={18} /> },
    { id: 'eraser', name: 'Borracha (E)', key: 'E', icon: <Eraser size={18} /> },
    { id: 'dropper', name: 'Conta-gotas (I)', key: 'I', icon: <Pipette size={18} /> },
    { id: 'fill', name: 'Preenchimento (G)', key: 'G', icon: <PaintBucket size={18} /> },
    { id: 'line', name: 'Linha (L)', key: 'L', icon: <Minus size={18} /> },
    { id: 'rectangle', name: 'Retângulo Contorno', key: 'U', icon: <Square size={18} /> },
    {
      id: 'rectangle-fill',
      name: 'Retângulo Preenchido',
      key: '⇧U',
      icon: <Square size={18} fill="currentColor" />,
    },
    { id: 'ellipse', name: 'Elipse Contorno', key: 'C', icon: <Circle size={18} /> },
    {
      id: 'ellipse-fill',
      name: 'Elipse Preenchida',
      key: '⇧C',
      icon: <Circle size={18} fill="currentColor" />,
    },
    { id: 'select', name: 'Seleção Retangular', key: 'M', icon: <BoxSelect size={18} /> },
    { id: 'move', name: 'Mover Seleção ou Camada (V)', key: 'V', icon: <Move size={18} /> },
  ];

  return (
    <div className="panel-section">
      <div className="panel-title">Ferramentas</div>
      <div className="tools-grid">
        {tools.map((t) => (
          <button
            key={t.id}
            className={`tool-button ${currentTool === t.id ? 'active' : ''}`}
            onClick={() => onSelectTool(t.id)}
            title={t.name}
          >
            {t.icon}
            <span className="tool-key">{t.key}</span>
          </button>
        ))}
      </div>

      {/* Selection Actions bar if selection is active */}
      {hasActiveSelection && (
        <div style={{ marginTop: 12 }}>
          <div className="panel-title" style={{ fontSize: '0.7rem' }}>
            Ações de Seleção
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
            <button className="btn btn-icon" onClick={onCopySelection} title="Copiar (Ctrl+C)">
              <Copy size={14} />
            </button>
            <button className="btn btn-icon" onClick={onCutSelection} title="Recortar (Ctrl+X)">
              <Scissors size={14} />
            </button>
            <button className="btn btn-icon" onClick={onPasteSelection} title="Colar (Ctrl+V)">
              <ClipboardPaste size={14} />
            </button>
            <button className="btn btn-icon" onClick={onFlipSelection} title="Espelhar Horizontalmente">
              <FlipHorizontal size={14} />
            </button>
            <button className="btn btn-icon" onClick={onCancelSelection} title="Desmarcar (Esc)">
              <XSquare size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
