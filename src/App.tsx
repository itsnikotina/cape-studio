import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DocumentModel } from './core/DocumentModel';
import { HistoryManager } from './core/HistoryManager';
import { TextureImporter, type ImportValidationResult } from './core/TextureImporter';
import { TextureExporter } from './core/TextureExporter';
import { DrawingEngine, rgbaToHex } from './core/DrawingEngine';
import { AutoSaveManager, type AutoSaveStatus } from './core/AutoSaveManager';
import { deserializeDocument, type SerializedProject } from './core/ProjectStorage';
import type {
  ToolType,
  ColorRGBA,
  SelectionState,
  SelectionRect,
  HistoryEntry,
} from './types/editor';

interface ClipboardData {
  canvas: HTMLCanvasElement;
  originRect?: SelectionRect;
  isFullLayer: boolean;
}

interface ImportModalData {
  file: File;
  image: HTMLImageElement;
  validation: ImportValidationResult;
  hasUnsavedChanges: boolean;
}

import { Header } from './components/Header';
import { ToolBar } from './components/ToolBar';
import { ColorTrianglePicker } from './components/ColorTrianglePicker';
import { LayerManager } from './components/LayerManager';
import { CanvasEditor } from './components/CanvasEditor';
import { Preview3DPanel } from './components/Preview3DPanel';
import { RecoveryModal } from './components/RecoveryModal';

import './styles/app.css';

