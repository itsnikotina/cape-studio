import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  RotateCcw,
  FilePlus,
  Layers,
  Calendar,
  Maximize2,
  FileText,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import type { SerializedProject } from '../core/ProjectStorage';

export interface RecoveryModalProps {
  isOpen: boolean;
  project: SerializedProject | null;
  onRestore: () => void;
  onNewProject: () => void;
  onClose: () => void;
}

export const RecoveryModal: React.FC<RecoveryModalProps> = ({
  isOpen,
  project,
  onRestore,
  onNewProject,
  onClose,
}) => {
  const [isConfirmingNew, setIsConfirmingNew] = useState(false);

  const handleClose = useCallback(() => {
    setIsConfirmingNew(false);
    onClose();
  }, [onClose]);

  const handleRestore = () => {
    setIsConfirmingNew(false);
    onRestore();
  };

  const handleConfirmNew = () => {
    setIsConfirmingNew(false);
    onNewProject();
  };

  // Listen to Escape key specifically for this modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (isConfirmingNew) {
          setIsConfirmingNew(false);
        } else {
          handleClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, isConfirmingNew, handleClose]);

  if (!isOpen || !project) {
    return null;
  }

  const formattedDate = new Date(project.updatedAt).toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const scaleText = project.dimensions.scale > 1
    ? `${project.dimensions.scale}x HD`
    : 'Padrão (1x)';

  return (
    <div
      className="modal-overlay"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-modal-title"
    >
      <div
        className="modal-card"
        style={{ width: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="#38bdf8" />
            <h3 id="recovery-modal-title" className="modal-title">
              {isConfirmingNew ? 'Confirmar Novo Projeto' : 'Projeto Recuperável Encontrado'}
            </h3>
          </div>
          <button
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Fechar janela de recuperação"
            title="Fechar janela (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {isConfirmingNew ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  background: 'rgba(234, 179, 8, 0.1)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  borderRadius: 8,
                  padding: 12,
                  color: '#facc15',
                  marginBottom: 16,
                }}
              >
                <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
                  <strong>Atenção:</strong> Ao iniciar um documento novo e começar a desenhar, um novo salvamento automático substituirá o projeto anterior no navegador.
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Se você fechar a janela agora ou clicar em <strong>Voltar</strong>, seu projeto anterior continuará guardado com segurança. Deseja realmente iniciar uma capa em branco?
              </p>
            </div>
          ) : (
            <div>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Encontramos uma textura salva automaticamente no armazenamento local deste navegador:
              </p>

              <div className="recovery-meta-card">
                <div className="recovery-meta-item">
                  <span className="recovery-meta-label">
                    <FileText size={12} /> Nome da Capa
                  </span>
                  <span className="recovery-meta-value" title={project.name}>
                    {project.name || 'minha_capa'}
                  </span>
                </div>

                <div className="recovery-meta-item">
                  <span className="recovery-meta-label">
                    <Maximize2 size={12} /> Resolução
                  </span>
                  <span className="recovery-meta-value">
                    {project.dimensions.width}×{project.dimensions.height} ({scaleText})
                  </span>
                </div>

                <div className="recovery-meta-item">
                  <span className="recovery-meta-label">
                    <Layers size={12} /> Camadas
                  </span>
                  <span className="recovery-meta-value">
                    {project.layers.length} camada{project.layers.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="recovery-meta-item">
                  <span className="recovery-meta-label">
                    <Calendar size={12} /> Salvo em
                  </span>
                  <span className="recovery-meta-value">
                    {formattedDate}
                  </span>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                💡 Fechar esta janela (X) não apaga o projeto salvo. Ele continuará disponível para recuperação posterior ou na próxima vez que você abrir o CAPE STUDIO.
              </p>
            </div>
          )}
        </div>

        <div className="modal-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {isConfirmingNew ? (
            <>
              <button
                className="btn"
                onClick={() => setIsConfirmingNew(false)}
                title="Voltar para a janela anterior"
              >
                <ArrowLeft size={14} /> Voltar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmNew}
                title="Confirmar início de um documento novo"
              >
                <FilePlus size={14} /> Confirmar Novo Documento
              </button>
            </>
          ) : (
            <>
              <button
                className="btn"
                onClick={() => setIsConfirmingNew(true)}
                title="Iniciar um novo documento em branco"
              >
                <FilePlus size={14} /> Novo Projeto
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRestore}
                title="Restaurar todas as camadas, resolução e pixels do projeto"
              >
                <RotateCcw size={14} /> Recuperar Projeto
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
