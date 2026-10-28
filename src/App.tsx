import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DocumentModel } from './core/DocumentModel';
import { HistoryManager } from './core/HistoryManager';
import { TextureImporter } from './core/TextureImporter';
import { TextureExporter } from './core/TextureExporter';
import { DrawingEngine, rgbaToHex } from './core/DrawingEngine';
import type {
  ToolType,
  ColorRGBA,
  SelectionState,
  HistoryEntry,
} from './types/editor';

import { Header } from './components/Header';
import { ToolBar } from './components/ToolBar';
import { ColorTrianglePicker } from './components/ColorTrianglePicker';
import { LayerManager } from './components/LayerManager';
import { CanvasEditor } from './components/CanvasEditor';
import { Preview3DPanel } from './components/Preview3DPanel';

import './styles/app.css';

export const App: React.FC = () => {
  // Document and History
  const [doc] = useState(() => new DocumentModel(64, 32, 1));
  const historyRef = useRef<HistoryManager>(new HistoryManager(30));
  const [historyStatus, setHistoryStatus] = useState({ canUndo: false, canRedo: false });

  // State
  const [documentName, setDocumentName] = useState('minha_capa');
  const [currentTool, setCurrentTool] = useState<ToolType>('pencil');
  const [primaryColor, setPrimaryColor] = useState<ColorRGBA>({ r: 176, g: 30, b: 40, a: 255 }); // Mojang Red
  const [recentColors, setRecentColors] = useState<string[]>(['#b01e28', '#ffffff', '#17dd62', '#ffac00']);
  const [showGrid, setShowGrid] = useState(true);
  const [showUVGuides, setShowUVGuides] = useState(true);
  const [mirrorHorizontal, setMirrorHorizontal] = useState(false);
  const [version, setVersion] = useState(0);

  // Modals & Warnings
  const [warningModal, setWarningModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    recommendation?: string;
  } | null>(null);

  const [exportModal, setExportModal] = useState(false);
  const [exportFilename, setExportFilename] = useState('minha_capa');

  // Selection
  const [selectionState, setSelectionState] = useState<SelectionState>({
    rect: null,
    floatingCanvas: null,
    floatingX: 0,
    floatingY: 0,
    isFloating: false,
  });

  const [copiedCanvas, setCopiedCanvas] = useState<HTMLCanvasElement | null>(null);

  // Stroke snapshot before modification
  const strokeBeforeSnapshotRef = useRef<HistoryEntry | null>(null);

  // Sync history state
  const syncHistoryStatus = useCallback(() => {
    setHistoryStatus({
      canUndo: historyRef.current.canUndo(),
      canRedo: historyRef.current.canRedo(),
    });
  }, []);

  const handleStartStroke = useCallback(() => {
    strokeBeforeSnapshotRef.current = doc.createSnapshot('Before Stroke');
  }, [doc]);

  // Helper to record recent color only when a drawing tool successfully modifies pixels
  const recordRecentColor = useCallback((color: ColorRGBA) => {
    const hex = rgbaToHex(color);
    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c.toLowerCase() !== hex.toLowerCase());
      return [hex, ...filtered].slice(0, 16);
    });
  }, []);

  // Commit changes to history
  const commitChange = useCallback((description = 'Modificação', colorUsed?: ColorRGBA) => {
    if (strokeBeforeSnapshotRef.current) {
      historyRef.current.pushState(strokeBeforeSnapshotRef.current);
      strokeBeforeSnapshotRef.current = null;
    } else {
      historyRef.current.pushState(doc.createSnapshot(description));
    }
    if (colorUsed) {
      recordRecentColor(colorUsed);
    }
    syncHistoryStatus();
    doc.notifyUpdate();
    setVersion((v) => v + 1);
  }, [doc, syncHistoryStatus, recordRecentColor]);

  // Helper for atomic actions outside drag drawing (layer operations, resize, import, etc.)
  const recordAction = useCallback((action: () => void, description = 'Modificação') => {
    const before = doc.createSnapshot(description);
    action();
    historyRef.current.pushState(before);
    syncHistoryStatus();
    doc.notifyUpdate();
    setVersion((v) => v + 1);
  }, [doc, syncHistoryStatus]);

  // Undo / Redo
  const handleUndo = useCallback(() => {
    const currentSnapshot = doc.createSnapshot('Current');
    const previous = historyRef.current.undo(currentSnapshot);
    if (previous) {
      doc.restoreSnapshot(previous);
      syncHistoryStatus();
      doc.notifyUpdate();
      setVersion((v) => v + 1);
    }
  }, [doc, syncHistoryStatus]);

  const handleRedo = useCallback(() => {
    const currentSnapshot = doc.createSnapshot('Current');
    const next = historyRef.current.redo(currentSnapshot);
    if (next) {
      doc.restoreSnapshot(next);
      syncHistoryStatus();
      doc.notifyUpdate();
      setVersion((v) => v + 1);
    }
  }, [doc, syncHistoryStatus]);

  // Color picker handler - updates primaryColor only; does NOT record to recent colors
  const handleColorChange = (newColor: ColorRGBA) => {
    setPrimaryColor(newColor);
  };

  // Resolution switch
  const handleResolutionChange = (scale: number, customW?: number, customH?: number) => {
    const newW = customW || 64 * scale;
    const newH = customH || 32 * scale;
    recordAction(() => {
      doc.setDimensions(newW, newH, scale, Boolean(customW || customH));
    }, `Alterar resolução para ${newW}×${newH}`);
  };

  // PNG Import
  const handleImportFile = async (file: File) => {
    try {
      const { image, validation } = await TextureImporter.loadFromFile(file);

      // Show warning modal if not standard HD or invalid
      if (validation.warning) {
        setWarningModal({
          isOpen: true,
          title: validation.isValid ? 'Aviso de Compatibilidade de Resolução' : 'Formato Não Padrão',
          message: validation.warning,
          recommendation: validation.recommendation,
        });
      }

      recordAction(() => {
        doc.setDimensions(
          validation.width,
          validation.height,
          validation.scale,
          !validation.isStandardHD
        );
        const activeLayer = doc.getActiveLayer();
        activeLayer.ctx.clearRect(0, 0, validation.width, validation.height);
        activeLayer.ctx.drawImage(image, 0, 0);
      }, `Importar ${file.name}`);

      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      setDocumentName(cleanName);
      setExportFilename(cleanName);
    } catch (err: unknown) {
      setWarningModal({
        isOpen: true,
        title: 'Erro ao Importar PNG',
        message: err instanceof Error ? err.message : 'Falha ao processar arquivo PNG.',
      });
    }
  };

  // PNG Export
  const handleConfirmExport = async () => {
    await TextureExporter.downloadTexture(doc, exportFilename);
    setExportModal(false);
  };

  // Selection actions
  const handleCopySelection = () => {
    if (!selectionState.rect) return;
    const activeLayer = doc.getActiveLayer();
    const extracted = DrawingEngine.extractSelection(activeLayer.ctx, selectionState.rect, false);
    setCopiedCanvas(extracted);
  };

  const handleCutSelection = () => {
    if (!selectionState.rect) return;
    recordAction(() => {
      const activeLayer = doc.getActiveLayer();
      const extracted = DrawingEngine.extractSelection(activeLayer.ctx, selectionState.rect!, true);
      setCopiedCanvas(extracted);
    }, 'Recortar Seleção');
  };

  const handlePasteSelection = () => {
    const source = copiedCanvas || selectionState.floatingCanvas;
    if (!source) return;

    setSelectionState({
      rect: {
        x: 0,
        y: 0,
        width: source.width,
        height: source.height,
      },
      floatingCanvas: source,
      floatingX: 0,
      floatingY: 0,
      isFloating: true,
    });
    setCurrentTool('move');
  };

  const handleFlipSelection = () => {
    if (selectionState.isFloating && selectionState.floatingCanvas) {
      const flipped = DrawingEngine.flipHorizontally(selectionState.floatingCanvas);
      setSelectionState({
        ...selectionState,
        floatingCanvas: flipped,
      });
      doc.notifyUpdate();
      setVersion((v) => v + 1);
    } else if (selectionState.rect) {
      recordAction(() => {
        const activeLayer = doc.getActiveLayer();
        const extracted = DrawingEngine.extractSelection(activeLayer.ctx, selectionState.rect!, true);
        const flipped = DrawingEngine.flipHorizontally(extracted);

        setSelectionState({
          ...selectionState,
          floatingCanvas: flipped,
          floatingX: selectionState.rect!.x,
          floatingY: selectionState.rect!.y,
          isFloating: true,
        });
      }, 'Espelhar Seleção');
    }
  };

  const commitFloatingSelection = () => {
    if (selectionState.isFloating && selectionState.floatingCanvas) {
      recordAction(() => {
        const activeLayer = doc.getActiveLayer();
        DrawingEngine.pasteSelection(
          activeLayer.ctx,
          selectionState.floatingCanvas!,
          selectionState.floatingX,
          selectionState.floatingY
        );
      }, 'Fixar Seleção');
    }
    setSelectionState({
      rect: null,
      floatingCanvas: null,
      floatingX: 0,
      floatingY: 0,
      isFloating: false,
    });
  };

  // Keyboard Shortcuts Refs for rock-solid event handling without stale closures
  const handleUndoRef = useRef(handleUndo);
  const handleRedoRef = useRef(handleRedo);
  const handleCopyRef = useRef(handleCopySelection);
  const handleCutRef = useRef(handleCutSelection);
  const handlePasteRef = useRef(handlePasteSelection);
  const commitFloatingRef = useRef(commitFloatingSelection);

  useEffect(() => {
    handleUndoRef.current = handleUndo;
    handleRedoRef.current = handleRedo;
    handleCopyRef.current = handleCopySelection;
    handleCutRef.current = handleCutSelection;
    handlePasteRef.current = handlePasteSelection;
    commitFloatingRef.current = commitFloatingSelection;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in text inputs or textareas
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Undo / Redo (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y)
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) {
            handleRedoRef.current();
          } else {
            handleUndoRef.current();
          }
          return;
        }

        if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          e.stopPropagation();
          handleRedoRef.current();
          return;
        }

        // Copy / Cut / Paste
        if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          handleCopyRef.current();
          return;
        }

        if (e.key.toLowerCase() === 'x') {
          e.preventDefault();
          handleCutRef.current();
          return;
        }

        if (e.key.toLowerCase() === 'v') {
          e.preventDefault();
          handlePasteRef.current();
          return;
        }
      }

      // Escape -> commit or cancel selection
      if (e.key === 'Escape') {
        commitFloatingRef.current();
        return;
      }

      // Tool shortcuts
      switch (e.key.toLowerCase()) {
        case 'p':
          commitFloatingRef.current();
          setCurrentTool('pencil');
          break;
        case 'e':
          commitFloatingRef.current();
          setCurrentTool('eraser');
          break;
        case 'i':
          commitFloatingRef.current();
          setCurrentTool('dropper');
          break;
        case 'g':
          commitFloatingRef.current();
          setCurrentTool('fill');
          break;
        case 'l':
          commitFloatingRef.current();
          setCurrentTool('line');
          break;
        case 'u':
          commitFloatingRef.current();
          setCurrentTool(e.shiftKey ? 'rectangle-fill' : 'rectangle');
          break;
        case 'c':
          commitFloatingRef.current();
          setCurrentTool(e.shiftKey ? 'ellipse-fill' : 'ellipse');
          break;
        case 'm':
          commitFloatingRef.current();
          setCurrentTool('select');
          break;
        case 'v':
          setCurrentTool('move');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        documentName={documentName}
        onDocumentNameChange={setDocumentName}
        dimensions={doc.dimensions}
        onResolutionChange={handleResolutionChange}
        canUndo={historyStatus.canUndo}
        canRedo={historyStatus.canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onImportFile={handleImportFile}
        onExportPNG={() => setExportModal(true)}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(!showGrid)}
        showUVGuides={showUVGuides}
        onToggleUVGuides={() => setShowUVGuides(!showUVGuides)}
        mirrorHorizontal={mirrorHorizontal}
        onToggleMirror={() => setMirrorHorizontal(!mirrorHorizontal)}
      />

      {/* Main Workspace */}
      <main className="app-main">
        {/* Left Panel: Tools, HSV Triangle Color & Layers */}
        <aside className="left-panel">
          <ToolBar
            currentTool={currentTool}
            onSelectTool={(t) => {
              if (t !== 'move' && selectionState.isFloating) {
                commitFloatingSelection();
              }
              setCurrentTool(t);
            }}
            hasActiveSelection={Boolean(selectionState.rect || selectionState.isFloating)}
            onCopySelection={handleCopySelection}
            onCutSelection={handleCutSelection}
            onPasteSelection={handlePasteSelection}
            onFlipSelection={handleFlipSelection}
            onCancelSelection={commitFloatingSelection}
          />

          <ColorTrianglePicker
            currentColor={primaryColor}
            onColorChange={handleColorChange}
            recentColors={recentColors}
          />

          <LayerManager
            layers={doc.layers}
            activeLayerId={doc.activeLayerId}
            onSelectLayer={(id) => {
              doc.setActiveLayer(id);
              doc.notifyUpdate();
              setVersion((v) => v + 1);
            }}
            onAddLayer={() => {
              recordAction(() => {
                doc.addLayer();
              }, 'Nova Camada');
            }}
            onDeleteLayer={(id) => {
              if (doc.layers.length > 1) {
                recordAction(() => {
                  doc.deleteLayer(id);
                }, 'Excluir Camada');
              }
            }}
            onDuplicateLayer={(id) => {
              recordAction(() => {
                doc.duplicateLayer(id);
              }, 'Duplicar Camada');
            }}
            onToggleVisibility={(id) => {
              const layer = doc.layers.find((l) => l.id === id);
              if (layer) {
                recordAction(() => {
                  doc.setLayerVisibility(id, !layer.visible);
                }, layer.visible ? 'Ocultar Camada' : 'Exibir Camada');
              }
            }}
            onChangeOpacity={(id, op) => {
              doc.setLayerOpacity(id, op);
              doc.notifyUpdate();
              setVersion((v) => v + 1);
            }}
            onRenameLayer={(id, name) => {
              recordAction(() => {
                doc.renameLayer(id, name);
              }, 'Renomear Camada');
            }}
            onReorderLayer={(from, to) => {
              recordAction(() => {
                doc.reorderLayers(from, to);
              }, 'Reordenar Camadas');
            }}
          />
        </aside>

        {/* Center: 2D Canvas Pixel Editor */}
        <CanvasEditor
          document={doc}
          currentTool={currentTool}
          onSelectTool={setCurrentTool}
          primaryColor={primaryColor}
          onColorPick={handleColorChange}
          showGrid={showGrid}
          showUVGuides={showUVGuides}
          mirrorHorizontal={mirrorHorizontal}
          dimensions={doc.dimensions}
          onStartStroke={handleStartStroke}
          onCommitChange={commitChange}
          selectionState={selectionState}
          onUpdateSelection={setSelectionState}
          version={version}
        />

        {/* Right Panel: 3D Realtime Three.js Preview */}
        <Preview3DPanel document={doc} version={version} />
      </main>

      {/* Export Confirmation Modal */}
      {exportModal && (
        <div className="modal-overlay" onClick={() => setExportModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Exportar Textura de Capa</h3>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 12 }}>
                A textura será exportada como PNG limpo com preservação total de transparência (canal alfa) e sem guias de interface.
              </p>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                  Nome do arquivo:
                </label>
                <input
                  type="text"
                  className="hex-input"
                  style={{ width: '100%' }}
                  value={exportFilename}
                  onChange={(e) => setExportFilename(e.target.value)}
                />
              </div>
              <div
                style={{
                  background: 'var(--bg-tertiary)',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid var(--border-light)',
                  fontSize: '0.8rem',
                }}
              >
                <div>
                  Resolução:{' '}
                  <strong style={{ color: 'var(--accent-color)' }}>
                    {doc.dimensions.width} × {doc.dimensions.height} pixels
                  </strong>
                </div>
                <div>
                  Escala HD:{' '}
                  <strong style={{ color: 'var(--accent-color)' }}>
                    {doc.dimensions.scale}x ({doc.dimensions.isCustom ? 'Personalizada' : 'Padrão'})
                  </strong>
                </div>
                <div>
                  Camadas visíveis mescladas:{' '}
                  <strong>
                    {doc.layers.filter((l) => l.visible).length} de {doc.layers.length}
                  </strong>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setExportModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleConfirmExport}>
                Baixar PNG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warning / Notification Modal */}
      {warningModal?.isOpen && (
        <div className="modal-overlay" onClick={() => setWarningModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{warningModal.title}</h3>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 8 }}>{warningModal.message}</p>
              {warningModal.recommendation && (
                <p style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: 8 }}>
                  💡 {warningModal.recommendation}
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setWarningModal(null)}>
                OK, Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
