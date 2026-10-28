import React, { useState } from 'react';
import {
  Plus,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  Edit2,
  Check,
} from 'lucide-react';
import type { CapeLayer } from '../types/editor';

interface LayerManagerProps {
  layers: CapeLayer[];
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onAddLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onDuplicateLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onChangeOpacity: (id: string, opacity: number) => void;
  onRenameLayer: (id: string, newName: string) => void;
  onReorderLayer: (fromIndex: number, toIndex: number) => void;
}

export const LayerManager: React.FC<LayerManagerProps> = ({
  layers,
  activeLayerId,
  onSelectLayer,
  onAddLayer,
  onDeleteLayer,
  onDuplicateLayer,
  onToggleVisibility,
  onChangeOpacity,
  onRenameLayer,
  onReorderLayer,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const activeLayer = layers.find((l) => l.id === activeLayerId) || layers[0];

  const handleStartRename = (layer: CapeLayer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(layer.id);
    setEditName(layer.name);
  };

  const handleSaveRename = (id: string, e?: React.MouseEvent | React.FormEvent) => {
    e?.stopPropagation();
    if (editName.trim()) {
      onRenameLayer(id, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="panel-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="panel-title">
        <span>Camadas ({layers.length})</span>
        <button className="btn btn-icon" onClick={onAddLayer} title="Adicionar Nova Camada">
          <Plus size={14} />
        </button>
      </div>

      {/* Layers list rendered top-to-bottom (visually top layer on top) */}
      <div className="layers-list">
        {layers.map((layer, index) => {
          const isActive = layer.id === activeLayerId;
          const isEditing = editingId === layer.id;

          return (
            <div
              key={layer.id}
              className={`layer-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectLayer(layer.id)}
            >
              <div className="layer-info">
                <button
                  className="btn btn-icon"
                  style={{ width: 22, height: 22, background: 'transparent', border: 'none' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisibility(layer.id);
                  }}
                  title={layer.visible ? 'Ocultar Camada' : 'Exibir Camada'}
                >
                  {layer.visible ? (
                    <Eye size={14} color="var(--accent-color)" />
                  ) : (
                    <EyeOff size={14} color="var(--text-dim)" />
                  )}
                </button>

                {isEditing ? (
                  <form
                    onSubmit={(e) => handleSaveRename(layer.id, e)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      className="hex-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      style={{ padding: '2px 4px', fontSize: '0.75rem', width: 90 }}
                    />
                    <button
                      type="submit"
                      className="btn btn-icon"
                      style={{ width: 20, height: 20 }}
                    >
                      <Check size={12} />
                    </button>
                  </form>
                ) : (
                  <span
                    className="layer-name"
                    onDoubleClick={(e) => handleStartRename(layer, e)}
                    title="Dois cliques para renomear"
                  >
                    {layer.name}
                  </span>
                )}
              </div>

              <div className="layer-controls" onClick={(e) => e.stopPropagation()}>
                <button
                  className="btn btn-icon"
                  style={{ width: 22, height: 22 }}
                  onClick={(e) => handleStartRename(layer, e)}
                  title="Renomear"
                >
                  <Edit2 size={11} />
                </button>

                <button
                  className="btn btn-icon"
                  style={{ width: 22, height: 22 }}
                  onClick={() => onDuplicateLayer(layer.id)}
                  title="Duplicar Camada"
                >
                  <Copy size={11} />
                </button>

                <button
                  className="btn btn-icon"
                  style={{ width: 22, height: 22 }}
                  disabled={index >= layers.length - 1}
                  onClick={() => onReorderLayer(index, index + 1)}
                  title="Subir Camada"
                >
                  <ChevronUp size={11} />
                </button>

                <button
                  className="btn btn-icon"
                  style={{ width: 22, height: 22 }}
                  disabled={index <= 0}
                  onClick={() => onReorderLayer(index, index - 1)}
                  title="Descer Camada"
                >
                  <ChevronDown size={11} />
                </button>

                {layers.length > 1 && (
                  <button
                    className="btn btn-icon"
                    style={{ width: 22, height: 22, color: 'var(--danger)' }}
                    onClick={() => onDeleteLayer(layer.id)}
                    title="Excluir Camada"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Opacity slider for active layer */}
      {activeLayer && (
        <div className="opacity-slider-row">
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', minWidth: 60 }}>
            Opacidade:
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(activeLayer.opacity * 100)}
            onChange={(e) => onChangeOpacity(activeLayer.id, parseInt(e.target.value) / 100)}
            className="slider"
          />
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              minWidth: 32,
              textAlign: 'right',
            }}
          >
            {Math.round(activeLayer.opacity * 100)}%
          </span>
        </div>
      )}
    </div>
  );
};