export const App: React.FC = () => {
  // Document and History
  const [doc] = useState(() => new DocumentModel(64, 32, 1));
  const historyRef = useRef<HistoryManager>(new HistoryManager(30));
  const [historyStatus, setHistoryStatus] = useState({ canUndo: false, canRedo: false });

  // Autosave and Recovery state
  const autoSaveManagerRef = useRef<AutoSaveManager>(new AutoSaveManager());
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>({
    type: 'idle',
    lastSavedAt: null,
    errorMessage: null,
    sequence: 0,
  });
  const [recoverableProject, setRecoverableProject] = useState<SerializedProject | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const hasUserModificationsRef = useRef(false);

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

  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
  const [importModal, setImportModal] = useState<ImportModalData | null>(null);

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

  // Check for auto-saved project on mount and subscribe to auto-save status
  useEffect(() => {
    const unsub = autoSaveManagerRef.current.subscribe(setAutoSaveStatus);
    autoSaveManagerRef.current.loadRecoverableProject().then((project) => {
      if (project && project.layers && project.layers.length > 0) {
        setRecoverableProject(project);
        setShowRecoveryModal(true);
      }
    });
    return () => unsub();
  }, []);

  // Flush pending auto-save before closing the tab or window
  useEffect(() => {
    const handleBeforeUnload = () => {
      // ONLY flush if the user actually modified the document in this session.
      // Protects saved projects against being overwritten by an empty document on accidental reload!
      if (hasUserModificationsRef.current) {
        autoSaveManagerRef.current.flush(doc, documentName);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [doc, documentName]);

  const handleRestoreProject = (project: SerializedProject) => {
    deserializeDocument(project, doc);
    setDocumentName(project.name || 'minha_capa');
    setExportFilename(project.name || 'minha_capa');
    historyRef.current.clear();
    historyRef.current.pushState(doc.createSnapshot('Projeto Restaurado'));
    hasUserModificationsRef.current = false;
    syncHistoryStatus();
    doc.notifyUpdate();
    setVersion((v) => v + 1);
    setShowRecoveryModal(false);
  };

  const handleNewProjectFromRecovery = () => {
    doc.resetDocument(64, 32, 1, false);
    historyRef.current.clear();
    historyRef.current.pushState(doc.createSnapshot('Documento Novo'));
    setDocumentName('minha_capa');
    setExportFilename('minha_capa');
    hasUserModificationsRef.current = false;
    syncHistoryStatus();
    setVersion((v) => v + 1);
    setShowRecoveryModal(false);
  };

  const handleCloseRecoveryModal = () => {
    setShowRecoveryModal(false);
    // Project remains safe in recoverableProject and IndexedDB
  };

  const handleClearAutoSave = async () => {
    await autoSaveManagerRef.current.clearRecoverableProject();
    setRecoverableProject(null);
    setShowRecoveryModal(false);
  };

  const handleDocumentNameChange = (name: string) => {
    setDocumentName(name);
    setExportFilename(name);
    hasUserModificationsRef.current = true;
    autoSaveManagerRef.current.scheduleSave(doc, name, 'Renomear');
  };

  // Commit changes to history
  const commitChange = useCallback((description = 'Modificação', colorUsed?: ColorRGBA) => {
    hasUserModificationsRef.current = true;
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
    autoSaveManagerRef.current.scheduleSave(doc, documentName, description);
  }, [doc, documentName, syncHistoryStatus, recordRecentColor]);

  // Helper for atomic actions outside drag drawing (layer operations, resize, import, etc.)
  const recordAction = useCallback((action: () => void, description = 'Modificação') => {
    hasUserModificationsRef.current = true;
    const before = doc.createSnapshot(description);
    action();
    historyRef.current.pushState(before);
    syncHistoryStatus();
    doc.notifyUpdate();
    setVersion((v) => v + 1);
    autoSaveManagerRef.current.scheduleSave(doc, documentName, description);
  }, [doc, documentName, syncHistoryStatus]);

  // Undo / Redo
  const handleUndo = useCallback(() => {
    const currentSnapshot = doc.createSnapshot('Current');
    const previous = historyRef.current.undo(currentSnapshot);
    if (previous) {
      hasUserModificationsRef.current = true;
      doc.restoreSnapshot(previous);
      syncHistoryStatus();
      doc.notifyUpdate();
      setVersion((v) => v + 1);
      autoSaveManagerRef.current.scheduleSave(doc, documentName, 'Desfazer');
    }
  }, [doc, documentName, syncHistoryStatus]);

  const handleRedo = useCallback(() => {
    const currentSnapshot = doc.createSnapshot('Current');
    const next = historyRef.current.redo(currentSnapshot);
    if (next) {
      hasUserModificationsRef.current = true;
      doc.restoreSnapshot(next);
      syncHistoryStatus();
      doc.notifyUpdate();
      setVersion((v) => v + 1);
      autoSaveManagerRef.current.scheduleSave(doc, documentName, 'Refazer');
    }
  }, [doc, documentName, syncHistoryStatus]);

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

  // PNG Import with confirmation and choice modal
  const handleImportFile = async (file: File) => {
    try {
      const { image, validation } = await TextureImporter.loadFromFile(file);
      const hasUnsavedChanges = historyStatus.canUndo || doc.layers.length > 1;
      setImportModal({
        file,
        image,
        validation,
        hasUnsavedChanges,
      });
    } catch (err: unknown) {
      setWarningModal({
        isOpen: true,
        title: 'Erro ao Importar Capa',
        message: err instanceof Error ? err.message : 'Falha ao processar arquivo PNG.',
      });
    }
  };

  // PNG Export
  const handleConfirmExport = async () => {
    await TextureExporter.downloadTexture(doc, exportFilename);
    setExportModal(false);
  };

  // Selection & Layer Clipboard actions
  const handleCopySelection = useCallback(() => {
    const activeLayer = doc.getActiveLayer();
    if (selectionState.rect) {
      const extracted = DrawingEngine.extractSelection(activeLayer.ctx, selectionState.rect, false);
      setClipboard({
        canvas: extracted,
        originRect: { ...selectionState.rect },
        isFullLayer: false,
      });
    } else {
      const fullCanvas = DrawingEngine.cloneCanvas(activeLayer.canvas);
      setClipboard({
        canvas: fullCanvas,
        originRect: { x: 0, y: 0, width: doc.dimensions.width, height: doc.dimensions.height },
        isFullLayer: true,
      });
    }
  }, [doc, selectionState.rect]);

  const handleCutSelection = useCallback(() => {
    const activeLayer = doc.getActiveLayer();
    if (selectionState.rect) {
      recordAction(() => {
        const extracted = DrawingEngine.extractSelection(activeLayer.ctx, selectionState.rect!, true);
        setClipboard({
          canvas: extracted,
          originRect: { ...selectionState.rect! },
          isFullLayer: false,
        });
        setSelectionState({
          rect: null,
          floatingCanvas: null,
          floatingX: 0,
          floatingY: 0,
          isFloating: false,
        });
      }, 'Recortar Seleção');
    } else {
      recordAction(() => {
        const fullCanvas = DrawingEngine.cloneCanvas(activeLayer.canvas);
        setClipboard({
          canvas: fullCanvas,
          originRect: { x: 0, y: 0, width: doc.dimensions.width, height: doc.dimensions.height },
          isFullLayer: true,
        });
        activeLayer.ctx.clearRect(0, 0, doc.dimensions.width, doc.dimensions.height);
      }, 'Recortar Camada');
    }
  }, [doc, selectionState.rect, recordAction]);

  const handlePasteSelection = useCallback(() => {
    if (!clipboard || !clipboard.canvas) return;

    const pasted = DrawingEngine.cloneCanvas(clipboard.canvas);
    const pasteX = clipboard.originRect && !clipboard.isFullLayer ? clipboard.originRect.x : 0;
    const pasteY = clipboard.originRect && !clipboard.isFullLayer ? clipboard.originRect.y : 0;

    setSelectionState({
      rect: {
        x: pasteX,
        y: pasteY,
        width: pasted.width,
        height: pasted.height,
      },
      floatingCanvas: pasted,
      floatingX: pasteX,
      floatingY: pasteY,
      isFloating: true,
    });
    setCurrentTool('move');
  }, [clipboard]);

  const handleFlipSelection = useCallback(() => {
    if (selectionState.isFloating && selectionState.floatingCanvas) {
      const flipped = DrawingEngine.flipHorizontally(selectionState.floatingCanvas);
      setSelectionState((prev) => ({
        ...prev,
        floatingCanvas: flipped,
      }));
      doc.notifyUpdate();
      setVersion((v) => v + 1);
    } else if (selectionState.rect) {
      recordAction(() => {
        const activeLayer = doc.getActiveLayer();
        const extracted = DrawingEngine.extractSelection(activeLayer.ctx, selectionState.rect!, true);
        const flipped = DrawingEngine.flipHorizontally(extracted);

        setSelectionState({
          rect: { ...selectionState.rect! },
          floatingCanvas: flipped,
          floatingX: selectionState.rect!.x,
          floatingY: selectionState.rect!.y,
          isFloating: true,
        });
      }, 'Espelhar Seleção');
    }
  }, [doc, selectionState, recordAction]);

  const commitFloatingSelection = useCallback(() => {
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
  }, [doc, selectionState, recordAction]);

  // Keyboard Shortcuts Refs for rock-solid event handling without stale closures
  const handleUndoRef = useRef(handleUndo);
  const handleRedoRef = useRef(handleRedo);
  const handleCopyRef = useRef(handleCopySelection);
  const handleCutRef = useRef(handleCutSelection);
  const handlePasteRef = useRef(handlePasteSelection);
  const commitFloatingRef = useRef(commitFloatingSelection);
  const currentToolRef = useRef(currentTool);
  const selectionStateRef = useRef(selectionState);
  const recordActionRef = useRef(recordAction);

  useEffect(() => {
    handleUndoRef.current = handleUndo;
    handleRedoRef.current = handleRedo;
    handleCopyRef.current = handleCopySelection;
    handleCutRef.current = handleCutSelection;
    handlePasteRef.current = handlePasteSelection;
    commitFloatingRef.current = commitFloatingSelection;
    currentToolRef.current = currentTool;
    selectionStateRef.current = selectionState;
    recordActionRef.current = recordAction;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in text inputs, textareas, selects, or contenteditable
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || target.isContentEditable) {
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

      // Arrow keys nudge when tool is 'move'
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && currentToolRef.current === 'move') {
        e.preventDefault();
        const step = e.shiftKey ? 4 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;

        if (selectionStateRef.current.rect) {
          recordActionRef.current(() => {
            const activeLayer = doc.getActiveLayer();
            const extracted = DrawingEngine.extractSelection(activeLayer.ctx, selectionStateRef.current.rect!, true);
            const newX = selectionStateRef.current.rect!.x + dx;
            const newY = selectionStateRef.current.rect!.y + dy;
            DrawingEngine.pasteSelection(activeLayer.ctx, extracted, newX, newY);
            setSelectionState({
              rect: { ...selectionStateRef.current.rect!, x: newX, y: newY },
              floatingCanvas: null,
              floatingX: 0,
              floatingY: 0,
              isFloating: false,
            });
          }, 'Mover Seleção');
        } else {
          recordActionRef.current(() => {
            const activeLayer = doc.getActiveLayer();
            DrawingEngine.moveLayer(activeLayer.ctx, doc.dimensions.width, doc.dimensions.height, dx, dy);
          }, 'Mover Camada');
        }
        return;
      }

      // Enter -> commit floating selection
      if (e.key === 'Enter') {
        if (selectionStateRef.current.isFloating) {
          e.preventDefault();
          commitFloatingRef.current();
          return;
        }
      }

      // Escape -> close any open modals first, or cancel/commit selection
      if (e.key === 'Escape') {
        if (showRecoveryModal) {
          setShowRecoveryModal(false);
          return;
        }
        if (exportModal) {
          setExportModal(false);
          return;
        }
        if (warningModal) {
          setWarningModal(null);
          return;
        }
        if (importModal) {
          setImportModal(null);
          return;
        }
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
  }, [doc, showRecoveryModal, exportModal, warningModal, importModal]);

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        documentName={documentName}
        onDocumentNameChange={handleDocumentNameChange}
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
        autoSaveStatus={autoSaveStatus}
        onClearAutoSave={handleClearAutoSave}
        hasRecoverableProject={Boolean(recoverableProject && !showRecoveryModal)}
        onOpenRecoveryModal={() => setShowRecoveryModal(true)}
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

      {/* Import Cape Modal */}
      {importModal && (
        <div className="modal-overlay" onClick={() => setImportModal(null)}>
          <div className="modal-card" style={{ width: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Importar Capa Existente</h3>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
                <div
                  style={{
                    width: 96,
                    height: 48,
                    borderRadius: 4,
                    border: '1px solid var(--border-light)',
                    background: '#0f172a',
                    backgroundImage: 'radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)',
                    backgroundSize: '8px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={importModal.image.src}
                    alt="Preview da capa"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      imageRendering: 'pixelated',
                    }}
                  />
                </div>
                <div style={{ flex: 1, fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {importModal.file.name}
                  </div>
                  <div>
                    Resolução detectada:{' '}
                    <strong style={{ color: 'var(--accent-color)' }}>
                      {importModal.validation.width} × {importModal.validation.height}
                    </strong>{' '}
                    ({importModal.validation.scale}x {importModal.validation.isStandardHD ? 'HD Padrão' : 'Personalizada'})
                  </div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: 2 }}>
                    Fundo transparente e pixels preservados sem suavização.
                  </div>
                </div>
              </div>

              {importModal.validation.warning && (
                <div
                  style={{
                    background: 'rgba(234, 179, 8, 0.1)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    borderRadius: 6,
                    padding: 8,
                    fontSize: '0.78rem',
                    color: '#facc15',
                    marginBottom: 14,
                  }}
                >
                  <div>⚠️ {importModal.validation.warning}</div>
                  {importModal.validation.recommendation && (
                    <div style={{ marginTop: 4, opacity: 0.9 }}>
                      💡 {importModal.validation.recommendation}
                    </div>
                  )}
                </div>
              )}

              {importModal.hasUnsavedChanges && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 6,
                    padding: 8,
                    fontSize: '0.78rem',
                    color: '#f87171',
                    marginBottom: 14,
                  }}
                >
                  ⚠️ A capa atual possui edições. Substituir a capa criará um novo documento com a resolução importada (você pode desfazer com Ctrl+Z).
                </div>
              )}

              <p style={{ fontSize: '0.82rem', marginBottom: 6 }}>
                Como deseja importar esta textura?
              </p>
            </div>
            <div className="modal-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => setImportModal(null)}>
                Cancelar
              </button>
              <button
                className="btn"
                onClick={() => {
                  const cleanName = importModal.file.name.replace(/\.[^/.]+$/, '');
                  recordAction(() => {
                    const newLayer = doc.addLayer(`Capa: ${cleanName}`);
                    newLayer.ctx.imageSmoothingEnabled = false;
                    newLayer.ctx.drawImage(importModal.image, 0, 0, doc.dimensions.width, doc.dimensions.height);
                  }, `Importar como camada: ${importModal.file.name}`);
                  setImportModal(null);
                }}
                title="Adiciona a imagem como uma nova camada acima das existentes"
              >
                Adicionar como Nova Camada
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const cleanName = importModal.file.name.replace(/\.[^/.]+$/, '');
                  recordAction(() => {
                    doc.setDimensions(
                      importModal.validation.width,
                      importModal.validation.height,
                      importModal.validation.scale,
                      !importModal.validation.isStandardHD
                    );
                    doc.layers = [];
                    const baseLayer = doc.createLayer('Capa Importada');
                    baseLayer.ctx.clearRect(0, 0, importModal.validation.width, importModal.validation.height);
                    baseLayer.ctx.drawImage(importModal.image, 0, 0);
                    doc.layers.push(baseLayer);
                    doc.activeLayerId = baseLayer.id;
                  }, `Importar capa: ${importModal.file.name}`);
                  setDocumentName(cleanName);
                  setExportFilename(cleanName);
                  setImportModal(null);
                }}
                title="Cria um novo documento com a resolução original da capa"
              >
                Substituir Capa Atual
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Centered Recovery Modal */}
      <RecoveryModal
        isOpen={showRecoveryModal}
        project={recoverableProject}
        onRestore={() => recoverableProject && handleRestoreProject(recoverableProject)}
        onNewProject={handleNewProjectFromRecovery}
        onClose={handleCloseRecoveryModal}
      />
    </div>
  );
};

export default App;
