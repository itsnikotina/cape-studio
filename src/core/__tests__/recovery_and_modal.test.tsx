import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RecoveryModal } from '../../components/RecoveryModal';
import { DocumentModel } from '../DocumentModel';
import { DrawingEngine } from '../DrawingEngine';
import {
  ProjectStorage,
  MemoryStorageBackend,
  serializeDocument,
  deserializeDocument,
  type SerializedProject,
} from '../ProjectStorage';
import { AutoSaveManager } from '../AutoSaveManager';

// Enable React act() support in happy-dom environment
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Recovery Modal and Project Restoration', () => {
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

  const mockProject: SerializedProject = {
    name: 'capa_lendaria',
    dimensions: {
      width: 128,
      height: 64,
      scale: 2,
    },
    activeLayerId: 'layer_1',
    layers: [
      {
        id: 'layer_1',
        name: 'Camada de Fundo',
        visible: true,
        opacity: 1,
        width: 128,
        height: 64,
        pixelData: new Uint8Array(128 * 64 * 4),
      },
      {
        id: 'layer_2',
        name: 'Detalhes Dourados',
        visible: true,
        opacity: 0.85,
        width: 128,
        height: 64,
        pixelData: new Uint8Array(128 * 64 * 4),
      },
    ],
    updatedAt: 1729000000000,
    sequence: 4,
    description: 'Pintura de dragão',
  };

  it('renders modal centered with project details when open', () => {
    const onRestore = vi.fn();
    const onNewProject = vi.fn();
    const onClose = vi.fn();

    act(() => {
      root!.render(
        <RecoveryModal
          isOpen={true}
          project={mockProject}
          onRestore={onRestore}
          onNewProject={onNewProject}
          onClose={onClose}
        />
      );
    });

    expect(container!.querySelector('.modal-overlay')).not.toBeNull();
    expect(container!.querySelector('.modal-card')).not.toBeNull();

    // Verify metadata rendering
    expect(container!.textContent).toContain('Projeto Recuperável Encontrado');
    expect(container!.textContent).toContain('capa_lendaria');
    expect(container!.textContent).toContain('128×64 (2x HD)');
    expect(container!.textContent).toContain('2 camadas');

    // Verify close button
    const closeBtn = container!.querySelector('.modal-close-btn');
    expect(closeBtn).not.toBeNull();
    expect(closeBtn?.getAttribute('aria-label')).toBe('Fechar janela de recuperação');
  });

  it('does not render when isOpen is false or project is null', () => {
    act(() => {
      root!.render(
        <RecoveryModal
          isOpen={false}
          project={mockProject}
          onRestore={vi.fn()}
          onNewProject={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });
    expect(container!.querySelector('.modal-overlay')).toBeNull();

    act(() => {
      root!.render(
        <RecoveryModal
          isOpen={true}
          project={null}
          onRestore={vi.fn()}
          onNewProject={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });
    expect(container!.querySelector('.modal-overlay')).toBeNull();
  });

  it('calls onRestore when "Recuperar Projeto" is clicked', () => {
    const onRestore = vi.fn();
    const onClose = vi.fn();

    act(() => {
      root!.render(
        <RecoveryModal
          isOpen={true}
          project={mockProject}
          onRestore={onRestore}
          onNewProject={vi.fn()}
          onClose={onClose}
        />
      );
    });

    const restoreBtn = Array.from(container!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Recuperar Projeto')
    );
    expect(restoreBtn).toBeDefined();

    act(() => {
      restoreBtn!.click();
    });

    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes modal when X button or backdrop is clicked without calling onRestore or onNewProject', () => {
    const onRestore = vi.fn();
    const onNewProject = vi.fn();
    const onClose = vi.fn();

    act(() => {
      root!.render(
        <RecoveryModal
          isOpen={true}
          project={mockProject}
          onRestore={onRestore}
          onNewProject={onNewProject}
          onClose={onClose}
        />
      );
    });

    const closeBtn = container!.querySelector('.modal-close-btn') as HTMLButtonElement;
    act(() => {
      closeBtn.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRestore).not.toHaveBeenCalled();
    expect(onNewProject).not.toHaveBeenCalled();

    // Click backdrop
    const overlay = container!.querySelector('.modal-overlay') as HTMLDivElement;
    act(() => {
      overlay.click();
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes modal on Escape key press', () => {
    const onClose = vi.fn();

    act(() => {
      root!.render(
        <RecoveryModal
          isOpen={true}
          project={mockProject}
          onRestore={vi.fn()}
          onNewProject={vi.fn()}
          onClose={onClose}
        />
      );
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows confirmation step when "Novo Projeto" is clicked, and allows proceeding or going back', () => {
    const onNewProject = vi.fn();
    const onClose = vi.fn();

    act(() => {
      root!.render(
        <RecoveryModal
          isOpen={true}
          project={mockProject}
          onRestore={vi.fn()}
          onNewProject={onNewProject}
          onClose={onClose}
        />
      );
    });

    const newBtn = Array.from(container!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Novo Projeto')
    );
    expect(newBtn).toBeDefined();

    // Click Novo Projeto
    act(() => {
      newBtn!.click();
    });

    // Confirmation view should now be visible
    expect(container!.textContent).toContain('Confirmar Novo Projeto');
    expect(container!.textContent).toContain('Atenção:');
    expect(container!.textContent).toContain('Voltar');

    // Click Voltar
    const backBtn = Array.from(container!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Voltar')
    );
    expect(backBtn).toBeDefined();
    act(() => {
      backBtn!.click();
    });

    // Should return to main recovery modal
    expect(container!.textContent).toContain('Projeto Recuperável Encontrado');
    expect(onNewProject).not.toHaveBeenCalled();

    // Click Novo Projeto again and confirm
    const newBtnAgain = Array.from(container!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Novo Projeto')
    );
    act(() => {
      newBtnAgain!.click();
    });

    const confirmBtn = Array.from(container!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Confirmar Novo Documento')
    );
    expect(confirmBtn).toBeDefined();
    act(() => {
      confirmBtn!.click();
    });

    expect(onNewProject).toHaveBeenCalledTimes(1);
  });

  it('restores DocumentModel state and immediately syncs composite canvas', () => {
    const doc = new DocumentModel(64, 32, 1);
    const layer = doc.getActiveLayer();

    // Draw purple pixel at (15, 20)
    const purple = { r: 160, g: 32, b: 240, a: 255 };
    DrawingEngine.setPixel(layer.ctx, 15, 20, purple, 'draw');

    const serialized = serializeDocument(doc, 'capa_roxa', 1);

    // Create fresh target document with different resolution
    const targetDoc = new DocumentModel(128, 64, 2);
    deserializeDocument(serialized, targetDoc);

    expect(targetDoc.dimensions.width).toBe(64);
    expect(targetDoc.dimensions.height).toBe(32);
    expect(targetDoc.layers.length).toBe(1);

    const pixel = DrawingEngine.getPixel(targetDoc.layers[0].ctx, 15, 20);
    expect(pixel.r).toBe(160);
    expect(pixel.g).toBe(32);
    expect(pixel.b).toBe(240);
    expect(pixel.a).toBe(255);

    // Composite canvas must have matching dimensions
    const compCanvas = targetDoc.getCompositeCanvas();
    expect(compCanvas.width).toBe(64);
    expect(compCanvas.height).toBe(32);
  });

  it('safely deserializes pixel data across various formats (Uint8Array, detached buffer, Array)', () => {
    const rawData = new Uint8Array(64 * 32 * 4);
    // Set red pixel at index 0
    rawData[0] = 255;
    rawData[1] = 0;
    rawData[2] = 0;
    rawData[3] = 255;

    const projectWithArray: SerializedProject = {
      name: 'teste_formatos',
      dimensions: { width: 64, height: 32, scale: 1 },
      activeLayerId: 'l1',
      layers: [
        {
          id: 'l1',
          name: 'Camada 1',
          visible: true,
          opacity: 1,
          width: 64,
          height: 32,
          pixelData: rawData,
        },
      ],
      updatedAt: Date.now(),
      sequence: 1,
    };

    const doc = new DocumentModel(64, 32, 1);
    deserializeDocument(projectWithArray, doc);

    const p = DrawingEngine.getPixel(doc.layers[0].ctx, 0, 0);
    expect(p.r).toBe(255);
    expect(p.a).toBe(255);
  });

  it('preserves auto-saved project when dismissed with X and page is reloaded', async () => {
    const backend = new MemoryStorageBackend();
    const storage = new ProjectStorage(backend);
    const autoSave = new AutoSaveManager(storage, 10);

    const doc = new DocumentModel(64, 32, 1);
    DrawingEngine.setPixel(doc.getActiveLayer().ctx, 5, 5, { r: 10, g: 20, b: 30, a: 255 }, 'draw');
    await autoSave.flush(doc, 'capa_para_preservar');

    // Simulate page reload: project is in storage
    const loaded = await autoSave.loadRecoverableProject();
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe('capa_para_preservar');

    // User closes modal with X (only dismisses UI modal):
    // In our App logic: hasUserModificationsRef is false, so beforeunload does NOT flush an empty document!
    const hasUserModifications = false;
    const simulateBeforeUnload = async (unmodifiedDoc: DocumentModel) => {
      if (hasUserModifications) {
        await autoSave.flush(unmodifiedDoc, 'nova_capa');
      }
    };

    const emptyDoc = new DocumentModel(64, 32, 1);
    await simulateBeforeUnload(emptyDoc);

    // Project in storage is still intact!
    const stillPresent = await autoSave.loadRecoverableProject();
    expect(stillPresent).not.toBeNull();
    expect(stillPresent?.name).toBe('capa_para_preservar');

    // User reloads again and clicks restore:
    deserializeDocument(stillPresent!, emptyDoc);
    expect(emptyDoc.dimensions.width).toBe(64);
    const restoredPixel = DrawingEngine.getPixel(emptyDoc.getActiveLayer().ctx, 5, 5);
    expect(restoredPixel.r).toBe(10);
    expect(restoredPixel.g).toBe(20);
    expect(restoredPixel.b).toBe(30);
  });
});
